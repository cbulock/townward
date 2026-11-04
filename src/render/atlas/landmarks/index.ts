import type { CivicArt } from '../civic/lot';
import { paintObservationWheel, WHEEL_TOP } from './observationWheel';
import { paintSailHotel, SAIL_HOTEL_TOP } from './sailHotel';
import { paintSkyTower, SKY_TOWER_TOP } from './skyTower';
import { paintThemePark, THEME_PARK_TOP } from './themePark';

/**
 * Landmarks (D-096): placeable showpieces in Parks & Places, one module each, built on the modern
 * kit (render/atlas/modern). Headroom is the art's height above the footprint.
 */
export type LandmarkArtId = 'sky_tower' | 'sail_hotel' | 'observation_wheel' | 'theme_park';

export const LANDMARK_ART: Readonly<Record<LandmarkArtId, CivicArt>> = {
  sky_tower: { variants: 3, headroom: () => Math.ceil(SKY_TOWER_TOP), paint: paintSkyTower },
  sail_hotel: { variants: 3, headroom: () => Math.ceil(SAIL_HOTEL_TOP), paint: paintSailHotel },
  observation_wheel: { variants: 3, headroom: () => Math.ceil(WHEEL_TOP), paint: paintObservationWheel },
  theme_park: { variants: 3, headroom: () => Math.ceil(THEME_PARK_TOP), paint: paintThemePark },
};
