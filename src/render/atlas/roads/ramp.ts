import { bits, body, DASHES, dashes, isStraight } from './kit';

/** Ramp (slip road): two narrow lanes between barriers, chevrons where it meets other roads. */
export const RAMP = { road: 0.24, barrier: 0.27 } as const;

export function paintRamp(ctx: CanvasRenderingContext2D, mask: number) {
  const arms = bits(mask);
  body(ctx, mask, RAMP.barrier + 0.03, '#78a95a'); // grass verge
  body(ctx, mask, RAMP.barrier, '#7d838b');
  body(ctx, mask, RAMP.barrier - 0.012, '#d6dadf');
  body(ctx, mask, RAMP.road, '#3a3f46');
  for (const b of arms) {
    dashes(ctx, b, 0, -RAMP.road + 0.025, 0.01, '#e8ebee', [[0, 0.52]]);
    dashes(ctx, b, 0, RAMP.road - 0.025, 0.01, '#e8ebee', [[0, 0.52]]);
    dashes(ctx, b, 0, 0, 0.012, '#f1d54a', DASHES);
  }
  if (arms.length === 2 && !isStraight(mask)) {
    ctx.fillStyle = '#f1d54a';
    ctx.fillRect(0.488, 0.488, 0.024, 0.024);
  }
}
