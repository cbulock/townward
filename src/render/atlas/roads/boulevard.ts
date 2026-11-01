import { band, dashLine, LANE_DASHES, sides } from './oneway';
import { pavingLook, pavingPattern } from './paving';

/**
 * Boulevard carriageway (docs/specs/transport.md): one direction's three lanes on this tile. Its
 * twin carries the other direction on the median side; the planted median is split between
 * them, the promenade is on the outer side. Lateral 0 = median edge, 1 = outer edge.
 */
export const BOULEVARD = {
  /** Planted median half (this tile's share). */
  median: 0.09,
  /** Carriageway, between the median kerb and the outer kerb. */
  road: [0.1, 0.8] as const,
  kerb: 0.82,
  /** Dashed lines between the three lanes. */
  laneLines: [0.333, 0.567] as const,
} as const;

const TONE = {
  asphalt: '#3d4249',
  speck: 'rgba(255, 255, 255, 0.05)',
  line: '#eef0f2',
  kerb: '#ece8e0',
  gutter: '#8a867e',
  medianKerb: '#e3dfd6',
  medianGrass: '#69b244',
  hedge: '#3f8a34',
  hedgeTop: '#5aa843',
  track: 'rgba(0, 0, 0, 0.07)',
} as const;

export function paintBoulevard(ctx: CanvasRenderingContext2D, mask: number, d: number) {
  const s = sides(d);
  const crossing = (mask & (s.median | s.outer)) !== 0;
  const look = pavingLook('promenade');
  // Promenade on the outer side (not where a side road joins).
  if (!(mask & s.outer)) {
    ctx.fillStyle = look.edge;
    band(ctx, d, BOULEVARD.kerb, 1.0);
    ctx.fillStyle = look.base;
    band(ctx, d, BOULEVARD.kerb + 0.012, 0.985);
    pavingPattern(ctx, 'promenade');
    ctx.fillStyle = TONE.kerb;
    band(ctx, d, BOULEVARD.road[1], BOULEVARD.kerb);
  }
  // Carriageway (the whole tile at crossings and turnarounds).
  ctx.fillStyle = TONE.gutter;
  band(ctx, d, mask & s.median ? 0 : BOULEVARD.road[0], mask & s.outer ? 1 : BOULEVARD.road[1] + 0.012);
  ctx.fillStyle = TONE.asphalt;
  band(ctx, d, mask & s.median ? 0 : BOULEVARD.road[0], mask & s.outer ? 1 : BOULEVARD.road[1]);
  ctx.fillStyle = TONE.speck;
  for (let k = 0; k < 16; k++) ctx.fillRect(((k * 37) % 29) / 29, ((k * 53) % 31) / 31, 0.018, 0.018);
  // Planted median with a clipped hedge line (the trees stand in the objects layer).
  if (!(mask & s.median)) {
    ctx.fillStyle = TONE.medianKerb;
    band(ctx, d, 0, BOULEVARD.road[0]);
    ctx.fillStyle = TONE.medianGrass;
    band(ctx, d, 0, BOULEVARD.median - 0.012);
    ctx.fillStyle = TONE.hedge;
    band(ctx, d, 0, 0.035);
    ctx.fillStyle = TONE.hedgeTop;
    band(ctx, d, 0, 0.02);
  }
  if (crossing) {
    // A clear junction box with a stop line where traffic enters it.
    ctx.fillStyle = TONE.line;
    const back = (d + 2) % 4;
    if (mask & (1 << back)) band(ctx, d, mask & s.median ? 0.04 : BOULEVARD.road[0] + 0.02, BOULEVARD.road[1] - 0.02, 0.0, 0.03);
    return;
  }
  ctx.fillStyle = TONE.track;
  for (const l of [0.217, 0.45, 0.683]) dashLine(ctx, d, l, 0.03, [[-0.02, 1.02]]); // wheel tracks
  ctx.fillStyle = TONE.line;
  for (const l of BOULEVARD.laneLines) dashLine(ctx, d, l, 0.008, LANE_DASHES);
  band(ctx, d, BOULEVARD.road[0] + 0.012, BOULEVARD.road[0] + 0.024);
  band(ctx, d, BOULEVARD.road[1] - 0.024, BOULEVARD.road[1] - 0.012);
}
