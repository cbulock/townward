import { mulberry32 } from '../shared/rng';
import { BUILDINGS } from './buildings/catalog';
import { isActive } from './population';
import { roadMask, RoadType } from './roads';
import type { World } from './World';

/**
 * Cars and pedestrians moving over the road network. Pure data and logic;
 * render/AgentRenderer.ts draws them. See docs/specs/simulation.md.
 */

export type AgentKind = 'car' | 'taxi' | 'bus' | 'truck' | 'person';

export interface Agent {
  kind: AgentKind;
  /** Tile indices to visit, in order. */
  path: Int32Array;
  /** Current segment: moving from path[seg] to path[seg + 1]. */
  seg: number;
  /** Progress along the segment, 0..1. */
  t: number;
  /** Tiles per sim second on a plain road. */
  speed: number;
  /** Art variant (colour, shirt…). */
  variant: number;
  /** Seconds alive, for walk-cycle animation. */
  age: number;
}

/** Where an agent is, in continuous tile coordinates, and which way it faces. */
export interface AgentPose {
  x: number;
  y: number;
  /** 0 NE (−y), 1 SE (+x), 2 SW (+y), 3 NW (−x). */
  dir: 0 | 1 | 2 | 3;
}

export const TRAFFIC = {
  maxCars: 320,
  maxPeople: 180,
  /** Car trips started per sim second, per resident. */
  carTripsPerResident: 1 / 140,
  peoplePerResident: 1 / 45,
  carSpeed: 1.7,
  highwaySpeedFactor: 1.9,
  personSpeed: 0.45,
  /** Cars drive on the right, this far from the road's centre line (tile units). */
  laneOffset: 0.17,
  sidewalkOffset: 0.37,
  /** Share of a segment over which a car eases from the previous lane offset into the new one. */
  laneBlend: 0.35,
  pathCacheSize: 400,
} as const;

const DIRS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** Shortest route between two road tiles (BFS over connected road pieces). */
export function findRoute(world: World, from: number, to: number, scratch?: Int32Array): Int32Array | null {
  if (world.road[from] === RoadType.None || world.road[to] === RoadType.None) return null;
  if (from === to) return Int32Array.of(from);
  const n = world.width * world.height;
  const prev = scratch && scratch.length >= n ? scratch : new Int32Array(n);
  prev.fill(-1);
  prev[from] = from;
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  queue[tail++] = from;
  while (head < tail) {
    const i = queue[head++];
    if (i === to) break;
    const x = i % world.width;
    const y = (i - x) / world.width;
    const mask = roadMask(world, x, y);
    for (let d = 0; d < 4; d++) {
      if (!(mask & (1 << d))) continue;
      const j = world.index(x + DIRS[d][0], y + DIRS[d][1]);
      if (prev[j] !== -1) continue;
      prev[j] = i;
      queue[tail++] = j;
    }
  }
  if (prev[to] === -1) return null;
  const out: number[] = [];
  for (let i = to; i !== from; i = prev[i]) out.push(i);
  out.push(from);
  return Int32Array.from(out.reverse());
}

/** Direction index for a step between two tile indices. */
function stepDir(a: number, b: number): 0 | 1 | 2 | 3 {
  const d = b - a;
  if (d === 1) return 1;
  if (d === -1) return 3;
  return d > 0 ? 2 : 0;
}

/** Right-hand perpendicular (tile space) of a heading. */
function rightOf(dir: number): [number, number] {
  const [dx, dy] = DIRS[dir];
  return [-dy, dx];
}

export function agentPose(world: World, a: Agent): AgentPose {
  const p = a.path;
  const i0 = p[a.seg];
  const i1 = p[Math.min(a.seg + 1, p.length - 1)];
  const w = world.width;
  const x0 = (i0 % w) + 0.5;
  const y0 = Math.floor(i0 / w) + 0.5;
  const x1 = (i1 % w) + 0.5;
  const y1 = Math.floor(i1 / w) + 0.5;
  const dir = i0 === i1 ? 1 : stepDir(i0, i1);
  const offset = a.kind === 'person' ? TRAFFIC.sidewalkOffset : TRAFFIC.laneOffset;
  const [rx, ry] = rightOf(dir);
  let ox = rx * offset;
  let oy = ry * offset;
  // Ease in from the previous segment's lane so turns don't jump.
  if (a.seg > 0 && a.t < TRAFFIC.laneBlend) {
    const pd = stepDir(p[a.seg - 1], i0);
    if (pd !== dir) {
      const [px, py] = rightOf(pd);
      const k = a.t / TRAFFIC.laneBlend;
      ox = px * offset * (1 - k) + ox * k;
      oy = py * offset * (1 - k) + oy * k;
    }
  }
  return { x: x0 + (x1 - x0) * a.t + ox, y: y0 + (y1 - y0) * a.t + oy, dir };
}

/**
 * Spawns and moves agents. Trips run from homes (with residents and road access)
 * to job buildings, shops and parks; pedestrians stroll a few tiles along the
 * pavement near homes and shops. Density follows population.
 */
export class Traffic {
  readonly agents: Agent[] = [];
  private readonly rng: () => number;
  private carBudget = 0;
  private peopleBudget = 0;
  private readonly cache = new Map<string, Int32Array | null>();
  private scratch: Int32Array;
  private homes: number[] = [];
  private destinations: number[] = [];
  private population = 0;

