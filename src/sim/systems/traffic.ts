import { mulberry32 } from '../../shared/rng';
import { BUILDINGS } from '../buildings/catalog';
import { isActive } from './access';
import { speedFactor, type CommuteTrip } from './commute';
import { DIRS as DIR_STEP, roadMask, RoadType, stepAllowed } from '../roads';
import type { World } from '../World';
import type { SimSystem, WorldChange } from '../core/System';
import { roadSpec } from '../roadTypes';

/** Cars may drive this road type (pedestrian streets: walkers only). */
const carsMay = (t: number) => roadSpec(t)?.cars ?? false;

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
  /** Seconds spent held up (queue, junction box), reset when it moves freely. */
  wait: number;
  /** Buses: seconds left at the current stop, and the path segment where they last stopped. */
  dwell: number;
  stopSeg: number;
}

/** A bus stop: a road tile and the pavement side its shelter stands on (0 −y, 1 +x, 2 +y, 3 −x). */
export interface BusStop {
  tile: number;
  side: 0 | 1 | 2 | 3;
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
  personSpeed: 0.45,
  /** Cars drive on the right, this far from the road's centre line (tile units). Matches render/atlas/roadArt STREET. */
  laneOffset: 0.13,
  /** Pedestrians walk down the middle of the right-hand footpath (each road type has its own, sim/roadTypes.ts). */
  sidewalkOffset: 0.37,
  /** Share of a segment over which a car eases from the previous lane offset into the new one. */
  laneBlend: 0.35,
  pathCacheSize: 400,
  /** Gap kept to the car ahead (tile units); more behind long vehicles. */
  gap: 0.42,
  longGap: 0.55,
  /** Seconds a car may stand still before it gives up and fades out. */
  giveUpAfter: 20,
  /** Visible cars per road tile at most (docs/specs/traffic.md). */
  carsPerRoadTile: 0.35,
  /** Car trips started per sim second, per commuter (scaled by the rush-hour curve). */
  carTripsPerCommuter: 1 / 400,
  /** Seconds each traffic-light phase stays green. */
  lightPhase: 5,
  /** Bus stops (docs/specs/simulation.md). */
  busDwell: 2,
  busMinPopulation: 150,
  stopMinCapacity: 12,
  stopSpacing: 6,
  maxStops: 40,
  busMinTrip: 8,
} as const;

/** Car trip rate multiplier by hour of day: night lull, morning and evening peaks. */
const TRIP_RATE: readonly (readonly [number, number])[] = [
  [0, 0.25],
  [5, 0.25],
  [7.5, 2],
  [9, 2],
  [10.5, 1],
  [16.5, 1],
  [17, 2],
  [18.5, 2],
  [20, 1],
  [22, 0.5],
  [24, 0.25],
];

function curve(keys: readonly (readonly [number, number])[], hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  for (let k = 1; k < keys.length; k++) {
    if (h <= keys[k][0]) {
      const [h0, v0] = keys[k - 1];
      const [h1, v1] = keys[k];
      return v0 + ((v1 - v0) * (h - h0)) / (h1 - h0);
    }
  }
  return keys[0][1];
}

/** Car trips per resident are scaled by this (rush hours). */
export function tripRate(hour: number): number {
  return curve(TRIP_RATE, hour);
}

/** Share of car trips that go home → work: high in the morning, low in the evening. */
export function outboundShare(hour: number): number {
  return hour >= 5 && hour < 11 ? 0.85 : hour >= 15 && hour < 20 ? 0.15 : 0.5;
}

function isLong(a: Agent): boolean {
  return a.kind === 'bus' || a.kind === 'truck';
}

/**
 * Bus stops outside the biggest buildings: one per entrance road tile, busiest first,
 * at least `stopSpacing` tiles apart. Bridges and junctions don't get stops.
 */
