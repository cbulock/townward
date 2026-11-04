import { BridgeAxis, bridgeAxisMask, type BuildableRoad } from '../../sim/roads';
import { BRIDGE_HEADROOM } from './geometry';
import { ROAD_ART } from './roads';
import { armQuad, bits, body, inTileSpace, PX } from './roads/kit';

/**
 * Road and bridge pieces for every road type and all 16 connection masks. Each road type's
 * look lives in its own module under roads/ (D-066); this file paints them into atlas frames.
 */

export function paintRoad(ctx: CanvasRenderingContext2D, type: BuildableRoad, mask: number, variant = 0) {
  inTileSpace(ctx, () => ROAD_ART[type].paint(ctx, mask, variant));
}

/**
 * A bridge span, built up back to front like a little diorama:
 *   shadow on the water → piers with ripple rings → girder (deck thickness)
 *   → deck (same markings as the road, so it meets the shore road seamlessly)
 *   → parapet walls with a lit top edge → lamp posts.
 * The deck stays at ground level; height is suggested by everything hanging below it
 * into the water. Drawn in a taller frame: BRIDGE_HEADROOM above, BRIDGE_DROP below.
 */
export function paintBridge(ctx: CanvasRenderingContext2D, type: BuildableRoad, axis: number, variant = 0) {
  const mask = bridgeAxisMask(axis);
  /** Half-width of the whole deck, out to the parapets. */
  const edge = ROAD_ART[type].deckEdge;
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

  inTileSpace(ctx, () => ROAD_ART[type].paint(ctx, mask, variant), BRIDGE_HEADROOM);

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

/** How far a flyover deck rides above the road under it, in px (its frame is this much taller). */
export const DECK_LIFT = 8;

/**
 * A flyover deck (docs/specs/transport.md, TX2): the road straight along one axis, LIFT px up,
 * on concrete piers at both ends of the span, with the deck's side face and parapets. Drawn
 * with the objects, so the traffic underneath passes below it.
 */
export function paintDeck(ctx: CanvasRenderingContext2D, type: BuildableRoad, axis: 1 | 2) {
  const mask = axis === 1 ? 0b1010 : 0b0101;
  const edge = ROAD_ART[type].deckEdge;
  const fill = (color: string, paint: () => void) => {
    ctx.fillStyle = color;
    paint();
  };
  // Piers at the span's two ends, then the deck's thickness, then the road on top.
  for (let px = 0; px <= DECK_LIFT; px++) {
    inTileSpace(
      ctx,
      () => fill(px === DECK_LIFT ? '#c9cdd2' : '#8e949b', () => {
        for (const b of bits(mask)) armQuad(ctx, b, 0.38, 0.5, -edge + 0.04, edge - 0.04);
      }),
      DECK_LIFT - px,
      false,
    );
  }
  for (let px = 1; px < DECK_LIFT; px++) inTileSpace(ctx, () => body(ctx, mask, edge + 0.02, '#6f757c'), DECK_LIFT - px, false);
  inTileSpace(ctx, () => ROAD_ART[type].paint(ctx, mask, 0), 0, false);
  // Parapets along both sides.
  inTileSpace(
    ctx,
    () => fill('#e4e1da', () => {
      for (const b of bits(mask)) {
        armQuad(ctx, b, -0.02, 0.52, edge - 0.03, edge);
        armQuad(ctx, b, -0.02, 0.52, -edge, -edge + 0.03);
      }
    }),
    0,
    false,
  );
}
