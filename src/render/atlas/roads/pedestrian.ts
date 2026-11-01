import type { PavementStyle } from '../../../sim/roadTypes';
import { bits, body, dashes } from './kit';
import { pavingLook, pavingPattern } from './paving';

/** Pedestrian street: paved from edge to edge in the chosen style, a stone drainage channel down the middle. */
export const PEDESTRIAN = { edge: 0.48 } as const;

export function paintPedestrian(ctx: CanvasRenderingContext2D, mask: number, style: PavementStyle) {
  const look = pavingLook(style);
  body(ctx, mask, PEDESTRIAN.edge, look.edge);
  body(ctx, mask, PEDESTRIAN.edge - 0.015, look.base);
  pavingPattern(ctx, style);
  // A decorative channel along the centre, and border bands that frame the walk.
  for (const b of bits(mask)) {
    dashes(ctx, b, 0, 0, 0.022, 'rgba(70, 76, 86, 0.35)', [[0, 0.52]]);
    dashes(ctx, b, 0, 0, 0.008, 'rgba(255, 255, 255, 0.35)', [[0, 0.52]]);
    for (const o of [-0.34, 0.34]) dashes(ctx, b, 0, o, 0.012, 'rgba(120, 100, 80, 0.22)', [[0, 0.52]]);
  }
  ctx.fillStyle = 'rgba(70, 76, 86, 0.35)';
  ctx.fillRect(0.478, 0.478, 0.044, 0.044);
}
