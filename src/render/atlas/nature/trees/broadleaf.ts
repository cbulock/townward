import type { Rng } from '../../core/iso';
import type { Foliage } from '../../theme/tokens';
import { NATURE } from '../../theme/tokens';
import { paintCrown, paintTrunk, type Clump } from './canopy';

/** Round deciduous tree (oak, maple, lime): a short trunk under a domed crown of clumps. Size 1 ≈ 24 px tall. */
export function paintBroadleaf(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, f: Foliage, rng: Rng) {
  paintTrunk(ctx, x, y, 10 * s, 1.6 * s, NATURE.bark);
  const cy = y - 15 * s;
  const R = 8.2 * s;
  const clumps: Clump[] = [{ x, y: cy, r: R * 0.72 }];
  const n = 5 + Math.floor(rng() * 2);
  for (let k = 0; k < n; k++) {
    // A dome: clumps round the sides and top, none below the crown's middle.
    const a = Math.PI * (1.02 + (k / (n - 1)) * 0.96) + (rng() - 0.5) * 0.25;
    const d = R * (0.48 + rng() * 0.14);
    clumps.push({ x: x + Math.cos(a) * d * 1.1, y: cy + Math.sin(a) * d * 0.85 + R * 0.08, r: R * (0.46 + rng() * 0.14) });
  }
  // Lower skirt clumps give the crown a full, rounded bottom.
  clumps.push({ x: x - R * 0.42, y: cy + R * 0.32, r: R * 0.46 }, { x: x + R * 0.4, y: cy + R * 0.36, r: R * 0.44 });
  paintCrown(ctx, clumps, f, rng);
}

/** Tall columnar tree (poplar, cypress): a narrow flame of stacked clumps. */
export function paintPoplar(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, f: Foliage, rng: Rng) {
  paintTrunk(ctx, x, y, 6 * s, 1.2 * s, NATURE.bark);
  const clumps: Clump[] = [];
  const H = 26 * s;
  for (let k = 0; k < 7; k++) {
    const t = k / 6;
    const w = 4.6 * s * Math.sin(Math.PI * (0.15 + t * 0.8));
    clumps.push({ x: x + (rng() - 0.5) * 1.6 * s, y: y - 6 * s - t * H * 0.85, r: Math.max(1.6 * s, w) });
  }
  paintCrown(ctx, clumps, f, rng, 0.7);
}

/** Birch: a slim pale trunk with dark marks under a light, airy crown. */
export function paintBirch(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, f: Foliage, rng: Rng) {
  paintTrunk(ctx, x, y, 16 * s, 1.1 * s, NATURE.birchBark);
  ctx.fillStyle = 'rgba(40, 40, 46, 0.7)';
  for (let k = 0; k < 4; k++) ctx.fillRect(x - 0.8 * s + rng() * 0.4, y - (3 + k * 3.2 + rng()) * s, (0.8 + rng() * 0.6) * s, 0.5 * s);
  const cy = y - 18 * s;
  const clumps: Clump[] = [];
  for (let k = 0; k < 7; k++) {
    const a = rng() * Math.PI * 2;
    const d = rng() * 4.2 * s;
    clumps.push({ x: x + Math.cos(a) * d, y: cy + Math.sin(a) * d * 1.2, r: (2.6 + rng() * 1.4) * s });
  }
  paintCrown(ctx, clumps, f, rng, 0.6);
}

/** Low round shrub. */
export function paintShrub(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, f: Foliage, rng: Rng) {
  const clumps: Clump[] = [];
  for (let k = 0; k < 4; k++) clumps.push({ x: x + (k - 1.5) * 2.4 * s + (rng() - 0.5) * s, y: y - (2.6 + rng() * 1.6) * s, r: (2.6 + rng() * 1.2) * s });
  clumps.push({ x, y: y - 4.6 * s, r: 3.2 * s });
  paintCrown(ctx, clumps, f, rng, 0.5);
}
