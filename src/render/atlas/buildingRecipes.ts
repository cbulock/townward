import type { EnergyArtId } from './energy';
import type { BuildingId } from '../../sim/buildings/catalog';
import type { Box } from './isoPaint';

/**
 * Building recipes (docs/specs/city-art.md). Each building has a list of variants; a variant
 * changes form (massing, height, roof, facade, rooftop, lot) as well as colour. Recipes are in
 * *local* space: footprint w × h with the front at +v. buildingArt.ts paints them.
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
function variants(base: BuildingArt, ...overrides: readonly Partial<BuildingArt>[]): readonly BuildingArt[] {
  return overrides.map((o) => ({ ...base, ...o }));
}

const one = (floors: number, inset: number, facade?: Facade, wall?: string): Mass => ({ floors, inset, facade, wall });

/** Buildings with their own painter in civicArt.ts. */
export type CustomArtId = 'park' | 'town_hall' | 'power_plant' | 'water_tower' | EnergyArtId;
export type RecipeId = Exclude<BuildingId, CustomArtId>;

export const ART: Readonly<Record<RecipeId, readonly BuildingArt[]>> = {
  // ------------------------------------------------------------ residential
  cottage: variants(
    {
      floorH: 11,
      masses: [one(1, 0.2)],
      wall: '#f3e7cf',
      roof: 'gable',
      roofColor: '#b8513d',
      roofH: 9,
      facade: 'punched',
      ground: 'garden',
      extras: ['chimney', 'fence'],
      trees: 1,
    },
    {},
    { wall: '#dfe9f0', roofColor: '#5e6f86', ridge: 'v', facade: 'siding', extras: ['chimney'], trees: 2 },
    { wall: '#f5efe4', roofColor: '#8a5a3b', roof: 'hip', roofH: 8, extras: ['fence'] },
    { wall: '#f2d7c9', roofColor: '#4f6b4a', facade: 'siding', trees: 2 },
    { wall: '#e9e4d8', roofColor: '#a2493a', masses: [{ floors: 1, box: { u0: 0.12, u1: 0.66, v0: 0.2, v1: 0.8 } }], extras: ['garage', 'chimney'] },
    { wall: '#fbe6b8', roofColor: '#3e5874', ridge: 'v', roofH: 11, extras: ['porch'], trees: 2 },
  ),
  family_house: variants(
    {
      floorH: 9,
      masses: [one(2, 0.16)],
      wall: '#dfe7ee',
      roof: 'hip',
      roofColor: '#4f5d70',
      roofH: 8,
      facade: 'punched',
      ground: 'garden',
      extras: ['porch', 'chimney'],
      trees: 1,
    },
    {},
    { wall: '#f0dcc4', roofColor: '#a2493a', roof: 'gable', roofH: 10, facade: 'siding', extras: ['chimney'], trees: 2 },
    { wall: '#d8e4cf', roofColor: '#6a4b3a', masses: [{ floors: 2, box: { u0: 0.1, u1: 0.64, v0: 0.16, v1: 0.82 } }], extras: ['garage', 'porch'] },
    { wall: '#c96f5a', facade: 'brick', roof: 'gable', ridge: 'v', roofColor: '#4a4f57', extras: ['chimney'], trees: 2 },
    {
      wall: '#f4f1ea',
      roof: 'flat',
      roofColor: '#8a8d92',
      facade: 'bands',
      masses: [one(1, 0.14), { floors: 1, box: { u0: 0.14, u1: 0.62, v0: 0.14, v1: 0.86 } }],
      extras: ['solar'],
      trees: 2,
    },
    { wall: '#e7d3a8', roofColor: '#5c6b4a', facade: 'siding', extras: ['porch', 'fence'] },
  ),
  townhouses: variants(
    {
      floorH: 8,
      masses: [one(3, 0.1)],
      wall: '#c96f5a',
      units: ['#c96f5a', '#d8b48a', '#8fa9b8'],
      roof: 'flat',
      roofColor: '#6b6e74',
      facade: 'townhouse',
      ground: 'paved',
      extras: ['acunits'],
    },
    {},
    { wall: '#e2c6a0', units: ['#e2c6a0', '#9fb7a3', '#d99a7a'] },
    { wall: '#7c8fa8', units: ['#7c8fa8', '#e8e1d0', '#b5554a'], roof: 'gable', roofH: 7, roofColor: '#4f5560', extras: [] },
    { wall: '#f1e4c8', units: ['#f1e4c8', '#c9d6df', '#e8c4c4'], masses: [one(2, 0.1)], extras: ['planters'] },
    { wall: '#a4553f', units: ['#a4553f', '#8b4a3a', '#b8664d'], extras: ['acunits', 'solar'] },
    { wall: '#d2e0d6', units: ['#d2e0d6', '#f3d9a8', '#c7c1e0'], roof: 'gable', roofH: 8, roofColor: '#6a3e30', extras: ['chimney'] },
  ),
  walkup: variants(
    {
      floorH: 8,
      masses: [one(4, 0.1)],
      wall: '#b35a45',
      trim: '#e8dcc8',
      roof: 'flat',
      roofColor: '#5f6268',
      facade: 'brick',
      ground: 'paved',
      extras: ['balconies', 'acunits'],
    },
    {},
    { wall: '#9c5040', extras: ['fireescape', 'watertank'] },
    { wall: '#c0785a', masses: [one(5, 0.1)], extras: ['balconies'] },
    { wall: '#e3d7c0', trim: '#8a6e5a', facade: 'punched', extras: ['balconies', 'acunits'] },
    {
      wall: '#7d8a96',
      facade: 'punched',
      masses: [one(1, 0.1, 'shopfront', '#5a636c'), one(3, 0.1)],
      sign: 'GROCER',
      signColor: '#2e6b3e',
      extras: ['awning', 'acunits'],
      awning: '#2e8a5a',
    },
    { wall: '#a8653f', extras: ['fireescape', 'roofgarden'] },
  ),
  apartment_block: variants(
    {
      floorH: 8,
      masses: [one(8, 0.18)],
      wall: '#e9e2d4',
      roof: 'flat',
      roofColor: '#6a6d73',
      facade: 'punched',
      ground: 'paved',
      extras: ['balconies', 'watertank', 'acunits'],
      trees: 2,
    },
    {},
    { wall: '#d9dfe6', facade: 'grid', masses: [one(9, 0.18)], extras: ['roofgarden', 'acunits'], ground: 'plaza' },
    { wall: '#efe0c8', masses: [one(1, 0.12, 'shopfront', '#6d5a4a'), one(7, 0.18)], extras: ['balconies', 'watertank'] },
    { wall: '#c98f6a', facade: 'brick', trim: '#efe3cf', masses: [one(7, 0.16)], extras: ['acunits', 'watertank'] },
    { wall: '#b8c9b0', masses: [one(6, 0.16), one(3, 0.36)], extras: ['balconies', 'roofgarden'], ground: 'garden', trees: 3 },
    { wall: '#f2efe8', facade: 'ribbon', masses: [one(10, 0.22)], extras: ['solar', 'acunits'], ground: 'plaza' },
  ),
  condo_tower: variants(
    {
      floorH: 7,
      masses: [one(15, 0.32)],
      wall: '#7fa8c9',
      roof: 'flat',
      roofColor: '#4a5560',
      facade: 'curtain',
      ground: 'plaza',
      extras: ['terraces', 'crown'],
      trees: 2,
    },
    {},
    { wall: '#8bb3b0', fins: true, masses: [one(2, 0.2, 'lobby'), one(16, 0.32)], extras: ['pool', 'terraces'] },
    { wall: '#9aa7c4', masses: [one(12, 0.28), one(5, 0.4)], extras: ['terraces', 'antenna'] },
    { wall: '#c7b9a6', facade: 'grid', masses: [one(18, 0.34)], roof: 'hip', roofH: 16, roofColor: '#3f4a55', extras: [] },
    { wall: '#5f7f8f', masses: [one(14, 0.3), one(3, 0.38), one(2, 0.46)], extras: ['spire'] },
    { wall: '#e8e4dc', facade: 'ribbon', masses: [one(2, 0.2, 'lobby', '#4a5560'), one(13, 0.3)], extras: ['balconies', 'roofgarden'] },
  ),

  // ------------------------------------------------------------ commercial
  corner_shop: variants(
    {
      floorH: 9,
      masses: [one(2, 0.12)],
      wall: '#e7d9bd',
      roof: 'flat',
      roofColor: '#6b6e74',
      facade: 'shopfront',
      ground: 'paved',
      extras: ['awning'],
      sign: 'SHOP',
      signColor: '#2f7d4a',
      awning: '#d94a3d',
    },
    {},
    { wall: '#f3e3cf', sign: 'BAKERY', signColor: '#8a4b2b', awning: '#f0a830', extras: ['awning', 'tables'] },
    { wall: '#b35a45', sign: 'BOOKS', signColor: '#2f5d9a', awning: '#2d6fc4' },
    { wall: '#efe7d8', masses: [one(1, 0.14)], sign: 'DELI', signColor: '#2e6b3e', awning: '#2e8a5a' },
    { wall: '#f4eef6', sign: 'FLORIST', signColor: '#9b2f5f', awning: '#d9578a', extras: ['awning', 'planters'] },
    { wall: '#e9edf0', masses: [one(3, 0.12)], sign: 'PHARMACY', signColor: '#1f8a5a', awning: '#3aa66a', extras: ['awning', 'acunits'] },
  ),
  cafe: variants(
    {
      floorH: 12,
      masses: [one(1, 0.22)],
      wall: '#f2e6d0',
      roof: 'flat',
      roofColor: '#7a5a43',
      facade: 'shopfront',
      ground: 'paved',
      extras: ['awning', 'tables'],
      sign: 'CAFE',
      signColor: '#7a4a2b',
      awning: '#d94a3d',
    },
    {},
    { wall: '#e4efe9', sign: 'DINER', signColor: '#c23b3b', awning: '#2f8fbf' },
    { wall: '#f3dfe0', sign: 'PIZZA', signColor: '#2f7d3a', awning: '#2e8a5a', extras: ['awning', 'tables', 'planters'] },
    { wall: '#efe2c4', sign: 'NOODLES', signColor: '#b8352f', awning: '#c23b3b', roof: 'gable', roofH: 7, roofColor: '#3a3a40' },
    { wall: '#4a505a', sign: 'BAR', signColor: '#6a4fa0', awning: '#6a4fa0', masses: [one(1, 0.18)] },
    { wall: '#fdf3e7', sign: 'GELATO', signColor: '#d9578a', awning: '#f2a3c0', extras: ['awning', 'tables'] },
  ),
  small_office: variants(
    {
      floorH: 8,
      masses: [one(5, 0.14)],
      wall: '#c9ced6',
      roof: 'flat',
      roofColor: '#5d6168',
      facade: 'bands',
      ground: 'paved',
      extras: ['acunits'],
    },
    {},
    { wall: '#d8d2c6', facade: 'grid', masses: [one(6, 0.14)] },
    { wall: '#bfc9cf', facade: 'ribbon', masses: [one(4, 0.12)], extras: ['acunits', 'antenna'] },
    { wall: '#a85a43', facade: 'brick', trim: '#efe3cf', extras: ['watertank'] },
    { wall: '#6f97b5', facade: 'curtain', fins: true, masses: [one(6, 0.16)], roofColor: '#3e4a56' },
    { wall: '#e2ddd2', facade: 'punched', masses: [one(1, 0.12, 'lobby'), one(5, 0.16)], extras: ['solar'] },
  ),
  supermarket: variants(
    {
      floorH: 16,
      masses: [{ floors: 1, box: { u0: 0.12, u1: 1.88, v0: 0.12, v1: 1.15 } }],
      wall: '#e8e3d8',
      roof: 'flat',
      roofColor: '#8a8d92',
      facade: 'shopfront',
      ground: 'parking',
      extras: ['parking', 'acunits'],
      sign: 'MARKET',
      signColor: '#d2462f',
    },
    {},
    { wall: '#dfe6ea', sign: 'GROCER', signColor: '#2b7a3d', extras: ['parking', 'solar'] },
    { wall: '#ece2d3', sign: 'FRESH', signColor: '#2c62b0' },
    { wall: '#f0ebe0', sign: 'FOODS', signColor: '#e08a1e', extras: ['parking', 'acunits', 'planters'] },
    { wall: '#c9d4dc', sign: 'MEGA', signColor: '#7a3fb0', extras: ['parking', 'solar'] },
    { wall: '#f2e6d6', sign: 'SAVE+', signColor: '#c2272d' },
  ),
  hotel: variants(
    {
      floorH: 7,
      masses: [one(11, 0.22)],
      wall: '#e9dcc6',
      roof: 'flat',
      roofColor: '#5c5f66',
      facade: 'punched',
      ground: 'plaza',
      extras: ['canopy', 'balconies'],
      sign: 'HOTEL',
      signColor: '#d23b3b',
      trees: 2,
    },
    {},
    { wall: '#d7d2e3', sign: 'INN', signColor: '#2d63c8', masses: [one(2, 0.14, 'lobby', '#5a5f6a'), one(10, 0.24)], extras: ['acunits'] },
    { wall: '#e6d0c0', trim: '#c9a447', sign: 'GRAND', signColor: '#c8902d', masses: [one(9, 0.2), one(4, 0.3)], extras: ['canopy'] },
    { wall: '#7fa3b8', facade: 'curtain', sign: 'SUITES', signColor: '#1f3f6a', masses: [one(14, 0.26)], extras: ['canopy', 'antenna'] },
    { wall: '#f0e6d6', facade: 'grid', sign: 'PLAZA', signColor: '#2f7d4a', masses: [one(12, 0.22)], extras: ['canopy', 'pool'] },
    { wall: '#f3efe6', sign: 'RESORT', signColor: '#1f8aa0', masses: [one(2, 0.14, 'lobby'), one(8, 0.22)], extras: ['balconies', 'pool'] },
  ),
  office_tower: variants(
    {
      floorH: 7,
      masses: [one(18, 0.28)],
      wall: '#5f8fb8',
      roof: 'flat',
      roofColor: '#3e4a56',
      facade: 'curtain',
      ground: 'plaza',
      extras: ['crown'],
      trees: 2,
    },
    {},
    { wall: '#6e9aa6', fins: true, masses: [one(3, 0.18, 'lobby'), one(18, 0.3)], extras: ['helipad'] },
    { wall: '#7d8fb0', masses: [one(12, 0.24), one(6, 0.34), one(4, 0.42)], extras: ['spire'] },
    { wall: '#b9a07a', masses: [one(20, 0.3)], roof: 'hip', roofH: 16, roofColor: '#6b5a44', extras: [] },
    { wall: '#d0d4d9', facade: 'grid', masses: [one(16, 0.26)], extras: ['antenna', 'acunits'] },
    { wall: '#3f5f78', fins: true, masses: [one(2, 0.2, 'lobby'), one(22, 0.32)], extras: ['crown'] },
  ),

  // ------------------------------------------------------------ industrial
  workshop: variants(
    {
      floorH: 13,
      masses: [one(1, 0.14)],
      wall: '#b9b3a6',
      roof: 'sawtooth',
      roofColor: '#7d8288',
      roofH: 6,
      facade: 'industrial',
      ground: 'paved',
      extras: ['garagedoor', 'crates'],
    },
    {},
    { wall: '#a9b4b9', roof: 'gable', roofH: 6, roofColor: '#6f757b' },
    { wall: '#c2b49a', roof: 'flat', roofColor: '#858179', extras: ['garagedoor', 'crates', 'acunits'] },
    { wall: '#8a9a7a', roofColor: '#5f6a55', extras: ['garagedoor', 'tanks'] },
    { wall: '#b5604a', roof: 'gable', ridge: 'v', roofH: 7, roofColor: '#5a5e64' },
    { wall: '#d0c9b8', roof: 'flat', roofColor: '#7f858b', extras: ['garagedoor', 'silo'] },
  ),
  warehouse: variants(
    {
      floorH: 10,
      masses: [one(2, 0.14)],
      wall: '#c7b48f',
      roof: 'flat',
      roofColor: '#8b8f94',
      facade: 'industrial',
      ground: 'paved',
      extras: ['loadingdock', 'crates'],
    },
    {},
    { wall: '#a8b0b8', roof: 'gable', roofH: 10, roofColor: '#6f777f' },
    { wall: '#b9a48a', roof: 'sawtooth', roofH: 7, roofColor: '#858179' },
    { wall: '#9fb0a0', extras: ['loadingdock', 'silo'] },
    { wall: '#c9c2b2', extras: ['loadingdock', 'tanks', 'solar'] },
    { wall: '#8f9aa6', roof: 'gable', ridge: 'v', roofH: 10, roofColor: '#5e646b', extras: ['loadingdock', 'crates'] },
  ),
  factory: variants(
    {
      floorH: 9,
      masses: [{ floors: 3, box: { u0: 0.12, u1: 1.88, v0: 0.12, v1: 1.6 } }],
      wall: '#a9a296',
      roof: 'sawtooth',
      roofColor: '#7a7f85',
      roofH: 8,
      facade: 'industrial',
      ground: 'paved',
      extras: ['smokestack', 'loadingdock'],
    },
    {},
    { wall: '#9fa7ad', roofColor: '#6d7379', extras: ['smokestack', 'silo', 'loadingdock'] },
    { wall: '#b0a28c', roof: 'flat', roofColor: '#82786d', extras: ['smokestacks', 'tanks', 'loadingdock'] },
    { wall: '#8e9c8a', roofColor: '#5f6a5c', extras: ['smokestacks', 'loadingdock'] },
    { wall: '#b8a07e', roof: 'gable', roofH: 12, roofColor: '#6a6f75', extras: ['smokestack', 'tanks'] },
    { wall: '#a4aab2', roof: 'flat', roofColor: '#70757b', extras: ['silo', 'loadingdock', 'acunits'] },
  ),

  // ------------------------------------------------------------ civic (generic painter)
  police_station: variants(
    {
      floorH: 10,
      // Pulled back from the street so the patrol cars have a forecourt.
      masses: [{ floors: 2, box: { u0: 0.12, u1: 0.88, v0: 0.12, v1: 0.6 } }],
      wall: '#dfe6ef',
      roof: 'flat',
      roofColor: '#3c5a8c',
      facade: 'bands',
      ground: 'paved',
      extras: ['canopy', 'acunits', 'patrolcars'],
      sign: 'POLICE',
      signColor: '#1f4fa8',
    },
    {},
    { wall: '#c4ccd6', facade: 'grid', masses: [{ floors: 3, box: { u0: 0.14, u1: 0.86, v0: 0.12, v1: 0.6 } }], extras: ['antenna', 'patrolcars'] },
    { wall: '#b8664d', facade: 'brick', trim: '#e8dcc8', extras: ['canopy', 'patrolcars'] },
  ),
  fire_station: variants(
    {
      floorH: 11,
      masses: [one(2, 0.12)],
      wall: '#b9483a',
      trim: '#efe3cf',
      roof: 'flat',
      roofColor: '#5d5f63',
      facade: 'brick',
      ground: 'paved',
      extras: ['firedoors', 'hosetower'],
      sign: 'FIRE',
      signColor: '#d23b2b',
    },
    {},
    { wall: '#ece4d6', facade: 'punched', extras: ['firedoors', 'hosetower', 'acunits'] },
    { wall: '#8f3a30', roof: 'gable', roofH: 8, roofColor: '#4a4d52', extras: ['firedoors'] },
  ),
  clinic: variants(
    {
      floorH: 10,
      masses: [one(2, 0.14)],
      wall: '#f2f4f5',
      roof: 'flat',
      roofColor: '#8b9196',
      facade: 'bands',
      ground: 'garden',
      extras: ['canopy', 'redcross'],
      sign: 'CLINIC',
      signColor: '#d4343a',
      trees: 1,
    },
    {},
    { wall: '#e3efe6', facade: 'ribbon', extras: ['canopy', 'redcross', 'solar'], trees: 2 },
    { wall: '#eef0f4', masses: [one(1, 0.1, 'lobby'), one(2, 0.16)], extras: ['redcross', 'helipad'], ground: 'plaza' },
  ),
  school: variants(
    {
      floorH: 10,
      masses: [{ floors: 2, box: { u0: 0.16, u1: 1.84, v0: 0.16, v1: 1.2 } }],
      wall: '#c8794f',
      trim: '#f0e4cf',
      roof: 'hip',
      roofColor: '#6d4a3b',
      roofH: 9,
      facade: 'brick',
      ground: 'field',
      extras: ['fence'],
      sign: 'SCHOOL',
      signColor: '#2f6d4a',
    },
    {},
    { wall: '#ead9b8', facade: 'punched', roof: 'gable', roofH: 10, roofColor: '#7a4a3a', signColor: '#2d5f8a' },
    { wall: '#e6ebef', facade: 'ribbon', roof: 'flat', roofColor: '#6a7076', extras: ['fence', 'solar'], signColor: '#c8602d' },
  ),
};
