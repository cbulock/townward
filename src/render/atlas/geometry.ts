import { HALF_H, HALF_W, TILE_H, TILE_W } from '../../shared/constants';

/**
 * Ground frames have a margin around the 64×32 diamond so the diamond can be
 * over-drawn, hiding hairline seams between neighbouring cells.
 */
export const GROUND_PAD = 3;
export const GROUND_FRAME_W = TILE_W + GROUND_PAD * 2;
export const GROUND_FRAME_H = TILE_H + GROUND_PAD * 2;

/**
 * Base cells over-draw slightly so neighbours overlap instead of leaving gaps.
 * Overlays reach further (see transitionArt cellCoords) and are drawn in a
 * second pass, so they always cover a neighbouring base's over-draw strip.
 */
export const SEAM_OVERLAP = 0.75;

/** Headroom above the ground diamond in object frames (trees, later buildings). */
export const TREE_HEADROOM = 40;
export const TREE_FRAME_H = GROUND_FRAME_H + TREE_HEADROOM;

/** Diamond path in ground-frame coordinates, optionally grown/shrunk (keeps the 2:1 ratio). */
export function diamondPath(ctx: CanvasRenderingContext2D, grow = 0, offsetY = 0) {
  const cx = GROUND_PAD + HALF_W;
  const cy = GROUND_PAD + HALF_H + offsetY;
  const gx = grow * 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - HALF_H - grow);
  ctx.lineTo(cx + HALF_W + gx, cy);
  ctx.lineTo(cx, cy + HALF_H + grow);
  ctx.lineTo(cx - HALF_W - gx, cy);
  ctx.closePath();
}

/** Tile-space (u, v) ∈ [0,1]² → ground-frame logical pixel. u runs toward +x (SE), v toward +y (SW). */
export function tileUVToFrame(u: number, v: number, offsetY = 0): { x: number; y: number } {
  return { x: GROUND_PAD + HALF_W + (u - v) * HALF_W, y: GROUND_PAD + (u + v) * HALF_H + offsetY };
}

/** Ground-frame logical pixel → tile-space (u, v). Inverse of tileUVToFrame. */
export function frameToTileUV(x: number, y: number): { u: number; v: number } {
  const sx = (x - GROUND_PAD - HALF_W) / HALF_W;
  const sy = (y - GROUND_PAD) / HALF_H;
  return { u: (sy + sx) / 2, v: (sy - sx) / 2 };
}
