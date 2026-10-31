import { BUILDINGS, type BuildingDef, type BuildingInstance } from '../buildings/catalog';
import { roadMask, RoadType } from '../roads';
import type { World } from '../World';
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
  power: UtilityTotals;
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
  return b.construction === 0 && b.entrance !== -1;
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

/** Recompute power and water for every building. Call after building or road changes. */
export function updateUtilities(world: World): UtilityReport {
  const buildings = [...world.buildings.values()].sort((a, b) => a.id - b.id);

  // Utilities: supply pooled per road island, handed out in building order.
  const islands = roadIslands(world);
  const power = new Map<number, number>();
  const water = new Map<number, number>();
  for (const b of buildings) {
    const d: BuildingDef = BUILDINGS[b.def];
    if (!d.supplies || !isWorking(b)) continue;
    const island = islands[b.entrance];
    if (d.supplies.power) power.set(island, (power.get(island) ?? 0) + d.supplies.power);
    if (d.supplies.water) water.set(island, (water.get(island) ?? 0) + d.supplies.water);
  }
  const report: UtilityReport = {
    power: { supply: [...power.values()].reduce((a, v) => a + v, 0), demand: 0, short: 0 },
    water: { supply: [...water.values()].reduce((a, v) => a + v, 0), demand: 0, short: 0 },
  };
  for (const b of buildings) {
    const d: BuildingDef = BUILDINGS[b.def];
    if (!needsUtilities(d)) {
      b.powered = true;
      b.watered = true;
      continue;
    }
    const need = d.capacity;
    const island = b.entrance === -1 ? -1 : islands[b.entrance];
    const take = (pool: Map<number, number>, totals: UtilityTotals): boolean => {
      totals.demand += need;
      const left = pool.get(island) ?? 0;
      if (island !== -1 && left >= need) {
        pool.set(island, left - need);
        return true;
      }
      totals.short++;
      return false;
    };
    b.powered = take(power, report.power);
    b.watered = take(water, report.water);
  }
  return report;
}

/** Keeps power and water up to date and holds the latest totals for the HUD. */
export class UtilitiesSystem implements SimSystem {
  readonly name = 'utilities';
  report: UtilityReport = { power: { supply: 0, demand: 0, short: 0 }, water: { supply: 0, demand: 0, short: 0 } };
  constructor(private readonly world: World) {}
  onWorldChanged() {
    this.report = updateUtilities(this.world);
  }
}
