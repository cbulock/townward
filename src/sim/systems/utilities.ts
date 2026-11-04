import { BUILDINGS, buildingDef, type BuildingDef, type BuildingInstance } from '../buildings/catalog';
import { roadMask, RoadType } from '../roads';
import { World } from '../World';
import { balancePower, plantOutput, type GridHour, type PowerReport } from './energy';
import type { SimSystem } from '../core/System';

/**
 * Utilities system: power plants and water towers supply the buildings whose entrance is on
 * the same road island, in building order, until their capacity runs out. No pipes or lines
 * (docs/specs/core.md, D-052). Results are stored on each building (`powered`, `watered`).
 */

export interface UtilityTotals {
  supply: number;
  demand: number;
  /** Buildings that need it but don't get it. */
  short: number;
}

export interface UtilityReport {
  power: PowerReport;
  water: UtilityTotals;
}

/** Civic buildings run themselves; everyone else needs power and water to have occupants. */
export function needsUtilities(def: BuildingDef): boolean {
  return def.category !== 'civic';
}

/** Has the power and water it needs (civic buildings need none). */
export function hasUtilities(b: BuildingInstance): boolean {
  return !needsUtilities(BUILDINGS[b.def]) || (b.powered && b.watered);
}

/** Finished and connected: a service or utility building is working. */
export function isWorking(b: BuildingInstance): boolean {
  return b.construction === 0 && b.entrance !== -1 && b.repairDays === 0 && b.condition > 0;
}

function isSubstation(b: BuildingInstance): boolean {
  const def: BuildingDef = BUILDINGS[b.def];
  return def.substation !== undefined;
}

function powerNetwork(buildings: readonly BuildingInstance[], islands: Int32Array) {
  const substations = buildings.filter((b) => isSubstation(b) && isWorking(b));
  if (substations.length === 0) return () => true;
  const islandOf = (b: BuildingInstance) => (b.entrance === -1 ? -1 : islands[b.entrance]);
  return (b: BuildingInstance): boolean => {
    const def: BuildingDef = BUILDINGS[b.def];
    // Plants feed the shared grid from wherever they are built. Consumers still
    // need road access and a substation within their coverage radius.
    if (def.energy) return isWorking(b);
    const island = islandOf(b);
    if (island === -1) return false;
    const size = def.size;
    const cx = b.x + size.w / 2;
    const cy = b.y + size.h / 2;
    return substations.some((s) => {
      const substationDef: BuildingDef = BUILDINGS[s.def];
      const radius = substationDef.substation?.radius ?? 0;
      return Math.hypot(s.x + 0.5 - cx, s.y + 0.5 - cy) <= radius;
    });
  };
}

/**
 * Apply one day's maintenance wear and progress existing repairs. A plant wears when the grid
 * as a whole runs above its safe share: demand against every working plant's *full* output
 * (docs/specs/energy.md). Comparing against one plant's output, as before, wore every plant
 * in a city with more than one, and derated output fed back into the load (a death spiral).
 */
function maintainPlants(world: World, report: UtilityReport) {
  let capacity = 0;
  for (const b of world.buildings.values()) {
    const d = buildingDef(b.def);
    if (d.energy && d.energy.source !== 'battery' && isWorking(b)) capacity += plantOutput(d, null);
  }
  const load = capacity === 0 ? 0 : report.power.demand / capacity;
  for (const b of world.buildings.values()) {
    const energy = buildingDef(b.def).energy;
    if (!energy || energy.source === 'battery' || b.construction > 0 || b.entrance === -1) continue;
    if (b.repairDays > 0) {
      b.repairDays--;
      if (b.repairDays === 0) b.condition = 1;
      continue;
    }
    if (load > (energy.overload ?? 0.9)) {
      b.condition = Math.max(0, b.condition - 0.04 * Math.min(2, load));
      if (b.condition <= 0) {
        b.condition = 0;
        b.repairDays = 3;
      }
    } else {
      b.condition = Math.min(1, b.condition + 0.01);
    }
  }
}

