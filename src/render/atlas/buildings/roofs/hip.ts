import { flatTone, shade, topTone } from '../../core';
import { EAVE, eaveShadow, ridgeFrame, slopeGradient, type RoofArgs } from './kit';

/** Hip roof (a pyramid on square plans): far slope, the end hip, then the near slope and ridge. */
export function paintHipRoof(args: RoofArgs) {
  const { iso, art, axis, H, roofColor } = args;
  const rh = art.roofH ?? 0;
  const o = EAVE;
  const { A0, A1, C0, C1, P, cm } = ridgeFrame(args);
  eaveShadow(args);
  const d = (C1 - C0) / 2;
  const r0 = Math.min(A0 + d, (A0 + A1) / 2);
  const r1 = Math.max(A1 - d, (A0 + A1) / 2);
  const sunny = axis === 'u';
  iso.poly([P(A0 - o, C0 - o, H), P(A1 + o, C0 - o, H), P(r1, cm, H + rh), P(r0, cm, H + rh)], shade(roofColor, -0.3));
  // The hip end faces SE (shade) for a u ridge, SW (sun) for a v ridge.
  const endTone = sunny ? flatTone(roofColor, 'se') : topTone(roofColor);
  iso.poly([P(A1 + o, C0 - o, H), P(A1 + o, C1 + o, H), P(r1, cm, H + rh)], slopeGradient(iso, P(A1 + o, cm, H), P(r1, cm, H + rh), shade(endTone, -0.08), shade(endTone, 0.08)));
  const near = sunny ? topTone(roofColor) : flatTone(roofColor, 'se');
  iso.poly(
    [P(A0 - o, C1 + o, H), P(A1 + o, C1 + o, H), P(r1, cm, H + rh), P(r0, cm, H + rh)],
    slopeGradient(iso, P((A0 + A1) / 2, C1 + o, H), P((A0 + A1) / 2, cm, H + rh), shade(near, -0.1), shade(near, 0.1)),
  );
  for (let t = 0.16; t < 1; t += 0.16) {
    const cc = C1 + o - (C1 + o - cm) * t;
    const z = H + rh * t;
    const s0 = A0 - o + (r0 - A0 + o) * t;
    const s1 = A1 + o - (A1 + o - r1) * t;
    iso.poly([P(s0, cc, z), P(s1, cc, z), P(s1, cc, z + 0.45), P(s0, cc, z + 0.45)], 'rgba(0,0,0,0.12)');
  }
  // Hip lines and ridge catch the light.
  const c = iso.ctx;
  c.strokeStyle = shade(roofColor, 0.35);
  c.lineWidth = 0.7;
  c.beginPath();
  const [ax, ay] = P(A1 + o, C1 + o, H);
  const [bx, by] = P(r1, cm, H + rh);
  const [cx, cy] = P(r0, cm, H + rh);
  const [dx, dy] = P(A0 - o, C1 + o, H);
  c.moveTo(ax, ay);
  c.lineTo(bx, by);
  c.lineTo(cx, cy);
  c.lineTo(dx, dy);
  c.stroke();
  iso.poly([P(A0 - o, C1 + o, H), P(A1 + o, C1 + o, H), P(A1 + o, C1 + o, H - 1), P(A0 - o, C1 + o, H - 1)], shade(roofColor, -0.4));
}
