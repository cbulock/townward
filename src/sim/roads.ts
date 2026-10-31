import type { World } from './World';

/** Values stored in `World.road`. */
export const RoadType = {
  None: 0,
  Road: 1,
  Highway: 2,
} as const;
export type RoadTypeId = (typeof RoadType)[keyof typeof RoadType];
export type BuildableRoad = Exclude<RoadTypeId, typeof RoadType.None>;

export interface TilePos {
  x: number;
  y: number;
}

/**
 * Connection mask for auto-tiling: which of the 4 neighbours carry any road.
 *   bit 0 NE (x, y−1)   bit 1 SE (x+1, y)   bit 2 SW (x, y+1)   bit 3 NW (x−1, y)
 * Roads and highways connect to each other.
 */
export function roadMask(world: World, x: number, y: number): number {
  const has = (nx: number, ny: number) => world.inBounds(nx, ny) && world.road[world.index(nx, ny)] !== RoadType.None;
  return (has(x, y - 1) ? 1 : 0) | (has(x + 1, y) ? 2 : 0) | (has(x, y + 1) ? 4 : 0) | (has(x - 1, y) ? 8 : 0);
}

/**
 * Tiles from `a` to `b` inclusive. The path runs along the dominant axis first, then the other
 * (an L), or only along the dominant axis when `straight` is set.
 */
export function roadPath(a: TilePos, b: TilePos, straight: boolean): TilePos[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const xFirst = Math.abs(dx) >= Math.abs(dy);
  const corner = xFirst ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
  const path: TilePos[] = [];
  const walk = (from: TilePos, to: TilePos) => {
    const sx = Math.sign(to.x - from.x);
    const sy = Math.sign(to.y - from.y);
    let { x, y } = from;
    while (x !== to.x || y !== to.y) {
      x += sx;
      y += sy;
      path.push({ x, y });
    }
  };
  path.push({ ...a });
  walk(a, corner);
  if (!straight) walk(corner, b);
  return path;
}

/** Every tile in the axis-aligned rectangle spanned by `a` and `b` (inclusive), row by row. */
export function rectTiles(a: TilePos, b: TilePos): TilePos[] {
  const tiles: TilePos[] = [];
  for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) {
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) tiles.push({ x, y });
  }
  return tiles;
}
