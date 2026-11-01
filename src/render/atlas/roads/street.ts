import type { PavementStyle } from '../../../sim/roadTypes';
import { armQuad, bits, body, DASHES, dashes, incomingSide, isStraight } from './kit';
import { pavingLook, pavingPattern } from './paving';

/**
 * Street cross-section (tile units from the centre line), docs/specs/city-art.md. Agents use
 * matching offsets in sim/systems/traffic.ts: cars at 0.13, pedestrians on the footpath at 0.37.
 */
export const STREET = {
  /** Carriageway half-width. */
  road: 0.26,
  /** Outer edge of the kerb stone. */
  kerb: 0.285,
  /** Outer edge of the footpath. */
  footpath: 0.48,
  /** Zebra crossings span this range along each arm (centred on the footpath line). */
  zebra: [0.3, 0.44] as const,
} as const;

export function paintStreet(ctx: CanvasRenderingContext2D, mask: number, style: PavementStyle = 'concrete') {
  const { road, kerb, footpath, zebra } = STREET;
  const arms = bits(mask);
  const junction = arms.length >= 3;
  // Footpath: an edge, then paving with joints, all the way round junction corners.
  const look = pavingLook(style);
  body(ctx, mask, footpath, look.edge);
  body(ctx, mask, footpath - 0.015, look.base);
  pavingPattern(ctx, style);
  // Kerb stone, gutter, then the carriageway.
  body(ctx, mask, kerb, '#f0eee8');
  body(ctx, mask, road + 0.01, '#8a8780');
  body(ctx, mask, road, '#4b4f57');
  // Subtle asphalt speckle for texture.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  for (let k = 0; k < 14; k++) ctx.fillRect(0.5 - road + ((k * 37) % 23) / 44, 0.5 - road + ((k * 53) % 19) / 36, 0.02, 0.02);

  if (junction) {
    for (const b of arms) {
      // Zebra crossing where the footpath line crosses the side road, and a stop line before it.
      ctx.fillStyle = '#f1f1ec';
      for (let o = -road + 0.03; o < road - 0.02; o += 0.075) armQuad(ctx, b, zebra[0], zebra[1], o, o + 0.04);
      const side = incomingSide(b);
      ctx.fillStyle = '#f1f1ec';
      armQuad(ctx, b, zebra[1] + 0.02, zebra[1] + 0.045, side > 0 ? 0.01 : -road + 0.02, side > 0 ? road - 0.02 : -0.01);
      // Short centre line up to the stop line.
      dashes(ctx, b, zebra[1] + 0.02, 0, 0.012, '#f3d548', [[0, 0.52]]);
    }
  } else {
    // Dashed centre line; on straights and corners it runs through the centre.
    for (const b of arms) dashes(ctx, b, 0, 0, 0.016, '#f3d548', DASHES);
    if (arms.length === 2 && !isStraight(mask)) {
      ctx.fillStyle = '#f3d548';
      ctx.fillRect(0.484, 0.484, 0.032, 0.032);
    }
  }
}
