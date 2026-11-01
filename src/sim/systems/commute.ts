import { BALANCE } from '../../shared/balance';
import { BUILDINGS } from '../buildings/catalog';
import type { SimSystem, WorldChange } from '../core/System';
import { roadMask, RoadType, stepAllowed } from '../roads';
import type { World } from '../World';
import { isActive } from './access';
import { hasUtilities } from './utilities';
import { roadSpec } from '../roadTypes';

/**
 * Commute system (docs/specs/traffic.md): where people travel and how busy each road is.
 * Workers commute from homes to job buildings over the road graph (fastest path, with travel
 * time slowed by congestion), spread over reachable jobs with a distance decay. Results:
 * volume and congestion per road tile, average commute per home, and a list of real trips
 * for the visible cars to drive.
 */

export const COMMUTE = {
  /** Commuters per day a road tile carries before it counts as congested. */
  /** Fallbacks; each road type's own numbers are in sim/roadTypes.ts. */
  roadCapacity: 500,
  /** Free-flow minutes to cross one tile. */
  roadMinutes: 1,
  /** Distance decay of job attraction (minutes). */
  decayMinutes: 25,
  /** Share of each day's new volume blended into the running volume (stops routes flapping). */
  smoothing: 0.4,
  /** Trips kept for the visible cars. */
  maxTrips: 500,
  /** Trips kept per group of homes (its biggest destinations). */
  tripsPerOrigin: 4,
} as const;

/** How much congestion slows traffic: 87% of free speed at c = 1, 43% at c = 2, never below 20%. */
export function speedFactor(congestion: number): number {
  const over = Math.max(0, congestion - 0.5);
  return Math.max(0.2, 1 / (1 + 0.6 * over * over));
}

/** A commute route the visible cars can drive, weighted by how many people use it each day. */
export interface CommuteTrip {
  /** Road tiles from the home's entrance to the job's entrance. */
  path: Int32Array;
  weight: number;
}

export interface CommuteReport {
  commuters: number;
  /** Commuter-weighted average trip time, minutes. */
  avgMinutes: number;
  /** Road tiles over capacity (congestion > 1). */
  jammedTiles: number;
}

const DIRS: readonly (readonly [number, number, number])[] = [
  [1, 0, -1],
  [2, 1, 0],
  [4, 0, 1],
  [8, -1, 0],
];

/** Binary min-heap of tile indices keyed by a distance array. */
class Heap {
  private items: number[] = [];
  private readonly key: Float64Array;
  constructor(key: Float64Array) {
    this.key = key;
  }
  get size(): number {
    return this.items.length;
  }
  push(i: number) {
    const a = this.items;
    a.push(i);
    let k = a.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (this.key[a[p]] <= this.key[a[k]]) break;
      [a[p], a[k]] = [a[k], a[p]];
      k = p;
    }
  }
  pop(): number {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < a.length && this.key[a[l]] < this.key[a[m]]) m = l;
        if (r < a.length && this.key[a[r]] < this.key[a[m]]) m = r;
        if (m === k) break;
        [a[m], a[k]] = [a[k], a[m]];
        k = m;
      }
    }
    return top;
  }
}

/** The commute model's day-to-day memory: smoothed volume and each home's commute. */
export interface CommuteState {
  /** Per tile (0 off-road). */
  readonly volume: Float32Array;
  /** Minutes per home building id. */
  readonly minutes: ReadonlyMap<number, number>;
}

export class CommuteSystem implements SimSystem {
  readonly name = 'commute';
  /** Smoothed commuters per day crossing each tile (0 off-road). */
  readonly volume: Float32Array;
  /** volume ÷ capacity per road tile. */
  readonly congestion: Float32Array;
  /** Average commute (minutes) per home building id. */
  readonly commuteMinutes = new Map<number, number>();
  trips: CommuteTrip[] = [];
  report: CommuteReport = { commuters: 0, avgMinutes: 0, jammedTiles: 0 };
  private computed = false;
  // Dijkstra scratch, reused between origins.
  private readonly dist: Float64Array;
  private readonly prev: Int32Array;
  private readonly seen: Int32Array;
  private readonly load: Float64Array;
  private stamp = 0;

  private readonly world: World;

  constructor(world: World) {
    this.world = world;
    const n = world.width * world.height;
    this.volume = new Float32Array(n);
    this.congestion = new Float32Array(n);
    this.dist = new Float64Array(n);
    this.prev = new Int32Array(n);
    this.seen = new Int32Array(n);
    this.load = new Float64Array(n);
  }

  onWorldChanged(change: WorldChange) {
    if (change.roads) this.compute();
  }

  /** What carries over from one day to the next (saved, so a loaded city continues exactly). */
  exportState(): CommuteState {
    return { volume: this.volume, minutes: this.commuteMinutes };
  }

  /** Put back a saved state, on top of a fresh compute (sim/save.ts, loadSimulation). */
  restoreState(state: CommuteState) {
    const w = this.world;
    for (let i = 0; i < this.volume.length; i++) {
      this.volume[i] = w.road[i] === RoadType.None ? 0 : state.volume[i];
      this.congestion[i] = w.road[i] === RoadType.None ? 0 : this.volume[i] / this.capacity(i);
    }
    this.commuteMinutes.clear();
    for (const [id, m] of state.minutes) this.commuteMinutes.set(id, m);
    this.computed = true;
  }

  onDay() {
    this.compute();
  }

