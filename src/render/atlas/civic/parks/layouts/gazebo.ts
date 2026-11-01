import { IsoFrame, shade } from '../../../core';
import { NATURE } from '../../../theme/tokens';
import { pole } from '../../lot';
import { flowerBed, lamp, tree } from '../../kit';
import type { ParkLayout } from './kit';

/** Flower garden round a white gazebo, with four bloom beds and a ring path. */
export const gazebo: ParkLayout = (iso, o, rng, items) => {
  const ctx = iso.ctx;
  iso.disc(0.5, 0.5, 0.35, 0.08, NATURE.pathEdge);
  iso.disc(0.5, 0.5, 0.33, 0.1, NATURE.path);
  iso.disc(0.5, 0.5, 0.25, 0.12, NATURE.lawnLight);
  iso.disc(0.5, 0.5, 0.15, 0.14, NATURE.path);
  const beds = [NATURE.flowers[2], NATURE.flowers[0], NATURE.flowers[3], NATURE.flowers[4]];
  for (let k = 0; k < 4; k++) {
    const ang = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const u = 0.5 + Math.cos(ang) * 0.4;
    const v = 0.5 + Math.sin(ang) * 0.4;
    flowerBed(iso, o, rng, { u0: u - 0.07, u1: u + 0.07, v0: v - 0.07, v1: v + 0.07 }, [beds[k], NATURE.flowers[1]]);
  }
  items.push({
    depth: 1,
    draw: () => {
      iso.round(0.5, 0.5, 0, 1.5, () => 0.13, '#e9e2d3', '#f6f2ea');
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * Math.PI * 2;
        if (Math.sin(ang + Math.PI / 4) < -0.3) continue;
        pole(iso, 0.5 + Math.cos(ang) * 0.1, 0.5 + Math.sin(ang) * 0.1, 1.5, 10, 1, '#fbf8f1');
      }
      const [x, y] = iso.p(0.5, 0.5, 10);
      const { rx, ry } = IsoFrame.ellipse(0.14);
      const roof = '#4f8a7a';
      ctx.fillStyle = shade(roof, -0.25);
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x + rx, y);
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI, false);
      ctx.closePath();
      ctx.fill();
      const g = ctx.createLinearGradient(x - rx, y, x, y - 9);
      g.addColorStop(0, shade(roof, 0.1));
      g.addColorStop(1, shade(roof, 0.35));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x - rx, y);
      ctx.ellipse(x, y, rx, ry, 0, Math.PI, Math.PI * 0.62, true);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#d9b64a';
      ctx.fillRect(x - 0.5, y - 11, 1, 2);
    },
  });
  items.push(tree(iso, o, 0.12, 0.12, 0.62, 0, 'conifer'), tree(iso, o, 0.88, 0.88, 0.6, 7), lamp(iso, o, 0.84, 0.16), lamp(iso, o, 0.16, 0.84));
};
