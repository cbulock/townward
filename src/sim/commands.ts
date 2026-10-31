import { BALANCE } from '../shared/balance';
import type { City } from './City';
import { RoadType, type BuildableRoad, type TilePos } from './roads';
import { Decor, Terrain } from './terrain/types';
import type { World } from './World';

/**
 * Every world mutation goes through a plan → apply pair (docs/decisions.md D-014).
 * `plan*` is pure: it validates and prices, and drives the tool preview.
 * `apply*` re-checks funds and mutates.
 */

export interface PlannedTile extends TilePos {
  /** Whether this tile will actually be changed. */
  valid: boolean;
  cost: number;
}

export interface Plan {
  tiles: PlannedTile[];
  /** Total cost of the valid tiles. */
  cost: number;
  /** Number of tiles that will change. */
  count: number;
}

export interface ApplyResult {
  ok: boolean;
  reason?: 'nothing-to-do' | 'insufficient-funds';
  /** Bounding box of changed tiles, for render refresh. */
  changed?: { minX: number; minY: number; maxX: number; maxY: number };
}

/** Cost of clearing trees and decorations from tile `i`. */
export function clearCost(world: World, i: number): number {
  let cost = world.tree[i] * BALANCE.treeClearCost;
  const d = world.decor[i];
  if (d === Decor.Rocks) cost += BALANCE.rocksClearCost;
  else if (d === Decor.Boulder) cost += BALANCE.boulderClearCost;
  else if (d !== Decor.None) cost += BALANCE.minorDecorClearCost;
  return cost;
}

/** Whether a road can sit on this terrain. Bridges come later. */
function roadable(world: World, i: number): boolean {
  const t = world.terrain[i];
  return t !== Terrain.DeepWater && t !== Terrain.ShallowWater && t !== Terrain.Rock;
}

const ROAD_COST: Readonly<Record<BuildableRoad, number>> = {
  [RoadType.Road]: BALANCE.roadCost,
  [RoadType.Highway]: BALANCE.highwayCost,
};

/**
 * Price a road along `path`. Only the contiguous valid run from the start gets built
 * (docs/specs/roads.md): once a tile is blocked, everything after it is invalid too.
 * Tiles that already carry this road type (or a highway, when placing a road) are free and kept.
 */
export function planRoad(world: World, path: readonly TilePos[], type: BuildableRoad): Plan {
  const tiles: PlannedTile[] = [];
  let blocked = false;
  let cost = 0;
  let count = 0;
  for (const p of path) {
    if (!world.inBounds(p.x, p.y)) {
      blocked = true;
      continue;
    }
    const i = world.index(p.x, p.y);
    if (blocked || !roadable(world, i)) {
      blocked = true;
      tiles.push({ ...p, valid: false, cost: 0 });
      continue;
    }
    const existing = world.road[i];
    // Never downgrade a highway to a road; same type is already built.
    if (existing === type || (existing === RoadType.Highway && type === RoadType.Road)) {
      tiles.push({ ...p, valid: true, cost: 0 });
      continue;
    }
    const c = ROAD_COST[type] + clearCost(world, i);
    tiles.push({ ...p, valid: true, cost: c });
    cost += c;
    count++;
  }
  return { tiles, cost, count };
}

export function applyRoad(city: City, plan: Plan, type: BuildableRoad): ApplyResult {
  const w = city.world;
  // Tiles that already carry the road are listed with cost 0; every real change costs at least the road price.
  const real = plan.tiles.filter((t) => t.valid && t.cost > 0);
  if (real.length === 0) return { ok: false, reason: 'nothing-to-do' };
  if (plan.cost > city.funds) return { ok: false, reason: 'insufficient-funds' };
  for (const t of real) {
    const i = w.index(t.x, t.y);
    w.road[i] = type;
    w.tree[i] = 0;
    w.decor[i] = Decor.None;
  }
  city.funds -= plan.cost;
  return { ok: true, changed: bounds(real) };
}

/** Price clearing a region: trees, decorations and roads. Empty tiles are listed as invalid (no-op). */
export function planClear(world: World, region: readonly TilePos[]): Plan {
  const tiles: PlannedTile[] = [];
  let cost = 0;
  let count = 0;
  for (const p of region) {
    if (!world.inBounds(p.x, p.y)) continue;
    const i = world.index(p.x, p.y);
    const hasSomething = world.tree[i] > 0 || world.decor[i] !== Decor.None || world.road[i] !== RoadType.None;
    const c = hasSomething ? clearCost(world, i) : 0;
    tiles.push({ ...p, valid: hasSomething, cost: c });
    if (hasSomething) {
      cost += c;
      count++;
    }
  }
  return { tiles, cost, count };
}

export function applyClear(city: City, plan: Plan): ApplyResult {
  const valid = plan.tiles.filter((t) => t.valid);
  if (valid.length === 0) return { ok: false, reason: 'nothing-to-do' };
  if (plan.cost > city.funds) return { ok: false, reason: 'insufficient-funds' };
  const w = city.world;
  for (const t of valid) {
    const i = w.index(t.x, t.y);
    w.tree[i] = 0;
    w.decor[i] = Decor.None;
    w.road[i] = RoadType.None;
  }
  city.funds -= plan.cost;
  return { ok: true, changed: bounds(valid) };
}

function bounds(tiles: readonly TilePos[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const t of tiles) {
    minX = Math.min(minX, t.x);
    minY = Math.min(minY, t.y);
    maxX = Math.max(maxX, t.x);
    maxY = Math.max(maxY, t.y);
  }
  return { minX, minY, maxX, maxY };
}
