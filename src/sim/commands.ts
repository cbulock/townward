import { BALANCE } from '../shared/balance';
import { BUILDINGS, footprintOrigin, type BuildingDef, type BuildingId } from './buildings/catalog';
import type { City } from './City';
import { ROAD_SPECS, roadSpec } from './roadTypes';
import { isUnlocked } from './stages';
import { DIRS, BridgeAxis, RoadType, type BridgeAxisId, type BuildableRoad, type TilePos } from './roads';
import { Decor, Terrain } from './terrain/types';
import type { World } from './World';
import { ZoneType, zoneOf, type ZoneTypeId } from './zones';

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
  /** One-way carriageways: travel direction (sim/roads.ts DIRS index). */
  lane?: number;
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
  reason?: 'nothing-to-do' | 'insufficient-funds' | 'locked';
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



/** Land a road can go on: not rock, no building. Existing roads count (they're kept or upgraded). */
function roadableLand(world: World, i: number): boolean {
  return !isWater(world, i) && world.terrain[i] !== Terrain.Rock && world.building[i] === -1;
}

/**
 * Check the water run that starts at path[k] (path[k − 1] is land). A bridge must start on
 * roadable land, be straight (every step, including the one back onto land, goes the same
 * way), land on roadable land within the path, span at most maxBridgeSpan tiles, and not
 * cross an existing bridge sideways. Otherwise it would be left dangling.
 */
function bridgeRunValid(world: World, path: readonly TilePos[], k: number): boolean {
  const start = path[k - 1];
  if (!world.inBounds(start.x, start.y) || !roadableLand(world, world.index(start.x, start.y))) return false;
  const dx = path[k].x - start.x;
  const dy = path[k].y - start.y;
  const axis = dx !== 0 ? BridgeAxis.X : BridgeAxis.Y;
  for (let j = k; j < path.length; j++) {
    const p = path[j];
    if (p.x - path[j - 1].x !== dx || p.y - path[j - 1].y !== dy) return false;
    if (!world.inBounds(p.x, p.y)) return false;
    const i = world.index(p.x, p.y);
    if (!isWater(world, i)) return j - k <= BALANCE.maxBridgeSpan && roadableLand(world, i);
    if (world.bridge[i] !== BridgeAxis.None && world.bridge[i] !== axis) return false;
  }
  return false; // path ends over water
}

/**
 * Price a road along `path`. Each tile is judged on its own (docs/specs/roads.md): rock,
 * buildings and the map edge block only their own tiles, and the rest of the drag still builds.
 * Water is crossed by straight bridges that start and end on roadable land; a crossing that
 * can't be bridged is blocked as a whole. The same or a bigger road is kept for free; a
 * smaller one is upgraded in place, paying the difference.
 *
 * Wide roads (boulevards, expressways) lay two rows from one straight drag: the dragged row
 * carries traffic in the drag's direction, the row on its left the other way (we drive on the
 * right). A step is built only where both rows can be, so no half carriageways are left.
 */
export function planRoad(world: World, path: readonly TilePos[], type: BuildableRoad): Plan {
  const spec = ROAD_SPECS[type];
  if (spec.width === 1) return planRow(world, path, type, -1);
  const a = path[0];
  const b = path[path.length - 1];
  const d = path.length < 2 ? 1 : b.x > a.x ? 1 : b.x < a.x ? 3 : b.y > a.y ? 2 : 0;
  const [lx, ly] = DIRS[(d + 3) % 4];
  const near = planRow(world, path, type, d);
  const far = planRow(
    world,
    path.map((p) => ({ x: p.x + lx, y: p.y + ly })),
    type,
    (d + 2) % 4,
  );
  // Pair the rows step by step (out-of-bounds steps are missing from a row).
  const farAt = new Map(far.tiles.map((t) => [`${t.x - lx},${t.y - ly}`, t]));
  const tiles: PlannedTile[] = [];
  let cost = 0;
  let count = 0;
  for (const t of near.tiles) {
    const f = farAt.get(`${t.x},${t.y}`);
    const both = t.valid && f !== undefined && f.valid;
    for (const p of f ? [t, f] : [t]) {
      tiles.push(both ? p : { ...p, valid: false, cost: 0 });
      if (both) {
        cost += p.cost;
        if (p.cost > 0) count++;
      }
    }
  }
  return { tiles, cost, count };
}

