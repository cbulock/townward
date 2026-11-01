import { faceRef, floorOut, pOn, topTone, wallOn } from '../../core';
import type { AttachArgs } from './kit';

/**
 * Balconies on every visible side of the residential masses, so a building reads the same from
 * any angle: a slab with its shadow on the wall below, and a glass or rail front.
 */
export function paintBalconies({ p }: AttachArgs) {
  const { iso, art, ms } = p;
  const fh = art.floorH;
  for (const m of ms) {
    if (m.facade === 'shopfront' || m.facade === 'lobby') continue;
    for (const face of ['sw', 'se'] as const) {
      const f = faceRef(face, m.view);
      const len = f.a1 - f.a0;
      const cols = Math.max(2, Math.round(len * 3.4));
      const step = len / cols;
      for (let k = 1; k < m.floors; k++) {
        for (let c = 0; c < cols; c += 2) {
          const a = f.a0 + c * step + step * 0.12;
          const a2 = a + step * 0.76;
          const z = m.z0 + k * fh + 0.5;
          wallOn(iso, f, a, a2, z - 2.2, z, 'rgba(12, 18, 30, 0.2)');
          floorOut(iso, f, a, a2, 0, 0.08, z, topTone('#d8d4cc'));
          wallOn(iso, f, a, a2, z - 0.6, z, face === 'sw' ? '#cfcac0' : '#a9a49b', 0.08);
          wallOn(iso, f, a, a2, z, z + 3, 'rgba(160, 196, 220, 0.45)', 0.08);
          wallOn(iso, f, a, a2, z + 2.6, z + 3, 'rgba(255,255,255,0.75)', 0.08);
        }
      }
    }
  }
}

/** Glass terrace rails every three floors round the top mass. */
export function paintTerraces({ p, top }: AttachArgs) {
  const { iso, art } = p;
  const tb = top.view;
  for (let k = 3; k < top.floors; k += 3) {
    const z = top.z0 + k * art.floorH;
    iso.wall('sw', tb.v1 + 0.06, tb.u0 - 0.02, tb.u1 + 0.02, z, z + 2.5, 'rgba(225, 238, 246, 0.7)');
    iso.wall('se', tb.u1 + 0.06, tb.v0 - 0.02, tb.v1 + 0.02, z, z + 2.5, 'rgba(190, 206, 220, 0.65)');
    iso.wall('sw', tb.v1 + 0.06, tb.u0 - 0.02, tb.u1 + 0.02, z + 2.1, z + 2.5, 'rgba(255,255,255,0.85)');
  }
}

/** Zig-zag fire escape on the right side: landings with rails and stair flights between them. */
export function paintFireEscape({ p, base }: AttachArgs) {
  const { iso, o, art } = p;
  const right = o.faceOf('right') ?? o.faceOf('left');
  if (!right) return;
  const f = faceRef(right, base.view);
  const fh = art.floorH;
  const a0 = f.a0 + (f.a1 - f.a0) * 0.3;
  const a1 = f.a0 + (f.a1 - f.a0) * 0.75;
  for (let k = 1; k < base.floors; k++) {
    const z = k * fh;
    wallOn(iso, f, a0, a1, z - 2, z, 'rgba(12, 18, 30, 0.18)');
    floorOut(iso, f, a0, a1, 0, 0.07, z, 'rgba(40, 40, 44, 0.85)');
    wallOn(iso, f, a0, a1, z, z + 2.5, 'rgba(30, 30, 34, 0.5)', 0.07);
    wallOn(iso, f, a0, a1, z + 2.2, z + 2.5, 'rgba(30, 30, 34, 0.9)', 0.07);
    const [s0, s1] = k % 2 ? [a0, a1] : [a1, a0];
    iso.poly([pOn(iso, f, s0, 0.05, z), pOn(iso, f, s0, 0.05, z + 0.8), pOn(iso, f, s1, 0.05, z - fh + 0.8), pOn(iso, f, s1, 0.05, z - fh)], 'rgba(30, 30, 34, 0.75)');
  }
}
