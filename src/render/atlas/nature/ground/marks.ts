import type { Rng } from '../../core/iso';
import { tileUVToFrame } from '../../geometry';

/**
 * Small soft marks laid on open ground. All are anti-aliased paths at sub-pixel sizes, never
 * snapped pixels, so the ground reads as a calm surface with a hint of texture rather than noise.
 */

/** A random frame point inside the diamond, kept `margin` (tile units) away from its edges. */
export function pointIn(rng: Rng, margin = 0.08): { x: number; y: number } {
  return tileUVToFrame(margin + rng() * (1 - 2 * margin), margin + rng() * (1 - 2 * margin));
}

/** A round fleck flattened to lie on the ground. */
export function fleck(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** A grass tuft: three short blades fanning up from one root, `s` scaling its height. */
export function tuft(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 0.5 * s, y);
  ctx.quadraticCurveTo(x - 0.7 * s, y - 1.2 * s, x - 1.6 * s, y - 1.9 * s);
  ctx.moveTo(x, y);
  ctx.lineTo(x + 0.15 * s, y - 2.5 * s);
  ctx.moveTo(x + 0.5 * s, y);
  ctx.quadraticCurveTo(x + 0.7 * s, y - 1.2 * s, x + 1.6 * s, y - 1.9 * s);
  ctx.stroke();
}

/** A pebble: a flattened stone with a lit top. */
export function pebble(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, body: string, top: string) {
  fleck(ctx, x, y, r, body);
  fleck(ctx, x - r * 0.2, y - r * 0.2, r * 0.6, top);
}

/** A shallow arc across the surface: wind ripples on sand, swells and glints on water. */
export function arc(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, lift: number, width: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - len / 2, y);
  ctx.quadraticCurveTo(x, y - lift, x + len / 2, y);
  ctx.stroke();
}

/** A short hairline crack in stone: two joined segments. */
export function crack(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, rng: Rng, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - len / 2, y + (rng() - 0.5) * 1.5);
  ctx.lineTo(x + (rng() - 0.5) * len * 0.3, y + (rng() - 0.5) * 1.5);
  ctx.lineTo(x + len / 2, y + (rng() - 0.5) * 1.5);
  ctx.stroke();
}
