import { BALANCE } from '../../shared/balance';
import { mulberry32, subSeed } from '../../shared/rng';
import type { City } from '../City';
import { AccessSystem, updateRoadAccess } from '../systems/access';
import { BudgetSystem } from '../systems/budget';
import { CommuteSystem } from '../systems/commute';
import { NeedsSystem } from '../systems/needs';
import { CoverageSystem, updateCoverage } from '../systems/coverage';
import { FireSystem } from '../systems/fire';
import { GrowthSystem } from '../systems/growth';
import { PopulationSystem } from '../systems/population';
import { TrafficSystem } from '../systems/traffic';
import { UtilitiesSystem, updateUtilities, type UtilityReport } from '../systems/utilities';
import type { World } from '../World';
import { emptyOutcome, type DayOutcome, type SimSystem, type WorldChange } from './System';

/** Salts for the systems' random streams (each system gets its own, so they never interfere). */
const SALT = { growth: 0x6077, fire: 0xf12e } as const;

/**
 * The simulation core (D-058): owns the systems and runs them in a fixed order.
 *   - after an edit:  access → utilities → coverage → commute (if roads changed) → needs → traffic
 *   - each day:       growth → fire → (the edit refresh) → commute → needs → population → traffic, plus budget at month end
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
  /** Run after any change to roads or buildings. */
  private readonly onChange: readonly SimSystem[];

  constructor(readonly city: City) {
    const world = city.world;
    this.access = new AccessSystem(world);
    this.utilities = new UtilitiesSystem(world);
    this.coverage = new CoverageSystem(world);
    this.growth = new GrowthSystem(city, mulberry32(subSeed(world.seed, SALT.growth)));
    this.fire = new FireSystem(world, mulberry32(subSeed(world.seed, SALT.fire)));
    this.population = new PopulationSystem(world);
    this.budget = new BudgetSystem(city);
    this.commute = new CommuteSystem(world);
    this.needs = new NeedsSystem(world, this.commute);
    this.traffic = new TrafficSystem(world, this.commute);
    this.onChange = [this.access, this.utilities, this.coverage, this.commute, this.needs, this.traffic];
  }

  get world(): World {
    return this.city.world;
  }

  /** Roads or buildings changed: bring every dependent system up to date. */
  worldChanged(change: WorldChange) {
    for (const s of this.onChange) s.onWorldChanged?.(change);
  }

  /** One in-game day. Returns what happened, for effects, toasts and refreshes. */
  day(): DayOutcome {
    const out = emptyOutcome();
    this.city.day++;
    this.growth.onDay(out);
    this.fire.onDay(out);
    this.worldChanged({ roads: false });
    this.commute.onDay();
    this.needs.onDay(out);
    this.population.onDay();
    this.traffic.onDay();
    if (this.city.day % BALANCE.daysPerMonth === 0) this.budget.onMonth(out);
    return out;
  }

  /** Every frame: `dt` in sim seconds, already scaled by game speed. */
  frame(dt: number) {
    this.city.clock += dt;
    this.traffic.onFrame(dt, this.city.hour);
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
