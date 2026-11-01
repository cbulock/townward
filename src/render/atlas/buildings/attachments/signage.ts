import { faceRef, flatTone, pOn, shade, wallOn, type FaceRef } from '../../core';
import type { AttachArgs } from './kit';

/** Striped awning over the shopfront, sloping out, with a scalloped valance and its shadow. */
export function paintAwning({ p, lf }: AttachArgs) {
  if (!lf) return;
  const { iso, art } = p;
  const c = art.awning ?? '#d94a3d';
  const z = art.floorH - 1.5;
  const stripes = 8;
  const len = lf.a1 - lf.a0;
  wallOn(iso, lf, lf.a0, lf.a1, z - 6, z - 4, 'rgba(12, 18, 30, 0.22)');
  for (let k = 0; k < stripes; k++) {
    const a = lf.a0 + (len / stripes) * k;
    const a2 = a + len / stripes;
    const fill = k % 2 ? '#f8f4ec' : c;
    const g = iso.ctx.createLinearGradient(...pOn(iso, lf, a, 0, z), ...pOn(iso, lf, a, 0.16, z - 4));
    g.addColorStop(0, shade(flatTone(fill, lf.face), -0.12));
    g.addColorStop(1, shade(flatTone(fill, lf.face), 0.1));
    iso.poly([pOn(iso, lf, a, 0, z), pOn(iso, lf, a2, 0, z), pOn(iso, lf, a2, 0.16, z - 4), pOn(iso, lf, a, 0.16, z - 4)], g);
  }
  wallOn(iso, lf, lf.a0, lf.a1, z - 5.5, z - 4, flatTone(shade(c, -0.15), lf.face), 0.16);
}

/** A sign board with a lit top edge and text. */
function board(p: AttachArgs['p'], f: FaceRef, a0: number, a1: number, z0: number, z1: number, text: string, size: number, color: string, out = 0) {
  const { iso } = p;
  wallOn(iso, f, a0, a1, z0 - 0.6, z1 + 0.2, 'rgba(12, 18, 30, 0.25)', out);
  wallOn(iso, f, a0, a1, z0, z1, iso.wallGradient(f.face, f.at + out, a0, a1, z0, z1, shade(color, 0.12), shade(color, -0.12)), out);
  wallOn(iso, f, a0, a1, z1 - 0.6, z1, 'rgba(255,255,255,0.45)', out);
  iso.text(f.face, f.at + out, (a0 + a1) / 2, (z0 + z1) / 2, text, size, '#ffffff');
}

/** A shop's name over its window (or above a one-storey shop's roofline). */
export function paintShopSign({ p, lf, base, top }: AttachArgs) {
  const { art } = p;
  if (!lf || !art.sign || base.facade !== 'shopfront') return;
  const sc = art.signColor ?? '#333';
  const size = art.sign.length > 6 ? 4 : 5;
  if (base.floors === 1 && top === base) board(p, lf, lf.a0 + 0.08, lf.a1 - 0.08, top.z1, top.z1 + 7, art.sign, size + 0.5, sc, -0.02);
  else board(p, lf, lf.a0 + 0.06, lf.a1 - 0.06, art.floorH + 1.2, art.floorH + 6.5, art.sign, size, sc);
}

/** Rooftop sign parallel to the front, on two posts; it faces whichever camera-facing wall shares its axis. */
export function paintRoofSign({ p, base, top }: AttachArgs) {
  const { iso, o, art } = p;
  if (!art.sign || base.facade === 'shopfront') return;
  const l = top.local;
  const sc = art.signColor ?? '#c33';
  const mid = (l.u0 + l.u1) / 2;
  const half = (l.u1 - l.u0) * 0.38;
  const vv = l.v0 + (l.v1 - l.v0) * 0.55;
  const [pu0, pv0] = o.point(mid - half, vv);
  const [pu1, pv1] = o.point(mid + half, vv);
  const sf: FaceRef =
    Math.abs(pv0 - pv1) < 1e-6
      ? { face: 'sw', at: pv0, a0: Math.min(pu0, pu1), a1: Math.max(pu0, pu1) }
      : { face: 'se', at: pu0, a0: Math.min(pv0, pv1), a1: Math.max(pv0, pv1) };
  const z0 = top.z1 + (art.roof === 'flat' ? 0 : (art.roofH ?? 0) * 0.5);
  for (const a of [sf.a0 + 0.05, sf.a1 - 0.07]) wallOn(iso, sf, a, a + 0.02, z0, z0 + 4, '#4a4f56');
  board(p, sf, sf.a0, sf.a1, z0 + 4, z0 + 12, art.sign, art.sign.length > 5 ? 5.5 : 6.5, sc);
}

/** Clinic red cross on both visible walls of the top mass. */
export function paintRedCross({ p, top }: AttachArgs) {
  const { iso } = p;
  for (const face of ['sw', 'se'] as const) {
    const f = faceRef(face, top.view);
    const mid = (f.a0 + f.a1) / 2;
    const z = top.z1 - 7;
    wallOn(iso, f, mid - 0.09, mid + 0.09, z - 4.5, z + 4.5, flatTone('#ffffff', face));
    wallOn(iso, f, mid - 0.025, mid + 0.025, z - 3.5, z + 3.5, flatTone('#e0393f', face));
    wallOn(iso, f, mid - 0.07, mid + 0.07, z - 1, z + 1, flatTone('#e0393f', face));
  }
}
