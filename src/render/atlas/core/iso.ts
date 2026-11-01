import { HALF_H, HALF_W } from '../../../shared/constants';
import { shade } from './color';
import { litBox } from './light';

/**
 * Projection for painting iso objects (buildings, civic art, street furniture, vehicles).
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

/**
 * Something the game animates on top of a painted frame (render/ambient): a window that lights
 * up at night, a warning beacon on a mast, or a fountain jet. Frame pixels, centre of the mark.
 */
export type MarkKind = 'window' | 'beacon' | 'fountain';

export interface FrameMark {
  readonly kind: MarkKind;
  readonly face: Face;
  readonly x: number;
  readonly y: number;
  /** Width and height in frame px (windows); 0 for point marks. */
  readonly w: number;
  readonly h: number;
}

/** Projection for one frame: (u, v, z) → frame pixels, plus fill helpers. */
export class IsoFrame {
  constructor(
    readonly ctx: CanvasRenderingContext2D,
    private readonly ox: number,
    private readonly oy: number,
    /** Collects animated marks while painting atlas frames; null for thumbnails. */
    private readonly marks: FrameMark[] | null = null,
  ) {}

  p(u: number, v: number, z = 0): [number, number] {
    return [this.ox + (u - v) * HALF_W, this.oy + (u + v) * HALF_H - z];
  }

  /** Record an animated mark at a frame point (ignored unless this frame collects them). */
  mark(kind: MarkKind, face: Face, x: number, y: number, w = 0, h = 0) {
    this.marks?.push({ kind, face, x, y, w, h });
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
  floor(u0: number, u1: number, v0: number, v1: number, z: number, fill: string | CanvasGradient) {
    this.poly([this.p(u0, v0, z), this.p(u1, v0, z), this.p(u1, v1, z), this.p(u0, v1, z)], fill);
  }

  /** The four screen corners of a wall rectangle (base-start, base-end, top-end, top-start). */
  wallQuad(face: Face, at: number, a0: number, a1: number, z0: number, z1: number): [number, number][] {
    const q = (a: number, z: number) => (face === 'sw' ? this.p(a, at, z) : this.p(at, a, z));
    return [q(a0, z0), q(a1, z0), q(a1, z1), q(a0, z1)];
  }

  /**
   * Rectangle on a wall. `a` runs along the wall (u on SW, v on SE), z is height.
   * `at` is the wall's plane coordinate (v1 for SW, u1 for SE).
   */
  wall(face: Face, at: number, a0: number, a1: number, z0: number, z1: number, fill: string | CanvasGradient) {
    this.poly(this.wallQuad(face, at, a0, a1, z0, z1), fill);
  }

  /** Vertical gradient for a wall span: `top` at z1, `bottom` at z0. */
  wallGradient(face: Face, at: number, a0: number, a1: number, z0: number, z1: number, top: string, bottom: string): CanvasGradient {
    const am = (a0 + a1) / 2;
    const [x, y1] = face === 'sw' ? this.p(am, at, z1) : this.p(at, am, z1);
    const y0 = y1 + (z1 - z0);
    const g = this.ctx.createLinearGradient(x, y1, x, y0);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    return g;
  }

  /** Axis box with explicit colours: back faces are hidden, so only the two visible walls and the top are drawn. */
  box(u0: number, u1: number, v0: number, v1: number, z0: number, z1: number, lit: string, shaded: string, top: string) {
    this.wall('sw', v1, u0, u1, z0, z1, lit);
    this.wall('se', u1, v0, v1, z0, z1, shaded);
    this.floor(u0, u1, v0, v1, z1, top);
  }

  /** Lit box from one base colour: graded walls, rim light and contact occlusion (core/light.ts). */
  solid(b: Box, z0: number, z1: number, color: string, top?: string) {
    litBox(this, b, z0, z1, color, top);
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
  disc(u: number, v: number, r: number, z: number, fill: string | CanvasGradient) {
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
   * Lit from the left with a soft specular band; the top is an open rim or a lid.
   */
  round(u: number, v: number, z0: number, z1: number, radius: (t: number) => number, color: string, top: string | null) {
    const c = this.ctx;
    const [x, y0] = this.p(u, v, z0);
    const y1 = y0 - (z1 - z0);
    const STEPS = 12;
    const r0 = IsoFrame.ellipse(radius(0));
    const g = c.createLinearGradient(x - r0.rx, 0, x + r0.rx, 0);
    g.addColorStop(0, shade(color, 0.04));
    g.addColorStop(0.22, shade(color, 0.22));
    g.addColorStop(0.4, color);
    g.addColorStop(0.8, shade(color, -0.32));
    g.addColorStop(1, shade(color, -0.42));
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
