import { HALF_H, HALF_W } from '../shared/constants';

/**
 * Isometric projection helpers. "World pixels" are the unscaled iso plane
 * (zoom 1, before camera transform).
 *
 * Tile (x, y) is a diamond whose TOP vertex is at tileToWorld(x, y);
 * its centre is HALF_H pixels below that.
 */
export function tileToWorld(x: number, y: number): { x: number; y: number } {
  return { x: (x - y) * HALF_W, y: (x + y) * HALF_H };
}

/**
 * Inverse projection: continuous tile coordinates for a world-pixel point.
 * Because the diamonds tile the plane linearly, flooring the result is an
 * exact (pixel-accurate) pick for flat terrain.
 */
export function worldToTileFloat(wx: number, wy: number): { x: number; y: number } {
  const a = wy / HALF_H;
  const b = wx / HALF_W;
  return { x: (a + b) / 2, y: (a - b) / 2 };
}

export function worldToTile(wx: number, wy: number): { x: number; y: number } {
  const t = worldToTileFloat(wx, wy);
  return { x: Math.floor(t.x), y: Math.floor(t.y) };
}

/** Axis-aligned world-pixel bounds of a width × height map. */
export function mapWorldBounds(width: number, height: number) {
  return {
    minX: -height * HALF_W,
    maxX: width * HALF_W,
    minY: 0,
    maxY: (width + height) * HALF_H,
  };
}
