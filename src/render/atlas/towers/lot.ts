import type { IsoFrame, Orient } from '../core';
import { at, drawItems, type Item } from '../civic/lot';
import { tree } from '../civic/kit';
import { plaza } from '../landmarks/plaza';

/**
 * The forecourt every modern tower stands on: a paved plaza with trees in its corners. Items
 * behind the tower's middle are drawn first; `front()` draws the rest once the tower is up.
 */
export interface TowerLot {
  front(): void;
}

export function towerLot(iso: IsoFrame, o: Orient, variant: number, trees: readonly (readonly [number, number])[] = CORNERS): TowerLot {
  plaza(iso, o, '#e9e5dc', 0.25);
  const items: Item[] = trees.map(([u, v], k) => tree(iso, o, u, v, 0.4, (variant * 3 + k) % 9));
  const c = at(o, o.w / 2, o.h / 2);
  const behind = (it: Item) => it.depth < c.depth;
  drawItems(items.filter(behind));
  return { front: () => drawItems(items.filter((it) => !behind(it))) };
}

const CORNERS: readonly (readonly [number, number])[] = [
  [0.2, 0.2],
  [1.8, 0.2],
  [0.2, 1.8],
  [1.8, 1.8],
];
