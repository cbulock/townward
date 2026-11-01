import { flatTone, floorOut, shade, solidOut, topTone, wallOn } from '../../core';
import { roofSpot } from '../context';
import type { AttachArgs } from './kit';

/** Brick chimney through a pitched roof, with a cap and a dark flue. */
export function paintChimney({ p, top }: AttachArgs) {
  const { iso, o, art } = p;
  const [cu, cv] = roofSpot(o, top, 0.75, 0.3);
  const H = top.z1;
  const z1 = H + (art.roofH ?? 0) + 4;
  iso.solid({ u0: cu - 0.05, u1: cu + 0.05, v0: cv - 0.05, v1: cv + 0.05 }, H - 2, z1, '#a4513f');
  iso.solid({ u0: cu - 0.06, u1: cu + 0.06, v0: cv - 0.06, v1: cv + 0.06 }, z1, z1 + 1, '#cfc6b8');
  iso.disc(cu, cv, 0.025, z1 + 1.05, '#2a2522');
}

/** Covered porch: a floor, two slim posts and a lit roof slab. */
export function paintPorch({ p, lf }: AttachArgs) {
  if (!lf) return;
  const { iso, art } = p;
  const mid = (lf.a0 + lf.a1) / 2;
  floorOut(iso, lf, mid - 0.21, mid + 0.21, 0, 0.15, 1.5, '#d8cbb2');
  solidOut(iso, lf, mid - 0.21, mid + 0.21, 0, 0.15, 0, 1.5, '#cbbda3');
  for (const a of [mid - 0.19, mid + 0.17]) wallOn(iso, lf, a, a + 0.02, 1.5, 8.5, '#f8f4ea', 0.13);
  solidOut(iso, lf, mid - 0.22, mid + 0.22, 0, 0.16, 8.5, 9.6, shade(art.roofColor, 0.05));
  wallOn(iso, lf, mid - 0.2, mid + 0.2, 6.6, 8.5, 'rgba(12, 18, 30, 0.2)');
}

/** Flat entrance canopy on two posts (offices, hotels, civic buildings). */
export function paintCanopy({ p, lf }: AttachArgs) {
  if (!lf) return;
  const { iso, art } = p;
  const mid = (lf.a0 + lf.a1) / 2;
  const trim = art.trim ?? '#c9a447';
  floorOut(iso, lf, mid - 0.3, mid + 0.3, 0.02, 0.32, 0.2, 'rgba(12, 18, 30, 0.18)');
  for (const a of [mid - 0.28, mid + 0.26]) wallOn(iso, lf, a, a + 0.02, 0, 7.5, flatTone(trim, lf.face), 0.28);
  floorOut(iso, lf, mid - 0.3, mid + 0.3, 0, 0.3, 9, topTone('#2c2f36'));
  wallOn(iso, lf, mid - 0.3, mid + 0.3, 7.5, 9, flatTone(trim, lf.face), 0.3);
  wallOn(iso, lf, mid - 0.3, mid + 0.3, 8.7, 9, 'rgba(255,255,255,0.4)', 0.3);
}
