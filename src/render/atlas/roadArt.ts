import { HALF_H, HALF_W } from '../../shared/constants';
import { BridgeAxis, bridgeAxisMask, RoadType, type BuildableRoad } from '../../sim/roads';
import { BRIDGE_HEADROOM, GROUND_PAD } from './geometry';

/**
 * Road pieces for all 16 connection masks, painted in tile space.
 * The canvas is transformed so (u, v) ∈ [0,1]² maps onto the iso diamond;
 * everything is drawn as simple rectangles along "arms" from the tile centre.
 *
 * Mask bits: 0 NE (toward v = 0), 1 SE (u = 1), 2 SW (v = 1), 3 NW (u = 0).
 */

/** Unit direction of each arm in (u, v), and the lateral axis across it. */
const ARMS: readonly { d: readonly [number, number]; p: readonly [number, number] }[] = [
  { d: [0, -1], p: [1, 0] },
  { d: [1, 0], p: [0, 1] },
  { d: [0, 1], p: [1, 0] },
  { d: [-1, 0], p: [0, 1] },
];

const bits = (mask: number) => [0, 1, 2, 3].filter((b) => mask & (1 << b));

/** Fill the quad covering s ∈ [s0, s1] along arm `b`, lateral offset o ∈ [o0, o1]. */
function armQuad(ctx: CanvasRenderingContext2D, b: number, s0: number, s1: number, o0: number, o1: number) {
  const { d, p } = ARMS[b];
  const pt = (s: number, o: number): [number, number] => [0.5 + d[0] * s + p[0] * o, 0.5 + d[1] * s + p[1] * o];
  const q = [pt(s0, o0), pt(s1, o0), pt(s1, o1), pt(s0, o1)];
  ctx.beginPath();
  ctx.moveTo(q[0][0], q[0][1]);
  for (let k = 1; k < 4; k++) ctx.lineTo(q[k][0], q[k][1]);
  ctx.closePath();
  ctx.fill();
}

/** Centre square plus an arm per connection, all of half-width `hw`. */
function body(ctx: CanvasRenderingContext2D, mask: number, hw: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(0.5 - hw, 0.5 - hw, hw * 2, hw * 2);
  for (const b of bits(mask)) armQuad(ctx, b, 0, 0.5 + 0.02, -hw, hw);
}

/** Dashes along an arm. Dash positions are measured so they line up across tile edges. */
function dashes(
  ctx: CanvasRenderingContext2D,
  b: number,
  from: number,
  offset: number,
  width: number,
  color: string,
  pattern: readonly (readonly [number, number])[],
) {
  ctx.fillStyle = color;
  for (const [s0, s1] of pattern) {
    if (s1 <= from) continue;
    armQuad(ctx, b, Math.max(s0, from), s1, offset - width, offset + width);
  }
}

const DASHES: readonly (readonly [number, number])[] = [
  [0.04, 0.17],
  [0.29, 0.42],
];

function isStraight(mask: number) {
  return mask === 0b0101 || mask === 0b1010;
}

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

/** Paint only where something is already drawn (keeps joints on the footpath). */
function onTop(ctx: CanvasRenderingContext2D, paint: () => void) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  paint();
  ctx.restore();
}

/** Lateral sign (along the arm's p axis) of the lane that drives in toward the junction on arm `b`. */
function incomingSide(b: number): number {
  const { d, p } = ARMS[b];
  // Heading in is −d; drivers keep right, and right of heading (hx, hy) is (−hy, hx).
  const right: [number, number] = [d[1], -d[0]];
  return Math.sign(right[0] * p[0] + right[1] * p[1]);
}

