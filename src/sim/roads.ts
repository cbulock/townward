import type { World } from './World';

/** Values stored in `World.road`. */
export const RoadType = {
  None: 0,
  /** A street: two lanes with footpaths (named Road for save compatibility). */
  Road: 1,
  Highway: 2,
  /** Four lanes, a tree-lined median and footpaths (docs/specs/transport.md). */
  Avenue: 3,
  /** Six lanes on two tiles: each tile is one direction's three lanes (a dual carriageway). */
  Boulevard: 4,
  /** Eight lanes on two tiles, limited access: joins only expressways, highways and ramps. */
  Expressway: 5,
  /** A slip road: the only way between an expressway and local roads. */
  Ramp: 6,
  /** Paved, car-free: walkers, shops and cafés. */
  Pedestrian: 7,
} as const;
export type RoadTypeId = (typeof RoadType)[keyof typeof RoadType];
export type BuildableRoad = Exclude<RoadTypeId, typeof RoadType.None>;

/** Values stored in `World.bridge`: which way a bridge runs. Bridges only connect at their two ends. */
export const BridgeAxis = {
  None: 0,
  /** Runs along x: connects SE and NW. */
  X: 1,
  /** Runs along y: connects NE and SW. */
  Y: 2,
} as const;
export type BridgeAxisId = (typeof BridgeAxis)[keyof typeof BridgeAxis];

/** Connection bits a bridge on this axis uses. */
export function bridgeAxisMask(axis: number): number {
  return axis === BridgeAxis.X ? 0b1010 : axis === BridgeAxis.Y ? 0b0101 : 0b1111;
}

export interface TilePos {
  x: number;
  y: number;
}

/**
 * The four directions, in mask-bit order: 0 NE (x, y−1), 1 SE (x+1, y), 2 SW (x, y+1), 3 NW (x−1, y).
 * Right of heading d is (d + 1) % 4, left is (d + 3) % 4, opposite is (d + 2) % 4.
 */
export const DIRS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** Travel direction of a one-way carriageway tile (World.lane − 1), or −1 for two-way roads. */
export function laneDir(world: World, i: number): number {
  return world.lane[i] - 1;
}

const sameAxis = (a: number, b: number) => a % 2 === b % 2;

/** Limited-access roads join only each other and ramps (docs/specs/transport.md). */
function accessOk(a: number, b: number): boolean {
  const limited = (t: number) => t === RoadType.Expressway;
  const opens = (t: number) => t === RoadType.Expressway || t === RoadType.Highway || t === RoadType.Ramp;
  return (!limited(a) || opens(b)) && (!limited(b) || opens(a));
}

/**
 * The two carriageways of a wide road open into each other at a crossing (a road meets them
 * from the side, so cross traffic passes through the median) and at the road's ends (a
 * turnaround, so traffic can U-turn instead of being trapped).
 */
function opensMedian(world: World, x: number, y: number): boolean {
  const i = world.index(x, y);
  const d = laneDir(world, i);
  for (const end of [d, (d + 2) % 4]) {
    const nx = x + DIRS[end][0];
    const ny = y + DIRS[end][1];
    if (!world.inBounds(nx, ny) || world.road[world.index(nx, ny)] === RoadType.None) return true;
  }
  for (const side of [(d + 1) % 4, (d + 3) % 4]) {
    const nx = x + DIRS[side][0];
    const ny = y + DIRS[side][1];
    if (!world.inBounds(nx, ny)) continue;
    const j = world.index(nx, ny);
    // Only a road that joins this one and carries cars opens the median: a pedestrian street
    // or a street beside an expressway runs alongside, it doesn't cross (user report: a
    // pedestrian street next to an expressway put traffic lights on every tile).
    if (world.road[j] === RoadType.None || world.road[j] === RoadType.Pedestrian || !accessOk(world.road[i], world.road[j])) continue;
    const dj = laneDir(world, j);
    if (dj < 0 || !sameAxis(dj, d)) return true;
  }
  return false;
}

