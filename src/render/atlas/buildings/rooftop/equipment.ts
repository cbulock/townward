import { contactShadow, IsoFrame, shade } from '../../core';
import { MATERIAL } from '../../theme/tokens';
import { roofSpot } from '../context';
import type { RooftopArgs } from './kit';

/** Air-conditioning units: lit boxes with a fan grille on top and a contact shadow. */
export function paintHvac({ p, top, H }: RooftopArgs) {
  const { iso, o, rng } = p;
  const n = 2 + (rng() < 0.4 ? 1 : 0);
  for (let k = 0; k < n; k++) {
    const [cu, cv] = roofSpot(o, top, 0.12 + rng() * 0.6, 0.12 + rng() * 0.55);
    const b = { u0: cu, u1: cu + 0.13, v0: cv, v1: cv + 0.11 };
    contactShadow(iso, { u0: b.u0, u1: b.u1 + 0.04, v0: b.v0 - 0.02, v1: b.v1 }, 0.8);
    iso.solid(b, H, H + 3.5, MATERIAL.metal);
    iso.disc(cu + 0.065, cv + 0.055, 0.036, H + 3.6, '#5d646c');
    iso.disc(cu + 0.065, cv + 0.055, 0.02, H + 3.7, '#8c939b');
  }
}

/** Timber water tank on a stand, with hoops and a conical lid. */
export function paintWaterTank({ p, top, H }: RooftopArgs) {
  const { iso, o } = p;
  const [tu, tv] = roofSpot(o, top, 0.3, 0.3);
  const [x, y] = iso.p(tu, tv, H);
  const ctx = iso.ctx;
  ctx.fillStyle = '#4a3a2c';
  for (const dx of [-4, -1, 3]) ctx.fillRect(x + dx, y - 6, 1.2, 6);
  iso.round(tu, tv, H + 6, H + 15, () => 0.12, '#8b6a4a', '#6b5038');
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  const { rx } = IsoFrame.ellipse(0.12);
  for (const z of [8.5, 11.5, 14]) ctx.fillRect(x - rx, y - z, rx * 2, 0.6);
  const lid = (fill: string, side: -1 | 1) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x, y - 20);
    ctx.lineTo(x + side * (rx + 0.6), y - 15);
    ctx.lineTo(x, y - 14);
    ctx.closePath();
    ctx.fill();
  };
  lid('#5e4733', -1);
  lid('#3d2e22', 1);
}

/** The fire station's hose-drying tower: a slim lit box with a dark cap. */
export function paintHoseTower({ p, top, H }: RooftopArgs) {
  const { iso, o, art } = p;
  const [cu, cv] = roofSpot(o, top, 0.12, 0.12);
  iso.solid({ u0: cu - 0.02, u1: cu + 0.16, v0: cv - 0.02, v1: cv + 0.16 }, H, H + 16, art.wall);
  iso.solid({ u0: cu - 0.04, u1: cu + 0.18, v0: cv - 0.04, v1: cv + 0.18 }, H + 16, H + 18, shade(MATERIAL.metalDark, -0.1));
}