  /** Free-flow minutes to cross a tile, slowed by its current congestion. */
  private tileMinutes(i: number): number {
    const base = roadSpec(this.world.road[i])?.minutes ?? COMMUTE.roadMinutes;
    return base / speedFactor(this.congestion[i]);
  }

  private capacity(i: number): number {
    return roadSpec(this.world.road[i])?.capacity ?? COMMUTE.roadCapacity;
  }

  /** Recompute today's commute: volumes, congestion, commute times and trips. */
  compute() {
    const w = this.world;
    const n = w.width * w.height;

    // Origins: workers in homes, grouped by entrance. Destinations: workers at job buildings.
    const origins = new Map<number, { commuters: number; homes: number[] }>();
    const jobs = new Map<number, number>();
    for (const b of w.buildings.values()) {
      if (!isActive(b) || b.occupants === 0 || !hasUtilities(b)) continue;
      if (BUILDINGS[b.def].category === 'residential') {
        const o = origins.get(b.entrance) ?? { commuters: 0, homes: [] };
        o.commuters += b.occupants * BALANCE.workforceShare;
        o.homes.push(b.id);
        origins.set(b.entrance, o);
      } else {
        jobs.set(b.entrance, (jobs.get(b.entrance) ?? 0) + b.occupants);
      }
    }

    const fresh = new Float64Array(n);
    const trips: CommuteTrip[] = [];
    let commuters = 0;
    let minutesSum = 0;
    this.commuteMinutes.clear();
    for (const [origin, o] of origins) {
      const order = this.shortestPaths(origin);
      // Spread this group's commuters over reachable jobs: big and near ones attract most.
      let total = 0;
      const reached: { tile: number; weight: number }[] = [];
      for (const [tile, workers] of jobs) {
        if (this.seen[tile] !== this.stamp) continue;
        const weight = workers * Math.exp(-this.dist[tile] / COMMUTE.decayMinutes);
        if (weight <= 0) continue;
        reached.push({ tile, weight });
        total += weight;
      }
      if (total === 0) continue;
      let minutes = 0;
      for (const r of reached) {
        const flow = (o.commuters * r.weight) / total;
        this.load[r.tile] += flow;
        minutes += flow * this.dist[r.tile];
        r.weight = flow;
      }
      // Push flow down the shortest-path tree, from the furthest tiles back to the origin.
      for (let k = order.length - 1; k >= 0; k--) {
        const v = order[k];
        const f = this.load[v];
        if (f === 0) continue;
        fresh[v] += f;
        this.load[v] = 0;
        if (v !== origin) this.load[this.prev[v]] += f;
      }
      const avg = minutes / o.commuters;
      for (const id of o.homes) this.commuteMinutes.set(id, avg);
      commuters += o.commuters;
      minutesSum += minutes;
      reached.sort((a, b) => b.weight - a.weight);
      for (const r of reached.slice(0, COMMUTE.tripsPerOrigin)) {
        if (r.tile === origin) continue;
        trips.push({ path: this.pathTo(origin, r.tile), weight: r.weight });
      }
    }

    // Blend into the running volume, then congestion per road tile.
    let jammed = 0;
    for (let i = 0; i < n; i++) {
      if (w.road[i] === RoadType.None) {
        this.volume[i] = 0;
        this.congestion[i] = 0;
        continue;
      }
      this.volume[i] = this.computed ? this.volume[i] * (1 - COMMUTE.smoothing) + fresh[i] * COMMUTE.smoothing : fresh[i];
      this.congestion[i] = this.volume[i] / this.capacity(i);
      if (this.congestion[i] > 1) jammed++;
    }
    this.computed = true;
    trips.sort((a, b) => b.weight - a.weight);
    this.trips = trips.slice(0, COMMUTE.maxTrips);
    this.report = { commuters: Math.round(commuters), avgMinutes: commuters > 0 ? minutesSum / commuters : 0, jammedTiles: jammed };
  }

  /** Dijkstra from a road tile; returns tiles in the order they were settled. */
  private shortestPaths(origin: number): number[] {
    const w = this.world;
    this.stamp++;
    const order: number[] = [];
    const heap = new Heap(this.dist);
    this.dist[origin] = 0;
    this.prev[origin] = origin;
    this.seen[origin] = this.stamp;
    heap.push(origin);
    const done = new Set<number>();
    while (heap.size > 0) {
      const i = heap.pop();
      if (done.has(i)) continue;
      done.add(i);
      order.push(i);
      const x = i % w.width;
      const y = (i - x) / w.width;
      const m = roadMask(w, x, y);
      for (let k = 0; k < DIRS.length; k++) {
        const [bit, dx, dy] = DIRS[k];
        if (!(m & bit)) continue;
        const j = w.index(x + dx, y + dy);
        // Never against a one-way carriageway (DIRS here is in mask-bit order, like sim/roads.ts).
        if (!stepAllowed(w, i, j, k)) continue;
        const d = this.dist[i] + this.tileMinutes(j);
        if (this.seen[j] === this.stamp && d >= this.dist[j]) continue;
        this.seen[j] = this.stamp;
        this.dist[j] = d;
        this.prev[j] = i;
        heap.push(j);
      }
    }
    return order;
  }

  private pathTo(origin: number, tile: number): Int32Array {
    const out: number[] = [];
    for (let v = tile; v !== origin; v = this.prev[v]) out.push(v);
    out.push(origin);
    return Int32Array.from(out.reverse());
  }
}
