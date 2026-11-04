import { cornerShop } from './corner_shop';
import { cafe } from './cafe';
import { smallOffice } from './small_office';
import { creativeOffice } from './creative_office';
import { supermarket } from './supermarket';
import { techCampus } from './tech_campus';
import type { BuildingArt, RecipeId } from '../types';

/** Shops, cafés, offices, and campuses (modern towers live in render/atlas/towers). One file per building. */
export const COMMERCIAL = {
  corner_shop: cornerShop,
  cafe,
  small_office: smallOffice,
  creative_office: creativeOffice,
  supermarket,
  tech_campus: techCampus,
} satisfies Partial<Record<RecipeId, readonly BuildingArt[]>>;
