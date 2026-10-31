import { Terrain, type TerrainId } from '../sim/terrain/types';
import type { World } from '../sim/World';

/**
 * Dual-grid terrain rendering (docs/decisions.md D-019).
 *
 * The ground is drawn on a grid offset by half a tile: dual cell (i, j) is a
 * diamond centred on the shared vertex of tiles (i−1, j−1), (i, j−1), (i, j), (i−1, j),
 * and its four corners sit on those tiles' centres. Each cell is drawn as:
 *   - a base of the lowest-priority terrain among its 4 corner tiles, then
 *   - for each higher terrain present, an overlay masked by a marching-squares
 *     contour over the corners that are at least that terrain.
 * This gives rounded corners and smooth diagonals instead of staircase tile edges.
 *
 * Corner bits (dual-cell local (s, t) ∈ [0,1]², s → +x, t → +y):
 *   bit 0 top    (0,0) → tile (i−1, j−1)
 *   bit 1 right  (1,0) → tile (i,   j−1)
 *   bit 2 bottom (1,1) → tile (i,   j)
 *   bit 3 left   (0,1) → tile (i−1, j)
 */

/** Higher priority draws over lower. */
const PRIORITY: Readonly<Record<TerrainId, number>> = {
  [Terrain.DeepWater]: 0,
  [Terrain.ShallowWater]: 1,
  [Terrain.Sand]: 2,
  [Terrain.Dirt]: 3,
  [Terrain.Rock]: 4,
  [Terrain.DryGrass]: 5,
  [Terrain.Grass]: 6,
};

/** Terrains that can be drawn as an overlay, in drawing (ascending priority) order. */
export const OVERLAY_TERRAINS: readonly TerrainId[] = [
  Terrain.ShallowWater,
  Terrain.Sand,
  Terrain.Dirt,
  Terrain.Rock,
  Terrain.DryGrass,
  Terrain.Grass,
];

/** Corner offsets from dual cell (i, j) to its tiles, in bit order. */
export const DUAL_CORNERS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [0, -1],
  [0, 0],
  [-1, 0],
];

export function isWaterTerrain(t: number): boolean {
  return t === Terrain.DeepWater || t === Terrain.ShallowWater;
}

export interface DualOverlay {
  terrain: TerrainId;
  /** 4-bit corner mask (1..14; never 0 or 15). */
  mask: number;
}

export interface DualCell {
  base: TerrainId;
  overlays: DualOverlay[];
  /** For water-based cells: corners that are land (drives shoreline foam). 0 = no shore. */
  shore: number;
}

/** Terrain of the tile at a dual corner, clamped to the map so border cells extend the edge tiles. */
function sample(world: World, x: number, y: number): TerrainId {
  const cx = Math.min(world.width - 1, Math.max(0, x));
  const cy = Math.min(world.height - 1, Math.max(0, y));
  return world.terrain[world.index(cx, cy)] as TerrainId;
}

/** What to draw for dual cell (i, j), with i, j ∈ [0, width] × [0, height]. */
export function computeDualCell(world: World, i: number, j: number): DualCell {
  const corners = DUAL_CORNERS.map(([dx, dy]) => sample(world, i + dx, j + dy));
  let base = corners[0];
  for (const c of corners) if (PRIORITY[c] < PRIORITY[base]) base = c;

  const overlays: DualOverlay[] = [];
  for (const t of OVERLAY_TERRAINS) {
    if (PRIORITY[t] <= PRIORITY[base] || !corners.includes(t)) continue;
    let mask = 0;
    corners.forEach((c, bit) => {
      if (PRIORITY[c] >= PRIORITY[t]) mask |= 1 << bit;
    });
    overlays.push({ terrain: t, mask });
  }

  let shore = 0;
  if (isWaterTerrain(base)) {
    corners.forEach((c, bit) => {
      if (!isWaterTerrain(c)) shore |= 1 << bit;
    });
  }
  return { base, overlays, shore };
}
