import { alpha, shade } from '../core/color';
import type { IsoFrame, Orient } from '../core';
import { loft, prism, sweep } from './loft';
import { circle, type Plan, type Pt } from './plans';
import { solid } from './skins';

/** Small modern parts shared by towers and landmarks: spires, floor slabs, crowns and lights. */

/** A tapering spire with a needle and a warning beacon on top (night: render/ambient beacons). */
export function spire(iso: IsoFrame, o: Orient, at: Pt, z0: number, height: number, r: number, color: string) {
  loft(iso, o, sweep(z0, z0 + height, 8, at, (t) => circle(r * (1 - t * 0.88), 10)), solid(color), null);
  const [u, v] = o.point(at[0], at[1]);
  const [x, y] = iso.p(u, v, z0 + height);
  const c = iso.ctx;
  c.strokeStyle = shade(color, 0.2);
  c.lineWidth = 0.6;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x, y - height * 0.22);
  c.stroke();
  c.fillStyle = '#ff5a4a';
  c.beginPath();
  c.arc(x, y - height * 0.22, 0.9, 0, Math.PI * 2);
  c.fill();
  iso.mark('beacon', 'sw', x, y - height * 0.22);
}

/** A thin floor slab or terrace: a plan `thick` px deep with a bright edge. */
export function slab(iso: IsoFrame, o: Orient, at: Pt, plan: Plan, z: number, thick: number, color: string) {
  prism(iso, o, at, plan, z, z + thick, solid(color));
}

/** A ring of small lights round a plan at height z (crowns, wheel rims). Dots only; cheap. */
export function lightRing(iso: IsoFrame, o: Orient, at: Pt, plan: Plan, z: number, color: string, every = 1) {
  const c = iso.ctx;
  c.fillStyle = color;
  plan.forEach(([x, y], k) => {
    if (k % every !== 0) return;
    const [u, v] = o.point(at[0] + x, at[1] + y);
    const [px, py] = iso.p(u, v, z);
    c.beginPath();
    c.arc(px, py, 0.55, 0, Math.PI * 2);
    c.fill();
  });
}

/** Glow halo under a light (signs, crowns): a soft radial blob. */
export function halo(iso: IsoFrame, x: number, y: number, r: number, color: string) {
  const c = iso.ctx;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, alpha(color, 0.55));
  g.addColorStop(1, alpha(color, 0));
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}

/** A sign or LED band lying on a wall plane, sheared like it (local side → visible face only). */
export function wallSign(iso: IsoFrame, face: 'sw' | 'se', at: number, a: number, z: number, text: string, size: number, color: string, glow?: string) {
  if (glow) {
    const [x, y] = face === 'sw' ? iso.p(a, at, z) : iso.p(at, a, z);
    halo(iso, x, y, size * 2.2, glow);
  }
  iso.text(face, at, a, z, text, size, color);
}
