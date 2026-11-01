import { DIRS } from '../../../sim/roads';
import { type IsoFrame } from '../core';
import { LAMP, pole, POLE } from '../streetArt';
import { gratedTree } from './avenueFurniture';

/**
 * What stands on one-way carriageways (docs/specs/transport.md): boulevard median trees and
 * promenade lamps, expressway high-mast lamps on the median barrier. Positions use the
 * carriageway's own frame (roads/oneway.ts): lateral 0 = median edge, 1 = outer edge.
 */

export const WIDE_STYLES = 2;

/** View-tile point at lateral `l`, along `s`, on a one-way tile travelling in direction `d`. */
function at(d: number, l: number, s: number): [number, number] {
  const [lx, ly] = DIRS[(d + 3) % 4];
  const lat = lx + ly < 0 ? l : 1 - l;
  return d % 2 === 1 ? [s, lat] : [lat, s];
}

/** A lamp at lateral `l` whose arm reaches toward lateral `to`. */
function lamp(iso: IsoFrame, d: number, l: number, to: number, s: number, h: number) {
  const [u, v] = at(d, l, s);
  const [hu, hv] = at(d, to, s);
  iso.disc(u, v, 0.02, 0, 'rgba(0, 0, 0, 0.22)');
  pole(iso, u, v, 0, h, h > 20 ? 1.6 : 1.2);
  const ctx = iso.ctx;
  const a = iso.p(u, v, h);
  const b = iso.p(hu, hv, h + 1);
  ctx.strokeStyle = POLE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 236, 160, 0.28)';
  ctx.beginPath();
  ctx.ellipse(b[0], b[1] + 1.6, 3.4, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = LAMP;
  ctx.fillRect(b[0] - 1.5, b[1] - 0.2, 3, 1.4);
}

export function paintBoulevardFurniture(iso: IsoFrame, d: number, style: number) {
  // Trees along this side of the median; the twin tile fills the other side, offset.
  gratedTree(iso, ...at(d, 0.045, style === 0 ? 0.3 : 0.75), style, 0.48);
  // A lamp on the promenade, its arm over the outer lanes.
  if (style === 1) lamp(iso, d, 0.9, 0.7, 0.35, 16);
}

export function paintExpresswayFurniture(iso: IsoFrame, d: number, style: number) {
  // High-mast lamps on the median barrier every other tile.
  if (style === 0) lamp(iso, d, 0.025, 0.3, 0.5, 26);
}
