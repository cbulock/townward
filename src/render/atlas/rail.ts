import { ARMS, armQuad, body, bits, dashes, inTileSpace } from './roads/kit';

/**
 * Rail track pieces (docs/specs/evolution.md, E7b), painted in tile space like roads: a ballast
 * bed, timber sleepers and two steel rails along each arm. Bridges sit the track on a concrete
 * deck with railings; over roads it rides a raised overpass (paintOverpass), never at grade.
 */

/** Track on the ground, track on a water bridge, and the shade an overpass casts on the road under it. */
export const RAIL_LOOKS = ['track', 'bridge', 'shade'] as const;
export type RailLook = (typeof RAIL_LOOKS)[number];

/** Double track (D-091): each direction's track sits LANE either side of the centre line (sim TRAINS.lane). */
const LANE = 0.11;
/** Half the gauge: each rail's offset from its track's centre. */
const GAUGE = 0.045;
/** Both tracks' rails, as offsets from the centre line. */
const RAILS = [-LANE - GAUGE, -LANE + GAUGE, LANE - GAUGE, LANE + GAUGE] as const;
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
    body(ctx, m, 0.3, '#6f757c'); // deck edge
    body(ctx, m, 0.28, '#a9aeb4'); // deck
    for (const b of arms) for (const o of [-0.285, 0.285]) dashes(ctx, b, 0, o, 0.012, '#4e545a', [[0, 0.52]]);
  }
  if (look === 'shade') {
    // Shade under an overpass deck, on the road below.
    body(ctx, m, 0.34, 'rgba(10, 14, 20, 0.32)');
    return;
  }
  body(ctx, m, 0.25, '#7d7466'); // ballast shoulder
  body(ctx, m, 0.22, '#968b79'); // ballast top
  ctx.fillStyle = 'rgba(0, 0, 0, 0.07)';
  for (let k = 0; k < 14; k++) ctx.fillRect(0.3 + ((k * 37) % 39) / 100, 0.3 + ((k * 53) % 41) / 100, 0.015, 0.015);
  // Sleepers under each track, then each track's two rails: a dark web under a bright head.
  for (const b of arms) for (const o of [-LANE, LANE]) dashes(ctx, b, 0, o, 0.085, TIMBER, SLEEPERS);
  ctx.fillStyle = TIMBER;
  for (const o of [-LANE, LANE]) ctx.fillRect(0.5 - 0.085, 0.5 + o - 0.018, 0.17, 0.036);
  for (const b of arms) {
    for (const o of RAILS) {
      dashes(ctx, b, 0, o, 0.013, STEEL_SHADE, [[0, 0.52]]);
      dashes(ctx, b, 0, o - 0.003, 0.007, STEEL, [[0, 0.52]]);
    }
  }
}

/** How a corner of track is drawn (sim/rail.ts railCornerShape): a quarter-turn arc or a 45° chord. */
export const RAIL_CURVES = ['arc', 'chord'] as const;
export type RailCurve = (typeof RAIL_CURVES)[number];

/**
 * A corner piece of track as a curve (curved track, D-089): from the middle of one arm's edge
 * to the other's, either straight (a chord, so staircases read as one 45° line) or bowed through
 * the tile centre (an arc). Ballast, sleepers and rails follow the curve, with the same widths
 * as straight track so pieces meet seamlessly at the tile edges.
 */
