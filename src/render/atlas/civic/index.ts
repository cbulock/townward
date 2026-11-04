import type { CustomArtId } from '../buildings/recipes';
import { ENERGY_ART } from '../energy';
import { paintRiversideMarket } from './commerce/riversideMarket';
import { paintShoppingComplex } from './commerce/shoppingComplex';
import type { CivicArt } from './lot';
import { paintBotanicalGarden } from './parks/botanicalGarden';
import { paintCentralPark } from './parks/centralPark';
import { paintPark, PARK_VARIANTS } from './parks/park';
import { paintTownHall } from './townHall';
import { paintPowerPlant, powerPlantSmoke } from './utilities/powerPlant';
import { paintLandfill } from './utilities/landfill';
import { paintWaterTower } from './utilities/waterTower';

/**
 * Buildings with their own painters (docs/specs/city-art.md, D-066), one module each:
 * parks/ (with one file per park layout), commerce/, the town hall, utilities/ and energy/.
 * Everything is laid out in local space (front at +v) and mapped through `Orient`.
 */
export const CIVIC_ART: Readonly<Record<CustomArtId, CivicArt>> = {
  park: { variants: PARK_VARIANTS, headroom: () => 34, paint: paintPark },
  central_park: { variants: 4, headroom: () => 42, paint: paintCentralPark },
  botanical_garden: { variants: 4, headroom: () => 42, paint: paintBotanicalGarden },
  shopping_complex: { variants: 4, headroom: () => 58, paint: paintShoppingComplex },
  riverside_market: { variants: 4, headroom: () => 34, paint: paintRiversideMarket },
  town_hall: { variants: 3, headroom: () => 72, paint: paintTownHall },
  power_plant: { variants: 3, headroom: () => 92, paint: paintPowerPlant, smoke: powerPlantSmoke },
  water_tower: { variants: 3, headroom: (v) => (v === 0 ? 62 : v === 1 ? 56 : 30), paint: paintWaterTower },
  landfill: { variants: 3, headroom: () => 34, paint: paintLandfill },
  ...ENERGY_ART,
};
