import { Terrain, type TerrainId } from '../../../sim/terrain/types';
import { ZoneType, type ZonedType } from '../../../sim/zones';
import { GROUND } from './tokens';

/**
 * Flat ground colours by terrain (theme tokens, see docs/04-ui-ux.md "World art").
 * Also used for the map underlay and minimap, so any seam blends into the right colour.
 */
export const GROUND_BASE: Readonly<Record<TerrainId, string>> = {
  [Terrain.DeepWater]: GROUND.deep.base,
  [Terrain.ShallowWater]: GROUND.shallow.base,
  [Terrain.Sand]: GROUND.sand.base,
  [Terrain.Grass]: GROUND.grass.base,
  [Terrain.DryGrass]: GROUND.dryGrass.base,
  [Terrain.Dirt]: GROUND.dirt.base,
  [Terrain.Rock]: GROUND.rock.base,
};

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
