import { BALANCE } from '../shared/balance';
import { BUILDINGS, SERVICE_KINDS, type BuildingDef, type BuildingInstance, type ServiceKind } from './buildings/catalog';
import { roadMask, RoadType } from './roads';
import type { World } from './World';

/**
 * Services and utilities (docs/specs/core.md).
 *   - Coverage: each working service building (finished, with road access) covers a circle.
 *   - Utilities: power plants and water towers supply the buildings whose entrance is on the
 *     same road network, in building order, until their capacity runs out. No pipes or lines.
 * Results are stored on each building (`powered`, `watered`, `services`) and summarised for the UI.
 */

export interface UtilityTotals {
  supply: number;
  demand: number;
  /** Buildings that need it but don't get it. */
  short: number;
}

export interface ServiceReport {
  power: UtilityTotals;
  water: UtilityTotals;
}

export function serviceBit(kind: ServiceKind): number {
  return 1 << SERVICE_KINDS.indexOf(kind);
}

/** How many services cover a building (0–4). */
export function serviceScore(b: BuildingInstance): number {
  let n = 0;
  for (let m = b.services; m; m >>= 1) n += m & 1;
  return n;
}

/** Occupancy multiplier from services: 70% with none, 100% with all four. */
export function serviceFactor(b: BuildingInstance): number {
  return BALANCE.serviceBase + BALANCE.serviceStep * serviceScore(b);
}

/** Civic buildings run themselves; everyone else needs power and water to have occupants. */
export function needsUtilities(def: BuildingDef): boolean {
  return def.category !== 'civic';
}

function isWorking(b: BuildingInstance): boolean {
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

/** Recompute coverage and utility supply for every building. Call after building changes and daily. */
export function updateServices(world: World): ServiceReport {
  const buildings = [...world.buildings.values()].sort((a, b) => a.id - b.id);

  // Coverage: a circle of `radius` tiles around each working service building's footprint centre.
  const coverage = new Map<ServiceKind, { x: number; y: number; r2: number }[]>(SERVICE_KINDS.map((k) => [k, []]));
  for (const b of buildings) {
    const d: BuildingDef = BUILDINGS[b.def];
    if (!d.service || !d.radius || !isWorking(b)) continue;
    coverage.get(d.service)?.push({ x: b.x + d.size.w / 2, y: b.y + d.size.h / 2, r2: d.radius * d.radius });
  }
  for (const b of buildings) {
    const d: BuildingDef = BUILDINGS[b.def];
    const cx = b.x + d.size.w / 2;
    const cy = b.y + d.size.h / 2;
    let mask = 0;
    SERVICE_KINDS.forEach((k, bit) => {
      if (coverage.get(k)?.some((c) => (c.x - cx) ** 2 + (c.y - cy) ** 2 <= c.r2)) mask |= 1 << bit;
    });
    b.services = mask;
  }

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
  const report: ServiceReport = {
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

/**
 * Daily fire roll: once the city has BALANCE.firePopulation residents, each finished zoned
 * building outside fire coverage may burn down. The lot is cleared and the zone stays, so it
 * regrows. Returns what burned (already removed from the world).
 */
export function rollFires(world: World, population: number, rng: () => number): BuildingInstance[] {
  if (population < BALANCE.firePopulation) return [];
  const fire = serviceBit('fire');
  const burned: BuildingInstance[] = [];
  for (const b of [...world.buildings.values()]) {
    const d: BuildingDef = BUILDINGS[b.def];
    if (d.category === 'civic' || b.construction > 0 || b.services & fire) continue;
    if (rng() >= BALANCE.fireChance) continue;
    world.removeBuilding(b.id, d.size.w, d.size.h);
    burned.push(b);
  }
  return burned;
}
