import { blobShadow, type Box, type IsoFrame } from '../../core';
import { MATERIAL } from '../../theme/tokens';
import type { MassBox, Painting } from '../context';

/** What a rooftop painter gets: the building, its top mass and roof height. */
export interface RooftopArgs {
  readonly p: Painting;
  readonly top: MassBox;
  /** View box of the top mass. */
  readonly tb: Box;
  /** Roof level (px). */
  readonly H: number;
}

export type RooftopPainter = (args: RooftopArgs) => void;

/** Thin mast with a light shaft, a cross-arm and a beacon on top (recorded so it blinks at night). */
export function mast(iso: IsoFrame, u: number, v: number, z: number, h: number) {
  const [x, y] = iso.p(u, v, z);
  const c = iso.ctx;
  blobShadow(c, x + 1.5, y + 0.3, 2.2, 0.8, 0.8);
  const g = c.createLinearGradient(x - 0.7, 0, x + 0.7, 0);
  g.addColorStop(0, '#9aa2ab');
  g.addColorStop(1, MATERIAL.metalDark);
  c.fillStyle = g;
  c.fillRect(x - 0.6, y - h, 1.3, h);
  c.fillStyle = MATERIAL.metalDark;
  c.fillRect(x - 2, y - h * 0.6, 4, 0.7);
  c.fillStyle = MATERIAL.beacon;
  c.beginPath();
  c.arc(x + 0.05, y - h - 0.6, 1.1, 0, Math.PI * 2);
  c.fill();
  iso.mark('beacon', 'sw', x + 0.05, y - h - 0.6);
}
