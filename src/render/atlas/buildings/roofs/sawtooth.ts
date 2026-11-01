import { flatTone, mix, shade, topTone } from '../../core';
import { GLASS } from '../../theme/tokens';
import { ridgeFrame, type RoofArgs } from './kit';

/** Sawtooth: north-light teeth along the axis, solid backs and glazed faces toward the camera. */
export function paintSawtoothRoof(args: RoofArgs) {
  const { iso, art, axis, H, roofColor, wall, b } = args;
  const rh = art.roofH ?? 0;
  const { A0, A1, C0, C1, P } = ridgeFrame(args);
  const teeth = Math.max(2, Math.round((A1 - A0) * 3));
  const tw = (A1 - A0) / teeth;
  iso.floor(b.u0, b.u1, b.v0, b.v1, H, shade(roofColor, -0.25));
  const endFace = axis === 'u' ? 'se' : 'sw';
  for (let k = 0; k < teeth; k++) {
    const a = A0 + k * tw;
    const c = a + tw;
    const back = topTone(roofColor);
    const [ex, ey] = P(a, C1, H);
    const [rx, ry] = P(c, C1, H + rh);
    const g = iso.ctx.createLinearGradient(ex, ey, rx, ry);
    g.addColorStop(0, shade(back, -0.12));
    g.addColorStop(1, shade(back, 0.08));
    iso.poly([P(a, C0, H), P(c, C0, H + rh), P(c, C1, H + rh), P(a, C1, H)], g);
    const glass = k === teeth - 1 ? flatTone(wall, endFace) : mix(GLASS.reflect, '#5f86a6', 0.5);
    iso.poly([P(c, C0, H), P(c, C0, H + rh), P(c, C1, H + rh), P(c, C1, H)], glass);
    iso.poly([P(c, C0, H + rh - 0.5), P(c, C0, H + rh), P(c, C1, H + rh), P(c, C1, H + rh - 0.5)], 'rgba(255,255,255,0.4)');
    iso.poly([P(a, C1, H), P(c, C1, H), P(c, C1, H + rh)], flatTone(wall, axis === 'u' ? 'sw' : 'se'));
  }
}
