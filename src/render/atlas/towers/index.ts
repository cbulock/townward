import type { CivicArt } from '../civic/lot';
import { CONDO_TOWER_TOP, CONDO_TOWER_VARIANTS, paintCondoTower } from './condoTower';
import { HOTEL_TOP, HOTEL_VARIANTS, paintHotel } from './hotel';
import { OFFICE_TOWER_TOP, OFFICE_TOWER_VARIANTS, paintOfficeTower } from './officeTower';

/**
 * Modern towers (D-096): zoned high-rises drawn with the modern kit instead of box recipes,
 * one module per building, each variant its own form.
 */
export type TowerArtId = 'office_tower' | 'condo_tower' | 'hotel';

export const TOWER_ART: Readonly<Record<TowerArtId, CivicArt>> = {
  office_tower: { variants: OFFICE_TOWER_VARIANTS, headroom: () => OFFICE_TOWER_TOP, paint: paintOfficeTower },
  condo_tower: { variants: CONDO_TOWER_VARIANTS, headroom: () => CONDO_TOWER_TOP, paint: paintCondoTower },
  hotel: { variants: HOTEL_VARIANTS, headroom: () => HOTEL_TOP, paint: paintHotel },
};
