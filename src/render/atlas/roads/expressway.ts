import { band, dashLine, LANE_DASHES, sides } from './oneway';

/**
 * Expressway carriageway (docs/specs/transport.md): one direction's four lanes on this tile,
 * between a concrete median barrier (shared with its twin) and the outer barrier. Ramps join
 * through gaps in the outer barrier. Lateral 0 = median edge, 1 = outer edge.
 */
export const EXPRESSWAY = {
  barrier: 0.05,
  road: [0.06, 0.94] as const,
  laneLines: [0.28, 0.5, 0.72] as const,
} as const;

const TONE = {
  asphalt: '#373b42',
  speck: 'rgba(255, 255, 255, 0.045)',
  line: '#e8ebee',
  edge: '#f1d54a',
  barrierFace: '#7d838b',
  barrierTop: '#d6dadf',
  track: 'rgba(0, 0, 0, 0.08)',
} as const;

export function paintExpressway(ctx: CanvasRenderingContext2D, mask: number, d: number) {
  const s = sides(d);
  ctx.fillStyle = TONE.asphalt;
  band(ctx, d, 0, 1);
  ctx.fillStyle = TONE.speck;
  for (let k = 0; k < 18; k++) ctx.fillRect(((k * 41) % 31) / 31, ((k * 29) % 37) / 37, 0.016, 0.016);
  ctx.fillStyle = TONE.track;
  for (const l of [0.17, 0.39, 0.61, 0.83]) dashLine(ctx, d, l, 0.028, [[-0.02, 1.02]]);
  // Barriers: the median one unless this is a turnaround, the outer one unless a ramp joins.
  for (const [has, l0, l1] of [
    [!(mask & s.median), 0, EXPRESSWAY.barrier],
    [!(mask & s.outer), 1 - EXPRESSWAY.barrier, 1],
  ] as const) {
    if (!has) continue;
    ctx.fillStyle = TONE.barrierFace;
    band(ctx, d, l0, l1);
    ctx.fillStyle = TONE.barrierTop;
    band(ctx, d, l0 + 0.012, l1 - 0.012);
  }
  ctx.fillStyle = TONE.edge;
  if (!(mask & s.median)) band(ctx, d, EXPRESSWAY.road[0] + 0.01, EXPRESSWAY.road[0] + 0.022);
  ctx.fillStyle = TONE.line;
  if (!(mask & s.outer)) band(ctx, d, EXPRESSWAY.road[1] - 0.022, EXPRESSWAY.road[1] - 0.01);
  if (!(mask & (s.median | s.outer))) for (const l of EXPRESSWAY.laneLines) dashLine(ctx, d, l, 0.008, LANE_DASHES);
}