/** Do the roads on (x, y) and its neighbour in direction `d` join? */
function links(world: World, x: number, y: number, d: number): boolean {
  const nx = x + DIRS[d][0];
  const ny = y + DIRS[d][1];
  if (!world.inBounds(nx, ny)) return false;
  const i = world.index(x, y);
  const j = world.index(nx, ny);
  if (world.road[j] === RoadType.None) return false;
  // Along a flyover's deck, the deck's road type is the one that joins (docs/specs/transport.md, TX2).
  const axis = d % 2 === 1 ? 1 : 2;
  const deckI = world.over[i] !== 0 && world.overAxis[i] === axis;
  const deckJ = world.over[j] !== 0 && world.overAxis[j] === axis;
  if (!accessOk(deckI ? world.over[i] : world.road[i], deckJ ? world.over[j] : world.road[j])) return false;
  // Decks run both ways: the one-way rules below are for the ground carriageways.
  if (deckI || deckJ) return true;
  // Bridges only connect along their axis.
  const along = d % 2 === 0 ? BridgeAxis.Y : BridgeAxis.X;
  if (world.bridge[j] !== BridgeAxis.None && world.bridge[j] !== along) return false;
  if (world.bridge[i] !== BridgeAxis.None && world.bridge[i] !== along) return false;
  // One-way carriageways: end to end unless head-on; sideways only into the partner at a
  // crossing, into a crossing road, or into a carriageway that crosses at right angles.
  const di = laneDir(world, i);
  const dj = laneDir(world, j);
  if (di >= 0 && dj >= 0) {
    if (sameAxis(di, d) && sameAxis(dj, d)) return di === dj;
    if (!sameAxis(di, d) && !sameAxis(dj, d)) return di !== dj && (opensMedian(world, x, y) || opensMedian(world, nx, ny));
    return true;
  }
  return true;
}

/**
 * Connection mask for auto-tiling and routing: which of the 4 neighbours carry a road that
 * connects here. bit 0 NE (x, y−1), bit 1 SE (x+1, y), bit 2 SW (x, y+1), bit 3 NW (x−1, y).
 * Bridges connect only along their axis; one-way carriageways and limited-access roads follow
 * the rules in `links` (docs/specs/transport.md).
 */
export function roadMask(world: World, x: number, y: number): number {
  // Also asked of empty tiles (tool previews): then it reports the roads around them.
  let mask = 0;
  for (let d = 0; d < 4; d++) if (links(world, x, y, d)) mask |= 1 << d;
  return mask;
}

/**
 * May traffic move from tile `from` to its neighbour in direction `d`? Never against a one-way
 * carriageway's flow, entering or leaving it (sideways moves at crossings are fine).
 */
export function stepAllowed(world: World, from: number, to: number, d: number): boolean {
  const a = laneDir(world, from);
  const b = laneDir(world, to);
  if (a >= 0 && sameAxis(a, d) && a !== d) return false;
  if (b >= 0 && sameAxis(b, d) && b !== d) return false;
  return true;
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

/**
 * Flyovers (docs/specs/transport.md, TX2). A flyover tile carries two roads that never meet:
 * the ground road along one axis and a raised one along the other. Route graphs give it two
 * nodes: the tile index for the ground road and `n + tile` for the deck (n = tiles on the map);
 * each node only goes straight through, along its own axis.
 */
export const OverAxis = { None: 0, X: 1, Y: 2 } as const;

/** The axis a step in mask direction d runs along: 1 for x (bits 1, 3), 2 for y (bits 0, 2). */
export function stepAxis(d: number): 1 | 2 {
  return d % 2 === 1 ? 1 : 2;
}

export function isFlyover(world: World, i: number): boolean {
  return world.over[i] !== 0;
}

/** The route-graph node a step in direction d arrives at on tile i (its deck when the step runs along it). */
export function nodeEntering(world: World, i: number, d: number): number {
  return world.over[i] !== 0 && world.overAxis[i] === stepAxis(d) ? world.width * world.height + i : i;
}

/** Whether a route-graph node may leave in direction d: flyover nodes only straight along their axis. */
export function nodeMayLeave(world: World, node: number, d: number): boolean {
  const n = world.width * world.height;
  const i = node >= n ? node - n : node;
  if (world.over[i] === 0) return true;
  const deckAxis = world.overAxis[i];
  return node >= n ? stepAxis(d) === deckAxis : stepAxis(d) !== deckAxis;
}

/** The road type a route-graph node drives on (the deck's, for a flyover's upper node). */
export function nodeRoad(world: World, node: number): number {
  const n = world.width * world.height;
  return node >= n ? world.over[node - n] : world.road[node];
}
