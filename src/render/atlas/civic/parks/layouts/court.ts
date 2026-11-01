import { MATERIAL } from '../../../theme/tokens';
import { at, pole } from '../../lot';
import { lamp, localFloor, tree } from '../../kit';
import type { ParkLayout } from './kit';

/** Basketball court: blue surround, painted court, hoops on posts, and a chain-link fence. */
export const court: ParkLayout = (iso, o, _rng, items) => {
  const ctx = iso.ctx;
  const box = { u0: 0.14, u1: 0.86, v0: 0.2, v1: 0.8 };
  localFloor(iso, o, { u0: 0.13, u1: 0.87, v0: 0.19, v1: 0.81 }, 0.08, '#2c5f94');
  localFloor(iso, o, box, 0.1, '#3f7fc0');
  localFloor(iso, o, { u0: 0.2, u1: 0.8, v0: 0.26, v1: 0.74 }, 0.15, '#d9803f');
  const white = 'rgba(255,255,255,0.9)';
  localFloor(iso, o, { u0: 0.495, u1: 0.505, v0: 0.26, v1: 0.74 }, 0.2, white);
  const c = at(o, 0.5, 0.5);
  iso.disc(c.u, c.v, 0.08, 0.2, white);
  iso.disc(c.u, c.v, 0.07, 0.25, '#d9803f');
  for (const u of [0.2, 0.68]) localFloor(iso, o, { u0: u, u1: u + 0.12, v0: 0.42, v1: 0.58 }, 0.2, 'rgba(255,255,255,0.35)');
  for (const u of [0.18, 0.82]) {
    const p = at(o, u, 0.5);
    items.push({
      depth: p.depth,
      draw: () => {
        pole(iso, p.u, p.v, 0, 12, 1.2, '#4a4f56');
        const [x, y] = iso.p(p.u, p.v, 12);
        ctx.fillStyle = '#f4f4f0';
        ctx.fillRect(x - 3, y - 4, 6, 4);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(x + 1.5, y - 4, 1.5, 4);
        ctx.strokeStyle = '#e8483d';
        ctx.lineWidth = 0.6;
        ctx.strokeRect(x - 1.2, y - 2.6, 2.4, 1.6);
      },
    });
  }
  items.push(tree(iso, o, 0.08, 0.1, 0.6, 2), lamp(iso, o, 0.9, 0.12));
  items.push({
    depth: 3,
    draw: () => {
      const r = o.rect(box);
      iso.wall('sw', r.v1, r.u0, r.u1, 0, 7, 'rgba(190, 200, 210, 0.26)');
      iso.wall('se', r.u1, r.v0, r.v1, 0, 7, 'rgba(160, 170, 180, 0.26)');
      for (let a = r.u0; a <= r.u1 + 1e-6; a += (r.u1 - r.u0) / 4) iso.wall('sw', r.v1, a - 0.006, a + 0.006, 0, 7, MATERIAL.metalDark);
      for (let a = r.v0; a <= r.v1 + 1e-6; a += (r.v1 - r.v0) / 4) iso.wall('se', r.u1, a - 0.006, a + 0.006, 0, 7, '#575d64');
      iso.wall('sw', r.v1, r.u0, r.u1, 6.4, 7, MATERIAL.metalDark);
      iso.wall('se', r.u1, r.v0, r.v1, 6.4, 7, '#575d64');
    },
  });
};