/** One row of road tiles (see planRoad). `lane` is the travel direction for one-way rows, −1 otherwise. */
function planRow(world: World, path: readonly TilePos[], type: BuildableRoad, lane: number): Plan {
  const tiles: PlannedTile[] = [];
  let cost = 0;
  let count = 0;
  const spec = ROAD_SPECS[type];
  const oneWay = lane >= 0 ? { lane } : {};
  /** Whether the water crossing we're in can be bridged; decided on entering it. */
  let crossingOk = false;
  for (let k = 0; k < path.length; k++) {
    const p = path[k];
    if (!world.inBounds(p.x, p.y)) continue;
    const i = world.index(p.x, p.y);
    const water = isWater(world, i);

    let bridge: BridgeAxisId = BridgeAxis.None;
    if (water) {
      const prev = k > 0 ? path[k - 1] : null;
      const prevI = prev && world.inBounds(prev.x, prev.y) ? world.index(prev.x, prev.y) : -1;
      if (prevI === -1 || !isWater(world, prevI)) crossingOk = prevI !== -1 && bridgeRunValid(world, path, k);
      if (crossingOk && prev) bridge = p.x !== prev.x ? BridgeAxis.X : BridgeAxis.Y;
    }
    if (water ? !crossingOk : !roadableLand(world, i)) {
      tiles.push({ ...p, valid: false, cost: 0 });
      continue;
    }

    const existing = roadSpec(world.road[i]);
    if (existing && existing.rank >= spec.rank) {
      tiles.push({ ...p, valid: true, cost: 0, ...(water && { bridge }) });
      continue;
    }
    const full = water ? spec.bridgeCost : spec.cost + clearCost(world, i);
    const c = existing ? Math.max(1, full - (water ? existing.bridgeCost : existing.cost)) : full;
    tiles.push({ ...p, valid: true, cost: c, ...(water && { bridge }), ...oneWay });
    cost += c;
    count++;
  }
  return { tiles, cost, count };
}

/** Build a planned road. `pave` is the footpath style picked in the road tool (World.pave; 0 = default). */
export function applyRoad(city: City, plan: Plan, type: BuildableRoad, pave = 0): ApplyResult {
  const w = city.world;
  // Tiles that already carry the road are listed with cost 0; every real change costs at least the road price.
  const real = plan.tiles.filter((t) => t.valid && t.cost > 0);
  if (real.length === 0) return { ok: false, reason: 'nothing-to-do' };
  if (plan.cost > city.funds) return { ok: false, reason: 'insufficient-funds' };
  for (const t of real) {
    const i = w.index(t.x, t.y);
    w.road[i] = type;
    w.bridge[i] = t.bridge ?? BridgeAxis.None;
    w.lane[i] = t.lane === undefined ? 0 : t.lane + 1;
    w.pave[i] = pave;
    w.tree[i] = 0;
    w.decor[i] = Decor.None;
    w.zone[i] = ZoneType.None;
  }
  city.funds -= plan.cost;
  return { ok: true, changed: bounds(real), tiles: real };
}

