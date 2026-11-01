import { HALF_W } from '../../shared/constants';
import { BUILDINGS, type BuildingInstance } from '../../sim/buildings/catalog';
import type { World } from '../../sim/World';
import { buildingHeadroom } from '../atlas/buildings';
import { GROUND_PAD } from '../atlas/geometry';
import { tileToWorld } from '../iso';
import { tileLift } from './lift';

/**
 * World-pixel top-left of a finished building's frame in view space (`ground` is the view-space
 * world, `b` a view-space instance). Frame marks (atlas/core FrameMark) are offsets from here.
 */
export function buildingOrigin(ground: World, b: BuildingInstance, r: number): { x: number; y: number } {
  const size = BUILDINGS[b.def].size;
  const h = r % 2 === 0 ? size.h : size.w;
  const p = tileToWorld(b.x, b.y);
  return { x: p.x - h * HALF_W - GROUND_PAD, y: p.y - GROUND_PAD - buildingHeadroom(b.def, b.variant) - tileLift(ground, b.x, b.y) };
}
