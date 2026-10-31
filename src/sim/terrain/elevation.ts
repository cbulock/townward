import { MAX_LEVEL } from '../../shared/constants';
import { Terrain } from './types';
import type { World } from '../World';

/**
 * Elevation helpers (docs/specs/elevation.md). `World.elevation[i]` is the level of tile
 * i's centre; 4-neighbours differ by at most 1, and water sits at level 0.
 */

export function isWaterTile(world: World, i: number): boolean {
  const t = world.terrain[i];
  return t === Terrain.DeepWater || t === Terrain.ShallowWater;
}

/**
 * Enforce the smoothness rule by lowering: repeat until no tile is more than 1 above a
 * neighbour. Water is pinned to 0, so shores end up at 0 or 1. Lowering-only keeps the
 * result under the input everywhere and always terminates.
 */
export function smoothElevation(world: World) {
  const { width: w, height: h, elevation: e } = world;
  const n = w * h;
  for (let i = 0; i < n; i++) {
    if (isWaterTile(world, i)) e[i] = 0;
    else if (e[i] > MAX_LEVEL) e[i] = MAX_LEVEL;
  }
  // Two sweeps (forward and back) per pass propagate a cap across the map quickly.
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      for (let k = 0; k < n; k++) {
        const i = pass === 0 ? k : n - 1 - k;
        const x = i % w;
        const y = (i - x) / w;
        let cap = e[i];
        if (x > 0) cap = Math.min(cap, e[i - 1] + 1);
        if (x < w - 1) cap = Math.min(cap, e[i + 1] + 1);
        if (y > 0) cap = Math.min(cap, e[i - w] + 1);
        if (y < h - 1) cap = Math.min(cap, e[i + w] + 1);
        if (cap < e[i]) {
          e[i] = cap;
          changed = true;
        }
      }
    }
  }
}

/** Level of a tile, clamped to the map (off-map reads the nearest edge tile). */
export function levelAt(world: World, x: number, y: number): number {
  const cx = Math.min(world.width - 1, Math.max(0, x));
  const cy = Math.min(world.height - 1, Math.max(0, y));
  return world.elevation[cy * world.width + cx];
}

/**
 * Ground height (in levels) at a continuous tile-space point. Tile centres sit at
 * (x + 0.5, y + 0.5); between them the surface is bilinear, matching the sloped ground quads.
 */
export function surfaceHeight(world: World, fx: number, fy: number): number {
  const gx = fx - 0.5;
  const gy = fy - 0.5;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = gx - x0;
  const ty = gy - y0;
  const a = levelAt(world, x0, y0);
  const b = levelAt(world, x0 + 1, y0);
  const c = levelAt(world, x0, y0 + 1);
  const d = levelAt(world, x0 + 1, y0 + 1);
  return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
}

/** Height of a tile *corner* (vertex between 4 tiles): the average of those tiles. */
export function cornerHeight(world: World, vx: number, vy: number): number {
  return (levelAt(world, vx - 1, vy - 1) + levelAt(world, vx, vy - 1) + levelAt(world, vx - 1, vy) + levelAt(world, vx, vy)) / 4;
}

/** Every tile of the footprint is at the same level (buildings need this). */
export function isFlat(world: World, x: number, y: number, w: number, h: number): boolean {
  const level = levelAt(world, x, y);
  for (let ty = y; ty < y + h; ty++) {
    for (let tx = x; tx < x + w; tx++) {
      if (!world.inBounds(tx, ty) || world.elevation[world.index(tx, ty)] !== level) return false;
    }
  }
  return true;
}
