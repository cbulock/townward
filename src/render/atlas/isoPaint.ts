import { HALF_H, HALF_W } from '../../shared/constants';
import { hexToRgb } from './palette';

/**
 * Shared helpers for painting iso objects (buildings, civic art, street furniture, vehicles).
 * Tile space (u, v) maps onto the diamond; z is height in px. The camera sees two walls:
 *   SW face (plane v = const): lit, on the left
 *   SE face (plane u = const): shaded, on the right
 */

export type Rng = () => number;
export type Face = 'sw' | 'se';

export interface Box {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

/** Projection for one frame: (u, v, z) → frame pixels, plus fill helpers. */
export class IsoFrame {
  constructor(
    readonly ctx: CanvasRenderingContext2D,
    private readonly ox: number,
    private readonly oy: number,
  ) {}

  p(u: number, v: number, z = 0): [number, number] {
    return [this.ox + (u - v) * HALF_W, this.oy + (u + v) * HALF_H - z];
  }

  poly(points: readonly (readonly [number, number])[], fill: string | CanvasGradient) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(points[0][0], points[0][1]);
    for (let k = 1; k < points.length; k++) c.lineTo(points[k][0], points[k][1]);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
  }

  /** Flat quad on the ground (or at height z). */
  floor(u0: number, u1: number, v0: number, v1: number, z: number, fill: string) {
    this.poly([this.p(u0, v0, z), this.p(u1, v0, z), this.p(u1, v1, z), this.p(u0, v1, z)], fill);
  }

  /**
   * Rectangle on a wall. `a` runs along the wall (u on SW, v on SE), z is height.
   * `at` is the wall's plane coordinate (v1 for SW, u1 for SE).
   */
  wall(face: Face, at: number, a0: number, a1: number, z0: number, z1: number, fill: string) {
    const q = (a: number, z: number) => (face === 'sw' ? this.p(a, at, z) : this.p(at, a, z));
    this.poly([q(a0, z0), q(a1, z0), q(a1, z1), q(a0, z1)], fill);
  }

  /** Axis box: back faces are hidden, so only the two visible walls and the top are drawn. */
  box(u0: number, u1: number, v0: number, v1: number, z0: number, z1: number, lit: string, shaded: string, top: string) {
    this.wall('sw', v1, u0, u1, z0, z1, lit);
    this.wall('se', u1, v0, v1, z0, z1, shaded);
    this.floor(u0, u1, v0, v1, z1, top);
  }

  /** Box from a base colour: lit, shaded and top tones derived from it. */
  solid(b: Box, z0: number, z1: number, color: string) {
    this.box(b.u0, b.u1, b.v0, b.v1, z0, z1, color, shade(color, -0.25), shade(color, 0.15));
  }

