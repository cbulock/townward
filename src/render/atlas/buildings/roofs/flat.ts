import { flatTone, shade, topTone } from '../../core';
import type { RoofArgs } from './kit';

/** Parapet height (px) and its thickness (tile units). */
const PARAPET = 1.6;
const T = 0.04;

/**
 * Flat roof: a membrane lit brighter toward the sun, the inner faces of the far parapets, the
 * shadow those parapets throw across the roof, then the near parapet walls and their cap.
 */
export function paintFlatRoof({ iso, b, H, roofColor, wall }: RoofArgs) {
  const i = { u0: b.u0 + T, u1: b.u1 - T, v0: b.v0 + T, v1: b.v1 - T };
  const [lx, ly] = iso.p(i.u0, i.v1, H);
  const [rx, ry] = iso.p(i.u1, i.v0, H);
  const g = iso.ctx.createLinearGradient(lx, ly, rx, ry);
  g.addColorStop(0, shade(topTone(roofColor), 0.06));
  g.addColorStop(1, shade(roofColor, -0.06));
  iso.floor(b.u0, b.u1, b.v0, b.v1, H, topTone(shade(wall, -0.05)));
  iso.floor(i.u0, i.u1, i.v0, i.v1, H, g);
  // Membrane seams and a speckle of gravel.
  for (let a = i.u0 + 0.18; a < i.u1 - 0.06; a += 0.18) iso.floor(a, a + 0.005, i.v0, i.v1, H, 'rgba(255,255,255,0.07)');
  const n = Math.round((i.u1 - i.u0) * (i.v1 - i.v0) * 40);
  for (let k = 0; k < n; k++) {
    const u = i.u0 + ((k * 0.618034) % 1) * (i.u1 - i.u0);
    const v = i.v0 + ((k * 0.414214) % 1) * (i.v1 - i.v0);
    const [x, y] = iso.p(u, v, H);
    iso.ctx.fillStyle = k % 2 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';
    iso.ctx.fillRect(x, y, 0.8, 0.5);
  }
  // Inner faces of the far parapets, and the shadow they cast inward.
  iso.wall('se', i.u0, i.v0, i.v1, H, H + PARAPET, flatTone(wall, 'se'));
  iso.wall('sw', i.v0, i.u0, i.u1, H, H + PARAPET, flatTone(wall, 'sw'));
  iso.floor(i.u0, i.u0 + 0.06, i.v0, i.v1, H, 'rgba(12, 18, 30, 0.16)');
  iso.floor(i.u0, i.u1, i.v1 - 0.05, i.v1, H, 'rgba(12, 18, 30, 0.1)');
  // Near parapet walls continue the facade upward; a lit cap on top.
  iso.wall('sw', b.v1, b.u0, b.u1, H, H + PARAPET, flatTone(shade(wall, 0.05), 'sw'));
  iso.wall('se', b.u1, b.v0, b.v1, H, H + PARAPET, flatTone(shade(wall, 0.05), 'se'));
  iso.floor(b.u0, b.u1, b.v1 - T, b.v1, H + PARAPET, topTone(wall));
  iso.floor(b.u1 - T, b.u1, b.v0, b.v1, H + PARAPET, topTone(wall));
  iso.floor(b.u0, b.u0 + T, b.v0, b.v1, H + PARAPET, topTone(wall));
  iso.floor(b.u0, b.u1, b.v0, b.v0 + T, H + PARAPET, topTone(wall));
}
