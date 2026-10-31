import { smoothstep } from '../../shared/noise';
import { mulberry32 } from '../../shared/rng';
import { frameToTileUV } from './geometry';

/**
 * Pixel masks for dual-grid terrain transitions (see render/transitions.ts).
 *
 * A dual cell's corners carry 0/1 values (the corner mask). The visible
 * boundary is the 0.5 contour of a smoothed bilinear blend of those values,
 * i.e. marching squares with rounded corners. A small wobble breaks up
 * straight lines; it is forced to zero on the cell's edges, so the contour
 * always crosses an edge at its midpoint and neighbouring cells line up exactly.
 */
export const WOBBLE_VARIANTS = 3;

export interface MaskShape {
  /** Contour wobble strength (field units). */
  amp: number;
  /** Half-width of the alpha falloff (field units). Small = crisp pixel-art edge. */
  soft: number;
  /** Optional darker line just inside the contour (field units wide). */
  rim?: { rgb: readonly [number, number, number]; width: number; strength: number };
}

/** Land over anything: crisp. Foam uses the same wobble, so it hugs the shoreline. */
export const LAND_SHAPE: MaskShape = { amp: 0.12, soft: 0.018 };
/** Grass edges get a darker green rim, like a pixel-art outline. */
export const GRASS_SHAPE: MaskShape = { ...LAND_SHAPE, rim: { rgb: [52, 140, 38], width: 0.07, strength: 0.85 } };
/** Shallow water fading over deep: wide and soft. */
export const SHALLOW_SHAPE: MaskShape = { amp: 0.15, soft: 0.2 };

interface Wave {
  a: number;
  b: number;
  phase: number;
  weight: number;
}

/** A couple of low-frequency waves per variant; fixed by seed so frames are deterministic. */
const WOBBLES: readonly (readonly Wave[])[] = Array.from({ length: WOBBLE_VARIANTS }, (_, w) => {
  const rng = mulberry32(9100 + w * 17);
  return [0.65, 0.35].map((weight) => ({
    a: 0.6 + rng() * 1.1,
    b: (0.6 + rng() * 1.1) * (rng() < 0.5 ? -1 : 1),
    phase: rng() * Math.PI * 2,
    weight,
  }));
});

/** Halfway between linear and smoothstep: rounder corners than plain bilinear, not blobby. */
function ease(x: number) {
  return 0.5 * x + 0.5 * x * x * (3 - 2 * x);
}

/** Signed contour field: > 0 inside the masked region. */
function field(s: number, t: number, mask: number, w: number, amp: number): number {
  const S = ease(s);
  const T = ease(t);
  const c0 = mask & 1 ? 1 : 0;
  const c1 = mask & 2 ? 1 : 0;
  const c2 = mask & 4 ? 1 : 0;
  const c3 = mask & 8 ? 1 : 0;
  const f = c0 * (1 - S) * (1 - T) + c1 * S * (1 - T) + c2 * S * T + c3 * (1 - S) * T;

  let g = 0;
  for (const wave of WOBBLES[w]) g += wave.weight * Math.sin(2 * Math.PI * (wave.a * s + wave.b * t) + wave.phase);
  const envelope = Math.sin(Math.PI * s) * Math.sin(Math.PI * t);
  return f + amp * envelope * g - 0.5;
}

/** Map a frame pixel to dual-cell space, or null when it lies outside the diamond grown by ~SEAM_OVERLAP. */
function cellCoords(px: number, py: number, resolution: number) {
  const { u, v } = frameToTileUV((px + 0.5) / resolution, (py + 0.5) / resolution);
  if (u < -0.05 || v < -0.05 || u > 1.05 || v > 1.05) return null;
  return { s: Math.min(1, Math.max(0, u)), t: Math.min(1, Math.max(0, v)) };
}

/** Copy `src` (a full ground tile painted at `resolution`×), keeping only the masked region with a soft edge. */
export function maskedOverlay(src: ImageData, resolution: number, mask: number, w: number, shape: MaskShape): ImageData {
  const out = new ImageData(src.width, src.height);
  const s = src.data;
  const d = out.data;
  for (let py = 0; py < src.height; py++) {
    for (let px = 0; px < src.width; px++) {
      const o = (py * src.width + px) * 4;
      if (s[o + 3] === 0) continue;
      const c = cellCoords(px, py, resolution);
      if (!c) continue;
      const f = field(c.s, c.t, mask, w, shape.amp);
      const a = smoothstep(-shape.soft, shape.soft, f);
      if (a <= 0) continue;
      let r = s[o];
      let g = s[o + 1];
      let b = s[o + 2];
      if (shape.rim) {
        const k = (1 - smoothstep(shape.rim.width - 0.015, shape.rim.width, f)) * shape.rim.strength;
        r += (shape.rim.rgb[0] - r) * k;
        g += (shape.rim.rgb[1] - g) * k;
        b += (shape.rim.rgb[2] - b) * k;
      }
      d[o] = r;
      d[o + 1] = g;
      d[o + 2] = b;
      // Ignore the source's anti-aliased diamond edge: inside the cell the overlay must be opaque,
      // or the cell's base terrain shows through as a hairline seam against the neighbouring cell.
      d[o + 3] = Math.round(255 * a);
    }
  }
  return out;
}

/** Solid light-cyan surf band just outside the land contour, on the water side. */
export function foamOverlay(width: number, height: number, resolution: number, mask: number, w: number): ImageData {
  const out = new ImageData(width, height);
  const d = out.data;
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const c = cellCoords(px, py, resolution);
      if (!c) continue;
      const f = field(c.s, c.t, mask, w, LAND_SHAPE.amp);
      const ring = smoothstep(-0.15, -0.13, f) * (1 - smoothstep(-0.02, 0, f));
      if (ring <= 0.01) continue;
      const o = (py * width + px) * 4;
      d[o] = 196;
      d[o + 1] = 238;
      d[o + 2] = 255;
      d[o + 3] = Math.round(ring * 235);
    }
  }
  return out;
}