/** Road islands: tiles reachable from each other along connected road pieces share a label (−1 = no road). */
export function roadIslands(world: World): Int32Array {
  const n = world.width * world.height;
  const label = new Int32Array(n).fill(-1);
  const stack: number[] = [];
  let next = 0;
  for (let start = 0; start < n; start++) {
    if (world.road[start] === RoadType.None || label[start] !== -1) continue;
    label[start] = next;
    stack.push(start);
    while (stack.length > 0) {
      const i = stack.pop()!;
      const x = i % world.width;
      const y = (i - x) / world.width;
      const m = roadMask(world, x, y);
      const links: [number, number, number][] = [
        [1, 0, -1],
        [2, 1, 0],
        [4, 0, 1],
        [8, -1, 0],
      ];
      for (const [bit, dx, dy] of links) {
        if (!(m & bit)) continue;
        const j = world.index(x + dx, y + dy);
        if (label[j] !== -1) continue;
        label[j] = next;
        stack.push(j);
      }
    }
    next++;
  }
  return label;
}

/**
 * Recompute power and water for every building. Call after building or road changes. Power is
 * balanced for the given hour (sim/systems/energy.ts), or for the peak without one.
 */
export function updateUtilities(world: World, at: GridHour | null = null): UtilityReport {
  const buildings = [...world.buildings.values()].sort((a, b) => a.id - b.id);
  const islands = roadIslands(world);
  const islandOf = (b: BuildingInstance) => (b.entrance === -1 ? -1 : islands[b.entrance]);
  const needs = (b: BuildingInstance) => needsUtilities(BUILDINGS[b.def]);
  const powerConnected = powerNetwork(buildings, islands);
  const sharedGrid = buildings.some((b) => isSubstation(b) && isWorking(b));
  const powerIslandOf = sharedGrid ? () => 0 : islandOf;

  const power = balancePower(buildings, powerIslandOf, needs, isWorking, at, powerConnected);

  // Water: supply pooled per road island, handed out in building order.
  const pool = new Map<number, number>();
  for (const b of buildings) {
    const supply = buildingDef(b.def).supplies?.water;
    if (supply && isWorking(b)) pool.set(islandOf(b), (pool.get(islandOf(b)) ?? 0) + supply);
  }
  const water: UtilityTotals = { supply: [...pool.values()].reduce((a, v) => a + v, 0), demand: 0, short: 0 };
  for (const b of buildings) {
    if (!needs(b)) {
      b.watered = true;
      continue;
    }
    const need = BUILDINGS[b.def].capacity;
    water.demand += need;
    const island = islandOf(b);
    const left = pool.get(island) ?? 0;
    b.watered = island !== -1 && left >= need;
    if (b.watered) pool.set(island, left - need);
    else water.short++;
  }
  return { power, water };
}

/**
 * Keeps power and water up to date and holds the latest totals for the HUD. After edits and
 * each day it balances at the current hour; on each clock hour it also moves battery charge.
 */
export class UtilitiesSystem implements SimSystem {
  readonly name = 'utilities';
  report: UtilityReport = updateUtilities(new World(1, 1, 0));
  private readonly world: World;
  /** The current hour, without battery steps (null: no clock, use the peak). */
  private readonly now: () => GridHour | null;

  constructor(world: World, now: () => GridHour | null = () => null) {
    this.world = world;
    this.now = now;
  }

  onWorldChanged() {
    this.report = updateUtilities(this.world, this.now());
  }

  onDay() {
    maintainPlants(this.world, this.report);
    this.report = updateUtilities(this.world, this.now());
  }

  /** A new clock hour: move battery charge and re-balance. */
  onHour(hour: number, day: number) {
    this.report = updateUtilities(this.world, { hour, day, seed: this.world.seed, step: true });
  }
}
