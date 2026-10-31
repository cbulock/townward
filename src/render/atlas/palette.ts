import { Terrain, type TerrainId } from '../../sim/terrain/types';
import { ZoneType, type ZonedType } from '../../sim/zones';

/**
 * Bright, saturated pixel-art palette (see docs/04-ui-ux.md, "World art").
 * Base colours are also used for the map underlay, so any seam blends into the right colour.
 */
export const GROUND_BASE: Readonly<Record<TerrainId, string>> = {
  [Terrain.DeepWater]: '#2b66c4',
  [Terrain.ShallowWater]: '#3a8ee0',
  [Terrain.Sand]: '#ebc77f',
  [Terrain.Grass]: '#62bf3c',
  [Terrain.DryGrass]: '#a9b552',
  [Terrain.Dirt]: '#a67c4e',
  [Terrain.Rock]: '#9298a0',
};

export const INK = {
  /** Dark outline used on trees and rocks. */
  outline: '#173d1f',
  grassDark: '#4aa22d',
  grassLight: '#86d65a',
  grassRim: 'rgba(44, 122, 36, 0.9)',
  sandDark: '#cfa35c',
  sandLight: '#f6dca0',
  foam: 'rgb(196, 238, 255)',
  sparkle: 'rgb(200, 236, 255)',
} as const;

/** Zone tints (match --zone-r/c/i in styles/tokens.css). */
export const ZONE_TINT: Readonly<Record<ZonedType, number>> = {
  [ZoneType.Residential]: 0x4ade80,
  [ZoneType.Commercial]: 0x60a5fa,
  [ZoneType.Industrial]: 0xfacc15,
  [ZoneType.ResidentialHigh]: 0x15a34a,
  [ZoneType.CommercialHigh]: 0x2563eb,
};

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function numberToRgb(n: number): [number, number, number] {
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hexToNumber(hex: string): number {
  return parseInt(hex.slice(1), 16);
}