export function computeBusStops(world: World): BusStop[] {
  const candidates: { tile: number; capacity: number; bx: number; by: number }[] = [];
  for (const b of world.buildings.values()) {
    if (!isActive(b)) continue;
    const d = BUILDINGS[b.def];
    const big = d.category === 'residential' ? d.capacity >= TRAFFIC.stopMinCapacity : d.category !== 'industrial';
    if (!big) continue;
    candidates.push({ tile: b.entrance, capacity: d.capacity, bx: b.x + d.size.w / 2, by: b.y + d.size.h / 2 });
  }
  candidates.sort((a, b) => b.capacity - a.capacity || a.tile - b.tile);
  const stops: BusStop[] = [];
  const w = world.width;
  for (const c of candidates) {
    if (stops.length >= TRAFFIC.maxStops) break;
    const x = c.tile % w;
    const y = (c.tile - x) / w;
    const mask = roadMask(world, x, y);
    // Straight road pieces only: 2 connections on one axis.
    if (world.bridge[c.tile] !== 0 || (mask !== 0b0101 && mask !== 0b1010)) continue;
    if (stops.some((s) => Math.abs((s.tile % w) - x) + Math.abs(Math.floor(s.tile / w) - y) < TRAFFIC.stopSpacing)) continue;
    // The shelter goes on the side of the road facing the building.
    const dx = c.bx - (x + 0.5);
    const dy = c.by - (y + 0.5);
    const side: BusStop['side'] = mask === 0b0101 ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
    stops.push({ tile: c.tile, side });
  }
  return stops;
}

const DIRS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** Cars may drive here (not pedestrian streets). */
function drivable(world: World, tile: number): boolean {
  return roadSpec(world.road[tile])?.cars ?? false;
}

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
      // Cars keep to roads they may drive, and never against a one-way carriageway.
      if (!stepAllowed(world, i, j, d) || (j !== to && !drivable(world, j))) continue;
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

/** Lane offset of a vehicle on a tile: on multi-lane roads buses, trucks and some cars keep to the outer lane. */
function laneOffset(world: World, a: Agent, tile: number): number {
  const lanes = roadSpec(world.road[tile])?.lanes;
  if (!lanes || lanes.length === 1) return lanes?.[0] ?? TRAFFIC.laneOffset;
  return isLong(a) || a.variant % 3 === 0 ? lanes[lanes.length - 1] : lanes[0];
}

/** Roads with footpaths both sides (pedestrians stroll there; never highways, bridges or one-way carriageways). */
function walkable(world: World, tile: number): boolean {
  return world.bridge[tile] === 0 && world.lane[tile] === 0 && (roadSpec(world.road[tile])?.footpath ?? null) !== null;
}

/**
 * A pedestrian's waypoint at path index k: the tile centre pushed onto the right-hand footpath.
 * At a turn the offsets of the two legs add up (a mitre), so the corner lands on the footpath
 * corner: right turns stay on the inside, left turns and straight-on cross the side road at
 * the zebra crossing (docs/specs/city-art.md).
 */
export function walkPoint(world: World, path: Int32Array, k: number): [number, number] {
  const w = world.width;
  const i = path[k];
  const din = k > 0 ? stepDir(path[k - 1], i) : -1;
  const dout = k < path.length - 1 ? stepDir(i, path[k + 1]) : -1;
  const o = roadSpec(world.road[i])?.footpath ?? TRAFFIC.sidewalkOffset;
  let ox = 0;
  let oy = 0;
  const add = (d: number) => {
    const [rx, ry] = rightOf(d);
    ox += rx * o;
    oy += ry * o;
  };
  if (din >= 0) add(din);
  // Straight on (same heading) or a dead-end reversal keeps the incoming side.
  if (dout >= 0 && (din < 0 || (dout !== din && (dout + 2) % 4 !== din))) add(dout);
  return [(i % w) + 0.5 + ox, Math.floor(i / w) + 0.5 + oy];
}