export function paintTrackCurve(ctx: CanvasRenderingContext2D, mask: number, curve: RailCurve) {
  const [b1, b2] = bits(mask);
  const end = (b: number): [number, number] => [0.5 + ARMS[b].d[0] * 0.5, 0.5 + ARMS[b].d[1] * 0.5];
  const p1 = end(b1);
  const p2 = end(b2);
  const c: [number, number] = [0.5, 0.5];
  const N = 20;
  // Points and unit normals along the curve, slightly past both edges so neighbours overlap.
  const pts: { x: number; y: number; nx: number; ny: number }[] = [];
  for (let k = 0; k <= N; k++) {
    const t = -0.02 + (k / N) * 1.04;
    const x = curve === 'arc' ? (1 - t) * (1 - t) * p1[0] + 2 * t * (1 - t) * c[0] + t * t * p2[0] : p1[0] + (p2[0] - p1[0]) * t;
    const y = curve === 'arc' ? (1 - t) * (1 - t) * p1[1] + 2 * t * (1 - t) * c[1] + t * t * p2[1] : p1[1] + (p2[1] - p1[1]) * t;
    const tx = curve === 'arc' ? 2 * (1 - t) * (c[0] - p1[0]) + 2 * t * (p2[0] - c[0]) : p2[0] - p1[0];
    const ty = curve === 'arc' ? 2 * (1 - t) * (c[1] - p1[1]) + 2 * t * (p2[1] - c[1]) : p2[1] - p1[1];
    const len = Math.hypot(tx, ty) || 1;
    pts.push({ x, y, nx: -ty / len, ny: tx / len });
  }
  const band = (half: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    pts.forEach((p, k) => (k === 0 ? ctx.moveTo(p.x + p.nx * half, p.y + p.ny * half) : ctx.lineTo(p.x + p.nx * half, p.y + p.ny * half)));
    for (let k = pts.length - 1; k >= 0; k--) ctx.lineTo(pts[k].x - pts[k].nx * half, pts[k].y - pts[k].ny * half);
    ctx.closePath();
    ctx.fill();
  };
  const line = (offset: number, width: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    pts.forEach((p, k) => (k === 0 ? ctx.moveTo(p.x + p.nx * offset, p.y + p.ny * offset) : ctx.lineTo(p.x + p.nx * offset, p.y + p.ny * offset)));
    ctx.stroke();
  };
  band(0.25, '#7d7466');
  band(0.22, '#968b79');
  // Sleepers every ~1/8 tile under each track.
  ctx.fillStyle = TIMBER;
  for (let k = 1; k < N; k += 2) {
    const p = pts[k];
    const tx = p.ny;
    const ty = -p.nx;
    const hw = 0.085;
    const ht = 0.0175;
    for (const lane of [-LANE, LANE]) {
      const cx = p.x + p.nx * lane;
      const cy = p.y + p.ny * lane;
      ctx.beginPath();
      ctx.moveTo(cx + p.nx * hw + tx * ht, cy + p.ny * hw + ty * ht);
      ctx.lineTo(cx - p.nx * hw + tx * ht, cy - p.ny * hw + ty * ht);
      ctx.lineTo(cx - p.nx * hw - tx * ht, cy - p.ny * hw - ty * ht);
      ctx.lineTo(cx + p.nx * hw - tx * ht, cy + p.ny * hw - ty * ht);
      ctx.closePath();
      ctx.fill();
    }
  }
  for (const o of RAILS) {
    line(o, 0.026, STEEL_SHADE);
    line(o - 0.003, 0.014, STEEL);
  }
}

/** How far an overpass deck rides above the road, in px (the frame is this much taller). */
export const OVERPASS_LIFT = 7;

/**
 * Track carried over a road (D-091): concrete piers at both ends of the span, the deck's side
 * face, then the deck with its track and railings on top, LIFT px up. Drawn as an object, so
 * cars pass under it.
 */
export function paintOverpass(ctx: CanvasRenderingContext2D, mask: number) {
  const m = mask === 0 ? 0b1010 : mask;
  const arms = bits(m);
  for (let px = 0; px <= OVERPASS_LIFT; px++) {
    inTileSpace(
      ctx,
      () => {
        ctx.fillStyle = px === OVERPASS_LIFT ? '#c9cdd2' : '#8e949b';
        for (const b of arms) armQuad(ctx, b, 0.4, 0.5, -0.24, 0.24); // piers at the span's ends
      },
      OVERPASS_LIFT - px,
      false,
    );
  }
  for (let px = 0; px < OVERPASS_LIFT; px++) inTileSpace(ctx, () => body(ctx, m, 0.3, '#6f757c'), OVERPASS_LIFT - px - 1, false);
  inTileSpace(ctx, () => paintTrack(ctx, m, 'bridge'), 0, false);
}
