import { alpha, shade } from '../../core/color';
import type { Rng } from '../../core/iso';
import { NATURE } from '../../theme/tokens';

/** A clump of flowers at (x, y): leafy mound, then petals with a lit and a shaded side. */
export function paintFlowerClump(ctx: CanvasRenderingContext2D, x: number, y: number, petal: string, centre: string, rng: Rng, size = 1) {
  const leaf = NATURE.greens[1];
  ctx.fillStyle = alpha(leaf.dark, 0.85);
  ctx.beginPath();
  ctx.ellipse(x, y - 0.6 * size, 3.2 * size, 1.5 * size, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = leaf.mid;
  ctx.beginPath();
  ctx.ellipse(x - 0.5 * size, y - 1.1 * size, 2.4 * size, 1.1 * size, 0, 0, Math.PI * 2);
  ctx.fill();
  const n = 4 + Math.floor(rng() * 3);
  for (let k = 0; k < n; k++) {
    const fx = x + (rng() - 0.5) * 5 * size;
    const fy = y - (1.2 + rng() * 2.2) * size;
    const r = (0.75 + rng() * 0.35) * size;
    ctx.fillStyle = shade(petal, -0.25);
    ctx.beginPath();
    ctx.arc(fx + 0.25, fy + 0.25, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = petal;
    ctx.beginPath();
    ctx.arc(fx, fy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = centre;
    ctx.fillRect(fx - 0.3, fy - 0.3, 0.6, 0.6);
  }
}

/** A tuft of grass blades curving away from the root, lit tips. */
export function paintGrassTuft(ctx: CanvasRenderingContext2D, x: number, y: number, rng: Rng, size = 1) {
  const g = NATURE.greens[2];
  const blades = 8 + Math.floor(rng() * 5);
  ctx.lineCap = 'round';
  for (let b = 0; b < blades; b++) {
    const t = b / (blades - 1) - 0.5;
    const h = (4.5 + rng() * 3.5 - Math.abs(t) * 3) * size;
    const lean = t * 5 * size + (rng() - 0.5) * 1.5;
    const grad = ctx.createLinearGradient(x, y, x + lean, y - h);
    grad.addColorStop(0, g.dark);
    grad.addColorStop(0.6, t < 0 ? g.light : g.mid);
    grad.addColorStop(1, t < 0 ? '#e3f2a0' : g.light);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 0.8 * size;
    ctx.beginPath();
    ctx.moveTo(x + t * 2 * size, y);
    ctx.quadraticCurveTo(x + t * 2 * size + lean * 0.2, y - h * 0.6, x + lean, y - h);
    ctx.stroke();
  }
}

/** A seed-head of tall meadow grass (wheat-coloured tips) for variety. */
export function paintMeadowStalks(ctx: CanvasRenderingContext2D, x: number, y: number, rng: Rng) {
  for (let k = 0; k < 4; k++) {
    const sx = x + (rng() - 0.5) * 4;
    const h = 6 + rng() * 3;
    ctx.strokeStyle = shade(NATURE.greens[4].mid, -0.1);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sx, y);
    ctx.lineTo(sx + 0.8, y - h);
    ctx.stroke();
    ctx.fillStyle = '#e8d38a';
    ctx.beginPath();
    ctx.ellipse(sx + 0.9, y - h - 0.8, 0.6, 1.4, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}
