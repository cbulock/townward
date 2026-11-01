import { HALF_W } from '../../shared/constants';
import { IsoFrame, shade } from './core';
import { GROUND_FRAME_H, GROUND_FRAME_W, GROUND_PAD } from './geometry';

/** Bus stop shelters (docs/specs/simulation.md): one frame per pavement side, in view space. */

export const STOP_HEADROOM = 24;
export const STOP_FRAME_W = GROUND_FRAME_W;
export const STOP_FRAME_H = GROUND_FRAME_H + STOP_HEADROOM;
/** Anchor that puts the tile's top vertex on the sprite position. */
export const STOP_ANCHOR = { x: (GROUND_PAD + HALF_W) / STOP_FRAME_W, y: (GROUND_PAD + STOP_HEADROOM) / STOP_FRAME_H } as const;

const ROOF = '#e8ecef';
const POST = '#5b636e';
const GLASS = 'rgba(160, 205, 235, 0.55)';
const BENCH = '#9a6b3f';
const SIGN = '#2f7fd6';

interface Part {
  /** Depth for back-to-front drawing (u + v of the part's centre). */
  depth: number;
  draw: () => void;
}

/** Shelter on side 0 (−v), 1 (+u), 2 (+v) or 3 (−u) of the tile, facing the road in the middle. */
export function paintBusStop(ctx: CanvasRenderingContext2D, side: 0 | 1 | 2 | 3) {
  const iso = new IsoFrame(ctx, GROUND_PAD + HALF_W, GROUND_PAD + STOP_HEADROOM);
  // Local frame: `a` runs along the kerb, `d` from the outer edge (0) toward the road (1).
  const along = side % 2 === 0;
  const outer = side === 0 || side === 3 ? 0.05 : 0.95;
  const inward = side === 0 || side === 3 ? 1 : -1;
  const at = (a: number, d: number): [number, number] => {
    // From just past the tile edge (d = 0) to the kerb (d = 1), so the posts stand on the pavement.
    const off = outer + inward * (d * 0.14 - 0.06);
    return along ? [a, off] : [off, a];
  };
  const box = (a0: number, a1: number, d0: number, d1: number, z0: number, z1: number, lit: string, dark: string, top: string): Part => {
    const [p0u, p0v] = at(a0, d0);
    const [p1u, p1v] = at(a1, d1);
    const u0 = Math.min(p0u, p1u);
    const u1 = Math.max(p0u, p1u);
    const v0 = Math.min(p0v, p1v);
    const v1 = Math.max(p0v, p1v);
    return { depth: (u0 + u1 + v0 + v1) / 2, draw: () => iso.box(u0, u1, v0, v1, z0, z1, lit, dark, top) };
  };

  const parts: Part[] = [
    // Back glass panel on the outer edge, bench in front of it, posts at the road-side corners.
    box(0.3, 0.7, 0, 0.12, 0, 13, GLASS, GLASS, GLASS),
    box(0.36, 0.64, 0.2, 0.45, 0, 3.5, BENCH, shade(BENCH, -0.25), shade(BENCH, 0.15)),
    box(0.3, 0.34, 0.85, 1, 0, 13, POST, shade(POST, -0.25), POST),
    box(0.66, 0.7, 0.85, 1, 0, 13, POST, shade(POST, -0.25), POST),
    // Bus sign on a pole beside the shelter.
    box(0.78, 0.81, 0.85, 0.95, 0, 17, POST, shade(POST, -0.25), POST),
  ];
  parts.sort((p, q) => p.depth - q.depth);
  for (const p of parts) p.draw();

  // Roof over everything, then the sign plate on its pole.
  box(0.27, 0.73, -0.05, 1.05, 13, 15, ROOF, shade(ROOF, -0.22), ROOF).draw();
  box(0.76, 0.83, 0.86, 0.94, 15, 21, SIGN, shade(SIGN, -0.25), shade(SIGN, 0.2)).draw();
}
