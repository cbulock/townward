import { contactShadow, shade, type IsoFrame } from '../../core';

/**
 * A parked car: a lower body box, a glass cabin set back from both ends, lit roof and a contact
 * shadow. `alongU` sets its heading. Footprint about 0.3 × 0.15 tiles.
 */
export function paintParkedCar(iso: IsoFrame, u: number, v: number, alongU: boolean, color: string) {
  const [l, w] = alongU ? [0.3, 0.15] : [0.15, 0.3];
  contactShadow(iso, { u0: u, u1: u + l, v0: v, v1: v + w }, 1.2);
  iso.solid({ u0: u, u1: u + l, v0: v, v1: v + w }, 0.6, 3, color);
  // Wheels peeking out under the body.
  iso.box(u + 0.01, u + l - 0.01, v + 0.01, v + w - 0.01, 0, 0.8, '#1d2024', '#14161a', '#1d2024');
  const [cu, cv] = alongU ? [l * 0.22, 0.015] : [0.015, w * 0.22];
  const cab = { u0: u + cu, u1: u + l - cu, v0: v + cv, v1: v + w - cv };
  iso.box(cab.u0, cab.u1, cab.v0, cab.v1, 3, 5, '#5c7894', '#2f4256', shade(color, 0.12));
  iso.floor(cab.u0 + 0.01, cab.u1 - 0.01, cab.v0 + 0.01, cab.v1 - 0.01, 5.05, shade(color, 0.22));
}