/** Length of a pedestrian's current leg (between two waypoints), so they walk at a steady pace. */
function walkLength(world: World, a: Agent): number {
  const k = Math.min(a.seg, a.path.length - 2);
  const [x0, y0] = walkPoint(world, a.path, k);
  const [x1, y1] = walkPoint(world, a.path, k + 1);
  return Math.max(0.2, Math.hypot(x1 - x0, y1 - y0));
}

export function agentPose(world: World, a: Agent): AgentPose {
  const p = a.path;
  const i0 = p[a.seg];
  const i1 = p[Math.min(a.seg + 1, p.length - 1)];
  const dir = i0 === i1 ? 1 : stepDir(i0, i1);
  if (a.kind === 'person') {
    const [x0, y0] = walkPoint(world, p, a.seg);
    const [x1, y1] = i0 === i1 ? [x0, y0] : walkPoint(world, p, a.seg + 1);
    return { x: x0 + (x1 - x0) * a.t, y: y0 + (y1 - y0) * a.t, dir };
  }
  const w = world.width;
  const x0 = (i0 % w) + 0.5;
  const y0 = Math.floor(i0 / w) + 0.5;
  const x1 = (i1 % w) + 0.5;
  const y1 = Math.floor(i1 / w) + 0.5;
  const offset = laneOffset(world, a, i0);
  const [rx, ry] = rightOf(dir);
  let ox = rx * offset;
  let oy = ry * offset;
  // Ease in from the previous segment's lane so turns and lane changes don't jump.
  if (a.seg > 0 && a.t < TRAFFIC.laneBlend) {
    const pd = stepDir(p[a.seg - 1], i0);
    const prevOffset = laneOffset(world, a, p[a.seg - 1]);
    if (pd !== dir || prevOffset !== offset) {
      const [px, py] = rightOf(pd);
      const k = a.t / TRAFFIC.laneBlend;
      ox = px * prevOffset * (1 - k) + ox * k;
      oy = py * prevOffset * (1 - k) + oy * k;
    }
  }
  return { x: x0 + (x1 - x0) * a.t + ox, y: y0 + (y1 - y0) * a.t + oy, dir };
}

/**
 * Spawns and moves agents. Trips run from homes (with residents and road access)
 * to job buildings, shops and parks; pedestrians stroll a few tiles along the
 * pavement near homes and shops. Density follows population.
 */
/** A junction's light: which axis has green (0 = along y, 1 = along x). */
export interface TrafficLight {
  tile: number;
  greenAxis: 0 | 1;
}

