import { blobShadow, shade } from '../../../core';
import { MATERIAL } from '../../../theme/tokens';
import { at, pole } from '../../lot';
import { bench, line, localFloor, path, tree } from '../../kit';
import type { ParkLayout } from './kit';

/** Playground: a rubber safety surface, a slide tower with a roof, swings and a sandpit. */
export const playground: ParkLayout = (iso, o, rng, items) => {
  const ctx = iso.ctx;
  localFloor(iso, o, { u0: 0.13, u1: 0.63, v0: 0.13, v1: 0.61 }, 0.08, shade('#e07a4c', -0.15));
  localFloor(iso, o, { u0: 0.14, u1: 0.62, v0: 0.14, v1: 0.6 }, 0.1, '#e8845a');
  localFloor(iso, o, { u0: 0.61, u1: 0.89, v0: 0.59, v1: 0.87 }, 0.08, '#cdb889');
  localFloor(iso, o, { u0: 0.62, u1: 0.88, v0: 0.6, v1: 0.86 }, 0.1, '#ecd8a2');
  path(iso, o, { u0: 0.45, u1: 0.55, v0: 0.6, v1: 0.96 });
  const tw = at(o, 0.22, 0.22);
  items.push({
    depth: tw.depth,
    draw: () => {
      const r = o.rect({ u0: 0.18, u1: 0.3, v0: 0.18, v1: 0.3 });
      const [sx, sy] = iso.p(r.u1, r.v1);
      blobShadow(ctx, sx + 4, sy, 9, 3);
      for (const [u, v] of [
        [r.u0, r.v1],
        [r.u1, r.v1],
        [r.u1, r.v0],
      ] as const)
        pole(iso, u, v, 0, 9, 1, '#3d6fb5');
      iso.solid(r, 8, 9, '#f2c43a');
      const [a0, b0] = o.point(0.3, 0.2);
      const [a1, b1] = o.point(0.3, 0.28);
      const [a2, b2] = o.point(0.56, 0.28);
      const [a3, b3] = o.point(0.56, 0.2);
      const g = ctx.createLinearGradient(...iso.p(a0, b0, 9), ...iso.p(a2, b2, 0.5));
      g.addColorStop(0, '#ff7a6e');
      g.addColorStop(1, '#c9372e');
      iso.poly([iso.p(a0, b0, 9), iso.p(a1, b1, 9), iso.p(a2, b2, 0.5), iso.p(a3, b3, 0.5)], g);
      const [cx, cy] = iso.p((r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2, 17);
      const [lx, ly] = iso.p(r.u0, r.v1, 13);
      const [rx, ry] = iso.p(r.u1, r.v0, 13);
      const [fx, fy] = iso.p(r.u1, r.v1, 13);
      iso.poly([[cx, cy], [lx, ly], [fx, fy]], '#f0574b');
      iso.poly([[cx, cy], [fx, fy], [rx, ry]], '#a8302a');
    },
  });
  const s0 = at(o, 0.36, 0.42);
  items.push({
    depth: s0.depth,
    draw: () => {
      const ends = [o.point(0.36, 0.42), o.point(0.6, 0.42)];
      for (const [u, v] of ends) {
        line(iso, iso.p(u - 0.03, v - 0.03, 0), iso.p(u, v, 12), MATERIAL.metalDark, 1.1);
        line(iso, iso.p(u + 0.03, v + 0.03, 0), iso.p(u, v, 12), MATERIAL.metalDark, 1.1);
      }
      line(iso, iso.p(ends[0][0], ends[0][1], 12), iso.p(ends[1][0], ends[1][1], 12), '#4d545c', 1.3);
      for (const t of [0.33, 0.66]) {
        const u = ends[0][0] + (ends[1][0] - ends[0][0]) * t;
        const v = ends[0][1] + (ends[1][1] - ends[0][1]) * t;
        line(iso, iso.p(u, v, 12), iso.p(u, v, 3), 'rgba(60,60,60,0.8)', 0.5);
        const [x, y] = iso.p(u, v, 3);
        ctx.fillStyle = t < 0.5 ? '#3aa66a' : '#f2c43a';
        ctx.fillRect(x - 1.5, y - 0.5, 3, 1.2);
      }
    },
  });
  // Sandpit toys.
  const sp = at(o, 0.76, 0.74);
  items.push({ depth: sp.depth, draw: () => iso.solid({ u0: sp.u - 0.03, u1: sp.u + 0.03, v0: sp.v - 0.03, v1: sp.v + 0.03 }, 0.1, 2, rng() < 0.5 ? '#3d7dd8' : '#e8483d') });
  items.push(tree(iso, o, 0.84, 0.2, 0.8, 0), tree(iso, o, 0.18, 0.84, 0.7, 8), bench(iso, o, 0.66, 0.42, true));
};
