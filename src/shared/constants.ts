/** Isometric tile footprint at zoom 1 (2:1 diamond). */
export const TILE_W = 64;
export const TILE_H = 32;
export const HALF_W = TILE_W / 2;
export const HALF_H = TILE_H / 2;

/** Map is split into CHUNK_SIZE × CHUNK_SIZE tile chunks for rendering. */
export const CHUNK_SIZE = 16;

export const MAP_SIZES = [64, 128, 256] as const;
export type MapSize = (typeof MAP_SIZES)[number];
export const DEFAULT_MAP_SIZE: MapSize = 128;

/** Simulation ticks per second at 1× speed. */
export const SIM_TICK_HZ = 10;

export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 4;