  constructor(
    private readonly world: World,
    seed = 1,
  ) {
    this.rng = mulberry32(seed);
    this.scratch = new Int32Array(world.width * world.height);
  }

  /** Call after buildings or populations change (e.g. once a day). */
  refreshDemand() {
    this.homes = [];
    this.destinations = [];
    this.population = 0;
    for (const b of this.world.buildings.values()) {
      if (!isActive(b)) continue;
      const d = BUILDINGS[b.def];
      if (d.category === 'residential') {
        if (b.occupants > 0) this.homes.push(b.entrance);
        this.population += b.occupants;
      } else if (b.occupants > 0 || d.category === 'civic') {
        this.destinations.push(b.entrance);
      }
    }
  }

  /** Roads changed: forget cached routes and drop agents whose path is now broken. */
  invalidateRoutes() {
    this.cache.clear();
    const w = this.world;
    for (let k = this.agents.length - 1; k >= 0; k--) {
      const a = this.agents[k];
      for (let s = a.seg; s < a.path.length; s++) {
        if (w.road[a.path[s]] === RoadType.None) {
          this.agents.splice(k, 1);
          break;
        }
      }
    }
  }

  private route(from: number, to: number): Int32Array | null {
    const key = `${from}:${to}`;
    if (this.cache.has(key)) return this.cache.get(key) ?? null;
    const r = findRoute(this.world, from, to, this.scratch);
    if (this.cache.size >= TRAFFIC.pathCacheSize) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key, r);
    return r;
  }

  private pick(list: readonly number[]): number {
    return list[Math.floor(this.rng() * list.length)];
  }

  private spawnCar() {
    if (this.homes.length === 0 || this.destinations.length === 0) return;
    const home = this.pick(this.homes);
    const dest = this.pick(this.destinations);
    const out = this.rng() < 0.5;
    const path = out ? this.route(home, dest) : this.route(dest, home);
    if (!path || path.length < 3) return;
    const roll = this.rng();
    const kind: AgentKind =
      roll < 0.06 && this.population > 150 ? 'bus' : roll < 0.14 ? 'truck' : roll < 0.22 ? 'taxi' : 'car';
    const speed = TRAFFIC.carSpeed * (kind === 'bus' || kind === 'truck' ? 0.8 : 0.9 + this.rng() * 0.25);
    this.agents.push({ kind, path, seg: 0, t: 0, speed, variant: Math.floor(this.rng() * 6), age: 0 });
  }

  /** A short stroll: a random walk along connected road tiles from a home or shop. */
  private spawnPerson() {
    const pool = this.rng() < 0.6 ? this.homes : this.destinations;
    if (pool.length === 0) return;
    const w = this.world;
    const start = this.pick(pool);
    const steps = 3 + Math.floor(this.rng() * 6);
    const path = [start];
    let cur = start;
    let prev = -1;
    for (let k = 0; k < steps; k++) {
      const x = cur % w.width;
      const y = (cur - x) / w.width;
      const mask = roadMask(w, x, y);
      const options: number[] = [];
      for (let d = 0; d < 4; d++) {
        if (!(mask & (1 << d))) continue;
        const j = w.index(x + DIRS[d][0], y + DIRS[d][1]);
        if (j !== prev && w.bridge[j] === 0) options.push(j);
      }
      if (options.length === 0) break;
      prev = cur;
      cur = this.pick(options);
      path.push(cur);
    }
    if (path.length < 2) return;
    this.agents.push({
      kind: 'person',
      path: Int32Array.from(path),
      seg: 0,
      t: 0,
      speed: TRAFFIC.personSpeed * (0.8 + this.rng() * 0.4),
      variant: Math.floor(this.rng() * 8),
      age: 0,
    });
  }

  /** Advance by `dt` sim seconds (already scaled by game speed). */
  update(dt: number) {
    if (dt <= 0) return;
    let cars = 0;
    let people = 0;
    for (const a of this.agents) {
      if (a.kind === 'person') people++;
      else cars++;
    }
    this.carBudget = Math.min(4, this.carBudget + this.population * TRAFFIC.carTripsPerResident * dt);
    while (this.carBudget >= 1) {
      this.carBudget -= 1;
      if (cars < TRAFFIC.maxCars) {
        this.spawnCar();
        cars++;
      }
    }
    const wantPeople = Math.min(TRAFFIC.maxPeople, Math.round(this.population * TRAFFIC.peoplePerResident));
    this.peopleBudget = Math.min(3, this.peopleBudget + dt * 2);
    while (this.peopleBudget >= 1 && people < wantPeople) {
      this.peopleBudget -= 1;
      this.spawnPerson();
      people++;
    }

    const w = this.world;
    for (let k = this.agents.length - 1; k >= 0; k--) {
      const a = this.agents[k];
      a.age += dt;
      const onHighway = a.kind !== 'person' && w.road[a.path[a.seg]] === RoadType.Highway;
      a.t += dt * a.speed * (onHighway ? TRAFFIC.highwaySpeedFactor : 1);
      while (a.t >= 1 && a.seg < a.path.length - 1) {
        a.t -= 1;
        a.seg++;
      }
      if (a.seg >= a.path.length - 1) this.agents.splice(k, 1);
    }
  }

  clear() {
    this.agents.length = 0;
  }
}
