import { shade, wallOn } from '../../core';
import { glassFill, markWindow, frameTone } from './glazing';
import { entrance, type FacadeArgs } from './kit';

/** Concrete grid: deep piers and floor slabs framing recessed glass, so every bay reads as a box. */
export function paintGrid({ iso, art, m, f, isFront }: FacadeArgs) {
  const fh = art.floorH;
  const { a0, a1 } = f;
  const len = a1 - a0;
  const H = m.z1;
  const cols = Math.max(2, Math.round(len * 3.4));
  const step = len / cols;
  const glass = art.glass ?? '#33506b';
  wallOn(iso, f, a0, a1, m.z0, H, glassFill(iso, f, a0, a1, m.z0, H, glass));
  for (let k = 0; k < m.floors; k++) {
    const z = m.z0 + k * fh;
    // Slab, with the shadow it throws into the recess below.
    wallOn(iso, f, a0, a1, z, z + 1.4, frameTone(m.wall, f));
    wallOn(iso, f, a0, a1, z + fh - 1.6, z + fh, 'rgba(10, 18, 30, 0.28)');
    for (let c = 0; c < cols; c++) markWindow(iso, f, a0 + c * step + 0.03, a0 + (c + 1) * step - 0.03, z + 1.6, z + fh - 0.4);
  }
  for (let c = 0; c <= cols; c++) {
    const a = a0 + c * step;
    const p0 = Math.max(a0, a - 0.025);
    const p1 = Math.min(a1, a + 0.025);
    wallOn(iso, f, p0, p1, m.z0, H, frameTone(m.wall, f, 0.06));
    // Pier side in shade: gives each pier depth.
    if (c < cols) wallOn(iso, f, p1, Math.min(a1, p1 + 0.012), m.z0, H, shade(frameTone(m.wall, f), -0.3));
  }
  if (m.z0 === 0 && isFront) entrance(iso, f, fh);
}
