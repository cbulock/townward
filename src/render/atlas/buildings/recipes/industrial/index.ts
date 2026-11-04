import { workshop } from './workshop';
import { warehouse } from './warehouse';
import { factory } from './factory';
import type { BuildingArt, RecipeId } from '../types';

/** Workshops, warehouses and factories. One file per building. */
export const INDUSTRIAL = {
  workshop,
  warehouse,
  factory,
} satisfies Partial<Record<RecipeId, readonly BuildingArt[]>>;
