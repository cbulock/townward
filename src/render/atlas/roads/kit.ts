import { HALF_H, HALF_W } from '../../../shared/constants';
import { GROUND_PAD } from '../geometry';

/**
 * The drawing kit every road type uses (D-066: one file per road type, sharing this).
 * Pieces are painted in tile space: (u, v) ∈ [0,1]² maps onto the iso diamond, and everything
 * is drawn as simple quads along "arms" from the tile centre.
 *
 * Mask bits: 0 NE (toward v = 0), 1 SE (u = 1), 2 SW (v = 1), 3 NW (u = 0).
 */

/** Unit direction of each arm in (u, v), and the lateral axis across it. */
export const ARMS: readonly { d: readonly [number, number]; p: readonly [number, number] }[] = [
  { d: [0, -1], p: [1, 0] },
  { d: [1, 0], p: [0, 1] },
  { d: [0, 1], p: [1, 0] },
  { d: [-1, 0], p: [0, 1] },
];

export const bits = (mask: number) => [0, 1, 2, 3].filter((b) => mask & (1 << b));

/** Fill the quad covering s ∈ [s0, s1] along arm `b`, lateral offset o ∈ [o0, o1]. */
export function armQuad(ctx: CanvasRenderingContext2D, b: number, s0: number, s1: number, o0: number, o1: number) {
  const { d, p } = ARMS[b];
  const pt = (s: number, o: number): [number, number] => [0.5 + d[0] * s + p[0] * o, 0.5 + d[1] * s + p[1] * o];
  const q = [pt(s0, o0), pt(s1, o0), pt(s1, o1), pt(s0, o1)];
  ctx.beginPath();
  ctx.moveTo(q[0][0], q[0][1]);
  for (let k = 1; k < 4; k++) ctx.lineTo(q[k][0], q[k][1]);
  ctx.closePath();
  ctx.fill();
}

/** Centre square plus an arm per connection, all of half-width `hw`. */
export function body(ctx: CanvasRenderingContext2D, mask: number, hw: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(0.5 - hw, 0.5 - hw, hw * 2, hw * 2);
  for (const b of bits(mask)) armQuad(ctx, b, 0, 0.5 + 0.02, -hw, hw);
}

/** Dashes along an arm. Dash positions are measured so they line up across tile edges. */
export function dashes(
  ctx: CanvasRenderingContext2D,
  b: number,
  from: number,
  offset: number,
  width: number,
  color: string,
  pattern: readonly (readonly [number, number])[],
) {
  ctx.fillStyle = color;
  for (const [s0, s1] of pattern) {
    if (s1 <= from) continue;
    armQuad(ctx, b, Math.max(s0, from), s1, offset - width, offset + width);
  }
}

export const DASHES: readonly (readonly [number, number])[] = [
  [0.04, 0.17],
  [0.29, 0.42],
];

export function isStraight(mask: number) {
  return mask === 0b0101 || mask === 0b1010;
}

/** Paint only where something is already drawn (keeps joints on the footpath). */
export function onTop(ctx: CanvasRenderingContext2D, paint: () => void) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  paint();
  ctx.restore();
}

/** Lateral sign (along the arm's p axis) of the lane that drives in toward the junction on arm `b`. */
export function incomingSide(b: number): number {
  const { d, p } = ARMS[b];
  // Heading in is −d; drivers keep right, and right of heading (hx, hy) is (−hy, hx).
  const right: [number, number] = [d[1], -d[0]];
  return Math.sign(right[0] * p[0] + right[1] * p[1]);
}

/**
 * Set up the (u, v) → iso diamond transform (the diamond's top vertex `offsetY` px below the
 * frame top), optionally clipped slightly past the tile so connected pieces overlap.
 */
export function inTileSpace(ctx: CanvasRenderingContext2D, paint: () => void, offsetY = 0, clip = true) {
  ctx.save();
  ctx.transform(HALF_W, HALF_H, -HALF_W, HALF_H, GROUND_PAD + HALF_W, GROUND_PAD + offsetY);
  if (clip) {
    ctx.beginPath();
    ctx.rect(-0.02, -0.02, 1.04, 1.04);
    ctx.clip();
  }
  paint();
  ctx.restore();
}

/** In tile space, moving (d, d) shifts straight down on screen by 2·HALF_H·d px. */
export const PX = 1 / (2 * HALF_H);
