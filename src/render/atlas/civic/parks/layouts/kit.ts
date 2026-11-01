import type { IsoFrame, Orient, Rng } from '../../../core';
import type { Item } from '../../lot';

/** A 1×1 park layout: paints its ground into the frame and pushes standing items (drawn back to front). */
export type ParkLayout = (iso: IsoFrame, o: Orient, rng: Rng, items: Item[]) => void;
