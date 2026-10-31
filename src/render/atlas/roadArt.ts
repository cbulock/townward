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

function paintStreet(ctx: CanvasRenderingContext2D, mask: number) {
  const hw = 0.3;
  const arms = bits(mask);
  const junction = arms.length >= 3;
  body(ctx, mask, hw + 0.1, '#9d978b'); // curb shadow
  body(ctx, mask, hw + 0.08, '#cfc9bc'); // sidewalk
  body(ctx, mask, hw, '#4b4f57'); // asphalt
  // Subtle asphalt speckle for texture.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  for (let k = 0; k < 14; k++) ctx.fillRect(0.5 - hw + ((k * 37) % 23) / 40, 0.5 - hw + ((k * 53) % 19) / 33, 0.02, 0.02);

  if (junction) {
    // Zebra crossings at each arm entrance.
    ctx.fillStyle = '#f1f1ec';
    for (const b of arms) {
      for (let o = -hw + 0.05; o < hw - 0.03; o += 0.1) armQuad(ctx, b, hw + 0.02, hw + 0.12, o, o + 0.05);
    }
  } else {
    // Dashed centre line; on straights and corners it runs through the centre.
    for (const b of arms) dashes(ctx, b, 0, 0, 0.018, '#f3d548', DASHES);
    if (arms.length === 2 && !isStraight(mask)) {
      ctx.fillStyle = '#f3d548';
      ctx.fillRect(0.482, 0.482, 0.036, 0.036);
    }
  }
}

function paintHighway(ctx: CanvasRenderingContext2D, mask: number) {
  const hw = 0.44;
  const arms = bits(mask);
  const junction = arms.length >= 3;
  body(ctx, mask, hw + 0.05, '#7d838c'); // shoulder / barrier
  body(ctx, mask, hw + 0.03, '#c3c8ce'); // guard rail
  body(ctx, mask, hw, '#3d4149'); // asphalt
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  for (let k = 0; k < 18; k++) ctx.fillRect(0.5 - hw + ((k * 37) % 29) / 33, 0.5 - hw + ((k * 53) % 31) / 35, 0.02, 0.02);

  const from = junction || !isStraight(mask) ? hw : 0;
  for (const b of arms) {
    // Solid white edge lines, dashed lane lines, and a concrete median with yellow edges.
    dashes(ctx, b, from, -hw + 0.04, 0.012, '#eceff2', [[0, 0.52]]);
    dashes(ctx, b, from, hw - 0.04, 0.012, '#eceff2', [[0, 0.52]]);
    dashes(ctx, b, from, -0.22, 0.013, '#e4e7ea', DASHES);
    dashes(ctx, b, from, 0.22, 0.013, '#e4e7ea', DASHES);
    if (!junction) {
      dashes(ctx, b, 0, 0, 0.035, '#f0c93a', [[0, 0.52]]);
      dashes(ctx, b, 0, 0, 0.018, '#cfd3d8', [[0, 0.52]]);
    }
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
  const edge = highway ? 0.5 : 0.41;
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
