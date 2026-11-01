import { alpha, mix, shade } from '../../core/color';
import { blobShadow } from '../../core/light';
import type { Rng } from '../../core/iso';
import { NATURE } from '../../theme/tokens';

/**
 * A faceted boulder at frame point (x, y) with radius r: a lit top facet, a mid front and a dark
 * right flank, so it reads as a solid stone rather than a blob. Optional moss on top.
 */
export function paintBoulder(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rng: Rng, moss = false) {
  const c = NATURE.rock;
  blobShadow(ctx, x + r * 0.5, y + 0.4, r * 1.35, r * 0.55);
  const lean = (rng() - 0.5) * 0.4;
  const top: [number, number] = [x - r * 0.15 + lean * r, y - r * (1.05 + rng() * 0.2)];
  const left: [number, number] = [x - r, y - r * 0.15];
  const right: [number, number] = [x + r, y - r * 0.2];
  const baseL: [number, number] = [x - r * 0.75, y + r * 0.18];
  const baseR: [number, number] = [x + r * 0.7, y + r * 0.2];
  const ridge: [number, number] = [x + r * 0.2, y - r * 0.45];
  const poly = (pts: readonly (readonly [number, number])[], fill: string | CanvasGradient) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  // Silhouette edge, then the three facets.
  ctx.save();
  ctx.translate(0.4, 0.5);
  poly([left, top, right, baseR, baseL], alpha(shade(c.dark, -0.4), 0.6));
  ctx.restore();
  poly([left, top, ridge, baseL], mix(c.mid, '#fff6e4', 0.06));
  poly([top, right, ridge], c.light);
  poly([ridge, right, baseR, baseL], c.dark);
  const g = ctx.createLinearGradient(0, y - r, 0, y + r * 0.2);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.18)');
  poly([left, top, right, baseR, baseL], g);
  if (moss) {
    ctx.fillStyle = alpha(NATURE.greens[2].mid, 0.9);
    ctx.beginPath();
    ctx.ellipse((top[0] + ridge[0]) / 2 - r * 0.15, top[1] + r * 0.3, r * 0.45, r * 0.18, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = NATURE.greens[2].light;
    ctx.fillRect(Math.round(top[0] - r * 0.2), Math.round(top[1] + r * 0.18), 1.5, 0.8);
  }
}
