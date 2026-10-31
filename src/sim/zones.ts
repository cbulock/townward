import type { Density, Zone } from './buildings/catalog';

/** Value of `World.zone[i]`. See docs/specs/buildings.md, "Zoning", and docs/specs/core.md, "Density". */
export const ZoneType = {
  None: 0,
  Residential: 1,
  Commercial: 2,
  Industrial: 3,
  /** Apartments: walk-ups, apartment blocks, condo towers. */
  ResidentialHigh: 4,
  /** Offices: small offices, hotels, office towers. */
  CommercialHigh: 5,
} as const;
export type ZoneTypeId = (typeof ZoneType)[keyof typeof ZoneType];
/** A real zone (not None). */
export type ZonedType = Exclude<ZoneTypeId, typeof ZoneType.None>;

export const ZONED_TYPES: readonly ZonedType[] = [
  ZoneType.Residential,
  ZoneType.ResidentialHigh,
  ZoneType.Commercial,
  ZoneType.CommercialHigh,
  ZoneType.Industrial,
];

/** Narrow a raw `World.zone` value to a real zone. */
export function isZoned(z: number): z is ZonedType {
  return ZONED_TYPES.some((t) => t === z);
}

/** The catalog's zone letter for each zone type. */
export const ZONE_LETTER: Readonly<Record<ZonedType, Zone>> = {
  [ZoneType.Residential]: 'R',
  [ZoneType.ResidentialHigh]: 'R',
  [ZoneType.Commercial]: 'C',
  [ZoneType.CommercialHigh]: 'C',
  [ZoneType.Industrial]: 'I',
};

export const ZONE_DENSITY: Readonly<Record<ZonedType, Density>> = {
  [ZoneType.Residential]: 'low',
  [ZoneType.ResidentialHigh]: 'high',
  [ZoneType.Commercial]: 'low',
  [ZoneType.CommercialHigh]: 'high',
  [ZoneType.Industrial]: 'low',
};

/** The zone a building of this letter and density grows on. */
export function zoneOf(letter: Zone, density: Density): ZonedType {
  if (letter === 'I') return ZoneType.Industrial;
  if (letter === 'R') return density === 'high' ? ZoneType.ResidentialHigh : ZoneType.Residential;
  return density === 'high' ? ZoneType.CommercialHigh : ZoneType.Commercial;
}
