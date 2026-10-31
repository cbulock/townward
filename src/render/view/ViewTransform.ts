import { BridgeAxis } from '../../sim/roads';

/** Quarter turns of the camera around the map (0 = the default view). */
export type Rotation = 0 | 1 | 2 | 3;
export type Direction = 0 | 1 | 2 | 3;

const QUARTERS: readonly Rotation[] = [0, 1, 2, 3];
const DIRECTIONS: readonly Direction[] = [0, 1, 2, 3];

/** One quarter turn forward (+1) or back (−1). */
export function turn(r: Rotation, step: 1 | -1): Rotation {
  return QUARTERS[(r + step + 4) % 4];
}

export interface Point {
  x: number;
  y: number;
}

export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Maps between world tile space (where the simulation lives) and view tile space
 * (the map as seen after `r` quarter turns). The renderer only ever draws view
 * space; everything else stays in world space. See docs/decisions.md D-032.
 *
 * Continuous points (tile corners at integers):
 *   r = 0: (x, y)          r = 1: (H − y, x)
 *   r = 2: (W − x, H − y)  r = 3: (y, W − x)
 * Directions and connection bits (0 NE, 1 SE, 2 SW, 3 NW) advance by r.
 */
export class ViewTransform {
  constructor(
    /** World map width and height in tiles. */
    readonly w: number,
    readonly h: number,
    readonly r: Rotation = 0,
  ) {}

  get viewW(): number {
    return this.r % 2 === 0 ? this.w : this.h;
  }

  get viewH(): number {
    return this.r % 2 === 0 ? this.h : this.w;
  }

  /** World point → view point (continuous). */
  pointToView(x: number, y: number): Point {
    switch (this.r) {
      case 0:
        return { x, y };
      case 1:
        return { x: this.h - y, y: x };
      case 2:
        return { x: this.w - x, y: this.h - y };
      case 3:
        return { x: y, y: this.w - x };
    }
  }

  /** View point → world point (continuous). */
  pointToWorld(vx: number, vy: number): Point {
    switch (this.r) {
      case 0:
        return { x: vx, y: vy };
      case 1:
        return { x: vy, y: this.h - vx };
      case 2:
        return { x: this.w - vx, y: this.h - vy };
      case 3:
        return { x: this.w - vy, y: vx };
    }
  }

  /** World tile → view tile (integer indices). */
  tileToView(x: number, y: number): Point {
    const p = this.pointToView(x + 0.5, y + 0.5);
    return { x: Math.floor(p.x), y: Math.floor(p.y) };
  }

  /** View tile → world tile (integer indices). */
  tileToWorld(vx: number, vy: number): Point {
    const p = this.pointToWorld(vx + 0.5, vy + 0.5);
    return { x: Math.floor(p.x), y: Math.floor(p.y) };
  }

  /** World tile rectangle (origin + size) → the same rectangle in view tiles. */
  rectToView(rect: TileRect): TileRect {
    const a = this.pointToView(rect.x, rect.y);
    const b = this.pointToView(rect.x + rect.w, rect.y + rect.h);
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    return { x, y, w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
  }

  /** Heading or connection direction (0 NE, 1 SE, 2 SW, 3 NW) as seen in the view. */
  dir(d: number): Direction {
    return DIRECTIONS[(d + this.r) % 4];
  }

  /** 4-bit connection mask (bit d = direction d) rotated into the view. */
  mask(m: number): number {
    const r = this.r;
    return ((m << r) | (m >> (4 - r))) & 0b1111;
  }

  /** Bridge axis as seen in the view: quarter turns swap X and Y. */
  bridgeAxis(axis: number): number {
    if (this.r % 2 === 0 || axis === BridgeAxis.None) return axis;
    return axis === BridgeAxis.X ? BridgeAxis.Y : BridgeAxis.X;
  }
}
