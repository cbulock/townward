import { BALANCE } from '../../shared/balance';
import { BUILDINGS, type BuildingInstance } from '../buildings/catalog';
import { BridgeAxis, RoadType } from '../roads';
import type { World } from '../World';
import type { SimSystem } from '../core/System';

/**
 * Access system: which road tile each building uses as its entrance (within
 * BALANCE.roadAccessRange). Everything else (utilities, traffic, growth) starts from this.
 * See docs/specs/simulation.md, "Road Access".
 */

/** A land road tile (bridges have no kerb to stop at, so they never count as an entrance). */
function isLandRoad(world: World, i: number): boolean {
  return world.road[i] !== RoadType.None && world.bridge[i] === BridgeAxis.None;
}

/**
 * Index of the nearest land road within `range` tiles of the footprint (x, y, w, h), or −1.
 * Rings are searched outward. Within a ring the road with the fewest straight steps to the
 * footprint wins (so a road in front beats one at a corner); ties go to the front (south)
 * edge, then east, north and west.
 */
export function findEntrance(world: World, x: number, y: number, w: number, h: number, range: number): number {
  for (let d = 1; d <= range; d++) {
    const x0 = x - d;
    const y0 = y - d;
    const x1 = x + w - 1 + d;
    const y1 = y + h - 1 + d;
    let best = -1;
    let bestSteps = Infinity;
    const check = (tx: number, ty: number) => {
      if (!world.inBounds(tx, ty) || !isLandRoad(world, world.index(tx, ty))) return;
      // Straight-line (Manhattan) steps from the footprint's edge.
      const steps = Math.max(0, x - tx, tx - (x + w - 1)) + Math.max(0, y - ty, ty - (y + h - 1));
      if (steps < bestSteps) {
        best = world.index(tx, ty);
        bestSteps = steps;
      }
    };
    for (let tx = x0; tx <= x1; tx++) check(tx, y1);
    for (let ty = y1 - 1; ty >= y0; ty--) check(x1, ty);
    for (let tx = x1 - 1; tx >= x0; tx--) check(tx, y0);
    for (let ty = y0 + 1; ty < y1; ty++) check(x0, ty);
    if (best !== -1) return best;
  }
  return -1;
}

/** Give every building its entrance road tile (within BALANCE.roadAccessRange), or −1. */
export function updateRoadAccess(world: World) {
  for (const b of world.buildings.values()) {
    const { w, h } = BUILDINGS[b.def].size;
    b.entrance = findEntrance(world, b.x, b.y, w, h, BALANCE.roadAccessRange);
    // A building cut off from the roads empties out.
    if (b.entrance === -1) b.occupants = 0;
  }
}

/** Finished and connected: the building can have residents or jobs. */
export function isActive(b: BuildingInstance): boolean {
  return b.construction === 0 && b.entrance !== -1;
}

/** Recomputes every building's entrance after edits. */
export class AccessSystem implements SimSystem {
  readonly name = 'access';
  private readonly world: World;
  constructor(world: World) {
    this.world = world;
  }
  onWorldChanged() {
    updateRoadAccess(this.world);
  }
}
