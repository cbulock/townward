import { HALF_H } from '../../../../shared/constants';
import { flatTone, mix, shade } from '../../core';
import { MATERIAL } from '../../theme/tokens';
import { roofSpot } from '../context';
import { mast, type RooftopArgs } from './kit';

/** Lit crown: a setback lantern box with a glowing band (recorded as windows) and a mast. */
export function paintCrown({ p, tb, H, top }: RooftopArgs) {
  const { iso } = p;
  const d = 0.1;
  const wall = top.wall;
  const b = { u0: tb.u0 + d, u1: tb.u1 - d, v0: tb.v0 + d, v1: tb.v1 - d };
  iso.solid(b, H, H + 6, shade(wall, -0.15), '#4a535c');
  iso.wall('sw', b.v1, b.u0, b.u1, H + 4.4, H + 6, 'rgba(255, 240, 190, 0.9)');
  iso.wall('se', b.u1, b.v0, b.v1, H + 4.4, H + 6, 'rgba(255, 226, 168, 0.7)');
  mast(iso, (tb.u0 + tb.u1) / 2, (tb.v0 + tb.v1) / 2, H + 6, 12);
}

export function paintAntenna({ p, top, H }: RooftopArgs) {
  const { iso, o } = p;
  const [au, av] = roofSpot(o, top, 0.65, 0.35);
  mast(iso, au, av, H, 20);
  const [bu, bv] = roofSpot(o, top, 0.3, 0.6);
  mast(iso, bu, bv, H, 11);
}

/** Spire: a plinth and a tall faceted needle, lit on the left, with a beacon at the tip. */
export function paintSpire({ p, tb, H, top }: RooftopArgs) {
  const { iso } = p;
  const ctx = iso.ctx;
  const cu = (tb.u0 + tb.u1) / 2;
  const cv = (tb.v0 + tb.v1) / 2;
  const s = Math.min(tb.u1 - tb.u0, tb.v1 - tb.v0) * 0.2;
  iso.solid({ u0: cu - s, u1: cu + s, v0: cv - s, v1: cv + s }, H, H + 5, shade(top.wall, -0.1));
  const [x, y] = iso.p(cu + s, cv + s, H + 5);
  const [x0] = iso.p(cu - s, cv + s, H + 5);
  const [x1] = iso.p(cu + s, cv - s, H + 5);
  const tipY = y - 34;
  const lit = ctx.createLinearGradient(0, tipY, 0, y);
  lit.addColorStop(0, '#ffffff');
  lit.addColorStop(1, mix(MATERIAL.metal, top.wall, 0.2));
  iso.poly([[x0, y - HALF_H * 2 * s], [x, y], [x, tipY]], lit);
  iso.poly([[x, y], [x1, y - HALF_H * 2 * s], [x, tipY]], flatTone(MATERIAL.metal, 'se'));
  ctx.fillStyle = MATERIAL.beacon;
  ctx.beginPath();
  ctx.arc(x, tipY - 1, 1.1, 0, Math.PI * 2);
  ctx.fill();
  iso.mark('beacon', 'sw', x, tipY - 1);
}
