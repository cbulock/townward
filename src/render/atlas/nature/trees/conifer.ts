import { alpha, mix, shade } from '../../core/color';
import type { Rng } from '../../core/iso';
import type { Foliage } from '../../theme/tokens';
import { NATURE } from '../../theme/tokens';
import { paintTrunk } from './canopy';

/**
 * One tier of boughs: a cone with a ragged hem, lit on the left and in shade on the right, with
 * the needles' texture as short strokes. `half` is the half-width, `h` the height (px).
 */
function tier(ctx: CanvasRenderingContext2D, x: number, bottom: number, half: number, h: number, f: Foliage, rng: Rng) {
  const top = bottom - h;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.quadraticCurveTo(x + half * 0.35, top + h * 0.45, x + half, bottom - h * 0.06);
    // Ragged hem: drooping bough tips from right to left.
    const tips = 5;
    for (let k = tips; k >= 0; k--) {
      const t = k / tips;
      const tx = x - half + 2 * half * t;
      const sag = (k % 2 === 0 ? 0.16 : 0.02) * h + Math.sin(t * Math.PI) * h * 0.1;
      ctx.lineTo(tx, bottom + sag);
    }
    ctx.quadraticCurveTo(x - half * 0.35, top + h * 0.45, x, top);
    ctx.closePath();
  };
  // Soft edge.
  ctx.fillStyle = alpha(shade(f.dark, -0.4), 0.5);
  ctx.save();
  ctx.translate(0.5, 0.6);
  path();
  ctx.fill();
  ctx.restore();
  const g = ctx.createLinearGradient(x - half, top, x + half, bottom);
  g.addColorStop(0, f.light);
  g.addColorStop(0.42, f.mid);
  g.addColorStop(0.75, f.dark);
  g.addColorStop(1, shade(f.dark, -0.2));
  path();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  // Needle strokes, lighter on the sunny side.
  ctx.lineWidth = 0.55;
  for (let k = 0; k < 9; k++) {
    const t = rng();
    const sx = x - half * 0.9 + t * half * 1.8;
    const sy = bottom - h * (0.15 + rng() * 0.55);
    ctx.strokeStyle = t < 0.5 ? alpha(mix(f.light, '#ffffff', 0.2), 0.6) : alpha(shade(f.dark, -0.3), 0.5);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (t < 0.5 ? -1.6 : 1.6), sy + 1.4);
    ctx.stroke();
  }
  // Shade under the tier above.
  const sh = ctx.createLinearGradient(0, top, 0, top + h * 0.35);
  sh.addColorStop(0, 'rgba(0, 0, 0, 0.22)');
  sh.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = sh;
  ctx.fillRect(x - half - 1, top, half * 2 + 2, h * 0.35);
  ctx.restore();
}

/** Spruce or pine: three to four tiers narrowing to a sharp tip. Size 1 ≈ 28 px tall. */
export function paintConifer(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, f: Foliage, rng: Rng) {
  paintTrunk(ctx, x, y, 6 * s, 1.5 * s, NATURE.bark);
  const tiers = rng() < 0.5 ? 4 : 3;
  const H = 26 * s;
  const step = (H - 4 * s) / tiers;
  for (let k = 0; k < tiers; k++) {
    const t = k / tiers;
    const bottom = y - 4 * s - k * step * 0.92;
    const half = (9.5 - 6.2 * t) * s * (0.92 + rng() * 0.16);
    tier(ctx, x, bottom, half, step * 1.55, f, rng);
  }
}
