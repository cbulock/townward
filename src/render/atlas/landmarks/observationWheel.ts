import type { IsoFrame, Orient, Rng } from '../core';
import { drawItems, type Item } from '../civic/lot';
import { lamp, path, tree } from '../civic/kit';
import { planShadow, prism } from '../modern/loft';
import { superellipse } from '../modern/plans';
import { glass, solid } from '../modern/skins';
import { vault } from '../modern/vault';
import { paintWheel, wheelTop, type WheelSpec } from '../modern/wheel';
import { plaza, pool } from './plaza';

/**
 * Observation Wheel (3×3 landmark): a giant wheel of glass pods over a waterfront plaza, with a
 * curved glass boarding hall under the wheel, a pool, trees and lamps.
 */

interface Look {
  readonly rim: string;
  readonly legs: string;
  readonly pods: readonly string[];
}

const LOOKS: readonly Look[] = [
  { rim: '#f2f5f8', legs: '#e3e8ee', pods: ['#ff6b8b', '#ffb44a', '#ffe066', '#5ad1a0', '#4ab2ff', '#a07bff'] },
  { rim: '#e8f6f6', legs: '#cfe3e6', pods: ['#3fc1c9', '#f7f7f7'] },
  { rim: '#fbeef2', legs: '#e9d6dd', pods: ['#ff8fb1', '#ffffff', '#ffd3e0'] },
];

const SPEC = { at: [1.5, 1.35] as const, axis: 'u' as const, radius: 1.38, hubZ: 62, pods: 18 };
export const WHEEL_TOP = wheelTop(SPEC);

export function paintObservationWheel(iso: IsoFrame, o: Orient, rng: Rng, variant: number) {
  const look = LOOKS[variant % LOOKS.length];
  plaza(iso, o, '#eee9df', 0.3);
  pool(iso, o, { u0: 0.2, u1: 1.05, v0: 2.15, v1: 2.8 });
  path(iso, o, { u0: 1.35, u1: 1.65, v0: 1.6, v1: 2.95 });
  const lot = { u0: 0, u1: o.vw, v0: 0, v1: o.vh };
  const items: Item[] = [];
  for (const [u, v] of [[2.3, 2.3], [2.75, 2.7], [0.3, 0.4], [2.7, 0.4]] as const) items.push(tree(iso, o, u, v, 0.5, (variant + Math.round(u * 3)) % 9));
  for (const [u, v] of [[1.2, 2.5], [1.8, 2.5], [1.2, 2.9], [1.8, 2.9]] as const) items.push(lamp(iso, o, u, v));
  const [hu, hv] = o.point(SPEC.at[0], SPEC.at[1]);
  const behind = (it: Item) => it.depth < hu + hv;
  drawItems(items.filter(behind));

  // Boarding hall: a low curved-glass vault under the wheel's lowest point.
  planShadow(iso, o, [1.5, 1.35], superellipse(0.6, 0.2, 4), 40, lot);
  prism(iso, o, [1.5, 1.35], superellipse(0.58, 0.22, 5, 20), 0, 7, glass({ tint: '#47708f', floorH: 0, mullion: 0.1 }), '#e9eef3');
  vault(iso, o, { u0: 0.95, u1: 2.05, v0: 1.15, v1: 1.55 }, 'u', 7, 5, solid('#f4f6f8'), '#c9d2db');

  const spec: WheelSpec = { ...SPEC, rim: look.rim, legs: look.legs, podColors: look.pods, spin: variant * 0.17 };
  paintWheel(iso, o, spec);
  drawItems(items.filter((it) => !behind(it)));
  void rng;
}