  /** Text lying on a wall plane (sheared to follow it). */
  text(face: Face, at: number, a: number, z: number, str: string, size: number, color: string) {
    const c = this.ctx;
    const [x, y] = face === 'sw' ? this.p(a, at, z) : this.p(at, a, z);
    c.save();
    c.translate(x, y);
    c.transform(1, face === 'sw' ? 0.5 : -0.5, 0, 1, 0, 0);
    c.font = `bold ${size}px Inter, system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = color;
    c.fillText(str, 0, 0);
    c.restore();
  }

  /** Screen radii of a tile-space circle of radius r (it projects to a 2:1 ellipse). */
  static ellipse(r: number): { rx: number; ry: number } {
    return { rx: r * HALF_W * Math.SQRT2, ry: r * HALF_H * Math.SQRT2 };
  }

  /** Flat disc (tile-space circle) at height z. */
  disc(u: number, v: number, r: number, z: number, fill: string) {
    const [x, y] = this.p(u, v, z);
    const { rx, ry } = IsoFrame.ellipse(r);
    const c = this.ctx;
    c.fillStyle = fill;
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
  }

  /**
   * Upright round shape (tank, tower, silo). `radius(t)` gives the tile-space radius at
   * height fraction t ∈ [0, 1], so the same routine draws cylinders and cooling towers.
   * Shaded left (lit) to right (dark); the top is an open rim or a lid.
   */
  round(u: number, v: number, z0: number, z1: number, radius: (t: number) => number, color: string, top: string | null) {
    const c = this.ctx;
    const [x, y0] = this.p(u, v, z0);
    const y1 = y0 - (z1 - z0);
    const STEPS = 12;
    const r0 = IsoFrame.ellipse(radius(0));
    const g = c.createLinearGradient(x - r0.rx, 0, x + r0.rx, 0);
    g.addColorStop(0, shade(color, 0.12));
    g.addColorStop(0.35, color);
    g.addColorStop(1, shade(color, -0.4));
    c.beginPath();
    // Left edge up, top, right edge down, then the front half of the base ellipse.
    for (let k = 0; k <= STEPS; k++) {
      const t = k / STEPS;
      c.lineTo(x - IsoFrame.ellipse(radius(t)).rx, y0 - (y0 - y1) * t);
    }
    for (let k = STEPS; k >= 0; k--) {
      const t = k / STEPS;
      c.lineTo(x + IsoFrame.ellipse(radius(t)).rx, y0 - (y0 - y1) * t);
    }
    c.ellipse(x, y0, r0.rx, r0.ry, 0, 0, Math.PI, false);
    c.closePath();
    c.fillStyle = g;
    c.fill();
    const r1 = IsoFrame.ellipse(radius(1));
    c.beginPath();
    c.ellipse(x, y1, r1.rx, r1.ry, 0, 0, Math.PI * 2);
    c.fillStyle = top ?? shade(color, 0.2);
    c.fill();
    if (top === null) {
      // Open top: dark inside with a lit rim.
      c.beginPath();
      c.ellipse(x, y1 + 0.4, r1.rx * 0.85, r1.ry * 0.8, 0, 0, Math.PI * 2);
      c.fillStyle = shade(color, -0.6);
      c.fill();
    }
  }
}

/** Parse '#rrggbb' or 'rgb(r, g, b)' (shade's own output, so shades can be chained). */
function parseColor(color: string): [number, number, number] {
  if (color.startsWith('#')) return hexToRgb(color);
  const m = color.match(/\d+(\.\d+)?/g);
  return m && m.length >= 3 ? [Number(m[0]), Number(m[1]), Number(m[2])] : [128, 128, 128];
}

/** Lighten (f > 0) or darken (f < 0) a colour. */
export function shade(color: string, f: number): string {
  const [r, g, b] = parseColor(color);
  const k = (c: number) => Math.round(Math.max(0, Math.min(255, f >= 0 ? c + (255 - c) * f : c * (1 + f))));
  return `rgb(${k(r)}, ${k(g)}, ${k(b)})`;
}

// ---------------------------------------------------------------- orientation

/** Quarter turns of the view; matches render/view/ViewTransform's Rotation. */
export type BuildingRotation = 0 | 1 | 2 | 3;
export const BUILDING_ROTATIONS: readonly BuildingRotation[] = [0, 1, 2, 3];

export type Side = 'front' | 'right' | 'back' | 'left';
const SIDES: readonly Side[] = ['front', 'right', 'back', 'left'];
/** Outward normal of each side in local building space (the front faces +v). */
const SIDE_DIR: Readonly<Record<Side, readonly [number, number]>> = {
  front: [0, 1],
  right: [1, 0],
  back: [0, -1],
  left: [-1, 0],
};

/**
 * Local building space (footprint w × h, front = +v) → view space after `r` quarter
 * turns, using the same mapping as ViewTransform so art and map rotate together.
 */
export class Orient {
  constructor(
    readonly r: BuildingRotation,
    readonly w: number,
    readonly h: number,
  ) {}

  get vw(): number {
    return this.r % 2 === 0 ? this.w : this.h;
  }

  get vh(): number {
    return this.r % 2 === 0 ? this.h : this.w;
  }

  point(u: number, v: number): [number, number] {
    switch (this.r) {
      case 0:
        return [u, v];
      case 1:
        return [this.h - v, u];
      case 2:
        return [this.w - u, this.h - v];
      case 3:
        return [v, this.w - u];
    }
  }

  rect(b: Box): Box {
    const [a0, c0] = this.point(b.u0, b.v0);
    const [a1, c1] = this.point(b.u1, b.v1);
    return { u0: Math.min(a0, a1), u1: Math.max(a0, a1), v0: Math.min(c0, c1), v1: Math.max(c0, c1) };
  }

  private dir(dx: number, dy: number): [number, number] {
    switch (this.r) {
      case 0:
        return [dx, dy];
      case 1:
        return [-dy, dx];
      case 2:
        return [-dx, -dy];
      case 3:
        return [dy, -dx];
    }
  }

  /** The camera-facing wall that shows a local side, or null if that side faces away. */
  faceOf(side: Side): Face | null {
    const [dx, dy] = this.dir(SIDE_DIR[side][0], SIDE_DIR[side][1]);
    if (dx === 0 && dy === 1) return 'sw';
    if (dx === 1 && dy === 0) return 'se';
    return null;
  }

  /** Which local side a camera-facing wall shows. */
  sideOf(face: Face): Side {
    for (const s of SIDES) if (this.faceOf(s) === face) return s;
    return 'front';
  }

  /** Axis a local-u feature (ridge, sawtooth) runs along in the view. */
  get uAxis(): 'u' | 'v' {
    return this.r % 2 === 0 ? 'u' : 'v';
  }
}

// ---------------------------------------------------------------- faces

/** A camera-facing wall of a box: its plane coordinate and the range along it (view space). */
export interface FaceRef {
  face: Face;
  at: number;
  a0: number;
  a1: number;
}

export function faceRef(face: Face, b: Box): FaceRef {
  return face === 'sw' ? { face, at: b.v1, a0: b.u0, a1: b.u1 } : { face, at: b.u1, a0: b.v0, a1: b.v1 };
}

/** View-space (u, v) of a point `a` along a face, `d` out from it. */
export function onFace(f: FaceRef, a: number, d: number): [number, number] {
  return f.face === 'sw' ? [a, f.at + d] : [f.at + d, a];
}

export function wallOn(iso: IsoFrame, f: FaceRef, a0: number, a1: number, z0: number, z1: number, fill: string, out = 0) {
  iso.wall(f.face, f.at + out, a0, a1, z0, z1, fill);
}

export function floorOut(iso: IsoFrame, f: FaceRef, a0: number, a1: number, d0: number, d1: number, z: number, fill: string) {
  if (f.face === 'sw') iso.floor(a0, a1, f.at + d0, f.at + d1, z, fill);
  else iso.floor(f.at + d0, f.at + d1, a0, a1, z, fill);
}

export function boxOut(
  iso: IsoFrame,
  f: FaceRef,
  a0: number,
  a1: number,
  d0: number,
  d1: number,
  z0: number,
  z1: number,
  lit: string,
  dark: string,
  top: string,
) {
  if (f.face === 'sw') iso.box(a0, a1, f.at + d0, f.at + d1, z0, z1, lit, dark, top);
  else iso.box(f.at + d0, f.at + d1, a0, a1, z0, z1, lit, dark, top);
}

export function pOn(iso: IsoFrame, f: FaceRef, a: number, d: number, z: number): [number, number] {
  const [u, v] = onFace(f, a, d);
  return iso.p(u, v, z);
}

// ---------------------------------------------------------------- shared props

/**
 * Something standing on the ground (tree, parked car, crate). Drawn back to front by
 * depth (u + v); props in front of a building's body are drawn after it.
 */
export interface Prop {
  u: number;
  v: number;
  draw: () => void;
}

export function inFront(p: Prop, b: Box): boolean {
  return p.u >= b.u1 || p.v >= b.v1;
}

const TREE_GREENS = ['#4fae3a', '#3f9a45', '#6bb83a', '#5aa64e'] as const;

/** A round deciduous tree standing at frame point (x, y). `size` 1 is about 20 px tall. */
export function paintRoundTree(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, tone: number) {
  const green = TREE_GREENS[tone % TREE_GREENS.length];
  const s = size;
  ctx.fillStyle = 'rgba(20, 60, 20, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x + 1.5 * s, y, 6 * s, 2.6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6b4a2e';
  ctx.fillRect(x - 0.8 * s, y - 8 * s, 1.6 * s, 8 * s);
  const blobs: readonly (readonly [number, number, number])[] = [
    [-2.6, -11, 4.6],
    [2.8, -11.5, 4.4],
    [0, -15.5, 5],
  ];
  ctx.fillStyle = shade(green, -0.35);
  for (const [dx, dy, r] of blobs) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, (r + 0.7) * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = green;
  for (const [dx, dy, r] of blobs) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = shade(green, 0.25);
  ctx.beginPath();
  ctx.arc(x - 1.6 * s, y - 16.5 * s, 2.2 * s, 0, Math.PI * 2);
  ctx.fill();
}

/** A parked car seen from above-ish: body box plus a dark glass roof. `alongU` sets its heading. */
export function paintParkedCar(iso: IsoFrame, u: number, v: number, alongU: boolean, color: string) {
  const [l, w] = alongU ? [0.3, 0.15] : [0.15, 0.3];
  iso.floor(u + 0.02, u + l + 0.04, v + 0.02, v + w + 0.04, 0, 'rgba(0,0,0,0.22)');
  iso.box(u, u + l, v, v + w, 0, 3, color, shade(color, -0.3), shade(color, 0.15));
  const g = 0.025;
  const [gu, gv] = alongU ? [g * 2.5, g] : [g, g * 2.5];
  iso.floor(u + gu, u + l - gu, v + gv, v + w - gv, 4.5, 'rgba(40, 60, 80, 0.85)');
}