/** Where the visible cars get their trips and road speeds from (the commute model). */
export interface CommuteSource {
  readonly trips: readonly CommuteTrip[];
  readonly congestion: Float32Array;
  readonly report: { readonly commuters: number };
}

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
  /** Bus stops, recomputed with demand. */
  stops: readonly BusStop[] = [];
  private stopTiles = new Set<number>();
  /** Road tiles with 3–4 connections (traffic lights); rebuilt when roads change. */
  private junction: Uint8Array;
  private junctions: number[] = [];
  private roadTiles = 0;
  private readonly lanes = new Map<number, Agent[]>();
  /** Sim seconds elapsed (drives the traffic lights). */
  private clock = 0;
  /** Running totals of trip weights, for picking a trip in proportion to its flow. */
  private tripCumulative: number[] = [];
  private readonly reversed = new WeakMap<CommuteTrip, Int32Array>();

  private readonly world: World;
  private readonly commute: CommuteSource | null;

  constructor(world: World, seed = 1, commute: CommuteSource | null = null) {
    this.world = world;
    this.commute = commute;
    this.rng = mulberry32(seed);
    this.scratch = new Int32Array(world.width * world.height);
    this.junction = new Uint8Array(world.width * world.height);
    this.findJunctions();
  }

  private findJunctions() {
    const w = this.world;
    this.junctions = [];
    this.roadTiles = 0;
    for (let y = 0; y < w.height; y++) {
      for (let x = 0; x < w.width; x++) {
        const i = w.index(x, y);
        if (w.road[i] !== RoadType.None) this.roadTiles++;
        // A junction is where three or more car roads meet; a pedestrian street joining one
        // gets a zebra crossing, not lights.
        const m = carsMay(w.road[i]) ? roadMask(w, x, y) : 0;
        let links = 0;
        for (let d = 0; d < 4; d++) if (m & (1 << d) && carsMay(w.road[w.index(x + DIR_STEP[d][0], y + DIR_STEP[d][1])])) links++;
        this.junction[i] = links >= 3 ? 1 : 0;
        if (links >= 3) this.junctions.push(i);
      }
    }
  }

  /** Which axis has green at a junction now. Junctions are offset so they don't all switch together. */
  private greenAxis(tile: number): 0 | 1 {
    const offset = (tile * 7919) % (TRAFFIC.lightPhase * 2);
    return Math.floor((this.clock + offset) / TRAFFIC.lightPhase) % 2 === 0 ? 0 : 1;
  }

  /** Every junction's light right now (for drawing). */
  lights(): TrafficLight[] {
    return this.junctions.map((tile) => ({ tile, greenAxis: this.greenAxis(tile) }));
  }

  /** At most this many cars on screen: a share of the road network, so roads never overfill. */
  private maxCars(): number {
    return Math.min(TRAFFIC.maxCars, Math.ceil(this.roadTiles * TRAFFIC.carsPerRoadTile));
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
    this.stops = this.population >= TRAFFIC.busMinPopulation ? computeBusStops(this.world) : [];
    this.stopTiles = new Set(this.stops.map((s) => s.tile));
    let sum = 0;
    this.tripCumulative = (this.commute?.trips ?? []).map((t) => (sum += t.weight));
  }

  /** Roads changed: forget cached routes and drop agents whose path is now broken. */
  invalidateRoutes() {
    this.cache.clear();
    this.findJunctions();
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

  /** A commute trip picked in proportion to its flow, in the direction of the rush hour. */
  private commuteTrip(hour: number): Int32Array | null {
    const trips = this.commute?.trips ?? [];
    const total = this.tripCumulative[this.tripCumulative.length - 1] ?? 0;
    if (trips.length === 0 || total <= 0) return null;
    const r = this.rng() * total;
    let lo = 0;
    let hi = this.tripCumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.tripCumulative[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    const trip = trips[lo];
    // Walkers' trips (through pedestrian streets) aren't drawn as cars.
    for (let k = 1; k < trip.path.length - 1; k++) if (!drivable(this.world, trip.path[k])) return null;
    if (this.rng() < outboundShare(hour)) return trip.path;
    let back = this.reversed.get(trip);
    if (!back) {
      // The way home: a plain reverse, unless one-way roads mean it must take the other carriageway.
      const oneWay = trip.path.some((t) => this.world.lane[t] !== 0);
      back = oneWay ? (this.route(trip.path[trip.path.length - 1], trip.path[0]) ?? undefined) : trip.path.slice().reverse();
      if (!back) return null;
      this.reversed.set(trip, back);
    }
    return back;
  }

  /** Room for a new car at the start of a path (nobody right at the start of its first lane). */
  private hasRoom(path: Int32Array): boolean {
    const lane = this.lanes.get(path[0] * this.junction.length + path[1]);
    return !lane || lane.every((a) => a.seg > 0 || a.t > TRAFFIC.gap * 1.5);
  }

  private spawnCar(hour: number) {
    if (this.homes.length === 0 || this.destinations.length === 0) return;
    const roll = this.rng();
    if (roll < 0.06 && this.stops.length >= 2) {
      this.spawnBus();
      return;
    }
    let path = this.commuteTrip(hour);
    if (!path) {
      // No commute model (or nothing reachable yet): a random trip, as before.
      const home = this.pick(this.homes);
      const dest = this.pick(this.destinations);
      path = this.rng() < outboundShare(hour) ? this.route(home, dest) : this.route(dest, home);
    }
    if (!path || path.length < 3 || !this.hasRoom(path)) return;
    const kind: AgentKind = roll < 0.14 ? 'truck' : roll < 0.22 ? 'taxi' : 'car';
    const speed = TRAFFIC.carSpeed * (kind === 'truck' ? 0.8 : 0.9 + this.rng() * 0.25);
    this.addVehicle(kind, path, speed);
  }

  /** A bus between two stops far enough apart; it pauses at every stop on the way. */
  private spawnBus() {
    const w = this.world.width;
    for (let attempt = 0; attempt < 5; attempt++) {
      const a = this.stops[Math.floor(this.rng() * this.stops.length)].tile;
      const b = this.stops[Math.floor(this.rng() * this.stops.length)].tile;
      const d = Math.abs((a % w) - (b % w)) + Math.abs(Math.floor(a / w) - Math.floor(b / w));
      if (d < TRAFFIC.busMinTrip) continue;
      const path = this.route(a, b);
      if (path && path.length >= 3) {
        this.addVehicle('bus', path, TRAFFIC.carSpeed * 0.8);
        return;
      }
    }
  }

  private addVehicle(kind: AgentKind, path: Int32Array, speed: number) {
    this.agents.push({ kind, path, seg: 0, t: 0, speed, variant: Math.floor(this.rng() * 6), age: 0, wait: 0, dwell: 0, stopSeg: -1 });
  }

  /** A short stroll on the footpaths: a random walk along connected streets (never highways or bridges) from a home or shop. */
  private spawnPerson() {
    const pool = this.rng() < 0.6 ? this.homes : this.destinations;
    if (pool.length === 0) return;
    const w = this.world;
    const start = this.pick(pool);
    if (!walkable(w, start)) return;
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
        if (j !== prev && walkable(w, j)) options.push(j);
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
      wait: 0,
      dwell: 0,
      stopSeg: -1,
    });
  }

  /** Advance by `dt` sim seconds (already scaled by game speed). `hour` is the time-of-day clock. */
  update(dt: number, hour = 12) {
    if (dt <= 0) return;
    let cars = 0;
    let people = 0;
    for (const a of this.agents) {
      if (a.kind === 'person') people++;
      else cars++;
    }
    this.clock += dt;
    // Car trips follow the commuters when the commute model is running, else population.
    const rate = this.commute && this.commute.trips.length > 0 ? this.commute.report.commuters * TRAFFIC.carTripsPerCommuter : this.population * TRAFFIC.carTripsPerResident;
    this.carBudget = Math.min(4, this.carBudget + rate * tripRate(hour) * dt);
    const maxCars = this.maxCars();
    while (this.carBudget >= 1) {
      this.carBudget -= 1;
      if (cars < maxCars) {
        this.spawnCar(hour);
        cars++;
      }
    }
    // Fewer strollers at night.
    const night = hour < 6 || hour >= 22 ? 0.3 : 1;
    const wantPeople = Math.min(TRAFFIC.maxPeople, Math.round(this.population * TRAFFIC.peoplePerResident * night));
    this.peopleBudget = Math.min(3, this.peopleBudget + dt * 2);
    while (this.peopleBudget >= 1 && people < wantPeople) {
      this.peopleBudget -= 1;
      this.spawnPerson();
      people++;
    }

    this.moveVehicles(dt);
    for (const a of this.agents) {
      if (a.kind !== 'person') continue;
      a.age += dt;
      a.t += (dt * a.speed) / walkLength(this.world, a);
      while (a.t >= 1 && a.seg < a.path.length - 1) {
        a.t -= 1;
        a.seg++;
      }
    }
    // Drop agents that arrived (or gave up waiting).
    let n = 0;
    for (const a of this.agents) {
      if (a.seg < a.path.length - 1 && a.wait < TRAFFIC.giveUpAfter) this.agents[n++] = a;
    }
    this.agents.length = n;
  }

  /** Lane key: one direction of one road segment. */
  private laneKey(a: Agent, seg: number): number {
    return a.path[seg] * this.junction.length + a.path[seg + 1];
  }

  /**
   * Move cars: keep a gap to the car ahead in the lane (including the next lane's last car),
   * stop at red lights and don't enter a junction with no room beyond it, slow down on
   * congested roads, and dwell at bus stops.
   */
  private moveVehicles(dt: number) {
    const w = this.world;
    const lanes = this.lanes;
    lanes.clear();
    for (const a of this.agents) {
      if (a.kind === 'person' || a.seg >= a.path.length - 1) continue;
      const key = this.laneKey(a, a.seg);
      const lane = lanes.get(key);
      if (lane) lane.push(a);
      else lanes.set(key, [a]);
    }
    for (const lane of lanes.values()) lane.sort((p, q) => q.t - p.t);

    for (const lane of lanes.values()) {
      for (let k = 0; k < lane.length; k++) {
        const a = lane[k];
        a.age += dt;
        const p = a.path;
        const last = p.length - 1;
        let limit = Infinity;
        if (k > 0) {
          const ahead = lane[k - 1];
          // The car ahead moved first, so it may already be in the next lane.
          const lead = this.laneKey(ahead, ahead.seg) === this.laneKey(a, a.seg) ? ahead.t : 1 + ahead.t;
          limit = lead - (isLong(ahead) ? TRAFFIC.longGap : TRAFFIC.gap);
        } else if (a.seg + 1 < last) {
          const next = lanes.get(p[a.seg + 1] * this.junction.length + p[a.seg + 2]);
          const tail = next?.[next.length - 1];
          if (tail && tail !== a) limit = 1 + tail.t - (isLong(tail) ? TRAFFIC.longGap : TRAFFIC.gap);
        }
        // Junction ahead: stop at the line (halfway along the approach) on red, or when the
        // road beyond is full, so nobody blocks the junction. Cars already past the line go on.
        const j = p[a.seg + 1];
        if (a.seg + 1 < last && this.junction[j] && a.t < 0.5) {
          const axis = stepDir(p[a.seg], j) % 2;
          const exit = lanes.get(j * this.junction.length + p[a.seg + 2]);
          const exitFull = !!exit && exit.some((b) => b !== a && b.t < TRAFFIC.gap + 0.25);
          if (axis !== this.greenAxis(j) || exitFull) limit = Math.min(limit, 0.46);
        }
        if (a.dwell > 0) {
          a.dwell -= dt;
          limit = Math.min(limit, a.t);
        }

        // Congested roads slow everyone down (but never to a stop).
        const slow = this.commute ? speedFactor(this.commute.congestion[p[a.seg]]) : 1;
        const step = dt * a.speed * slow * (roadSpec(w.road[p[a.seg]])?.carSpeed ?? 1);
        const t = Math.max(a.t, Math.min(a.t + step, limit));
        a.wait = a.dwell <= 0 && t - a.t < step * 0.5 ? a.wait + dt : 0;
        a.t = t;
        while (a.t >= 1 && a.seg < last) {
          a.t -= 1;
          a.seg++;
          // Buses pull in at every stop they pass (not the one they started from).
          if (a.kind === 'bus' && a.seg < last && a.stopSeg !== a.seg && this.stopTiles.has(p[a.seg])) {
            a.stopSeg = a.seg;
            a.dwell = TRAFFIC.busDwell;
            a.t = 0;
          }
        }
      }
    }
  }

  clear() {
    this.agents.length = 0;
  }
}

/** Cars, people and buses: demand follows the city, routes are rebuilt when roads change. */
export class TrafficSystem implements SimSystem {
  readonly name = 'traffic';
  readonly traffic: Traffic;
  constructor(world: World, commute: CommuteSource) {
    this.traffic = new Traffic(world, world.seed, commute);
  }
  onWorldChanged(change: WorldChange) {
    this.traffic.refreshDemand();
    if (change.roads) this.traffic.invalidateRoutes();
  }
  onDay() {
    this.traffic.refreshDemand();
  }
  onFrame(dt: number, hour: number) {
    this.traffic.update(dt, hour);
  }
}
