import { HEIGHT_STEP } from '../../shared/constants';
import { cornerHeight, levelAt, surfaceHeight } from '../../sim/terrain/elevation';
import type { World } from '../../sim/World';
import type { Vec } from '../ground/TileMesh';
import { tileToWorld } from '../iso';
import type { ViewRef } from '../Renderer';

/**
 * Screen-world positions on the sloped terrain (docs/specs/elevation.md). Everything here
 * is in *view* space: `ground` is the rotated copy of the world (ViewWorld).
 */

/** A continuous view-tile point on the ground surface. */
export function liftView(ground: World, vx: number, vy: number): Vec {
  const p = tileToWorld(vx, vy);
  return { x: p.x, y: p.y - surfaceHeight(ground, vx, vy) * HEIGHT_STEP };
}

/** A continuous *world*-tile point on the ground, placed in the current view. */
export function liftWorld(ref: ViewRef, wx: number, wy: number): Vec {
  const v = ref.current.pointToView(wx, wy);
  return liftView(ref.ground, v.x, v.y);
}

/** Pixels a view tile's centre is raised by. */
export function tileLift(ground: World, vx: number, vy: number): number {
  return levelAt(ground, vx, vy) * HEIGHT_STEP;
}

/** Corners (top, right, bottom, left) and centre of view tile (vx, vy), bent to the terrain. */
export function tileQuadPoints(ground: World, vx: number, vy: number): Vec[] {
  const at = (x: number, y: number, h: number) => {
    const p = tileToWorld(x, y);
    return { x: p.x, y: p.y - h * HEIGHT_STEP };
  };
  return [
    at(vx, vy, cornerHeight(ground, vx, vy)),
    at(vx + 1, vy, cornerHeight(ground, vx + 1, vy)),
    at(vx + 1, vy + 1, cornerHeight(ground, vx + 1, vy + 1)),
    at(vx, vy + 1, cornerHeight(ground, vx, vy + 1)),
    at(vx + 0.5, vy + 0.5, levelAt(ground, vx, vy)),
  ];
}

/**
 * Dual cell (i, j): a diamond centred on tile vertex (i, j) whose corners are the centres of
 * tiles (i−1, j−1) top, (i, j−1) right, (i, j) bottom and (i−1, j) left (D-019).
 */
export function cellQuadPoints(ground: World, i: number, j: number): Vec[] {
  const at = (x: number, y: number, h: number) => {
    const p = tileToWorld(x, y);
    return { x: p.x, y: p.y - h * HEIGHT_STEP };
  };
  return [
    at(i - 0.5, j - 0.5, levelAt(ground, i - 1, j - 1)),
    at(i + 0.5, j - 0.5, levelAt(ground, i, j - 1)),
    at(i + 0.5, j + 0.5, levelAt(ground, i, j)),
    at(i - 0.5, j + 0.5, levelAt(ground, i - 1, j)),
    at(i, j, cornerHeight(ground, i, j)),
  ];
}

/**
 * Hill light at a view tile's centre: slopes facing the camera's lower-left are lit,
 * lower-right shaded (same light as the buildings).
 */
export function tileShade(ground: World, vx: number, vy: number): number {
  const dx = levelAt(ground, vx + 1, vy) - levelAt(ground, vx - 1, vy);
  const dy = levelAt(ground, vx, vy + 1) - levelAt(ground, vx, vy - 1);
  return Math.min(1.22, Math.max(0.72, 1 - 0.1 * dy + 0.1 * dx));
}
