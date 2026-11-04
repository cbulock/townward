import type { SimSystem } from '../core/System';
import { platformOf, railPath } from '../rail';
import type { World } from '../World';

/**
 * Visible trains (docs/specs/evolution.md, E7b): one per busy station pair, shuttling along the
 * track between the two platforms with a short stop at each. A sample for the eye, like the
 * cars (D-059); riders are counted by the commute model.
 */

/** Where the trains come from: riders between station pairs, busiest first (sim/systems/commute.ts). */
export interface RailRiders {
  readonly railTrips: readonly { readonly from: number; readonly to: number; readonly riders: number }[];
}

/** One rail vehicle to draw: a point in world tiles, the direction it faces (0 NE … 3 NW), and its part. */
export interface RailCarPose {
  readonly x: number;
  readonly y: number;
  readonly dir: number;
  readonly part: 'engine' | 'carriage';
}

export const TRAINS = {
  /** At most this many trains on the map. */
  max: 6,
  /** Carriages behind the engine. */
  carriages: 3,
  /** Tiles per sim second. */
  speed: 2.4,
  /** Sim seconds standing at each platform. */
  dwell: 2.5,
} as const;

interface Train {
  readonly key: string;
  readonly path: Int32Array;
  /** Position of the engine along the path, in tiles from the start. */
  s: number;
  /** +1 towards the end, −1 back. */
  heading: 1 | -1;
  dwell: number;
}

export class TrainSystem implements SimSystem {
  readonly name = 'trains';
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

  /** One train per busy pair; trains already running keep their place. */
  refresh() {
    const w = this.world;
    const running = new Map(this.trains.map((t) => [t.key, t]));
    const next: Train[] = [];
    for (const trip of this.riders.railTrips.slice(0, TRAINS.max)) {
      const key = `${trip.from}-${trip.to}`;
      const a = w.buildings.get(trip.from);
      const b = w.buildings.get(trip.to);
      if (!a || !b) continue;
      const path = railPath(w, platformOf(w, a), platformOf(w, b));
      if (!path || path.length < 2) continue;
      const old = running.get(key);
      next.push(old && old.path.length === path.length ? old : { key, path, s: 0, heading: 1, dwell: TRAINS.dwell });
    }
    this.trains = next;
  }

  /** Every frame: run along the track, turning round after a stop at each end. */
  onFrame(dt: number) {
    for (const t of this.trains) {
      if (t.dwell > 0) {
        t.dwell -= dt;
        continue;
      }
      const end = t.path.length - 1;
      t.s += t.heading * TRAINS.speed * dt;
      if (t.s >= end || t.s <= 0) {
        t.s = Math.max(0, Math.min(end, t.s));
        t.heading = t.heading === 1 ? -1 : 1;
        t.dwell = TRAINS.dwell;
      }
    }
  }

  /** The engine and its carriages, trailing behind along the track. */
  poses(): RailCarPose[] {
    const out: RailCarPose[] = [];
    for (const t of this.trains) {
      for (let k = 0; k <= TRAINS.carriages; k++) {
        const s = Math.max(0, Math.min(t.path.length - 1, t.s - t.heading * k));
        out.push({ ...this.pointAt(t, s), part: k === 0 ? 'engine' : 'carriage' });
      }
    }
    return out;
  }

  private pointAt(t: Train, s: number): { x: number; y: number; dir: number } {
    const w = this.world.width;
    const k = Math.min(t.path.length - 2, Math.floor(s));
    const f = s - k;
    const a = t.path[k];
    const b = t.path[k + 1];
    const ax = a % w;
    const ay = (a - ax) / w;
    const bx = b % w;
    const by = (b - bx) / w;
    // Facing along the way the train is going on this step.
    const dx = (bx - ax) * t.heading;
    const dy = (by - ay) * t.heading;
    const dir = dy < 0 ? 0 : dx > 0 ? 1 : dy > 0 ? 2 : 3;
    return { x: ax + (bx - ax) * f + 0.5, y: ay + (by - ay) * f + 0.5, dir };
  }
}
