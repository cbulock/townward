import type { PavementStyle } from '../../../sim/roadTypes';
import { armQuad, bits, body, DASHES, dashes, incomingSide, isStraight } from './kit';
import { pavingLook, pavingPattern } from './paving';

/**
 * Avenue (docs/specs/transport.md): two lanes each way around a planted median, granite kerbs
 * and warm brick-paved footpaths. The median's trees and lamps stand in the objects layer
 * (roads/avenueFurniture.ts) so they sort with cars and buildings.
 *
 * Cross-section in tile units from the centre line. Agents use the matching offsets in
 * sim/roadTypes.ts: lanes at 0.12 and 0.25, pedestrians at 0.41.
 */
export const AVENUE = {
  /** Half-width of the median, kerb included. */
  median: 0.05,
  /** Carriageway half-width (median edge to gutter). */
  road: 0.33,
  /** Outer edge of the kerb stone. */
  kerb: 0.35,
  footpath: 0.48,
  /** Dashed line between the two lanes of each direction. */
  laneLine: 0.185,
  /** At junctions, along each arm: the zebra crossing, then the stop line, then the median's nose. */
  zebra: [0.345, 0.44] as const,
  stopLine: [0.452, 0.468] as const,
  nose: 0.472,
} as const;

/** Colour tokens (D-066), kept together so a theme can restyle avenues in one place. */
const TONE = {
  kerb: '#efece5',
  gutter: '#8a867e',
  asphalt: '#3f444c',
  asphaltSpeck: 'rgba(255, 255, 255, 0.05)',
  wheelTrack: 'rgba(0, 0, 0, 0.07)',
  line: '#eef0f2',
  lineSoft: 'rgba(238, 240, 242, 0.85)',
  medianKerb: '#e6e2d9',
  medianSoil: '#5a8a3a',
  medianGrass: '#6cb546',
  shrub: '#3f8a34',
  shrubLight: '#82c95c',
} as const;

/** The planted median along arm `b` from `from` to the tile edge: kerb, soil, grass and shrubs. */
function median(ctx: CanvasRenderingContext2D, b: number, from: number) {
  const m = AVENUE.median;
  ctx.fillStyle = TONE.medianKerb;
  armQuad(ctx, b, from, 0.52, -m, m);
  ctx.fillStyle = TONE.medianSoil;
  armQuad(ctx, b, from + 0.008, 0.52, -m + 0.01, m - 0.01);
  ctx.fillStyle = TONE.medianGrass;
  armQuad(ctx, b, from + 0.012, 0.52, -m + 0.016, m - 0.016);
  // Low shrubs along the middle (the trees are furniture sprites).
  for (let s = Math.max(from + 0.05, 0.06); s < 0.5; s += 0.11) {
    ctx.fillStyle = TONE.shrub;
    armQuad(ctx, b, s, s + 0.04, -0.018, 0.018);
    ctx.fillStyle = TONE.shrubLight;
    armQuad(ctx, b, s + 0.008, s + 0.024, -0.012, 0.004);
  }
}

export function paintAvenue(ctx: CanvasRenderingContext2D, mask: number, style: PavementStyle = 'brick') {
  const { road, kerb, footpath, laneLine, zebra, stopLine, nose } = AVENUE;
  const arms = bits(mask);
  const junction = arms.length >= 3;

  // Footpath: edge, then brick paving all round the corners.
  const look = pavingLook(style);
  body(ctx, mask, footpath, look.edge);
  body(ctx, mask, footpath - 0.015, look.base);
  pavingPattern(ctx, style);
  // Kerb, gutter, carriageway.
  body(ctx, mask, kerb, TONE.kerb);
  body(ctx, mask, road + 0.012, TONE.gutter);
  body(ctx, mask, road, TONE.asphalt);
  ctx.fillStyle = TONE.asphaltSpeck;
  for (let k = 0; k < 20; k++) ctx.fillRect(0.5 - road + ((k * 37) % 29) / 44, 0.5 - road + ((k * 53) % 31) / 47, 0.018, 0.018);

  const from = junction ? road : 0;
  for (const b of arms) {
    // Darker wheel tracks in all four lanes.
    for (const o of [-0.25, -0.12, 0.12, 0.25]) dashes(ctx, b, from, o, 0.03, TONE.wheelTrack, [[0, 0.52]]);
    // Solid edge lines by the kerbs, dashed lane lines.
    dashes(ctx, b, from, -road + 0.025, 0.01, TONE.lineSoft, [[0, 0.52]]);
    dashes(ctx, b, from, road - 0.025, 0.01, TONE.lineSoft, [[0, 0.52]]);
    dashes(ctx, b, junction ? nose : 0, -laneLine, 0.01, TONE.line, DASHES);
    dashes(ctx, b, junction ? nose : 0, laneLine, 0.01, TONE.line, DASHES);
  }

  if (junction) {
    for (const b of arms) {
      // Zebra crossing across all four lanes and the median, then a stop line on the way in.
      ctx.fillStyle = TONE.line;
      for (let o = -road + 0.03; o < road - 0.02; o += 0.07) armQuad(ctx, b, zebra[0], zebra[1], o, o + 0.038);
      const side = incomingSide(b);
      armQuad(ctx, b, stopLine[0], stopLine[1], side > 0 ? AVENUE.median + 0.01 : -road + 0.02, side > 0 ? road - 0.02 : -AVENUE.median - 0.01);
      // The median ends in a nose short of the crossing.
      median(ctx, b, nose);
    }
    return;
  }

  // Straights, bends and dead ends: the median runs through the centre.
  for (const b of arms) median(ctx, b, arms.length === 1 ? 0.12 : 0);
  if (arms.length === 2 && !isStraight(mask)) {
    // Fill the bend's inside corner so the two median arms meet cleanly.
    const m = AVENUE.median;
    ctx.fillStyle = TONE.medianKerb;
    ctx.fillRect(0.5 - m, 0.5 - m, m * 2, m * 2);
    ctx.fillStyle = TONE.medianGrass;
    ctx.fillRect(0.5 - m + 0.016, 0.5 - m + 0.016, (m - 0.016) * 2, (m - 0.016) * 2);
  }
}
