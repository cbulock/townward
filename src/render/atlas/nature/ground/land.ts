import { alpha } from '../../core/color';
import type { Rng } from '../../core/iso';
import { GROUND } from '../../theme/tokens';
import { arc, crack, fleck, pebble, pointIn, tuft } from './marks';

/**
 * Land surfaces. Each paints a few low-contrast marks over the flat base: enough to read as
 * grass, sand or stone up close, quiet enough that roads, zones and buildings stay the focus.
 * Variants differ only in where the marks fall, so wide areas never read as a checkerboard.
 */
export type SurfacePainter = (ctx: CanvasRenderingContext2D, rng: Rng, phase: number) => void;

/** Soft light and dark flecks, the shared under-texture of every land surface. */
function flecks(ctx: CanvasRenderingContext2D, rng: Rng, count: number, r: number, color: string) {
  for (let i = 0; i < count; i++) {
    const p = pointIn(rng, 0.04);
    fleck(ctx, p.x, p.y, r * (0.7 + rng() * 0.6), color);
  }
}

function tufts(ctx: CanvasRenderingContext2D, rng: Rng, count: number, color: string) {
  for (let i = 0; i < count; i++) {
    const p = pointIn(rng, 0.14);
    tuft(ctx, p.x, p.y, 0.9 + rng() * 0.4, color);
  }
}

export const paintGrass: SurfacePainter = (ctx, rng) => {
  const g = GROUND.grass;
  flecks(ctx, rng, 5, 1.6, alpha(g.light, 0.45));
  flecks(ctx, rng, 4, 1.4, alpha(g.dark, 0.35));
  tufts(ctx, rng, 2, alpha(g.dark, 0.55));
};

export const paintDryGrass: SurfacePainter = (ctx, rng) => {
  const g = GROUND.dryGrass;
  flecks(ctx, rng, 5, 1.6, alpha(g.light, 0.5));
  flecks(ctx, rng, 4, 1.4, alpha(g.dark, 0.4));
  tufts(ctx, rng, 2, alpha(g.dark, 0.65));
  tufts(ctx, rng, 1, alpha(g.light, 0.8));
};

export const paintSand: SurfacePainter = (ctx, rng) => {
  const g = GROUND.sand;
  flecks(ctx, rng, 7, 0.6, alpha(g.dark, 0.55));
  flecks(ctx, rng, 5, 0.8, alpha(g.light, 0.7));
  // Wind ripples share one direction, so they run on across neighbouring tiles.
  for (let i = 0; i < 2; i++) {
    const p = pointIn(rng, 0.2);
    arc(ctx, p.x, p.y, 7 + rng() * 4, 0.9, 0.7, alpha(g.light, 0.75));
  }
};

export const paintDirt: SurfacePainter = (ctx, rng) => {
  const g = GROUND.dirt;
  flecks(ctx, rng, 6, 0.6, alpha(g.dark, 0.6));
  flecks(ctx, rng, 4, 0.7, alpha(g.light, 0.55));
  for (let i = 0; i < 3; i++) {
    const p = pointIn(rng, 0.14);
    pebble(ctx, p.x, p.y, 0.9 + rng() * 0.6, alpha(g.dark, 0.85), alpha(g.light, 0.8));
  }
};

export const paintRock: SurfacePainter = (ctx, rng) => {
  const g = GROUND.rock;
  flecks(ctx, rng, 4, 1.8, alpha(g.light, 0.4));
  for (let i = 0; i < 2; i++) {
    const p = pointIn(rng, 0.2);
    crack(ctx, p.x, p.y, 6 + rng() * 4, rng, alpha(g.dark, 0.7));
  }
  for (let i = 0; i < 3; i++) {
    const p = pointIn(rng, 0.14);
    pebble(ctx, p.x, p.y, 0.8 + rng() * 0.6, alpha(g.dark, 0.8), alpha(g.light, 0.85));
  }
};
