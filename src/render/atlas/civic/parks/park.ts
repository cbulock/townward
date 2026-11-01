import type { Box, IsoFrame, Orient, Rng } from '../../core';
import { drawItems, type Item } from '../lot';
import { lawn, paintHedges } from '../kit';
import { court } from './layouts/court';
import { duckPond } from './layouts/duckPond';
import { fountainPlaza } from './layouts/fountainPlaza';
import { gazebo } from './layouts/gazebo';
import type { ParkLayout } from './layouts/kit';
import { picnicGrove } from './layouts/picnicGrove';
import { playground } from './layouts/playground';

/** The neighbourhood park's looks, one per variant. */
const LAYOUTS: readonly ParkLayout[] = [fountainPlaza, playground, duckPond, court, gazebo, picnicGrove];

export const PARK_VARIANTS = LAYOUTS.length;

/** A 1×1 park: lawn, the variant's layout, then a hedge on the camera-facing edges. */
export function paintPark(iso: IsoFrame, o: Orient, rng: Rng, variant: number) {
  const lot: Box = { u0: 0, u1: o.vw, v0: 0, v1: o.vh };
  lawn(iso, lot);
  const items: Item[] = [];
  LAYOUTS[variant % LAYOUTS.length](iso, o, rng, items);
  drawItems(items);
  paintHedges(iso, lot);
}
