import type { Box, Face, IsoFrame } from './iso';

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

export function wallOn(iso: IsoFrame, f: FaceRef, a0: number, a1: number, z0: number, z1: number, fill: string | CanvasGradient, out = 0) {
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

/** Box standing out from a face, lit from one base colour. */
export function solidOut(iso: IsoFrame, f: FaceRef, a0: number, a1: number, d0: number, d1: number, z0: number, z1: number, base: string) {
  const b: Box = f.face === 'sw' ? { u0: a0, u1: a1, v0: f.at + d0, v1: f.at + d1 } : { u0: f.at + d0, u1: f.at + d1, v0: a0, v1: a1 };
  iso.solid(b, z0, z1, base);
}

export function pOn(iso: IsoFrame, f: FaceRef, a: number, d: number, z: number): [number, number] {
  const [u, v] = onFace(f, a, d);
  return iso.p(u, v, z);
}

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
