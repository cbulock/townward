/** Terrain type ids stored in `World.terrain`. See docs/specs/terrain.md. */
export const Terrain = {
  DeepWater: 0,
  ShallowWater: 1,
  Sand: 2,
  Grass: 3,
  DryGrass: 4,
  Dirt: 5,
  Rock: 6,
} as const;
export type TerrainId = (typeof Terrain)[keyof typeof Terrain];

/** Small decorations stored in `World.decor`. Purely visual; cleared when something is built on the tile. */
export const Decor = {
  None: 0,
  Rocks: 1,
  FlowersWhite: 2,
  FlowersYellow: 3,
  TallGrass: 4,
  /** Big moss-topped boulder pile. */
  Boulder: 5,
} as const;
export type DecorId = (typeof Decor)[keyof typeof Decor];
export const DECOR_KINDS = 5;

/** Number of random visual variants per ground tile type. */
export const GROUND_VARIANTS = 4;
