import { shade } from '../../../core';
import { NATURE } from '../../../theme/tokens';
import { bench, lamp, tree } from '../../kit';
import type { ParkLayout } from './kit';

/** Duck pond: a sandy margin, deep-to-shallow water, lily pads, ducks, reeds and willows. */
export const duckPond: ParkLayout = (iso, o, rng, items) => {
  const ctx = iso.ctx;
  iso.disc(0.5, 0.52, 0.35, 0.08, shade('#e5d3a0', -0.12));
  iso.disc(0.5, 0.52, 0.33, 0.1, '#e5d3a0');
  const [cx, cy] = iso.p(0.5, 0.52, 0.15);
  const g = ctx.createRadialGradient(cx - 6, cy - 3, 2, cx, cy, 26);
  g.addColorStop(0, NATURE.waterLight);
  g.addColorStop(0.5, NATURE.water);
  g.addColorStop(1, shade(NATURE.water, -0.25));
  iso.disc(0.5, 0.52, 0.29, 0.15, g);
  iso.disc(0.42, 0.44, 0.08, 0.25, 'rgba(255,255,255,0.18)');
  for (const [u, v] of [
    [0.6, 0.6],
    [0.56, 0.66],
    [0.38, 0.62],
  ] as const) {
    iso.disc(u, v, 0.03, 0.3, '#3f8a2f');
    iso.disc(u - 0.005, v - 0.005, 0.022, 0.32, '#5fae45');
  }
  for (const [u, v] of [
    [0.45, 0.5],
    [0.55, 0.42],
  ] as const) {
    const [x, y] = iso.p(u, v, 0.3);
    ctx.fillStyle = 'rgba(0, 40, 80, 0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + 0.3, 2.4, 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 1.5, y - 1.5, 3, 1.8);
    ctx.fillRect(x + 0.5, y - 2.6, 1.3, 1.3);
    ctx.fillStyle = '#f29a2e';
    ctx.fillRect(x + 1.8, y - 2.2, 0.8, 0.6);
  }
  for (let k = 0; k < 12; k++) {
    const ang = 2.1 + k * 0.15;
    const [x, y] = iso.p(0.5 + Math.cos(ang) * 0.31, 0.52 + Math.sin(ang) * 0.31, 0);
    const h = 3 + rng() * 2.5;
    ctx.fillStyle = k % 2 ? '#5a9a3a' : '#3f7a2c';
    ctx.fillRect(x, y - h, 0.8, h);
    if (k % 3 === 0) {
      ctx.fillStyle = '#6b4a2e';
      ctx.fillRect(x - 0.2, y - h - 1.4, 1.2, 1.6);
    }
  }
  items.push(tree(iso, o, 0.15, 0.16, 0.85, 1), tree(iso, o, 0.86, 0.14, 0.9, 3, 'poplar'), tree(iso, o, 0.86, 0.86, 0.7, 1, 'birch'));
  items.push(bench(iso, o, 0.12, 0.8, true), lamp(iso, o, 0.28, 0.86));
};
