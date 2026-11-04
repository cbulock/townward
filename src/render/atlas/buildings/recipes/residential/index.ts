import { cottage } from './cottage';
import { familyHouse } from './family_house';
import { townhouses } from './townhouses';
import { walkup } from './walkup';
import { apartmentBlock } from './apartment_block';
import { villa } from './villa';
import { luxuryApartments } from './luxury_apartments';
import type { BuildingArt, RecipeId } from '../types';

/** Homes, from cottages to condo towers. One file per building. */
export const RESIDENTIAL = {
  cottage,
  family_house: familyHouse,
  townhouses,
  walkup,
  apartment_block: apartmentBlock,
  villa,
  luxury_apartments: luxuryApartments,
} satisfies Partial<Record<RecipeId, readonly BuildingArt[]>>;
