import type { EnergyArtId } from '../../energy';
import type { BuildingId } from '../../../../sim/buildings/catalog';
import type { Box } from '../../core';

/**
 * Building recipes (docs/specs/city-art.md). Each building has a list of variants; a variant
 * changes form (massing, height, roof, facade, rooftop, lot) as well as colour. Recipes are in
 * *local* space: footprint w × h with the front at +v. buildings/index.ts paints them.
 */

export type Roof = 'flat' | 'gable' | 'hip' | 'sawtooth';
export type Facade =
  | 'punched'
  | 'brick'
  | 'siding'
  | 'bands'
  | 'ribbon'
  | 'grid'
  | 'curtain'
  | 'shopfront'
  | 'lobby'
  | 'industrial'
  | 'townhouse';
export type Ground = 'garden' | 'paved' | 'parking' | 'plaza' | 'field';
export type Extra =
  // ground level
  | 'porch'
  | 'fence'
  | 'awning'
  | 'tables'
  | 'planters'
  | 'canopy'
  | 'parking'
  | 'garagedoor'
  | 'garage'
  | 'loadingdock'
  | 'crates'
  | 'patrolcars'
  | 'firedoors'
  | 'silo'
  | 'tanks'
  | 'smokestack'
  | 'smokestacks'
  // on the walls
  | 'balconies'
  | 'fireescape'
  | 'terraces'
  | 'redcross'
  // on the roof
  | 'chimney'
  | 'watertank'
  | 'acunits'
  | 'crown'
  | 'spire'
  | 'antenna'
  | 'helipad'
  | 'solar'
  | 'roofgarden'
  | 'pool'
  | 'hosetower';

/** One box of a building; masses stack, each sitting on the one below. */
export interface Mass {
  floors: number;
  /** Inset from the lot edges (tile units); ignored when `box` is set. */
  inset?: number;
  /** Explicit box in local footprint space. */
  box?: Box;
  facade?: Facade;
  wall?: string;
}

export interface BuildingArt {
  floorH: number;
  masses: readonly Mass[];
  wall: string;
  /** Accent for cornices and lintels. */
  trim?: string;
  glass?: string;
  roof: Roof;
  roofColor: string;
  /** Extra roof height for pitched roofs (px). */
  roofH?: number;
  /** Pitched roofs: which local axis the ridge runs along (default u, parallel to the front). */
  ridge?: 'u' | 'v';
  facade: Facade;
  /** Curtain walls: vertical fins. */
  fins?: boolean;
  ground: Ground;
  extras: readonly Extra[];
  /** Round trees planted on the lot. */
  trees?: number;
  /** Text on a sign (shopfront, or rooftop for other facades). */
  sign?: string;
  signColor?: string;
  awning?: string;
  /** Townhouses: each unit's colour. */
  units?: readonly string[];
}

/** Variants share a base recipe and override parts of it. */
export function variants(base: BuildingArt, ...overrides: readonly Partial<BuildingArt>[]): readonly BuildingArt[] {
  return overrides.map((o) => ({ ...base, ...o }));
}

export const one = (floors: number, inset: number, facade?: Facade, wall?: string): Mass => ({ floors, inset, facade, wall });

/** Buildings with their own painter in civicArt.ts. */
export type CustomArtId =
  | 'park'
  | 'central_park'
  | 'botanical_garden'
  | 'shopping_complex'
  | 'riverside_market'
  | 'town_hall'
  | 'power_plant'
  | 'water_tower'
  | 'landfill'
  | EnergyArtId;
export type RecipeId = Exclude<BuildingId, CustomArtId>;
