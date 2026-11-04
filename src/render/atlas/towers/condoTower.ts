import type { IsoFrame, Orient, Rng } from '../core';
import { at } from '../civic/lot';
import { planShadow, prism } from '../modern/loft';
import { circle, rect, rotate, superellipse, type Plan, type Pt } from '../modern/plans';
import { bands, glass, solid } from '../modern/skins';
import { towerLot } from './lot';

/**
 * Condo Tower (2×2, zoned high-density residential): a glass core wrapped in white balconies
 * that ripple floor by floor, a stack of twisting glass boxes with planted edges, and twin round
 * towers joined at the top by a sky pool.
 */

const C: Pt = [1, 1];
const LOT = (o: Orient) => ({ u0: 0, u1: o.vw, v0: 0, v1: o.vh });

type Design = (iso: IsoFrame, o: Orient) => void;

/** A plan whose radius ripples round its edge (balcony slabs that wave). */
function wavy(base: Plan, amp: number, phase: number): Plan {
  return base.map(([x, y]) => {
    const a = Math.atan2(y, x);
    const k = 1 + amp * Math.sin(2 * a + phase);
    return [x * k, y * k];
  });
}

const waves: Design = (iso, o) => {
  const FLOOR = 8;
  const FLOORS = 18;
  planShadow(iso, o, C, rect(0.6, 0.6), FLOOR * FLOORS, LOT(o));
  const core = superellipse(0.46, 0.46, 4, 28);
  const skin = glass({ tint: '#4f7d99', floorH: 0, mullion: 0.12 });
  const slabs = superellipse(0.56, 0.56, 3, 28);
  for (let k = 0; k < FLOORS; k++) {
    prism(iso, o, C, core, k * FLOOR, (k + 1) * FLOOR - 1.4, skin, null);
    prism(iso, o, C, wavy(slabs, 0.13, k * 0.42), (k + 1) * FLOOR - 1.4, (k + 1) * FLOOR, solid('#f7f7f4'));
  }
  prism(iso, o, C, superellipse(0.3, 0.3, 4, 20), FLOOR * FLOORS, FLOOR * FLOORS + 6, glass({ tint: '#6fa0bc', floorH: 0, mullion: 0.1, lights: false }), '#7cc46a');
};

/** Glass boxes stacked four floors at a time, each turned a little against the last. */
const jenga: Design = (iso, o) => {
  const H = 34;
  const STACKS = 5;
  planShadow(iso, o, C, rect(0.62, 0.62), H * STACKS, LOT(o));
  const skin = bands({ wall: '#f4f2ec', tint: '#3f6b7f', floorH: 8.5, glazed: 0.72 });
  for (let k = 0; k < STACKS; k++) {
    const plan = rotate(rect(0.58, 0.46), (k % 2 ? 1 : -1) * 0.16 + k * 0.05);
    prism(iso, o, C, plan, k * H, (k + 1) * H, skin, '#78bf62');
  }
};

/** Twin round towers, a sky pool spanning their tops. */
const twins: Design = (iso, o) => {
  const H = 150;
  const a: Pt = [0.58, 1.42];
  const b: Pt = [1.42, 0.58];
  planShadow(iso, o, C, rect(0.75, 0.75), H, LOT(o));
  const skin = bands({ wall: '#efe9df', tint: '#557a96', floorH: 7.5, glazed: 0.6 });
  const [far, near] = [a, b].sort((p, q) => at(o, p[0], p[1]).depth - at(o, q[0], q[1]).depth);
  prism(iso, o, far, circle(0.36, 24), 0, H, skin, '#e6ded0');
  // The bridge, its glass sides, and the pool water on top.
  const bridge = rotate(rect(0.62, 0.17), -Math.PI / 4);
  prism(iso, o, C, bridge, H - 10, H - 2, glass({ tint: '#7fb9d6', floorH: 0, mullion: 0.06, lights: false }), null);
  prism(iso, o, C, bridge, H - 2, H, solid('#f2f4f6'), '#4fc3e8');
  prism(iso, o, near, circle(0.36, 24), 0, H, skin, '#e6ded0');
};

const DESIGNS: readonly Design[] = [waves, jenga, twins];
export const CONDO_TOWER_VARIANTS = DESIGNS.length;
export const CONDO_TOWER_TOP = 180;

export function paintCondoTower(iso: IsoFrame, o: Orient, rng: Rng, variant: number) {
  const lot = towerLot(iso, o, variant);
  DESIGNS[variant % DESIGNS.length](iso, o);
  lot.front();
  void rng;
}
