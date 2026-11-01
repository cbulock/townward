import { alpha, mix, shade } from '../../core/color';
import type { Rng } from '../../core/iso';
import { LIGHT } from '../../theme/tokens';
import type { Foliage } from '../../theme/tokens';

/**
 * Leaf masses lit like spheres: the light comes from the upper left, so each clump has a bright
 * cap, a mid body and a dark underside, and the whole crown darkens toward its base where leaves
 * shade each other. Shared by every broadleaf species.
 */

export interface Clump {
  x: number;
  y: number;
  r: number;
}

/** Fill a circle with a sphere gradient in the foliage colours. */
function sphere(ctx: CanvasRenderingContext2D, c: Clump, f: Foliage) {
  const g = ctx.createRadialGradient(c.x - c.r * 0.45, c.y - c.r * 0.5, c.r * 0.1, c.x, c.y, c.r * 1.05);
  g.addColorStop(0, f.light);
  g.addColorStop(0.45, f.mid);
  g.addColorStop(1, f.dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
  ctx.fill();
}

function unionPath(ctx: CanvasRenderingContext2D, clumps: readonly Clump[], grow = 0) {
  ctx.beginPath();
  for (const c of clumps) {
    ctx.moveTo(c.x + c.r + grow, c.y);
    ctx.arc(c.x, c.y, c.r + grow, 0, Math.PI * 2);
  }
}

/**
 * A crown of clumps. Drawn back to front (by y), with a soft dark halo first so clumps read as
 * separate masses, then a leaf texture of small lit and shaded dabs, then crown occlusion.
 */
export function paintCrown(ctx: CanvasRenderingContext2D, clumps: readonly Clump[], f: Foliage, rng: Rng, texture = 1) {
  const sorted = [...clumps].sort((a, b) => a.y - b.y);
  // Soft outer edge: a slightly larger, darker silhouette instead of an ink outline.
  ctx.fillStyle = alpha(shade(f.dark, -0.35), 0.55);
  unionPath(ctx, sorted, 0.7);
  ctx.fill();
  for (const c of sorted) sphere(ctx, c, f);

  ctx.save();
  unionPath(ctx, sorted);
  ctx.clip();
  // Leaf texture: lit dabs on the upper left of each clump, dark ones on the lower right.
  const dabs = Math.round(texture * 6);
  for (const c of sorted) {
    for (let k = 0; k < dabs; k++) {
      const a = Math.PI * (1.05 + rng() * 0.75);
      const d = c.r * (0.35 + rng() * 0.55);
      ctx.fillStyle = alpha(mix(f.light, '#ffffff', 0.15), 0.55 + rng() * 0.3);
      ctx.beginPath();
      ctx.arc(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, c.r * (0.14 + rng() * 0.1), 0, Math.PI * 2);
      ctx.fill();
    }
    for (let k = 0; k < Math.ceil(dabs / 2); k++) {
      const a = Math.PI * (0.05 + rng() * 0.8);
      const d = c.r * (0.4 + rng() * 0.5);
      ctx.fillStyle = alpha(shade(f.dark, -0.2), 0.45);
      ctx.beginPath();
      ctx.arc(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, c.r * (0.12 + rng() * 0.1), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Crown occlusion: the underside of the whole crown sits in its own shade.
  let top = Infinity;
  let bottom = -Infinity;
  for (const c of sorted) {
    top = Math.min(top, c.y - c.r);
    bottom = Math.max(bottom, c.y + c.r);
  }
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, 'rgba(255, 248, 220, 0.12)');
  g.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, alpha(LIGHT.ao, 0.4));
  ctx.fillStyle = g;
  ctx.fillRect(-1000, top, 2000, bottom - top);
  ctx.restore();
}

/** A tapered trunk from the ground (x, y) up `h` px, lit on the left. */
export function paintTrunk(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, w: number, bark: string) {
  const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
  g.addColorStop(0, shade(bark, 0.25));
  g.addColorStop(0.45, bark);
  g.addColorStop(1, shade(bark, -0.45));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x - w * 0.55, y - h * 0.5, x - w * 0.45, y - h);
  ctx.lineTo(x + w * 0.45, y - h);
  ctx.quadraticCurveTo(x + w * 0.55, y - h * 0.5, x + w, y);
  ctx.closePath();
  ctx.fill();
}
