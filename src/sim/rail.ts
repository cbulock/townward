import { BUILDINGS, type BuildingInstance } from './buildings/catalog';
import type { City } from './City';
import { hasTech } from './research';
import { isWorking } from './systems/utilities';
import type { World } from './World';

/**
 * Rail (docs/specs/evolution.md, E7b): track on its own tile layer (`World.rail`), stations
 * beside it, and travel times between stations for the commute model's train option.
 */

export const Rail = { None: 0, Track: 1, Bridge: 2 } as const;
export type RailId = (typeof Rail)[keyof typeof Rail];

/** Neighbour offsets in mask-bit order, as roads (bit 0 NE, 1 SE, 2 SW, 3 NW). */
const STEPS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export function isRail(world: World, i: number): boolean {
  return world.rail[i] !== Rail.None;
}

/** Which neighbours carry track that joins this tile (track joins track in every direction). */
export function railMask(world: World, x: number, y: number): number {
  let mask = 0;
  for (let d = 0; d < 4; d++) {
    const nx = x + STEPS[d][0];
    const ny = y + STEPS[d][1];
    if (world.inBounds(nx, ny) && isRail(world, world.index(nx, ny))) mask |= 1 << d;
  }
  return mask;
}

/** May this city lay track and build stations? (Rapid transit research, in cities that lock by stage.) */
export function railUnlocked(city: Pick<City, 'locked' | 'research'>): boolean {
  return !city.locked || hasTech(city, 'rapidTransit');
}

/** Rail tuning (spec E7b). */
export const RAIL = {
  /** A home or job is served by a station within this many tiles of its entrance. */
  walkTiles: 8,
  walkMinutes: 1.5,
  waitMinutes: 3,
  minutesPerTile: 0.3,
} as const;

/** The track tile beside a station (its platform): the first rail tile in the ring around the footprint. */
export function platformOf(world: World, b: BuildingInstance): number {
  const { w, h } = BUILDINGS[b.def].size;
  for (let y = b.y - 1; y <= b.y + h; y++) {
    for (let x = b.x - 1; x <= b.x + w; x++) {
      const inside = x >= b.x && x < b.x + w && y >= b.y && y < b.y + h;
      if (inside || !world.inBounds(x, y)) continue;
      if (isRail(world, world.index(x, y))) return world.index(x, y);
    }
  }
  return -1;
}

/** One working station with its platform. */
export interface Station {
  readonly id: number;
  readonly platform: number;
  readonly x: number;
  readonly y: number;
}

/** Today's rail network: working stations and track minutes between every pair (Infinity when not joined). */
export interface RailNetwork {
  readonly stations: readonly Station[];
  /** minutes[a * stations.length + b]: riding from station a to b (no waiting). */
  readonly minutes: Float64Array;
}

export function railNetwork(world: World): RailNetwork {
  const stations: Station[] = [];
  for (const b of world.buildings.values()) {
    if (b.def !== 'train_station' || !isWorking(b)) continue;
    const platform = platformOf(world, b);
    if (platform === -1) continue;
    const { w, h } = BUILDINGS[b.def].size;
    stations.push({ id: b.id, platform, x: b.x + w / 2, y: b.y + h / 2 });
  }
  const n = stations.length;
  const minutes = new Float64Array(n * n).fill(Infinity);
  if (n === 0) return { stations, minutes };
  const dist = new Int32Array(world.width * world.height);
  const queue = new Int32Array(world.width * world.height);
  for (let a = 0; a < n; a++) {
    // Breadth-first over the track from this station's platform.
    dist.fill(-1);
    let head = 0;
    let tail = 0;
    queue[tail++] = stations[a].platform;
    dist[stations[a].platform] = 0;
    while (head < tail) {
      const i = queue[head++];
      const x = i % world.width;
      const y = (i - x) / world.width;
      for (const [dx, dy] of STEPS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!world.inBounds(nx, ny)) continue;
        const j = world.index(nx, ny);
        if (dist[j] !== -1 || !isRail(world, j)) continue;
        dist[j] = dist[i] + 1;
        queue[tail++] = j;
      }
    }
    for (let b = 0; b < n; b++) {
      const d = dist[stations[b].platform];
      if (d >= 0) minutes[a * n + b] = d * RAIL.minutesPerTile;
    }
  }
  return { stations, minutes };
}

/** The station serving a tile: the nearest within walking reach, and the walk in minutes. */
export function servingStation(net: RailNetwork, world: World, tile: number): { station: number; walk: number } | null {
  const x = tile % world.width;
  const y = (tile - x) / world.width;
  let best = -1;
  let bestD = Infinity;
  for (let k = 0; k < net.stations.length; k++) {
    const s = net.stations[k];
    const d = Math.hypot(s.x - (x + 0.5), s.y - (y + 0.5));
    if (d <= RAIL.walkTiles && d < bestD) {
      best = k;
      bestD = d;
    }
  }
  return best === -1 ? null : { station: best, walk: bestD * RAIL.walkMinutes };
}

/** Track tiles from one platform to another (breadth-first, so the shortest run), or null if not joined. */
export function railPath(world: World, from: number, to: number): Int32Array | null {
  const prev = new Int32Array(world.width * world.height).fill(-1);
  const queue = new Int32Array(world.width * world.height);
  let head = 0;
  let tail = 0;
  queue[tail++] = from;
  prev[from] = from;
  while (head < tail) {
    const i = queue[head++];
    if (i === to) break;
    const x = i % world.width;
    const y = (i - x) / world.width;
    for (const [dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!world.inBounds(nx, ny)) continue;
      const j = world.index(nx, ny);
      if (prev[j] !== -1 || !isRail(world, j)) continue;
      prev[j] = i;
      queue[tail++] = j;
    }
  }
  if (prev[to] === -1) return null;
  const out: number[] = [];
  for (let v = to; v !== from; v = prev[v]) out.push(v);
  out.push(from);
  return Int32Array.from(out.reverse());
}
