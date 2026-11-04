import type { SimSystem } from '../core/System';
import { platformOf, pointOnTrack, railPath } from '../rail';
import { RoadType } from '../roads';
import type { World } from '../World';

/**
 * Trains (docs/specs/evolution.md, E7b): the track's stations are joined into **lines**, and
 * each line runs trains end to end, stopping at every station. Track is double: each direction
 * keeps to its own side, so trains going opposite ways pass beside each other. Trains speed up
 * out of a station, brake to a stop at the next platform, wait, and turn round at the ends, and
 * a train never closes on the one ahead going its way (a moving block, like signals).
 * A visual sample: riders are counted by the commute model.
 */

/** Riders between station pairs, busiest first (sim/systems/commute.ts). */
export interface RailRiders {
  readonly railTrips: readonly { readonly from: number; readonly to: number; readonly riders: number }[];
}

/** One rail vehicle to draw: a point in world tiles, its facing (0 NE … 3 NW), its part. */
export interface RailCarPose {
  readonly x: number;
  readonly y: number;
  readonly dir: number;
  readonly part: 'engine' | 'carriage';
  /** On an overpass deck over a road: drawn raised, above the deck. */
  readonly raised: boolean;
}

export const TRAINS = {
  /** Carriages behind the engine; a train is this + 1 tiles long. */
  carriages: 3,
  /** Top speed (tiles a sim second), acceleration and braking (tiles a second²). */
  maxSpeed: 3.2,
  accel: 1.6,
  brake: 2.2,
  /** Sim seconds standing at a platform. */
  dwell: 3,
  /** Gap kept behind the train ahead going the same way (tiles, nose to tail). */
  headway: 3,
  /** Each direction's track sits this far either side of the centre line (tiles). */
  lane: 0.11,
  /** Trains per line: one per this many riders a day, between min and max. */
  ridersPerTrain: 250,
  minPerLine: 1,
  maxPerLine: 4,
} as const;

/** A line: a run of track and the stations along it, in order. */
export interface RailLine {
  readonly path: Int32Array;
  /** Positions of the stops along the path (tile index), ascending, with their station ids. */
  readonly stops: readonly { readonly at: number; readonly station: number }[];
}

interface Train {
  readonly line: number;
  /** Position of the engine's nose along the line, in tiles. */
  s: number;
  heading: 1 | -1;
  speed: number;
  dwell: number;
  /** Standing at a terminus, waiting to change ends onto the other track. */
  turning: boolean;
  /** Each car's last facing, kept on 45° stretches so sprites don't flicker. */
  dirs: number[];
}

/**
 * Lines over the track: for each connected stretch with stations, the longest station-to-station
 * run is the main line; every station not on it gets a branch line to the nearest station that is.
 */
export function railLines(world: World): RailLine[] {
  const stations = [...world.buildings.values()]
    .filter((b) => b.def === 'train_station' && b.construction === 0)
    .map((b) => ({ id: b.id, platform: platformOf(world, b) }))
    .filter((s) => s.platform !== -1);
  const lines: RailLine[] = [];
  const served = new Set<number>();
  const stopsOn = (path: Int32Array) => {
    const at = new Map<number, number>();
    path.forEach((tile, k) => at.set(tile, k));
    return stations
      .filter((s) => at.has(s.platform))
      .map((s) => ({ at: at.get(s.platform) ?? 0, station: s.id }))
      .sort((a, b) => a.at - b.at);
  };
  // Main lines: repeatedly take the longest run between two stations not yet served.
  for (;;) {
    let best: Int32Array | null = null;
    for (let a = 0; a < stations.length; a++) {
      if (served.has(stations[a].id)) continue;
      for (let b = a + 1; b < stations.length; b++) {
        if (served.has(stations[b].id)) continue;
        const path = railPath(world, stations[a].platform, stations[b].platform);
        if (path && (!best || path.length > best.length)) best = path;
      }
    }
    if (!best) break;
    const stops = stopsOn(best);
    for (const s of stops) served.add(s.station);
    lines.push({ path: best, stops });
  }
  // Branches: a station left over joins the nearest served station on its track.
  for (const s of stations) {
    if (served.has(s.id)) continue;
    let best: Int32Array | null = null;
    for (const t of stations) {
      if (!served.has(t.id)) continue;
      const path = railPath(world, s.platform, t.platform);
      if (path && (!best || path.length < best.length)) best = path;
    }
    if (!best) continue;
    lines.push({ path: best, stops: stopsOn(best) });
    served.add(s.id);
  }
  return lines;
}

export class TrainSystem implements SimSystem {
  readonly name = 'trains';
  lines: RailLine[] = [];
  private trains: Train[] = [];
  private readonly world: World;
  private readonly riders: RailRiders;

  constructor(world: World, riders: RailRiders) {
    this.world = world;
    this.riders = riders;
  }

  onWorldChanged() {
    this.refresh();
  }

  onDay() {
    this.refresh();
  }

  /** Trains per line, by its riders. */
  trainsFor(line: RailLine): number {
    const ids = new Set(line.stops.map((s) => s.station));
    let riders = 0;
    for (const t of this.riders.railTrips) if (ids.has(t.from) && ids.has(t.to)) riders += t.riders;
    return Math.max(TRAINS.minPerLine, Math.min(TRAINS.maxPerLine, Math.ceil(riders / TRAINS.ridersPerTrain)));
  }

