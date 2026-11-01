import type { PavementStyle } from '../../../sim/roadTypes';
import { onTop } from './kit';

/**
 * Footpath paving styles (docs/specs/transport.md), chosen per road in the road tool. Each
 * paints a base colour plus its pattern over whatever footpath area is already drawn.
 */

interface PavingLook {
  readonly edge: string;
  readonly base: string;
  pattern(ctx: CanvasRenderingContext2D): void;
}

const LOOKS: Readonly<Record<PavementStyle, PavingLook>> = {
  // Large grey concrete slabs.
  concrete: {
    edge: '#b7b0a2',
    base: '#d8d2c5',
    pattern(ctx) {
      ctx.fillStyle = 'rgba(90, 80, 60, 0.13)';
      for (let a = 0.1; a < 1; a += 0.1) {
        ctx.fillRect(a, 0, 0.008, 1);
        ctx.fillRect(0, a, 1, 0.008);
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      for (let k = 0; k < 10; k++) ctx.fillRect(((k * 37) % 19) / 19, ((k * 53) % 17) / 17, 0.1, 0.1);
    },
  },
  // Warm clay bricks in running bond.
  brick: {
    edge: '#b3a48d',
    base: '#dccdb4',
    pattern(ctx) {
      ctx.fillStyle = 'rgba(110, 80, 50, 0.16)';
      const row = 0.05;
      for (let r = 0, y = 0; y < 1; r++, y += row) {
        ctx.fillRect(0, y, 1, 0.006);
        const shift = r % 2 === 0 ? 0 : row;
        for (let x = shift; x < 1; x += row * 2) ctx.fillRect(x, y, 0.006, row);
      }
      ctx.fillStyle = 'rgba(190, 110, 70, 0.12)';
      for (let k = 0; k < 14; k++) ctx.fillRect(((k * 41) % 23) / 23, ((k * 29) % 19) / 19, 0.1, 0.05);
    },
  },
  // Small granite setts in a fine grid: the old-town look.
  setts: {
    edge: '#8f9298',
    base: '#b9bcc2',
    pattern(ctx) {
      ctx.fillStyle = 'rgba(40, 44, 52, 0.18)';
      const step = 0.033;
      for (let a = 0; a < 1; a += step) {
        ctx.fillRect(a, 0, 0.005, 1);
        ctx.fillRect(0, a, 1, 0.005);
      }
      for (let k = 0; k < 26; k++) {
        ctx.fillStyle = k % 2 ? 'rgba(255, 255, 255, 0.10)' : 'rgba(60, 64, 72, 0.08)';
        ctx.fillRect(Math.floor(((k * 37) % 29) / 29 / step) * step, Math.floor(((k * 53) % 31) / 31 / step) * step, step, step);
      }
    },
  },
  // Pale stone promenade: big slabs with a darker border course.
  promenade: {
    edge: '#a9a395',
    base: '#e6e0d2',
    pattern(ctx) {
      ctx.fillStyle = 'rgba(120, 110, 90, 0.12)';
      for (let a = 0.125; a < 1; a += 0.125) {
        ctx.fillRect(a, 0, 0.006, 1);
        ctx.fillRect(0, a, 1, 0.006);
      }
      ctx.fillStyle = 'rgba(150, 140, 120, 0.18)';
      for (let a = 0; a < 1; a += 0.25) ctx.fillRect(a, 0, 0.02, 1);
    },
  },
};

export function pavingLook(style: PavementStyle): { edge: string; base: string } {
  return LOOKS[style];
}

/** Lay the style's pattern over the footpath already drawn on the canvas. */
export function pavingPattern(ctx: CanvasRenderingContext2D, style: PavementStyle) {
  onTop(ctx, () => LOOKS[style].pattern(ctx));
}
