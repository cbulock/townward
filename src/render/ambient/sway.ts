import { GROUND_PAD, TREE_HEADROOM } from '../atlas/geometry';
import { HALF_H, HALF_W } from '../../shared/constants';

/**
 * Wind in the trees (D-071): every tree sprite skews about the ground point under it, so trunks
 * stay planted and crowns move. A slow gust front rolls across the map, so a forest ripples
 * instead of nodding in lockstep. Only visible chunks at readable zoom levels animate.
 */

/** The ground point of a tree frame (frame px): sprites pivot here. */
export const SWAY_PIVOT_X = GROUND_PAD + HALF_W;
export const SWAY_PIVOT_Y = TREE_HEADROOM + GROUND_PAD + HALF_H;

/** Below this zoom the motion is too small to see, so trees hold still. */
export const SWAY_MIN_ZOOM = 0.75;

/** Horizontal skew (radians) for a tree at world point (x, y) at time t (seconds). */
export function swaySkew(x: number, y: number, t: number): number {
  // A gust front travelling across the map, plus each tree's own quick flutter.
  const gust = 0.5 + 0.5 * Math.sin(t * 0.45 - (x * 0.6 + y) * 0.004);
  const flutter = Math.sin(t * 2.1 + x * 0.05 + y * 0.09);
  return (0.012 + 0.03 * gust * gust) * flutter + 0.018 * gust;
}
