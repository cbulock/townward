import { BALANCE } from '../../shared/balance';
import { SIM_TICK_HZ } from '../../shared/constants';
import { RandomStream, subSeed } from '../../shared/rng';
import type { City } from '../City';
import { AccessSystem, updateRoadAccess } from '../systems/access';
import { BudgetSystem } from '../systems/budget';
import { CommuteSystem } from '../systems/commute';
import { NeedsSystem } from '../systems/needs';
import { CoverageSystem, updateCoverage } from '../systems/coverage';
import { FireSystem } from '../systems/fire';
import { GarbageSystem } from '../systems/garbage';
import { LifestyleSystem } from '../systems/lifestyle';
import { stageFor } from '../stages';
import { GrowthSystem } from '../systems/growth';
import { cityStats, PopulationSystem } from '../systems/population';
import { TrafficSystem } from '../systems/traffic';
import { UtilitiesSystem, updateUtilities, type UtilityReport } from '../systems/utilities';
import type { World } from '../World';
import { emptyOutcome, type DayOutcome, type SimSystem, type WorldChange } from './System';
import { SystemTimings } from './timings';

/** A calendar day every this many ticks. */
export const TICKS_PER_DAY = BALANCE.secondsPerDay * SIM_TICK_HZ;

/** Salts for the systems' random streams (each system gets its own, so they never interfere). */
const SALT = { growth: 0x6077, fire: 0xf12e } as const;

/**
 * The simulation core (D-058): owns the systems and runs them in a fixed order.
 *   - after an edit:  access → utilities → coverage → commute (if roads changed) → needs → traffic
 *   - each day:       stage → growth → fire → (the edit refresh) → garbage → commute → needs → lifestyle → population → traffic,
 *                     plus budget (then the garbage month reset) at month end
 *   - each frame:     the clock and traffic
 * The game layer only calls these entry points and shows the outcome.
 */
export class Simulation {
  readonly access: AccessSystem;
  readonly utilities: UtilitiesSystem;
  readonly coverage: CoverageSystem;
  readonly growth: GrowthSystem;
  readonly fire: FireSystem;
  readonly population: PopulationSystem;
  readonly budget: BudgetSystem;
  readonly commute: CommuteSystem;
  readonly needs: NeedsSystem;
  readonly traffic: TrafficSystem;
  readonly garbage: GarbageSystem;
  readonly lifestyle: LifestyleSystem;
  /** Run after any change to roads or buildings. */
  private readonly onChange: readonly SimSystem[];
  /** Random streams whose state is saved, so a loaded city continues exactly (sim/save.ts). */
  readonly streams: { readonly growth: RandomStream; readonly fire: RandomStream };
  /** Time per system and hook (F3 overlay, `bun run sim:run`). */
  readonly timings = new SystemTimings();
  readonly city: City;

  constructor(city: City) {
    this.city = city;
    const world = city.world;
    this.access = new AccessSystem(world);
    this.utilities = new UtilitiesSystem(world, () => ({ hour: Math.floor(city.hour), day: city.day, seed: world.seed, step: false }));
    this.coverage = new CoverageSystem(world);
    // Mixing in the day means a loaded city doesn't replay the events of day 0 (identical for new cities).
    const seed = world.seed ^ city.day;
    this.streams = { growth: new RandomStream(subSeed(seed, SALT.growth)), fire: new RandomStream(subSeed(seed, SALT.fire)) };
    this.growth = new GrowthSystem(city, this.streams.growth.next);
    this.fire = new FireSystem(world, this.streams.fire.next);
    this.population = new PopulationSystem(world);
    this.budget = new BudgetSystem(city);
    this.commute = new CommuteSystem(world);
    this.needs = new NeedsSystem(world, this.commute, () => city.stage);
    this.traffic = new TrafficSystem(world, this.commute);
    this.garbage = new GarbageSystem(city);
    this.lifestyle = new LifestyleSystem(city);
    this.onChange = [this.access, this.utilities, this.coverage, this.commute, this.needs, this.traffic];
  }

  get world(): World {
    return this.city.world;
  }

  /** Roads or buildings changed: bring every dependent system up to date. */
  worldChanged(change: WorldChange) {
    for (const s of this.onChange) if (s.onWorldChanged) this.timings.run(`${s.name}.change`, () => s.onWorldChanged?.(change));
  }

  /** One in-game day. Returns what happened, for effects, toasts and refreshes. */
  day(): DayOutcome {
    const out = emptyOutcome();
    const t = this.timings;
    this.city.day++;
    this.climbStage(out);
    t.run('growth.day', () => this.growth.onDay(out));
    t.run('fire.day', () => this.fire.onDay(out));
    t.run('utilities.day', () => this.utilities.onDay?.());
    this.worldChanged({ roads: false });
    t.run('garbage.day', () => this.garbage.onDay());
    t.run('commute.day', () => this.commute.onDay());
    t.run('needs.day', () => this.needs.onDay(out));
    t.run('lifestyle.day', () => this.lifestyle.onDay(out));
    t.run('population.day', () => this.population.onDay());
    t.run('traffic.day', () => this.traffic.onDay());
    if (this.city.day % BALANCE.daysPerMonth === 0) {
      t.run('budget.month', () => this.budget.onMonth(out));
      t.run('garbage.month', () => this.garbage.onMonth());
    }
    return out;
  }

  /** The city reaches the stage its population allows; stages never go back down (D-086). */
  private climbStage(out: DayOutcome) {
    const reached = stageFor(cityStats(this.world).population);
    if (reached <= this.city.stage) return;
    this.city.stage = reached;
    out.stage = reached;
  }

  /**
   * One fixed tick (1 / SIM_TICK_HZ sim seconds): advances the clock, runs the hourly work on
   * each clock-hour boundary, and a whole day every TICKS_PER_DAY ticks. The only way sim time
   * moves (D-068). Returns the day's outcome when a day ran.
   */
  tick(): DayOutcome | null {
    const before = Math.floor(this.city.hour);
    this.city.ticks++;
    const hour = Math.floor(this.city.hour);
    if (hour !== before) this.timings.run('utilities.hour', () => this.utilities.onHour(hour, this.city.day));
    return this.city.ticks % TICKS_PER_DAY === 0 ? this.day() : null;
  }

  /** Run whole days through tick(), as the game does (harness, tests). */
  runDays(days: number) {
    for (let t = 0; t < days * TICKS_PER_DAY; t++) this.tick();
  }

  /** Every frame, for the visible agents only: `dt` in sim seconds, already scaled by game speed. */
  frame(dt: number) {
    this.timings.run('traffic.frame', () => this.traffic.onFrame(dt, this.city.hour));
  }
}

/**
 * Bring access, utilities and coverage up to date without a Simulation (tests, the demo
 * builder). Same order as Simulation.worldChanged, minus traffic.
 */
export function refreshCity(world: World): UtilityReport {
  updateRoadAccess(world);
  const report = updateUtilities(world);
  updateCoverage(world);
  return report;
}
