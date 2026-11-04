import { BALANCE } from '../../shared/balance';
import { BUILDINGS, buildingDef } from '../buildings/catalog';
import type { SimSystem, WorldChange } from '../core/System';
import { nodeEntering, nodeMayLeave, nodeRoad, roadMask, RoadType, stepAllowed } from '../roads';
import type { World } from '../World';
import { isActive } from './access';
import { hasUtilities } from './utilities';
import { roadSpec } from '../roadTypes';
import { RAIL, railNetwork, servingStation } from '../rail';

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
  /** Share of drives that go by bus from homes near a bus station. */
  busShare: 0.15,
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
  /** Commuters a day who take the train instead of driving (docs/specs/evolution.md, E7b). */
  trainRiders: number;
  /** Commuters a day who take the bus from a bus station instead of driving. */
  busRiders: number;
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

/**
 * Binary min-heap of tile indices keyed by a distance array, on a reused typed buffer (lazy
 * deletion: a tile may be pushed more than once; stale entries are skipped when popped).
 */
class Heap {
  private items = new Int32Array(64);
  size = 0;
  private readonly key: Float64Array;
  constructor(key: Float64Array) {
    this.key = key;
  }
  clear() {
    this.size = 0;
  }
  push(i: number) {
    if (this.size === this.items.length) {
      const grown = new Int32Array(this.items.length * 2);
      grown.set(this.items);
      this.items = grown;
    }
    const a = this.items;
    const key = this.key;
    let k = this.size++;
    a[k] = i;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (key[a[p]] <= key[a[k]]) break;
      const t = a[p];
      a[p] = a[k];
      a[k] = t;
      k = p;
    }
  }
  pop(): number {
    const a = this.items;
    const key = this.key;
    const top = a[0];
    const last = a[--this.size];
    if (this.size > 0) {
      a[0] = last;
      let k = 0;
      const n = this.size;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < n && key[a[l]] < key[a[m]]) m = l;
        if (r < n && key[a[r]] < key[a[m]]) m = r;
        if (m === k) break;
        const t = a[m];
        a[m] = a[k];
        a[k] = t;
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
  /** The same for flyover decks (docs/specs/transport.md, TX2), per tile. */
  readonly deckVolume: Float32Array;
  readonly deckCongestion: Float32Array;
  /** Average commute (minutes) per home building id. */
  readonly commuteMinutes = new Map<number, number>();
  trips: CommuteTrip[] = [];
  report: CommuteReport = { commuters: 0, trainRiders: 0, busRiders: 0, avgMinutes: 0, jammedTiles: 0 };
  /** Bus riders a day from each bus station (building id). */
  readonly busStationRiders = new Map<number, number>();
  /** Train riders a day boarding or leaving at each station (building id). */
  readonly stationRiders = new Map<number, number>();
  /** Riders a day between pairs of stations (building ids), busiest first, for the visible trains. */
  railTrips: { from: number; to: number; riders: number }[] = [];
  private computed = false;
  // Dijkstra scratch, reused between origins.
  private readonly dist: Float64Array;
  private readonly prev: Int32Array;
  private readonly seen: Int32Array;
  private readonly done: Int32Array;
  private readonly load: Float64Array;
  private readonly heap: Heap;
  private order = new Int32Array(64);
  private stamp = 0;
  /**
   * Today's road graph, built once per compute (docs/specs/engine.md, 11.5): for each tile, the
   * neighbours traffic may step to (CSR: `next[first[i]] … next[first[i + 1] − 1]`, in the same
   * direction order as roadMask), and the minutes to enter each tile at today's congestion.
   * Rebuilding it per Dijkstra pop (roadMask, one-way rules, the road table) was most of the cost.
   */
  private readonly first: Int32Array;
  private next = new Int32Array(0);
  private readonly enter: Float64Array;

  private readonly world: World;

  constructor(world: World) {
    this.world = world;
    const n = world.width * world.height;
    // Route-graph nodes: one per tile, plus one per tile for flyover decks (n + tile).
    const nodes = 2 * n;
    this.volume = new Float32Array(n);
    this.congestion = new Float32Array(n);
    this.deckVolume = new Float32Array(n);
    this.deckCongestion = new Float32Array(n);
    this.dist = new Float64Array(nodes);
    this.prev = new Int32Array(nodes);
    this.seen = new Int32Array(nodes);
    this.done = new Int32Array(nodes);
    this.load = new Float64Array(nodes);
    this.heap = new Heap(this.dist);
    this.first = new Int32Array(nodes + 1);
    this.enter = new Float64Array(nodes);
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

  /** Free-flow minutes to cross a route-graph node (a tile, or a flyover deck), slowed by its congestion. */
  private tileMinutes(node: number): number {
    const n = this.world.width * this.world.height;
    const base = roadSpec(nodeRoad(this.world, node))?.minutes ?? COMMUTE.roadMinutes;
    return base / speedFactor(node >= n ? this.deckCongestion[node - n] : this.congestion[node]);
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

    this.buildGraph();
    // Jobs as flat arrays (walked once per origin), and scratch for the jobs each origin reaches.
    const jobTile = Int32Array.from(jobs.keys());
    const jobWorkers = Float64Array.from(jobs.values());
    const reachTile = new Int32Array(jobTile.length);
    const reachFlow = new Float64Array(jobTile.length);
    const reachMinutes = new Float64Array(jobTile.length);
    /** −1 drive; otherwise the job's station index (the trip goes by train). */
    const reachRail = new Int32Array(jobTile.length);
    // The train option (sim/rail.ts): stations, track minutes between them, and who each serves.
    const net = railNetwork(w);
    const hasRail = net.stations.length >= 2;
    const ns = net.stations.length;
    const jobStation = new Int32Array(jobTile.length).fill(-1);
    const jobWalk = new Float64Array(jobTile.length);
    if (hasRail) {
      for (let k = 0; k < jobTile.length; k++) {
        const s = servingStation(net, w, jobTile[k]);
        if (s) {
          jobStation[k] = s.station;
          jobWalk[k] = s.walk;
        }
      }
    }
    const riders = new Float64Array(ns * ns);
    let trainRiders = 0;
    // Bus stations: homes in reach send a share of their drives by bus.
    const busStations: { id: number; x: number; y: number; reach: number }[] = [];
    for (const b of w.buildings.values()) {
      const bus = buildingDef(b.def).busStation;
      if (!bus || !isActive(b)) continue;
      const { w: bw, h: bh } = BUILDINGS[b.def].size;
      busStations.push({ id: b.id, x: b.x + bw / 2, y: b.y + bh / 2, reach: bus.reach });
    }
    this.busStationRiders.clear();
    let busRiders = 0;
    const picked = new Uint8Array(jobTile.length);
    const fresh = new Float64Array(2 * n);
    const trips: CommuteTrip[] = [];
    let commuters = 0;
    let minutesSum = 0;
    this.commuteMinutes.clear();
    const { dist, seen, load, prev } = this;
    for (const [origin, o] of origins) {
      const settled = this.shortestPaths(origin);
      const order = this.order;
      const stamp = this.stamp;
      const home = hasRail ? servingStation(net, w, origin) : null;
      // The nearest bus station in reach, if any: a share of this group's drives go by bus.
      const ox = (origin % w.width) + 0.5;
      const oy = Math.floor(origin / w.width) + 0.5;
      let busStop: (typeof busStations)[number] | null = null;
      for (const b of busStations) {
        const d = Math.hypot(b.x - ox, b.y - oy);
        if (d <= b.reach && (!busStop || d < Math.hypot(busStop.x - ox, busStop.y - oy))) busStop = b;
      }
      const busShare = busStop ? COMMUTE.busShare : 0;
      // Spread this group's commuters over reachable jobs: big and near ones attract most, by
      // the faster of driving and (where both ends are near stations on one line) the train.
      let total = 0;
      let reached = 0;
      for (let k = 0; k < jobTile.length; k++) {
        const tile = jobTile[k];
        const drive = seen[tile] === stamp ? dist[tile] : Infinity;
        let train = Infinity;
        const js = jobStation[k];
        if (home && js !== -1 && js !== home.station) {
          const ride = net.minutes[home.station * ns + js];
          if (ride !== Infinity) train = home.walk + RAIL.waitMinutes + ride + jobWalk[k];
        }
        const best = Math.min(drive, train);
        if (best === Infinity) continue;
        const weight = jobWorkers[k] * Math.exp(-best / COMMUTE.decayMinutes);
        if (weight <= 0) continue;
        reachTile[reached] = tile;
        reachMinutes[reached] = best;
        reachRail[reached] = train < drive ? js : -1;
        reachFlow[reached++] = weight;
        total += weight;
      }
      if (total === 0) continue;
      let minutes = 0;
      for (let r = 0; r < reached; r++) {
        const flow = (o.commuters * reachFlow[r]) / total;
        // Train trips put nothing on the roads; they count as riders between the two stations.
        if (reachRail[r] === -1) {
          load[reachTile[r]] += flow * (1 - busShare);
          if (busStop) {
            busRiders += flow * busShare;
            this.busStationRiders.set(busStop.id, (this.busStationRiders.get(busStop.id) ?? 0) + flow * busShare);
          }
        }
        else if (home) {
          riders[home.station * ns + reachRail[r]] += flow;
          trainRiders += flow;
        }
        minutes += flow * reachMinutes[r];
        reachFlow[r] = flow;
      }
      // Push flow down the shortest-path tree, from the furthest tiles back to the origin.
      for (let k = settled - 1; k >= 0; k--) {
        const v = order[k];
        const f = load[v];
        if (f === 0) continue;
        fresh[v] += f;
        load[v] = 0;
        if (v !== origin) load[prev[v]] += f;
      }
      const avg = minutes / o.commuters;
      for (const id of o.homes) this.commuteMinutes.set(id, avg);
      commuters += o.commuters;
      minutesSum += minutes;
      // The biggest destinations become trips for the visible cars: the top few by flow, ties in
      // reach order (what a stable descending sort would give, without sorting them all).
      // Visible cars only drive the trips that go by road.
      for (let r = 0; r < reached; r++) picked[r] = reachRail[r] === -1 ? 0 : 1;
      for (let t = 0; t < Math.min(COMMUTE.tripsPerOrigin, reached); t++) {
        let best = -1;
        for (let r = 0; r < reached; r++) if (!picked[r] && (best === -1 || reachFlow[r] > reachFlow[best])) best = r;
        if (best === -1) break;
        picked[best] = 1;
        if (reachTile[best] === origin) continue;
        trips.push({ path: this.pathTo(origin, reachTile[best]), weight: reachFlow[best] });
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
    // Flyover decks keep their own traffic (TX2).
    for (let i = 0; i < n; i++) {
      if (w.over[i] === 0) {
        this.deckVolume[i] = 0;
        this.deckCongestion[i] = 0;
        continue;
      }
      this.deckVolume[i] = this.computed ? this.deckVolume[i] * (1 - COMMUTE.smoothing) + fresh[n + i] * COMMUTE.smoothing : fresh[n + i];
      this.deckCongestion[i] = this.deckVolume[i] / (roadSpec(w.over[i])?.capacity ?? COMMUTE.roadCapacity);
    }
    this.computed = true;
    trips.sort((a, b) => b.weight - a.weight);
    this.trips = trips.slice(0, COMMUTE.maxTrips);
    // Riders per station and per station pair (both directions together), busiest pairs first.
    this.stationRiders.clear();
    const pairs: { from: number; to: number; riders: number }[] = [];
    for (let a = 0; a < ns; a++) {
      for (let b = a + 1; b < ns; b++) {
        const r = riders[a * ns + b] + riders[b * ns + a];
        if (r <= 0) continue;
        const from = net.stations[a].id;
        const to = net.stations[b].id;
        this.stationRiders.set(from, (this.stationRiders.get(from) ?? 0) + r);
        this.stationRiders.set(to, (this.stationRiders.get(to) ?? 0) + r);
        pairs.push({ from, to, riders: r });
      }
    }
    this.railTrips = pairs.sort((a, b) => b.riders - a.riders);
    this.report = { commuters: Math.round(commuters), trainRiders: Math.round(trainRiders), busRiders: Math.round(busRiders), avgMinutes: commuters > 0 ? minutesSum / commuters : 0, jammedTiles: jammed };
  }

  /** Today's adjacency and entry minutes (see `first`, `next`, `enter`). */
  private buildGraph() {
    const w = this.world;
    const n = w.width * w.height;
    const nodes = 2 * n;
    let edges = 0;
    const scratch: number[] = [];
    for (let u = 0; u < nodes; u++) {
      this.first[u] = edges;
      const i = u < n ? u : u - n;
      // A deck node exists only on flyover tiles.
      if (u < n ? w.road[i] === RoadType.None : w.over[i] === 0) continue;
      this.enter[u] = this.tileMinutes(u);
      const x = i % w.width;
      const y = (i - x) / w.width;
      const m = roadMask(w, x, y);
      for (let k = 0; k < DIRS.length; k++) {
        const [bit, dx, dy] = DIRS[k];
        if (!(m & bit)) continue;
        // On a flyover each level only goes straight through, along its own axis.
        if (!nodeMayLeave(w, u, k)) continue;
        const j = w.index(x + dx, y + dy);
        // Never against a one-way carriageway (DIRS here is in mask-bit order, like sim/roads.ts).
        if (!stepAllowed(w, i, j, k)) continue;
        scratch.push(nodeEntering(w, j, k));
        edges++;
      }
    }
    this.first[nodes] = edges;
    if (this.next.length < edges) this.next = new Int32Array(edges);
    this.next.set(scratch);
    if (this.order.length < nodes) this.order = new Int32Array(nodes);
  }

  /** Dijkstra from a road tile over today's graph; fills `order` with tiles as they settle and returns how many. */
  private shortestPaths(origin: number): number {
    const { dist, prev, seen, done, first, next, enter, heap, order } = this;
    const stamp = ++this.stamp;
    let settled = 0;
    heap.clear();
    dist[origin] = 0;
    prev[origin] = origin;
    seen[origin] = stamp;
    heap.push(origin);
    while (heap.size > 0) {
      const i = heap.pop();
      if (done[i] === stamp) continue;
      done[i] = stamp;
      order[settled++] = i;
      const di = dist[i];
      for (let e = first[i], end = first[i + 1]; e < end; e++) {
        const j = next[e];
        const d = di + enter[j];
        if (seen[j] === stamp && d >= dist[j]) continue;
        seen[j] = stamp;
        dist[j] = d;
        prev[j] = i;
        heap.push(j);
      }
    }
    return settled;
  }

  /** The route to `tile` as tiles (a flyover deck node maps back to its tile). */
  private pathTo(origin: number, tile: number): Int32Array {
    const n = this.world.width * this.world.height;
    const out: number[] = [];
    for (let v = tile; v !== origin; v = this.prev[v]) out.push(v >= n ? v - n : v);
    out.push(origin);
    return Int32Array.from(out.reverse());
  }
}
