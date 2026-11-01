import { DIRS } from '../../../sim/roads';

/**
 * Geometry for one-way carriageway tiles (boulevards, expressways). A tile's travel direction
 * `d` follows sim/roads.ts DIRS; the median is on the left of travel, the outer edge on the right.
 * Lateral positions `l` run from 0 at the median edge to 1 at the outer edge; along positions
 * `s` from 0 to 1 across the tile. Everything is in tile space ((u, v) ∈ [0,1]², roads/kit.ts).
 */

/** Mask bits of the median side, the outer side, and the two ends. */
export function sides(d: number): { median: number; outer: number; along: number } {
  return { median: 1 << ((d + 3) % 4), outer: 1 << ((d + 1) % 4), along: (1 << d) | (1 << ((d + 2) % 4)) };
}

/** Fill a band from lateral l0..l1 and along s0..s1. */
export function band(ctx: CanvasRenderingContext2D, d: number, l0: number, l1: number, s0 = -0.02, s1 = 1.02) {
  const [lx, ly] = DIRS[(d + 3) % 4];
  // Lateral 0 is the median edge: the tile side the left vector points to.
  const lat = (l: number) => (lx + ly < 0 ? l : 1 - l);
  const a0 = Math.min(lat(l0), lat(l1));
  const a1 = Math.max(lat(l0), lat(l1));
  if (d % 2 === 1) ctx.fillRect(s0, a0, s1 - s0, a1 - a0); // travels along u: lateral is v
  else ctx.fillRect(a0, s0, a1 - a0, s1 - s0); // travels along v: lateral is u
}

/** Dashes along the travel axis at lateral `l` (pattern in along units, aligned across tiles). */
export function dashLine(ctx: CanvasRenderingContext2D, d: number, l: number, w: number, pattern: readonly (readonly [number, number])[]) {
  for (const [s0, s1] of pattern) band(ctx, d, l - w, l + w, s0, s1);
}

/** Dash pattern for lane lines on one-way roads (whole tile, lines up with neighbours). */
export const LANE_DASHES: readonly (readonly [number, number])[] = [
  [0.05, 0.3],
  [0.55, 0.8],
];
