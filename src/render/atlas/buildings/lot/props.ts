import { blobShadow, IsoFrame, shade, type Prop } from '../../core';
import { paintRoundTree, paintTree, conifers } from '../../nature/trees';
import { MATERIAL, NATURE } from '../../theme/tokens';
import type { Painting } from '../context';
import { paintParkedCar } from './vehicles';

/** Ground-level props in local space (trees, cars, crates, café tables, planters, tanks, silos), mapped into the view. */
export function groundProps(p: Painting): Prop[] {
  const { iso, o, art, rng } = p;
  const local = p.ms[0].local;
  const props: Prop[] = [];
  const ex = new Set(art.extras);
  const ctx = iso.ctx;
  const at = (lu: number, lv: number, draw: (u: number, v: number) => void) => {
    const [u, v] = o.point(lu, lv);
    props.push({ u, v, draw: () => draw(u, v) });
  };

  if (art.trees) {
    // Lot corners and edges that the body doesn't cover.
    const m = 0.1;
    const spots: [number, number][] = [
      [o.w - m, o.h - m],
      [m, o.h - m],
      [o.w - m, m],
      [m, m],
      [o.w / 2, o.h - m],
      [o.w - m, o.h / 2],
    ];
    const free = spots.filter(([u, v]) => u < local.u0 - 0.02 || u > local.u1 + 0.02 || v < local.v0 - 0.02 || v > local.v1 + 0.02);
    const size = o.w > 1 ? 0.95 : 0.7;
    free.slice(0, art.trees).forEach(([lu, lv], k) => {
      const tone = k + Math.floor(rng() * 9);
      const evergreen = rng() < 0.2;
      at(lu, lv, (u, v) => {
        const [x, y] = iso.p(u, v, 0);
        if (evergreen) paintTree(ctx, x, y, { species: 'conifer', size: size * 0.8, foliage: conifers(tone), seed: 400 + tone });
        else paintRoundTree(ctx, x, y, size, tone);
      });
    });
  }
  if (ex.has('parking')) {
    for (let k = 0; k < 7; k++) {
      const u = local.u0 + 0.12 + k * ((local.u1 - local.u0 - 0.2) / 7);
      const line = o.rect({ u0: u, u1: u + 0.012, v0: local.v1 + 0.12, v1: o.h - 0.15 });
      iso.floor(line.u0, line.u1, line.v0, line.v1, 0.1, 'rgba(255,255,255,0.75)');
      if (rng() < 0.65) {
        const c = MATERIAL.carPaints[Math.floor(rng() * MATERIAL.carPaints.length)];
        const cv = local.v1 + 0.25 + rng() * 0.2;
        const car = o.rect({ u0: u + 0.05, u1: u + 0.18, v0: cv, v1: cv + 0.32 });
        props.push({ u: car.u0, v: car.v0, draw: () => paintParkedCar(iso, car.u0, car.v0, car.u1 - car.u0 > car.v1 - car.v0, c) });
      }
    }
  }
  if (ex.has('patrolcars')) {
    for (let k = 0; k < 2; k++) {
      const lu = local.u0 + 0.06 + k * 0.22;
      const car = o.rect({ u0: lu, u1: lu + 0.15, v0: local.v1 + 0.04, v1: local.v1 + 0.34 });
      if (car.u1 > o.vw || car.v1 > o.vh) continue;
      props.push({
        u: car.u0,
        v: car.v0,
        draw: () => {
          paintParkedCar(iso, car.u0, car.v0, car.u1 - car.u0 > car.v1 - car.v0, '#f4f6f8');
          const [x, y] = iso.p((car.u0 + car.u1) / 2, (car.v0 + car.v1) / 2, 5.5);
          ctx.fillStyle = '#2456d8';
          ctx.fillRect(x - 2, y - 1.5, 2, 1.5);
          ctx.fillStyle = '#e8343a';
          ctx.fillRect(x, y - 1.5, 2, 1.5);
        },
      });
    }
  }
  if (ex.has('crates')) {
    const colors = ['#a87a45', '#7a8a4a', '#3d6e9e'];
    for (let k = 0; k < 3; k++) {
      const cu = Math.min(local.u1 + 0.02 + (k % 2) * 0.1, o.w - 0.12);
      const cv = local.v1 - 0.35 + k * 0.12;
      const r = o.rect({ u0: cu, u1: cu + 0.09, v0: cv, v1: cv + 0.09 });
      props.push({ u: r.u0, v: r.v0, draw: () => iso.solid(r, 0, 3.5, colors[k % colors.length]) });
    }
  }
  if (ex.has('tables')) {
    const umbrellas = [art.awning ?? '#e9554a', '#f2c84b'];
    for (const [k, tu] of [local.u0 + 0.12, local.u0 + 0.42].entries()) {
      const tv = Math.min(local.v1 + 0.2 + k * 0.04, o.h - 0.06);
      const r = o.rect({ u0: tu, u1: tu + 0.04, v0: tv, v1: tv + 0.04 });
      props.push({
        u: r.u0,
        v: r.v0,
        draw: () => {
          const [bx, by] = iso.p((r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2, 0);
          blobShadow(ctx, bx + 3, by, 6, 2.4);
          iso.box(r.u0, r.u1, r.v0, r.v1, 0, 5, '#7a7f86', '#5c6168', '#7a7f86');
          const [x, y] = iso.p((r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2, 7);
          const g = ctx.createLinearGradient(x - 6, y, x + 6, y);
          g.addColorStop(0, shade(umbrellas[k], 0.2));
          g.addColorStop(1, shade(umbrellas[k], -0.25));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(x, y - 2.5);
          ctx.lineTo(x + 6, y + 0.5);
          ctx.ellipse(x, y + 0.5, 6, 2, 0, 0, Math.PI, false);
          ctx.closePath();
          ctx.fill();
        },
      });
    }
  }
  if (ex.has('planters')) {
    for (const lu of [local.u0 + 0.04, local.u1 - 0.12]) {
      const r = o.rect({ u0: lu, u1: lu + 0.08, v0: local.v1 + 0.03, v1: local.v1 + 0.11 });
      props.push({
        u: r.u0,
        v: r.v0,
        draw: () => {
          iso.solid(r, 0, 2.5, '#8a6a4a');
          const [x, y] = iso.p((r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2, 3);
          paintTree(ctx, x, y, { species: 'shrub', size: 0.5, foliage: NATURE.greens[1], seed: 51 });
          ctx.fillStyle = '#ef5f74';
          ctx.fillRect(x - 1.5, y - 3, 1.2, 1.2);
          ctx.fillStyle = '#f6d044';
          ctx.fillRect(x + 0.6, y - 2.2, 1.2, 1.2);
        },
      });
    }
  }
  if (ex.has('tanks')) {
    const lu = Math.min(local.u1 + 0.02, o.w - 0.32);
    const lv = Math.min(local.v1 + 0.08, o.h - 0.32);
    const cool = ['#dfe3e7', '#cfd5da'];
    [
      [lu + 0.12, lv + 0.12],
      [lu + 0.12 - 0.2, lv + 0.2],
    ].forEach(([tu, tv], k) => {
      if (tu < 0.12) return;
      at(tu, tv, (u, v) => {
        const [x, y] = iso.p(u, v, 0);
        blobShadow(ctx, x + 4, y, 8, 3);
        iso.round(u, v, 0, 14, () => 0.1, cool[k], shade(cool[k], 0.12));
      });
    });
  }
  if (ex.has('silo')) {
    const lu = Math.min(local.u1 + 0.02, o.w - 0.2);
    const lv = Math.max(local.v0 + 0.15, Math.min(local.v1 - 0.15, o.h - 0.2));
    at(lu + 0.08, lv, (u, v) => {
      const [x0, y0] = iso.p(u, v, 0);
      blobShadow(ctx, x0 + 6, y0, 10, 3.5);
      iso.round(u, v, 0, 40, () => 0.13, '#c9ccd0', null);
      iso.round(u, v, 40, 46, (t) => 0.13 * (1 - t * 0.85), '#b8bcc1', '#d8dbde');
      const { rx, ry } = IsoFrame.ellipse(0.13);
      for (let z = 8; z < 40; z += 8) {
        const [x, y] = iso.p(u, v, z);
        ctx.strokeStyle = 'rgba(0,0,0,0.14)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI);
        ctx.stroke();
      }
    });
  }
  return props;
}
