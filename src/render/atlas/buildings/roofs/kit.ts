import type { Box, IsoFrame } from '../../core';
import type { BuildingArt } from '../recipes';

/** What a roof painter gets: the top mass's view box and the axis a ridge runs along. */
export interface RoofArgs {
  readonly iso: IsoFrame;
  readonly art: BuildingArt;
  readonly b: Box;
  readonly axis: 'u' | 'v';
  /** Height of the top of the walls (px). */
  readonly H: number;
  readonly roofColor: string;
  readonly wall: string;
}

export type RoofPainter = (args: RoofArgs) => void;

/** Eave overhang (tile units). */
export const EAVE = 0.06;

/** Along/across accessors so one routine handles a ridge along u or along v. */
export function ridgeFrame({ iso, b, axis }: RoofArgs) {
  const [A0, A1, C0, C1] = axis === 'u' ? [b.u0, b.u1, b.v0, b.v1] : [b.v0, b.v1, b.u0, b.u1];
  const P = (a: number, c: number, z: number) => (axis === 'u' ? iso.p(a, c, z) : iso.p(c, a, z));
  return { A0, A1, C0, C1, P, cm: (C0 + C1) / 2 };
}

/** The shadow the eaves throw on the top of both visible walls. */
export function eaveShadow({ iso, b, H }: RoofArgs) {
  for (const face of ['sw', 'se'] as const) {
    const [at, a0, a1] = face === 'sw' ? [b.v1, b.u0, b.u1] : [b.u1, b.v0, b.v1];
    iso.wall(face, at, a0, a1, H - 3.5, H, iso.wallGradient(face, at, a0, a1, H - 3.5, H, 'rgba(12, 18, 30, 0.38)', 'rgba(12, 18, 30, 0)'));
  }
}

/** A gradient across a slope from its eave (screen point e) to its ridge (screen point r). */
export function slopeGradient(iso: IsoFrame, e: readonly [number, number], r: readonly [number, number], eave: string, ridge: string): CanvasGradient {
  const g = iso.ctx.createLinearGradient(e[0], e[1], r[0], r[1]);
  g.addColorStop(0, eave);
  g.addColorStop(1, ridge);
  return g;
}
