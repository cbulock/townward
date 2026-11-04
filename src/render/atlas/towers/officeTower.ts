import type { IsoFrame, Orient, Rng } from '../core';
import { at } from '../civic/lot';
import { loft, planShadow, prism, sweep } from '../modern/loft';
import { lightRing, spire } from '../modern/parts';
import { chamfered, circle, rect, rotate, superellipse, type Pt } from '../modern/plans';
import { bands, glass, solid } from '../modern/skins';
import { towerLot } from './lot';

/**
 * Office Tower (2×2, zoned high-density commercial): six contemporary skyscrapers, each its own
 * form rather than a recolour: a twisting tower, a chamfered obelisk, a bullet, twin slabs with
 * a skybridge, a stepped tower with a spire, and a slanted-cut prism.
 */

const C: Pt = [1, 1];
const LOT = (o: Orient) => ({ u0: 0, u1: o.vw, v0: 0, v1: o.vh });

type Design = (iso: IsoFrame, o: Orient) => void;

/** A square tower turning a quarter turn on its way up. */
const twist: Design = (iso, o) => {
  const H = 196;
  planShadow(iso, o, C, rect(0.6, 0.6), H, LOT(o));
  prism(iso, o, C, superellipse(0.72, 0.72, 6, 32), 0, 10, glass({ tint: '#2f4f68', floorH: 10, mullion: 0.12 }), '#d5dbe1');
  const skin = glass({ tint: '#4d8aa6', frame: '#e6f1f6', floorH: 6, mullion: 0.11 });
  loft(iso, o, sweep(10, H, 30, C, (t) => rotate(superellipse(0.58, 0.58, 8, 32), t * (Math.PI / 2))), skin, '#dfe8ee');
  lightRing(iso, o, C, rotate(superellipse(0.56, 0.56, 8, 32), Math.PI / 2), H - 2, '#eaf8ff');
  spire(iso, o, C, H, 26, 0.06, '#e3eaf0');
};

/** A chamfered obelisk tapering to a pyramid top and spire. */
const obelisk: Design = (iso, o) => {
  const H = 188;
  planShadow(iso, o, C, rect(0.65, 0.65), H, LOT(o));
  const skin = glass({ tint: '#33557e', frame: '#d9e4f0', floorH: 6, mullion: 0.1 });
  loft(iso, o, sweep(0, H, 12, C, (t) => chamfered(0.72 - t * 0.28, 0.72 - t * 0.28, 0.2 - t * 0.08)), skin, null);
  loft(iso, o, sweep(H, H + 22, 3, C, (t) => chamfered(0.44 * (1 - t) + 0.03, 0.44 * (1 - t) + 0.03, 0.12 * (1 - t) + 0.01)), glass({ tint: '#6c93c0', floorH: 0, mullion: 0.08, lights: false }), null);
  spire(iso, o, C, H + 22, 30, 0.04, '#e7edf3');
};

/** A rounded bullet with a fine diagrid of mullions. */
const bullet: Design = (iso, o) => {
  const H = 176;
  planShadow(iso, o, C, circle(0.6), H, LOT(o));
  const r = (t: number) => 0.7 * Math.sin(Math.PI * (0.27 + 0.73 * t)) + 0.02;
  loft(iso, o, sweep(0, H, 26, C, (t) => circle(r(t), 28)), glass({ tint: '#4f8a7c', frame: '#e1f2ec', floorH: 5, mullion: 0.08 }), '#e7efeb');
};

/** Two slim slabs of different heights joined by a glass skybridge. */
const twins: Design = (iso, o) => {
  const skin = glass({ tint: '#7a6a55', frame: '#f1e8dc', floorH: 6, mullion: 0.1 });
  const a: Pt = [0.55, 1];
  const b: Pt = [1.45, 1];
  const plan = superellipse(0.3, 0.55, 6, 24);
  planShadow(iso, o, C, rect(0.75, 0.6), 180, LOT(o));
  const [far, near] = [
    { depth: at(o, a[0], a[1]).depth, draw: () => prism(iso, o, a, plan, 0, 182, skin, '#efe6da') },
    { depth: at(o, b[0], b[1]).depth, draw: () => prism(iso, o, b, plan, 0, 158, skin, '#efe6da') },
  ].sort((x, y) => x.depth - y.depth);
  far.draw();
  prism(iso, o, C, rect(0.2, 0.22), 118, 128, glass({ tint: '#a3c4d8', floorH: 0, mullion: 0.06, lights: false }), '#e9eef2');
  near.draw();
};

/** Three stepped tiers in stone bands and glass, finished with a spire. */
const stepped: Design = (iso, o) => {
  planShadow(iso, o, C, rect(0.7, 0.7), 190, LOT(o));
  const skin = bands({ wall: '#e9e4da', tint: '#3e5f7e', floorH: 7, glazed: 0.62 });
  const tiers: readonly [number, number, number][] = [
    [0, 92, 0.74],
    [92, 142, 0.6],
    [142, 176, 0.46],
  ];
  for (const [z0, z1, hw] of tiers) prism(iso, o, C, chamfered(hw, hw, hw * 0.25), z0, z1, skin, '#d9d3c7');
  prism(iso, o, C, chamfered(0.3, 0.3, 0.08), 176, 186, solid('#d6cfc1'));
  spire(iso, o, C, 186, 44, 0.08, '#dcd5c8');
};

/** A prism cut by one great slanting face that catches the sky. */
const slant: Design = (iso, o) => {
  const H = 190;
  planShadow(iso, o, C, rect(0.65, 0.65), H, LOT(o));
  const skin = glass({ tint: '#5f8fb5', frame: '#e8f1f8', floorH: 6, mullion: 0.1 });
  // The front recedes as it rises: depth shrinks and the centre moves back, keeping the back wall plumb.
  loft(
    iso,
    o,
    sweep(0, H, 1, (t) => [1, 1 - t * 0.38], (t) => rect(0.64, 0.66 - t * 0.38)),
    skin,
    '#e6eef4',
  );
};

const DESIGNS: readonly Design[] = [twist, obelisk, bullet, twins, stepped, slant];
export const OFFICE_TOWER_VARIANTS = DESIGNS.length;
export const OFFICE_TOWER_TOP = 240;

export function paintOfficeTower(iso: IsoFrame, o: Orient, rng: Rng, variant: number) {
  const lot = towerLot(iso, o, variant);
  DESIGNS[variant % DESIGNS.length](iso, o);
  lot.front();
  void rng;
}