/** Price clearing a region: trees, decorations, roads, buildings and zones. Empty tiles are listed as invalid (no-op). */
export function planClear(world: World, region: readonly TilePos[]): Plan {
  const tiles: PlannedTile[] = [];
  let cost = 0;
  let count = 0;
  for (const p of region) {
    if (!world.inBounds(p.x, p.y)) continue;
    const i = world.index(p.x, p.y);
    const hasSomething =
      world.tree[i] > 0 ||
      world.decor[i] !== Decor.None ||
      world.road[i] !== RoadType.None ||
      world.building[i] !== -1 ||
      world.zone[i] !== ZoneType.None;
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
  const touched: TilePos[] = [...valid];
  for (const t of valid) {
    const i = w.index(t.x, t.y);
    w.tree[i] = 0;
    w.decor[i] = Decor.None;
    w.road[i] = RoadType.None;
    w.bridge[i] = BridgeAxis.None;
    w.lane[i] = 0;
    w.pave[i] = 0;
    // Clear is the one "remove" tool: zones go too (there's no separate Dezone, D-051).
    w.zone[i] = ZoneType.None;
    // Selecting any tile of a building removes the whole building.
    touched.push(...removeBuildingAt(w, i));
  }
  city.funds -= plan.cost;
  return { ok: true, changed: bounds(touched), tiles: valid };
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

export interface PlacePlan extends Plan {
  building: BuildingId;
  /** Footprint's top (north) tile. */
  origin: TilePos;
  /** Every footprint tile is valid. */
  ok: boolean;
}

/** Price placing `id` with its footprint centred on (cx, cy). Trees and decorations are auto-cleared. */
export function planPlace(world: World, id: BuildingId, cx: number, cy: number): PlacePlan {
  const def = BUILDINGS[id];
  const origin = footprintOrigin(id, cx, cy);
  const tiles: PlannedTile[] = [];
  let clearing = 0;
  let ok = true;
  for (let y = origin.y; y < origin.y + def.size.h; y++) {
    for (let x = origin.x; x < origin.x + def.size.w; x++) {
      if (!world.inBounds(x, y)) {
        ok = false;
        continue;
      }
      const i = world.index(x, y);
      const valid =
        !isWater(world, i) &&
        world.terrain[i] !== Terrain.Rock &&
        world.road[i] === RoadType.None &&
        world.building[i] === -1 &&
        // Buildings need a flat footprint (docs/specs/elevation.md).
        world.elevation[i] === world.elevation[world.index(origin.x, origin.y)];
      const c = valid ? clearCost(world, i) : 0;
      tiles.push({ x, y, valid, cost: c });
      clearing += c;
      if (!valid) ok = false;
    }
  }
  return { tiles, cost: def.cost + clearing, count: ok ? 1 : 0, building: id, origin, ok };
}

export function applyPlace(city: City, plan: PlacePlan, variant: number): ApplyResult {
  if (!plan.ok) return { ok: false, reason: 'nothing-to-do' };
  if (!isUnlocked(city, plan.building)) return { ok: false, reason: 'locked' };
  if (plan.cost > city.funds) return { ok: false, reason: 'insufficient-funds' };
  const w = city.world;
  const { size } = BUILDINGS[plan.building];
  for (const t of plan.tiles) {
    const i = w.index(t.x, t.y);
    w.tree[i] = 0;
    w.decor[i] = Decor.None;
    // Placed buildings never sit on a zone (only grown ones do).
    w.zone[i] = ZoneType.None;
  }
  w.addBuilding({ def: plan.building, x: plan.origin.x, y: plan.origin.y, variant }, size.w, size.h);
  city.funds -= plan.cost;
  return { ok: true, changed: bounds(plan.tiles), tiles: plan.tiles };
}

export interface MovePlan extends PlacePlan {
  /** The building being moved. */
  moving: number;
}

/** Can a building move here? Built buildings only, same rules as placing; its own tiles count as free. */
export function planMove(world: World, id: number, cx: number, cy: number): MovePlan | null {
  const b = world.buildings.get(id);
  if (!b) return null;
  const def = BUILDINGS[b.def];
  const origin = footprintOrigin(b.def, cx, cy);
  const tiles: PlannedTile[] = [];
  let clearing = 0;
  let ok = b.construction === 0 && (origin.x !== b.x || origin.y !== b.y);
  for (let y = origin.y; y < origin.y + def.size.h; y++) {
    for (let x = origin.x; x < origin.x + def.size.w; x++) {
      if (!world.inBounds(x, y)) {
        ok = false;
        continue;
      }
      const i = world.index(x, y);
      const occupant = world.building[i];
      const valid = !isWater(world, i) && world.terrain[i] !== Terrain.Rock && world.road[i] === RoadType.None && (occupant === -1 || occupant === id);
      const c = valid ? clearCost(world, i) : 0;
      tiles.push({ x, y, valid, cost: c });
      clearing += c;
      if (!valid) ok = false;
    }
  }
  const fee = Math.round(def.cost * BALANCE.moveCostShare);
  return { tiles, cost: fee + clearing, count: ok ? 1 : 0, building: b.def, origin, ok, moving: id };
}

/**
 * Move a building, keeping everything about it (residents, level, happiness, battery charge).
 * A grown home or business brings its zone along; the lot it leaves stays zoned, so something
 * new can grow there.
 */
export function applyMove(city: City, plan: MovePlan): ApplyResult {
  if (!plan.ok) return { ok: false, reason: 'nothing-to-do' };
  if (plan.cost > city.funds) return { ok: false, reason: 'insufficient-funds' };
  const w = city.world;
  const b = w.buildings.get(plan.moving);
  if (!b) return { ok: false, reason: 'nothing-to-do' };
  const def: BuildingDef = BUILDINGS[b.def];
  const from: TilePos[] = [
    { x: b.x, y: b.y },
    { x: b.x + def.size.w - 1, y: b.y + def.size.h - 1 },
  ];
  const zone = b.grown && def.zone && def.density ? zoneOf(def.zone, def.density) : ZoneType.None;
  for (const t of plan.tiles) {
    const i = w.index(t.x, t.y);
    w.tree[i] = 0;
    w.decor[i] = Decor.None;
    w.zone[i] = zone;
  }
  w.moveBuilding(b.id, plan.origin.x, plan.origin.y, def.size.w, def.size.h);
  city.funds -= plan.cost;
  return { ok: true, changed: bounds([...from, ...plan.tiles]), tiles: plan.tiles };
}

/** Remove the building covering tile `i`, if any. Returns its footprint corners for refresh bounds. */
function removeBuildingAt(w: World, i: number): TilePos[] {
  const b = w.buildings.get(w.building[i]);
  if (!b) return [];
  const { w: bw, h: bh } = BUILDINGS[b.def].size;
  w.removeBuilding(b.id, bw, bh);
  return [
    { x: b.x, y: b.y },
    { x: b.x + bw - 1, y: b.y + bh - 1 },
  ];
}

/**
 * Price zoning a region as `zone`. Valid tiles are the ones that change:
 * land without rock or road, not already this zone, and either empty or holding a grown building
 * (which rezoning or dezoning removes). See docs/specs/buildings.md, "Zoning".
 */
export function planZone(world: World, region: readonly TilePos[], zone: ZoneTypeId): Plan {
  const tiles: PlannedTile[] = [];
  let cost = 0;
  let count = 0;
  for (const p of region) {
    if (!world.inBounds(p.x, p.y)) continue;
    const i = world.index(p.x, p.y);
    const b = world.buildings.get(world.building[i]);
    const valid =
      world.zone[i] !== zone &&
      !isWater(world, i) &&
      world.terrain[i] !== Terrain.Rock &&
      world.road[i] === RoadType.None &&
      (b === undefined || b.grown);
    const c = valid && zone !== ZoneType.None ? BALANCE.zoneCost : 0;
    tiles.push({ ...p, valid, cost: c });
    if (valid) {
      cost += c;
      count++;
    }
  }
  return { tiles, cost, count };
}

export function applyZone(city: City, plan: Plan, zone: ZoneTypeId): ApplyResult {
  const valid = plan.tiles.filter((t) => t.valid);
  if (valid.length === 0) return { ok: false, reason: 'nothing-to-do' };
  if (plan.cost > city.funds) return { ok: false, reason: 'insufficient-funds' };
  const w = city.world;
  const touched: TilePos[] = [...valid];
  for (const t of valid) {
    const i = w.index(t.x, t.y);
    w.zone[i] = zone;
    touched.push(...removeBuildingAt(w, i));
  }
  city.funds -= plan.cost;
  return { ok: true, changed: bounds(touched), tiles: valid };
}
