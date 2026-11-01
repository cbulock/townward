import { IsoFrame, type Orient, type Rng } from '../isoPaint';
import { at, type CivicArt } from '../lot';
import { ROTOR_RADIUS, type RotorSource } from './rotor';
import { TONE } from './tones';

/**
 * Wind turbine (1×1): a slim tapered tower and the nacelle. The blades are not painted here:
 * they spin in the game (render/fx/Rotors.ts) and are added as a still for thumbnails.
 */

const TOWER_H = 74;
/** Hub sits a little in front of the nacelle, on the side the variant faces. */
const HUB_DX = 4;
const facingOf = (variant: number) => (variant % 2 === 0 ? 1 : -1);

function paint(iso: IsoFrame, o: Orient, _rng: Rng, variant: number) {
  const ctx = iso.ctx;
  iso.disc(0.5, 0.5, 0.24, 0, TONE.gravelEdge);
  iso.disc(0.5, 0.5, 0.2, 0.1, TONE.gravel);
  const c = at(o, 0.5, 0.5);
  iso.round(c.u, c.v, 0, 3, () => 0.13, TONE.concrete, TONE.concreteTop);
  iso.round(c.u, c.v, 3, TOWER_H, (t) => 0.07 * (1 - 0.45 * t), TONE.white, null);

  // Nacelle, facing the view's left or right with the variant, then hub and blades.
  const [hx, hy] = iso.p(c.u, c.v, TOWER_H);
  const facing = facingOf(variant);
  ctx.fillStyle = TONE.whiteShade;
  ctx.fillRect(hx - 3 * facing - (facing < 0 ? 7 : 0), hy - 3, 7, 4);
  ctx.fillStyle = TONE.white;
  ctx.fillRect(hx - 3 * facing - (facing < 0 ? 7 : 0), hy - 4, 7, 2);
  ctx.fillStyle = TONE.beacon;
  ctx.fillRect(hx - 0.6, hy - 5.4, 1.2, 1.2);
}

function rotors(o: Orient, variant: number): RotorSource[] {
  const c = at(o, 0.5, 0.5);
  return [{ u: c.u, v: c.v, z: TOWER_H + 2, dx: HUB_DX * facingOf(variant) }];
}

export const windTurbineArt: CivicArt = { variants: 3, headroom: () => TOWER_H + ROTOR_RADIUS + 6, paint, rotors };
