import { mulberry32 } from '../../../../shared/rng';
import { alpha, shade } from '../../core';
import { greens, paintTree } from '../../nature/trees';
import { MATERIAL, NATURE } from '../../theme/tokens';
import { roofSpot } from '../context';
import type { RooftopArgs } from './kit';

/** Solar arrays: tilted panels in rows, each with a frame, cells and a sky glint. */
export function paintSolar({ p, top, H }: RooftopArgs) {
  const { iso, o } = p;
  const l = top.local;
  for (let lv = l.v0 + 0.1; lv < l.v1 - 0.18; lv += 0.16) {
    const r = o.rect({ u0: l.u0 + 0.1, u1: l.u1 - 0.1, v0: lv, v1: lv + 0.11 });
    iso.floor(r.u0 + 0.02, r.u1 + 0.02, r.v0 - 0.01, r.v1 - 0.01, H + 0.2, 'rgba(10, 16, 28, 0.25)');
    iso.floor(r.u0, r.u1, r.v0, r.v1, H + 1.5, '#c8ced6');
    const [ax, ay] = iso.p(r.u0, r.v1, H + 1.6);
    const [bx, by] = iso.p(r.u1, r.v0, H + 1.6);
    const g = iso.ctx.createLinearGradient(ax, ay, bx, by);
    g.addColorStop(0, '#5b7fbf');
    g.addColorStop(0.5, MATERIAL.solarCell);
    g.addColorStop(1, MATERIAL.solar);
    iso.floor(r.u0 + 0.01, r.u1 - 0.01, r.v0 + 0.01, r.v1 - 0.01, H + 1.6, g);
    for (let a = r.u0 + 0.07; a < r.u1; a += 0.07) iso.floor(a, a + 0.005, r.v0, r.v1, H + 1.7, 'rgba(255,255,255,0.22)');
  }
}

/** Roof garden: planted beds with a gravel walk and little trees and shrubs. */
export function paintRoofGarden({ p, tb, H }: RooftopArgs) {
  const { iso } = p;
  const d = 0.08;
  iso.floor(tb.u0 + d, tb.u1 - d, tb.v0 + d, tb.v1 - d, H + 0.5, shade(NATURE.lawn, -0.08));
  iso.floor(tb.u0 + d + 0.02, tb.u1 - d - 0.02, tb.v0 + d + 0.02, tb.v1 - d - 0.02, H + 0.6, NATURE.lawn);
  iso.floor(tb.u0 + d + 0.05, tb.u0 + d + 0.12, tb.v0 + d, tb.v1 - d, H + 0.7, NATURE.path);
  const rng = mulberry32(Math.round((tb.u1 + tb.v1) * 1000));
  const spots = Array.from({ length: 4 }, () => [tb.u0 + d + 0.2 + rng() * (tb.u1 - tb.u0 - 0.38), tb.v0 + d + 0.1 + rng() * (tb.v1 - tb.v0 - 0.28)] as const).sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  for (const [k, [u, v]] of spots.entries()) {
    const [x, y] = iso.p(u, v, H + 0.6);
    paintTree(iso.ctx, x, y, { species: k % 2 ? 'shrub' : 'broadleaf', size: k % 2 ? 0.6 : 0.42, foliage: greens(k + 1), seed: 300 + k });
  }
}

/** Rooftop pool: a coping, a water surface with a lit shallow end and ripple highlights. */
export function paintPool({ p, top, tb, H }: RooftopArgs) {
  const { iso, o } = p;
  const [pu, pv] = roofSpot(o, top, 0.5, 0.55);
  const hw = Math.min(0.24, (tb.u1 - tb.u0) * 0.3);
  const hv = Math.min(0.16, (tb.v1 - tb.v0) * 0.22);
  iso.floor(pu - hw - 0.05, pu + hw + 0.05, pv - hv - 0.05, pv + hv + 0.05, H + 0.5, MATERIAL.pavingLight);
  const [ax, ay] = iso.p(pu - hw, pv + hv, H + 0.6);
  const [bx, by] = iso.p(pu + hw, pv - hv, H + 0.6);
  const g = iso.ctx.createLinearGradient(ax, ay, bx, by);
  g.addColorStop(0, '#8fe3f5');
  g.addColorStop(1, shade(MATERIAL.poolWater, -0.2));
  iso.floor(pu - hw, pu + hw, pv - hv, pv + hv, H + 0.6, g);
  // The far walls of the pool in shade.
  iso.floor(pu - hw, pu + hw, pv - hv, pv - hv + 0.025, H + 0.65, 'rgba(10, 60, 90, 0.35)');
  iso.floor(pu - hw, pu - hw + 0.025, pv - hv, pv + hv, H + 0.65, 'rgba(10, 60, 90, 0.25)');
  for (let k = 0; k < 3; k++) iso.floor(pu - hw * 0.6 + k * hw * 0.4, pu - hw * 0.4 + k * hw * 0.4, pv - hv * 0.2, pv - hv * 0.1, H + 0.7, alpha('#ffffff', 0.5));
}

/** Helipad: a dark disc with a yellow ring and an H, plus edge lights. */
export function paintHelipad({ p, top, tb, H }: RooftopArgs) {
  const { iso, o } = p;
  const [cu, cv] = roofSpot(o, top, 0.5, 0.5);
  const r = Math.min(tb.u1 - tb.u0, tb.v1 - tb.v0) * 0.36;
  iso.disc(cu + 0.03, cv - 0.02, r, H + 0.4, 'rgba(10,16,28,0.25)');
  iso.disc(cu, cv, r, H + 0.8, '#3b3f46');
  iso.disc(cu, cv, r * 0.88, H + 0.9, '#f2c43a');
  iso.disc(cu, cv, r * 0.8, H + 1, '#454a52');
  const s = r * 0.35;
  const t = r * 0.08;
  iso.floor(cu - s, cu - s + t, cv - s, cv + s, H + 1.1, '#f4f4f0');
  iso.floor(cu + s - t, cu + s, cv - s, cv + s, H + 1.1, '#f4f4f0');
  iso.floor(cu - s, cu + s, cv - t / 2, cv + t / 2, H + 1.1, '#f4f4f0');
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    iso.disc(cu + Math.cos(a) * r * 0.94, cv + Math.sin(a) * r * 0.94, 0.012, H + 1.2, '#9ff0a0');
  }
}
