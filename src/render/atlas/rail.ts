import { body, bits, dashes } from './roads/kit';

/**
 * Rail track pieces (docs/specs/evolution.md, E7b), painted in tile space like roads: a ballast
 * bed, timber sleepers and two steel rails along each arm. Crossings drop the ballast for a
 * rubber panel over the road; bridges sit the track on a concrete deck with railings.
 */

export const RAIL_LOOKS = ['track', 'crossing', 'bridge'] as const;
export type RailLook = (typeof RAIL_LOOKS)[number];

/** Half the gauge: each rail's offset from the centre line. */
const GAUGE = 0.075;
const SLEEPERS: readonly (readonly [number, number])[] = [
  [0.03, 0.065],
  [0.155, 0.19],
  [0.28, 0.315],
  [0.405, 0.44],
];
const STEEL = '#cfd5dc';
const STEEL_SHADE = '#5b6168';
const TIMBER = '#6e4b30';

export function paintTrack(ctx: CanvasRenderingContext2D, mask: number, look: RailLook) {
  // A lone piece runs along u, like a fresh straight.
  const m = mask === 0 ? 0b1010 : mask;
  const arms = bits(m);
  if (look === 'bridge') {
    body(ctx, m, 0.26, '#6f757c'); // deck edge
    body(ctx, m, 0.24, '#a9aeb4'); // deck
    for (const b of arms) for (const o of [-0.245, 0.245]) dashes(ctx, b, 0, o, 0.012, '#4e545a', [[0, 0.52]]);
  }
  if (look === 'crossing') {
    body(ctx, m, 0.15, '#3d4046'); // rubber crossing panel over the road
    for (const b of arms) for (const o of [-0.15, 0.15]) dashes(ctx, b, 0, o, 0.01, '#f2f2f2', [[0, 0.52]]);
  } else {
    body(ctx, m, 0.2, '#7d7466'); // ballast shoulder
    body(ctx, m, 0.17, '#968b79'); // ballast top
    ctx.fillStyle = 'rgba(0, 0, 0, 0.07)';
    for (let k = 0; k < 14; k++) ctx.fillRect(0.35 + ((k * 37) % 29) / 100, 0.35 + ((k * 53) % 31) / 100, 0.015, 0.015);
    for (const b of arms) dashes(ctx, b, 0, 0, 0.145, TIMBER, SLEEPERS);
    ctx.fillStyle = TIMBER;
    ctx.fillRect(0.5 - 0.145, 0.5 - 0.02, 0.29, 0.04);
  }
  // Two rails per arm: a dark web under a bright head.
  for (const b of arms) {
    for (const o of [-GAUGE, GAUGE]) {
      dashes(ctx, b, 0, o, 0.016, STEEL_SHADE, [[0, 0.52]]);
      dashes(ctx, b, 0, o - 0.004, 0.009, STEEL, [[0, 0.52]]);
    }
  }
}
