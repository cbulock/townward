import type { Zone } from './buildings/catalog';

/** Value of `World.zone[i]`. See docs/specs/buildings.md, "Zoning". */
export const ZoneType = {
  None: 0,
  Residential: 1,
  Commercial: 2,
  Industrial: 3,
} as const;
export type ZoneTypeId = (typeof ZoneType)[keyof typeof ZoneType];
/** A real zone (not None). */
export type ZonedType = Exclude<ZoneTypeId, typeof ZoneType.None>;

export const ZONED_TYPES: readonly ZonedType[] = [ZoneType.Residential, ZoneType.Commercial, ZoneType.Industrial];

/** Narrow a raw `World.zone` value to a real zone. */
export function isZoned(z: number): z is ZonedType {
  return z === ZoneType.Residential || z === ZoneType.Commercial || z === ZoneType.Industrial;
}

/** The catalog's zone letter for each zone type. */
export const ZONE_LETTER: Readonly<Record<ZonedType, Zone>> = {
  [ZoneType.Residential]: 'R',
  [ZoneType.Commercial]: 'C',
  [ZoneType.Industrial]: 'I',
};

export function zoneOfLetter(z: Zone): ZonedType {
  return z === 'R' ? ZoneType.Residential : z === 'C' ? ZoneType.Commercial : ZoneType.Industrial;
}
