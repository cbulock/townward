import type { IsoFrame, Orient, Rng } from '../core';
import { drawItems, type Item } from '../civic/lot';
import { tree } from '../civic/kit';
import { loft, planShadow, prism, sweep } from '../modern/loft';
import { lightRing, spire } from '../modern/parts';
import { circle, trefoil, type Plan, type Pt } from '../modern/plans';
import { glass, solid } from '../modern/skins';
import { palm, plaza, pool } from './plaza';

/**
 * Sky Tower (3×3 landmark): a supertall on a three-winged plan. The wings step back one at a
 * time as it rises, so the setbacks spiral round the core, which runs on as a slim glass drum
 * to a needle spire. Silver-blue glass with fine mullions; terraces in pale metal.
 */

const TIER_H = 30;
const TIERS = 9;
const CORE_H = 46;
const SPIRE_H = 92;
export const SKY_TOWER_TOP = 12 + TIER_H * TIERS + CORE_H + SPIRE_H * 1.25;

interface Look {
  readonly tint: string;
  readonly terrace: string;
  readonly turn: number;
}

const LOOKS: readonly Look[] = [
  { tint: '#6f8fae', terrace: '#dfe6ee', turn: Math.PI / 2 },
  { tint: '#5f8e9c', terrace: '#e6ecef', turn: Math.PI / 2 + Math.PI / 3 },
  { tint: '#7b86a6', terrace: '#ece6dc', turn: Math.PI / 6 },
];

/** Wing lengths of tier k: each tier pulls one wing in, round and round. */
function wings(k: number): [number, number, number] {
  const out: [number, number, number] = [1.28, 1.28, 1.28];
  for (let s = 0; s < k; s++) out[s % 3] -= 0.115;
  return out;
}

export function paintSkyTower(iso: IsoFrame, o: Orient, rng: Rng, variant: number) {
  const look = LOOKS[variant % LOOKS.length];
  const at: Pt = [1.5, 1.5];
  const lot = { u0: 0, u1: o.vw, v0: 0, v1: o.vh };
  plaza(iso, o, '#ece8df', 0.3);
  // Reflecting pools in the crooks between the wings.
  pool(iso, o, { u0: 2.25, u1: 2.85, v0: 2.2, v1: 2.85 });
  pool(iso, o, { u0: 0.18, u1: 0.75, v0: 2.25, v1: 2.85 });
  const halfW = 0.27;
  const base = trefoil(wings(0), halfW, look.turn);
  planShadow(iso, o, at, base, 240, lot, 1.2);

  const items: Item[] = [];
  for (const [u, v] of [[0.3, 0.3], [2.7, 0.35], [0.25, 1.9], [2.75, 1.85]] as const) items.push(palm(iso, o, u, v, 15, u < 1.5 ? 1 : -1));
  for (const [u, v] of [[1.2, 2.82], [1.85, 2.82]] as const) items.push(tree(iso, o, u, v, 0.45, 3));
  // Split by view depth against the tower's centre, so the split turns with the view.
  const behind = (it: Item) => it.depth < 3;
  drawItems(items.filter(behind));

  // Podium: a low glass lobby on a wider version of the same plan.
  const podium = trefoil([1.42, 1.42, 1.42], halfW + 0.1, look.turn);
  prism(iso, o, at, podium, 0, 12, glass({ tint: '#3e5f7c', floorH: 12, mullion: 0.1 }), '#cfd6dd');

  const skin = glass({ tint: look.tint, frame: '#eef3f8', floorH: 5, mullion: 0.09 });
  for (let k = 0; k < TIERS; k++) {
    const z0 = 12 + k * TIER_H;
    const plan: Plan = trefoil(wings(k), halfW - k * 0.008, look.turn);
    prism(iso, o, at, plan, z0, z0 + TIER_H, skin, look.terrace);
  }
  // The core drum, a crown of lights, then the spire.
  const zc = 12 + TIERS * TIER_H;
  loft(iso, o, sweep(zc, zc + CORE_H, 6, at, (t) => circle(0.3 - t * 0.08, 18)), skin, look.terrace);
  lightRing(iso, o, at, circle(0.23, 18), zc + CORE_H - 3, '#fff2c8');
  prism(iso, o, at, circle(0.2, 14), zc + CORE_H, zc + CORE_H + 6, solid('#dfe5ea'));
  spire(iso, o, at, zc + CORE_H + 6, SPIRE_H, 0.15, '#e2e8ee');
  drawItems(items.filter((it) => !behind(it)));
  void rng;
}
