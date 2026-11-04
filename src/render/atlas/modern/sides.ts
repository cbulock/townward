import type { IsoFrame, Orient, Side } from '../core';
import type { Pt } from './plans';

/**
 * Painting on the walls of a rectangular block (a `rect` plan round `p`): doors, shopfronts,
 * signs and loading bays go on a local side, and appear only when that side faces the camera.
 * Positions along a side are fractions 0..1: along local u on the front and back, along local
 * v on the left and right.
 */
export interface SideRef {
  readonly face: 'sw' | 'se';
  /** The wall's plane coordinate in view space. */
  readonly at: number;
  /** View-space coordinate along the wall at a local fraction. */
  along(t: number): number;
}

export function sideRef(o: Orient, p: Pt, hw: number, hd: number, side: Side, out = 0): SideRef | null {
  const face = o.faceOf(side);
  if (!face) return null;
  const local = (t: number): Pt => {
    switch (side) {
      case 'front':
        return [p[0] - hw + 2 * hw * t, p[1] + hd + out];
      case 'back':
        return [p[0] - hw + 2 * hw * t, p[1] - hd - out];
      case 'right':
        return [p[0] + hw + out, p[1] - hd + 2 * hd * t];
      case 'left':
        return [p[0] - hw - out, p[1] - hd + 2 * hd * t];
    }
  };
  const view = (t: number) => o.point(...local(t));
  const [u0, v0] = view(0);
  return { face, at: face === 'sw' ? v0 : u0, along: (t) => (face === 'sw' ? view(t)[0] : view(t)[1]) };
}

/** A rectangle on a side, from fraction a0 to a1 along it and z0 to z1 up it. */
export function panel(iso: IsoFrame, s: SideRef, a0: number, a1: number, z0: number, z1: number, fill: string | CanvasGradient) {
  const x0 = s.along(a0);
  const x1 = s.along(a1);
  iso.wall(s.face, s.at, Math.min(x0, x1), Math.max(x0, x1), z0, z1, fill);
}

/** Text on a side, centred at fraction a and height z. */
export function sideText(iso: IsoFrame, s: SideRef, a: number, z: number, text: string, size: number, color: string) {
  iso.text(s.face, s.at, s.along(a), z, text, size, color);
}

/** The view point (frame px) on a side at fraction a and height z, for glows and marks. */
export function sidePoint(iso: IsoFrame, s: SideRef, a: number, z: number): [number, number] {
  const x = s.along(a);
  return s.face === 'sw' ? iso.p(x, s.at, z) : iso.p(s.at, x, z);
}
