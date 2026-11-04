import { alpha, blobShadow, shade, type Box, type IsoFrame, type Orient } from '../core';
import { at, type Item } from '../civic/lot';
import { localFloor } from '../civic/kit';
import { MATERIAL, NATURE } from '../theme/tokens';

/**
 * Ground pieces for landmarks: a modern stone plaza with a paving grid, reflecting pools and
 * lagoons with a soft lit edge, and palm trees. Local space, mapped through `Orient`.
 */

/** Paved lot: kerb, pale stone and a faint paving grid. */
export function plaza(iso: IsoFrame, o: Orient, stone = MATERIAL.pavingLight, grid = 0.25) {
  const w = o.w;
  const h = o.h;
  localFloor(iso, o, { u0: 0.02, u1: w - 0.02, v0: 0.02, v1: h - 0.02 }, 0, MATERIAL.kerb);
  localFloor(iso, o, { u0: 0.08, u1: w - 0.08, v0: 0.08, v1: h - 0.08 }, 0, stone);
  const c = iso.ctx;
  c.strokeStyle = alpha(shade(stone, -0.25), 0.35);
  c.lineWidth = 0.3;
  for (let a = 0.08 + grid; a < w - 0.08; a += grid) {
    const [p, q] = [o.point(a, 0.08), o.point(a, h - 0.08)];
    const [x0, y0] = iso.p(p[0], p[1]);
    const [x1, y1] = iso.p(q[0], q[1]);
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
  }
  for (let a = 0.08 + grid; a < h - 0.08; a += grid) {
    const [p, q] = [o.point(0.08, a), o.point(w - 0.08, a)];
    const [x0, y0] = iso.p(p[0], p[1]);
    const [x1, y1] = iso.p(q[0], q[1]);
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
  }
}

/** A sunk pool or lagoon (local box): stone coping, deep water with a lit sheen. */
export function pool(iso: IsoFrame, o: Orient, b: Box, water: string = NATURE.water, coping = '#e8e2d4') {
  localFloor(iso, o, { u0: b.u0 - 0.04, u1: b.u1 + 0.04, v0: b.v0 - 0.04, v1: b.v1 + 0.04 }, 0.2, coping);
  const r = o.rect(b);
  const [lx, ly] = iso.p(r.u0, r.v1);
  const [rx, ry] = iso.p(r.u1, r.v0);
  const g = iso.ctx.createLinearGradient(lx, ly, rx, ry);
  g.addColorStop(0, shade(water, 0.25));
  g.addColorStop(1, shade(water, -0.15));
  iso.floor(r.u0, r.u1, r.v0, r.v1, 0.2, g);
  // Inner shadow on the far edges, where the coping overhangs.
  iso.floor(r.u0, r.u1, r.v0, r.v0 + 0.05, 0.25, alpha('#0b2a4a', 0.25));
  iso.floor(r.u0, r.u0 + 0.05, r.v0, r.v1, 0.25, alpha('#0b2a4a', 0.25));
  const c = iso.ctx;
  c.strokeStyle = 'rgba(255,255,255,0.5)';
  c.lineWidth = 0.5;
  for (let k = 0; k < 3; k++) {
    const t = 0.25 + k * 0.25;
    const [x0, y0] = iso.p(r.u0 + (r.u1 - r.u0) * (t - 0.08), r.v0 + (r.v1 - r.v0) * (1 - t), 0.3);
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x0 + 4, y0 - 0.6);
    c.stroke();
  }
}

/** A palm: a slim curved trunk with a crown of drooping fronds. */
export function palm(iso: IsoFrame, o: Orient, u: number, v: number, height = 16, lean = 1): Item {
  const p = at(o, u, v);
  return {
    depth: p.depth,
    draw: () => {
      const c = iso.ctx;
      const [x, y] = iso.p(p.u, p.v);
      blobShadow(c, x + 4, y + 0.5, 4.5, 1.6);
      const tx = x + lean * 2.2;
      const ty = y - height;
      c.strokeStyle = '#8a6a4a';
      c.lineWidth = 1.3;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + lean * 0.4, y - height * 0.6, tx, ty);
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.25)';
      c.lineWidth = 0.4;
      c.stroke();
      const fronds = 7;
      for (let k = 0; k < fronds; k++) {
        const a = (k / fronds) * Math.PI * 2 + 0.3;
        const dx = Math.cos(a) * 6.5;
        const dy = Math.sin(a) * 2.6;
        const front = Math.sin(a) > 0;
        c.strokeStyle = front ? '#4c9a3f' : '#2f6f33';
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(tx, ty);
        c.quadraticCurveTo(tx + dx * 0.6, ty + dy * 0.6 - 2.5, tx + dx, ty + dy + 1.8);
        c.stroke();
      }
      c.fillStyle = '#6b8a3a';
      c.beginPath();
      c.arc(tx, ty, 1, 0, Math.PI * 2);
      c.fill();
    },
  };
}
