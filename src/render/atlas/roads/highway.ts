import { bits, body, DASHES, dashes, isStraight } from './kit';

/** Highway cross-section: barriers at the edges, two lanes each way, a jersey barrier in the middle. */
export const HIGHWAY = {
  road: 0.46,
  /** Dashed line between the two lanes of each carriageway. */
  laneLine: 0.22,
} as const;

export function paintHighway(ctx: CanvasRenderingContext2D, mask: number) {
  const hw = HIGHWAY.road;
  const arms = bits(mask);
  const junction = arms.length >= 3;
  body(ctx, mask, hw + 0.04, '#6c727a'); // barrier face
  body(ctx, mask, hw + 0.025, '#d4d8dc'); // barrier top
  body(ctx, mask, hw, '#3b3f47'); // asphalt
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  for (let k = 0; k < 18; k++) ctx.fillRect(0.5 - hw + ((k * 37) % 29) / 33, 0.5 - hw + ((k * 53) % 31) / 35, 0.02, 0.02);
  // Darker wheel tracks in each lane.
  for (const b of arms) {
    for (const o of [-0.34, -0.1, 0.1, 0.34]) dashes(ctx, b, junction ? hw : 0, o, 0.035, 'rgba(0,0,0,0.08)', [[0, 0.52]]);
  }

  const from = junction || !isStraight(mask) ? hw : 0;
  for (const b of arms) {
    // Solid edge lines, dashed lane lines, and the median barrier with yellow edge lines.
    dashes(ctx, b, from, -hw + 0.04, 0.012, '#eceff2', [[0, 0.52]]);
    dashes(ctx, b, from, hw - 0.04, 0.012, '#eceff2', [[0, 0.52]]);
    dashes(ctx, b, from, -HIGHWAY.laneLine, 0.013, '#e4e7ea', DASHES);
    dashes(ctx, b, from, HIGHWAY.laneLine, 0.013, '#e4e7ea', DASHES);
    if (!junction) {
      dashes(ctx, b, 0, -0.05, 0.008, '#f0c93a', [[0, 0.52]]);
      dashes(ctx, b, 0, 0.05, 0.008, '#f0c93a', [[0, 0.52]]);
      dashes(ctx, b, 0, 0, 0.03, '#8d939a', [[0, 0.52]]);
      dashes(ctx, b, 0, -0.008, 0.016, '#e2e5e8', [[0, 0.52]]);
    }
  }
  if (!junction && arms.length === 2 && !isStraight(mask)) {
    ctx.fillStyle = '#e2e5e8';
    ctx.fillRect(0.47, 0.47, 0.06, 0.06);
  }
}