  /** Rebuild the lines; keep trains running where their line is unchanged, spread new ones out. */
  refresh() {
    const old = this.lines;
    const lines = railLines(this.world);
    const same = (a: RailLine, b: RailLine) => a.path.length === b.path.length && a.path[0] === b.path[0] && a.path[a.path.length - 1] === b.path[b.path.length - 1];
    const next: Train[] = [];
    lines.forEach((line, li) => {
      if (line.stops.length < 2) return;
      const want = this.trainsFor(line);
      const prevIndex = old.findIndex((l) => same(l, line));
      const kept = prevIndex === -1 ? [] : this.trains.filter((t) => t.line === prevIndex).slice(0, want);
      for (const t of kept) next.push({ ...t, line: li });
      // New trains start at stops spread along the line, alternating directions.
      const end = line.path.length - 1;
      for (let k = kept.length; k < want; k++) {
        const stop = line.stops[Math.floor((k * line.stops.length) / want) % line.stops.length];
        const heading: 1 | -1 = k % 2 === 0 ? 1 : -1;
        // The whole train on the track: its nose at the platform, its tail behind it.
        const s = heading === 1 ? Math.max(stop.at, TRAINS.carriages) : Math.min(stop.at, end - TRAINS.carriages);
        next.push({ line: li, s, heading, speed: 0, dwell: TRAINS.dwell, turning: false, dirs: [] });
      }
    });
    this.lines = lines;
    this.trains = next;
  }

  /** Every frame: accelerate, brake for the next stop and for the train ahead, wait, turn round. */
  onFrame(dt: number) {
    const length = TRAINS.carriages; // nose to tail, in tiles
    for (const t of this.trains) {
      const line = this.lines[t.line];
      const end = line.path.length - 1;
      if (t.dwell > 0) {
        t.dwell -= dt;
        if (t.dwell > 0 || !t.turning) continue;
        // At a terminus: change ends onto the other track only when it's clear ahead (signals).
        const heading: 1 | -1 = t.heading === 1 ? -1 : 1;
        const nose = t.s - t.heading * length;
        const blocked = this.trains.some((o) => {
          if (o === t || o.line !== t.line || o.heading !== heading) return false;
          const ahead = (o.s - nose) * heading;
          return ahead > 0 && ahead - length - TRAINS.headway < 0;
        });
        if (blocked) {
          t.dwell = 0.5;
          continue;
        }
        t.s = nose;
        t.heading = heading;
        t.turning = false;
        continue;
      }
      // Where it must stop: the next platform ahead, or the line's end.
      const ahead = t.heading === 1 ? line.stops.find((p) => p.at > t.s + 0.01) : [...line.stops].reverse().find((p) => p.at < t.s - 0.01);
      const target = ahead ? ahead.at : t.heading === 1 ? end : 0;
      const toStop = Math.abs(target - t.s);
      // Signals: never closer than the headway behind the tail of a train ahead on this track.
      let room = toStop;
      for (const o of this.trains) {
        if (o === t || o.line !== t.line || o.heading !== t.heading) continue;
        const nose = (o.s - t.s) * t.heading;
        if (nose > 0) room = Math.min(room, Math.max(0, nose - length - TRAINS.headway));
      }
      // Speed up to the top speed, never faster than it can stop in the room left.
      t.speed = Math.min(TRAINS.maxSpeed, t.speed + TRAINS.accel * dt, Math.sqrt(2 * TRAINS.brake * room));
      const step = Math.min(t.speed * dt, room);
      t.s += t.heading * step;
      if (room === toStop && toStop - step < 0.02) {
        // At the platform: stop and wait.
        t.s = target;
        t.speed = 0;
        t.dwell = TRAINS.dwell;
        // At the line's end it changes ends once the other track is clear (see above).
        if (target === 0 || target === end) t.turning = true;
      } else if (step >= room) {
        // Held at a signal behind the train ahead.
        t.speed = 0;
      }
    }
  }

  /** Engine and carriages, trailing along their side of the double track (round bends, on diagonals). */
  poses(): RailCarPose[] {
    const w = this.world;
    const out: RailCarPose[] = [];
    for (const t of this.trains) {
      const line = this.lines[t.line];
      const last = line.path.length - 1;
      for (let k = 0; k <= TRAINS.carriages; k++) {
        const s = Math.max(0, Math.min(last, t.s - t.heading * k));
        const p = pointOnTrack(w, line.path, s);
        const tx = p.tx * t.heading;
        const ty = p.ty * t.heading;
        // Each direction on its own track: to the right of the way it's going.
        const x = p.x - ty * TRAINS.lane;
        const y = p.y + tx * TRAINS.lane;
        const prev = t.dirs[k];
        const diagonal = Math.abs(Math.abs(tx) - Math.abs(ty)) < 0.15;
        const dir = diagonal && prev !== undefined ? prev : Math.abs(tx) >= Math.abs(ty) ? (tx > 0 ? 1 : 3) : ty > 0 ? 2 : 0;
        t.dirs[k] = dir;
        const tile = w.index(Math.floor(p.x), Math.floor(p.y));
        // Push-pull: a driving cab at both ends, so it simply changes ends at a terminus.
        out.push({ x, y, dir, part: k === 0 || k === TRAINS.carriages ? 'engine' : 'carriage', raised: w.road[tile] !== RoadType.None });
      }
    }
    return out;
  }

  /** For a station's info panel: the lines it's on, their stops, and trains on each. */
  linesAt(station: number): { stops: number[]; trains: number }[] {
    return this.lines
      .map((line, li) => ({ line, li }))
      .filter(({ line }) => line.stops.some((s) => s.station === station))
      .map(({ line, li }) => ({ stops: line.stops.map((s) => s.station), trains: this.trains.filter((t) => t.line === li).length }));
  }
}
