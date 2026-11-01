import type { Box, IsoFrame, Orient, Rng } from '../core';
import type { BuildingArt, Facade } from './recipes';

/** A mass resolved into local and view boxes and its z range. */
export interface MassBox {
  local: Box;
  view: Box;
  z0: number;
  z1: number;
  floors: number;
  facade: Facade;
  wall: string;
  top: boolean;
}

/** Everything a part painter needs about the building being painted. */
export interface Painting {
  readonly iso: IsoFrame;
  readonly o: Orient;
  readonly art: BuildingArt;
  readonly ms: readonly MassBox[];
  readonly rng: Rng;
  /** The whole lot in view space. */
  readonly lot: Box;
}

export function resolveMasses(art: BuildingArt, o: Orient): MassBox[] {
  let z = 0;
  return art.masses.map((m, k) => {
    const inset = m.inset ?? 0.15;
    const local = m.box ?? { u0: inset, u1: o.w - inset, v0: inset, v1: o.h - inset };
    const z0 = z;
    z += m.floors * art.floorH;
    return {
      local,
      view: o.rect(local),
      z0,
      z1: z,
      floors: m.floors,
      facade: m.facade ?? art.facade,
      wall: m.wall ?? art.wall,
      top: k === art.masses.length - 1,
    };
  });
}

export const totalHeight = (art: BuildingArt) => art.masses.reduce((s, m) => s + m.floors, 0) * art.floorH;

/** Where rooftop items go: local positions inside the top mass, mapped to view. */
export function roofSpot(o: Orient, top: MassBox, fu: number, fv: number): [number, number] {
  const l = top.local;
  return o.point(l.u0 + (l.u1 - l.u0) * fu, l.v0 + (l.v1 - l.v0) * fv);
}
