import { faceRef, flatTone, shade, topTone } from '../../core';
import { glassFill } from '../facades';
import { EAVE, eaveShadow, ridgeFrame, slopeGradient, type RoofArgs } from './kit';

/**
 * Gable roof: far slope, the gable end wall with a small window, then the near slope with tile
 * courses and a bright ridge cap. The near slope faces the sun for a ridge along u.
 */
export function paintGableRoof(args: RoofArgs) {
  const { iso, art, axis, H, roofColor, wall, b } = args;
  const rh = art.roofH ?? 0;
  const o = EAVE;
  const { A0, A1, C0, C1, P, cm } = ridgeFrame(args);
  const sunny = axis === 'u';
  eaveShadow(args);
  iso.poly([P(A0 - o, C0 - o, H), P(A1 + o, C0 - o, H), P(A1 + o, cm, H + rh), P(A0 - o, cm, H + rh)], shade(roofColor, -0.3));
  // Gable end, in the tone of the wall it tops.
  const endFace = axis === 'u' ? 'se' : 'sw';
  iso.poly([P(A1, C0, H), P(A1, C1, H), P(A1, cm, H + rh)], flatTone(wall, endFace));
  const f = faceRef(endFace, b);
  const half = Math.min(0.07, (C1 - C0) * 0.1);
  if (rh > 5) iso.wall(endFace, f.at, cm - half, cm + half, H + rh * 0.18, H + rh * 0.5, glassFill(iso, f, cm - half, cm + half, H + rh * 0.18, H + rh * 0.5));

  const near = sunny ? topTone(roofColor) : flatTone(roofColor, 'se');
  const eaveP = P((A0 + A1) / 2, C1 + o, H - 1);
  const ridgeP = P((A0 + A1) / 2, cm, H + rh);
  iso.poly([P(A0 - o, C1 + o, H - 1), P(A1 + o, C1 + o, H - 1), P(A1 + o, cm, H + rh), P(A0 - o, cm, H + rh)], slopeGradient(iso, eaveP, ridgeP, shade(near, -0.1), shade(near, 0.1)));
  // Tile courses.
  for (let t = 0.14; t < 1; t += 0.14) {
    const cc = C1 + o - (C1 + o - cm) * t;
    const z = H - 1 + (rh + 1) * t;
    iso.poly([P(A0 - o, cc, z), P(A1 + o, cc, z), P(A1 + o, cc, z + 0.5), P(A0 - o, cc, z + 0.5)], 'rgba(0,0,0,0.13)');
  }
  // Fascia along the eave, and the ridge cap.
  iso.poly([P(A0 - o, C1 + o, H - 1), P(A1 + o, C1 + o, H - 1), P(A1 + o, C1 + o, H - 2), P(A0 - o, C1 + o, H - 2)], shade(roofColor, -0.4));
  iso.poly([P(A0 - o, cm, H + rh), P(A1 + o, cm, H + rh), P(A1 + o, cm, H + rh + 1), P(A0 - o, cm, H + rh + 1)], shade(roofColor, 0.3));
  // Verge: the end of the near slope catches the light.
  iso.poly([P(A1 + o, C1 + o, H - 1), P(A1 + o, cm, H + rh), P(A1 + o - 0.02, cm, H + rh), P(A1 + o - 0.02, C1 + o, H - 1)], 'rgba(255, 248, 230, 0.35)');
}
