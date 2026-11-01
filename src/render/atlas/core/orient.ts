import type { Box, Face } from './iso';

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
