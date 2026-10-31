import { BALANCE } from '../shared/balance';
import type { City } from './City';
import { BridgeAxis, RoadType, type BridgeAxisId, type BuildableRoad, type TilePos } from './roads';
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
  /** Set for road tiles over water. */
  bridge?: BridgeAxisId;
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
  /** Tiles that changed, in plan order (drives build effects). */
  tiles?: readonly PlannedTile[];
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

function isWater(world: World, i: number): boolean {
  const t = world.terrain[i];
  return t === Terrain.DeepWater || t === Terrain.ShallowWater;
}

const ROAD_COST: Readonly<Record<BuildableRoad, number>> = {
  [RoadType.Road]: BALANCE.roadCost,
  [RoadType.Highway]: BALANCE.highwayCost,
};

const BRIDGE_COST: Readonly<Record<BuildableRoad, number>> = {
  [RoadType.Road]: BALANCE.bridgeCost,
  [RoadType.Highway]: BALANCE.highwayBridgeCost,
};

/**
 * Check the water run that starts at path[k] (path[k − 1] is land). A bridge must be
 * straight (every step, including the one back onto land, goes the same way), land on
 * the far shore within the path, and span at most maxBridgeSpan tiles.
 */
function bridgeRunValid(world: World, path: readonly TilePos[], k: number): boolean {
  const dx = path[k].x - path[k - 1].x;
  const dy = path[k].y - path[k - 1].y;
  for (let j = k; j < path.length; j++) {
    const p = path[j];
    if (p.x - path[j - 1].x !== dx || p.y - path[j - 1].y !== dy) return false;
    if (!world.inBounds(p.x, p.y)) return false;
    if (!isWater(world, world.index(p.x, p.y))) return j - k <= BALANCE.maxBridgeSpan;
  }
  return false; // path ends over water
}

/**
 * Price a road along `path`. Only the contiguous valid run from the start gets built
 * (docs/specs/roads.md): once a tile is blocked, everything after it is invalid too.
 * Water is crossed by straight bridges that start and end on land. Tiles that already
 * carry this road type (or a highway, when placing a road) are free and kept.
 */
export function planRoad(world: World, path: readonly TilePos[], type: BuildableRoad): Plan {
  const tiles: PlannedTile[] = [];
  let blocked = false;
  let cost = 0;
  let count = 0;
  for (let k = 0; k < path.length; k++) {
    const p = path[k];
    if (!world.inBounds(p.x, p.y)) {
      blocked = true;
      continue;
    }
    const i = world.index(p.x, p.y);
    const water = isWater(world, i);

    let bridge: BridgeAxisId = BridgeAxis.None;
    if (!blocked && water) {
      const prev = path[k - 1];
      const enteringWater = k > 0 && !isWater(world, world.index(prev.x, prev.y));
      if (k === 0 || (enteringWater && !bridgeRunValid(world, path, k))) blocked = true;
      else {
        bridge = p.x !== prev.x ? BridgeAxis.X : BridgeAxis.Y;
        // Can't run a road sideways across an existing bridge.
        if (world.bridge[i] !== BridgeAxis.None && world.bridge[i] !== bridge) blocked = true;
      }
    }
    if (blocked || world.terrain[i] === Terrain.Rock) {
      blocked = true;
      tiles.push({ ...p, valid: false, cost: 0 });
      continue;
    }

    const existing = world.road[i];
    // Never downgrade a highway to a road; same type is already built.
    if (existing === type || (existing === RoadType.Highway && type === RoadType.Road)) {
      tiles.push({ ...p, valid: true, cost: 0, ...(water && { bridge }) });
      continue;
    }
    const c = water ? BRIDGE_COST[type] : ROAD_COST[type] + clearCost(world, i);
    tiles.push({ ...p, valid: true, cost: c, ...(water && { bridge }) });
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
    w.bridge[i] = t.bridge ?? BridgeAxis.None;
    w.tree[i] = 0;
    w.decor[i] = Decor.None;
  }
  city.funds -= plan.cost;
  return { ok: true, changed: bounds(real), tiles: real };
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
    w.bridge[i] = BridgeAxis.None;
  }
  city.funds -= plan.cost;
  return { ok: true, changed: bounds(valid), tiles: valid };
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
