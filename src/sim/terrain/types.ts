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

/** Number of random visual variants per ground tile type. */
export const GROUND_VARIANTS = 4;
