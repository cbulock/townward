import { clamp } from '../../../shared/noise';
import { mix } from '../core/color';
import type { Face, IsoFrame } from '../core/iso';
import { faceTone, topTone } from '../core/light';

/**
 * The modern kit's core (D-096): any solid is a list of flat facets in 3D, each lit by its own
 * normal. Boxes only ever show two walls; facets let towers taper, twist, curve and lean, and
 * let roofs vault, while sharing the one lighting model (core/light.ts).
 */

/** View-space point: u, v in tiles, z in px. */
export type V3 = readonly [number, number, number];

/** Px of height that match one tile of ground distance, so normals mix both in one metric. */
export const Z_PER_TILE = 36;
/** Unit vector toward the camera (2:1 iso looks down at about 30°). */
const TO_CAMERA: V3 = [0.612, 0.612, 0.5];

export interface Facet {
  /** Corners in view space. Quads run bottom-start, bottom-end, top-end, top-start. */
  readonly pts: readonly V3[];
  /** Outward unit normal, z in the tile metric. */
  readonly n: V3;
}

/** A visible facet with its screen corners and how it sits in the light. */
export interface ScreenFacet extends Facet {
  readonly xy: readonly (readonly [number, number])[];
  /** 0 faces the lit SW side, 1 the shaded SE side. */
  readonly side: number;
  /** 0 for a wall, 1 for a flat roof. */
  readonly up: number;
  /** The box wall it is closest to (for night-light marks). */
  readonly face: Face;
  /** Height fractions of the whole solid at the facet's foot and top (for tall gradients). */
  readonly t0: number;
  readonly t1: number;
}

/** A surface material: paints one visible facet. */
export interface Skin {
  readonly base: string;
  paint(iso: IsoFrame, f: ScreenFacet): void;
}

/** Newell normal of a polygon, flipped to point away from `centre`. */
export function facet(pts: readonly V3[], centre: V3): Facet {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const az = a[2] / Z_PER_TILE;
    const bz = b[2] / Z_PER_TILE;
    nx += (a[1] - b[1]) * (az + bz);
    ny += (az - bz) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const len = Math.hypot(nx, ny, nz) || 1;
  let n: [number, number, number] = [nx / len, ny / len, nz / len];
  const m = mid(pts);
  const out = (m[0] - centre[0]) * n[0] + (m[1] - centre[1]) * n[1] + ((m[2] - centre[2]) / Z_PER_TILE) * n[2];
  if (out < 0) n = [-n[0], -n[1], -n[2]];
  return { pts, n };
}

export function mid(pts: readonly V3[]): V3 {
  let u = 0;
  let v = 0;
  let z = 0;
  for (const p of pts) {
    u += p[0];
    v += p[1];
    z += p[2];
  }
  return [u / pts.length, v / pts.length, z / pts.length];
}

/** Colour of a surface of `base` facing `side`/`up`, at height fraction t. */
export function toneOf(base: string, side: number, up: number, t: number): string {
  const wall = mix(faceTone(base, 'sw', t), faceTone(base, 'se', t), side);
  return up > 0.02 ? mix(wall, topTone(base), Math.min(1, up)) : wall;
}

/** Screen data for a facet, or null when it faces away from the camera. */
export function project(iso: IsoFrame, f: Facet, z0: number, z1: number): ScreenFacet | null {
  const [nu, nv, nz] = f.n;
  if (nu * TO_CAMERA[0] + nv * TO_CAMERA[1] + nz * TO_CAMERA[2] <= 0.01) return null;
  const h = Math.hypot(nu, nv);
  const side = h < 1e-6 ? 0.5 : clamp(0.5 + (nu - nv) / (2 * h), 0, 1);
  const span = Math.max(1, z1 - z0);
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of f.pts) {
    lo = Math.min(lo, p[2]);
    hi = Math.max(hi, p[2]);
  }
  return {
    ...f,
    xy: f.pts.map((p) => iso.p(p[0], p[1], p[2])),
    side,
    up: Math.max(0, nz),
    face: side < 0.5 ? 'sw' : 'se',
    t0: clamp((lo - z0) / span, 0, 1),
    t1: clamp((hi - z0) / span, 0, 1),
  };
}

/** Draw facets back to front (depth = u + v of their middle; lower first at equal depth). */
export function drawFacets(iso: IsoFrame, facets: readonly Facet[], skin: Skin, z0: number, z1: number) {
  const shown: ScreenFacet[] = [];
  for (const f of facets) {
    const s = project(iso, f, z0, z1);
    if (s) shown.push(s);
  }
  const depth = (f: ScreenFacet) => {
    const m = mid(f.pts);
    return m[0] + m[1] + m[2] * 0.0005;
  };
  shown.sort((a, b) => depth(a) - depth(b));
  for (const f of shown) skin.paint(iso, f);
}

/** A point inside a quad facet at (a along it, t up it), both 0..1, in screen space. */
export function onQuad(f: ScreenFacet, a: number, t: number): [number, number] {
  const [p0, p1, p2, p3] = f.xy;
  const bx = p0[0] + (p1[0] - p0[0]) * a;
  const by = p0[1] + (p1[1] - p0[1]) * a;
  const tx = p3[0] + (p2[0] - p3[0]) * a;
  const ty = p3[1] + (p2[1] - p3[1]) * a;
  return [bx + (tx - bx) * t, by + (ty - by) * t];
}

/** Fill a screen polygon, stroking it in the same colour so neighbouring facets meet without hairlines. */
export function fillShape(iso: IsoFrame, xy: readonly (readonly [number, number])[], fill: string | CanvasGradient, seam = true) {
  const c = iso.ctx;
  c.beginPath();
  c.moveTo(xy[0][0], xy[0][1]);
  for (let k = 1; k < xy.length; k++) c.lineTo(xy[k][0], xy[k][1]);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (seam) {
    c.strokeStyle = fill;
    c.lineWidth = 0.35;
    c.lineJoin = 'round';
    c.stroke();
  }
}

/** A vertical gradient across a facet's screen extent. */
export function facetGradient(iso: IsoFrame, f: ScreenFacet, top: string, bottom: string): CanvasGradient {
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of f.xy) {
    y0 = Math.min(y0, p[1]);
    y1 = Math.max(y1, p[1]);
  }
  const g = iso.ctx.createLinearGradient(0, y0, 0, Math.max(y0 + 0.01, y1));
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  return g;
}
