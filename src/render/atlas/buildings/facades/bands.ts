import { wallOn } from '../../core';
import { glassFill, markWindow } from './glazing';
import { entrance, type FacadeArgs } from './kit';

/**
 * Horizontal window bands (`bands`) or slimmer ribbon windows with a bright sill line (`ribbon`):
 * continuous glazing between solid floor strips.
 */
export function paintBands({ iso, art, m, f, isFront }: FacadeArgs) {
  const fh = art.floorH;
  const { a0, a1 } = f;
  const len = a1 - a0;
  const ribbon = m.facade === 'ribbon';
  const cols = Math.max(2, Math.round(len * 3.4));
  const step = len / cols;
  const glass = ribbon ? '#23394a' : '#2f4d6a';
  for (let k = 0; k < m.floors; k++) {
    const z = m.z0 + k * fh;
    const z0 = z + (ribbon ? 2.6 : 2);
    const z1 = z + fh - (ribbon ? 1.4 : 1.5);
    wallOn(iso, f, a0 + 0.03, a1 - 0.03, z0, z1, glassFill(iso, f, a0, a1, z0, z1, glass));
    // Band reveal: the floor strip above shades the top of the glass.
    wallOn(iso, f, a0 + 0.03, a1 - 0.03, z1 - 0.8, z1, 'rgba(8, 14, 24, 0.35)');
    for (let c = 1; c < cols; c++) wallOn(iso, f, a0 + c * step, a0 + c * step + 0.01, z0, z1, ribbon ? 'rgba(255,255,255,0.55)' : 'rgba(230,236,242,0.45)');
    for (let c = 0; c < cols; c++) markWindow(iso, f, a0 + c * step + 0.03, a0 + (c + 1) * step - 0.03, z0, z1);
    if (ribbon) wallOn(iso, f, a0 + 0.02, a1 - 0.02, z0 - 0.7, z0, 'rgba(255,255,255,0.6)');
  }
  if (m.z0 === 0 && isFront) entrance(iso, f, fh);
}