function paintStreet(ctx: CanvasRenderingContext2D, mask: number) {
  const { road, kerb, footpath, zebra } = STREET;
  const arms = bits(mask);
  const junction = arms.length >= 3;
  // Footpath: an edge, then paving with joints, all the way round junction corners.
  body(ctx, mask, footpath, '#b7b0a2');
  body(ctx, mask, footpath - 0.015, '#d8d2c5');
  onTop(ctx, () => {
    ctx.fillStyle = 'rgba(90, 80, 60, 0.13)';
    for (let a = 0.1; a < 1; a += 0.1) {
      ctx.fillRect(a, 0, 0.008, 1);
      ctx.fillRect(0, a, 1, 0.008);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    for (let k = 0; k < 10; k++) ctx.fillRect(((k * 37) % 19) / 19, ((k * 53) % 17) / 17, 0.1, 0.1);
  });
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

/** Highway cross-section: barriers at the edges, two lanes each way, a jersey barrier in the middle. */
export const HIGHWAY = {
  road: 0.46,
  /** Dashed line between the two lanes of each carriageway. */
  laneLine: 0.22,
} as const;

function paintHighway(ctx: CanvasRenderingContext2D, mask: number) {
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

/**
 * Set up the (u, v) → iso diamond transform (the diamond's top vertex `offsetY` px below the
 * frame top), optionally clipped slightly past the tile so connected pieces overlap.
 */
function inTileSpace(ctx: CanvasRenderingContext2D, paint: () => void, offsetY = 0, clip = true) {
  ctx.save();
  ctx.transform(HALF_W, HALF_H, -HALF_W, HALF_H, GROUND_PAD + HALF_W, GROUND_PAD + offsetY);
  if (clip) {
    ctx.beginPath();
    ctx.rect(-0.02, -0.02, 1.04, 1.04);
    ctx.clip();
  }
  paint();
  ctx.restore();
}

/** In tile space, moving (d, d) shifts straight down on screen by 2·HALF_H·d px. */
const PX = 1 / (2 * HALF_H);

function paintDeck(ctx: CanvasRenderingContext2D, type: BuildableRoad, mask: number) {
  if (type === RoadType.Highway) paintHighway(ctx, mask);
  else paintStreet(ctx, mask);
}

export function paintRoad(ctx: CanvasRenderingContext2D, type: BuildableRoad, mask: number) {
  inTileSpace(ctx, () => paintDeck(ctx, type, mask));
}

/**
 * A bridge span, built up back to front like a little diorama:
 *   shadow on the water → piers with ripple rings → girder (deck thickness)
 *   → deck (same markings as the road, so it meets the shore road seamlessly)
 *   → parapet walls with a lit top edge → lamp posts.
 * The deck stays at ground level; height is suggested by everything hanging below it
 * into the water. Drawn in a taller frame: BRIDGE_HEADROOM above, BRIDGE_DROP below.
 */
export function paintBridge(ctx: CanvasRenderingContext2D, type: BuildableRoad, axis: number) {
  const mask = bridgeAxisMask(axis);
  const highway = type === RoadType.Highway;
  /** Half-width of the whole deck, out to the parapets. */
  const edge = highway ? 0.5 : STREET.footpath + 0.02;
  /** One arm along the span; its lateral +o side is the one facing the viewer. */
  const along = axis === BridgeAxis.X ? 1 : 0;
  const shift = (px: number, paint: () => void) => {
    ctx.save();
    ctx.translate(px * PX, px * PX);
    paint();
    ctx.restore();
  };
  const fill = (color: string, paint: () => void) => {
    ctx.fillStyle = color;
    paint();
  };

  inTileSpace(
    ctx,
    () => {
      // Shadow on the water, well below the deck.
      shift(11, () => body(ctx, mask, edge, 'rgba(8, 38, 90, 0.24)'));

      // Piers: a pair of concrete columns under the middle of each span tile.
      const PIER_DEPTH = 16;
      for (const o of [-edge * 0.55, edge * 0.55]) {
        shift(PIER_DEPTH, () => fill('rgba(205, 240, 255, 0.4)', () => armQuad(ctx, along, -0.08, 0.08, o - 0.08, o + 0.08)));
        for (let px = PIER_DEPTH; px >= 4; px--) {
          const t = (px - 4) / (PIER_DEPTH - 4);
          const shade = Math.round(122 - 46 * t);
          shift(px, () => fill(`rgb(${shade}, ${shade + 6}, ${shade + 14})`, () => armQuad(ctx, along, -0.055, 0.055, o - 0.055, o + 0.055)));
        }
      }

      // Girder: the deck's thickness, darker toward its underside.
      for (let px = 7; px >= 1; px--) shift(px, () => body(ctx, mask, edge, px >= 6 ? '#3e444c' : '#6a717a'));
      // Lighter lip where the deck slab meets the girder.
      shift(1, () => body(ctx, mask, edge, '#9aa0a8'));
    },
    BRIDGE_HEADROOM,
    false,
  );

  inTileSpace(ctx, () => paintDeck(ctx, type, mask), BRIDGE_HEADROOM);

  inTileSpace(
    ctx,
    () => {
      // Parapet walls: a face built up a few px, capped with a lit top.
      for (const b of bits(mask)) {
        for (let px = 0; px >= -3; px--) {
          const color = px === -3 ? '#f4f1ea' : '#aeaaa1';
          shift(px, () =>
            fill(color, () => {
              armQuad(ctx, b, -0.02, 0.52, edge - 0.04, edge);
              armQuad(ctx, b, -0.02, 0.52, -edge, -edge + 0.04);
            }),
          );
        }
      }
      // A lamp post on the far parapet, mid-span.
      const POLE = 13;
      for (let px = 0; px >= -POLE; px--) {
        shift(px, () => fill('#5b6169', () => armQuad(ctx, along, -0.015, 0.015, -edge + 0.005, -edge + 0.035)));
      }
      shift(-POLE - 1, () => fill('#fff3bf', () => armQuad(ctx, along, -0.04, 0.04, -edge, -edge + 0.06)));
      shift(-POLE + 1, () => fill('rgba(255, 236, 160, 0.35)', () => armQuad(ctx, along, -0.08, 0.08, -edge - 0.03, -edge + 0.1)));
    },
    BRIDGE_HEADROOM,
    false,
  );
}
