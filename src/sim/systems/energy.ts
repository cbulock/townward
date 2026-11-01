import { createNoise2D, type Noise2D } from '../../shared/noise';
import { subSeed } from '../../shared/rng';
import { BUILDINGS, buildingDef, type BuildingDef, type BuildingInstance, type EnergySource } from '../buildings/catalog';

/**
 * The power grid (docs/specs/energy.md): what each plant makes this hour, what the city needs
 * this hour, and batteries that move power from surplus hours to short ones. Delivery is per
 * road island, as before (D-052). Wind and sun are pure functions of seed, day and hour, so the
 * grid is deterministic with no extra state; only battery charge is stored (on the building).
 */

/** When the grid is being balanced. Without one (tests, the demo builder: no clock) the peak is assumed. */
export interface GridHour {
  readonly hour: number;
  readonly day: number;
  readonly seed: number;
  /** Move battery charge (true only on the real hourly step). */
  readonly step: boolean;
}

export interface PowerReport {
  /** Output available now (incl. battery discharge) and demand now, over the whole city. */
  supply: number;
  demand: number;
  /** Buildings that need power but don't get it this hour. */
  short: number;
  /** Output now by source; batteries count what they give (negative while charging). */
  sources: Record<EnergySource, number>;
  /** All batteries together. */
  stored: number;
  storage: number;
  /** Number of plants currently waiting for repair. */
  repair: number;
}

/** Demand through the day (fraction of each building's capacity): low at night, evening peak 1. */
const DEMAND_CURVE: readonly (readonly [hour: number, share: number])[] = [
  [0, 0.6],
  [3, 0.55],
  [6, 0.6],
  [8, 0.85],
  [12, 0.8],
  [16, 0.82],
  [18, 1],
  [21, 1],
  [23, 0.7],
  [24, 0.6],
];

export function demandFactor(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  for (let k = 1; k < DEMAND_CURVE.length; k++) {
    const [h1, v1] = DEMAND_CURVE[k];
    if (h <= h1) {
      const [h0, v0] = DEMAND_CURVE[k - 1];
      return v0 + ((h - h0) / (h1 - h0)) * (v1 - v0);
    }
  }
  return DEMAND_CURVE[0][1];
}

/** Sunlight 0..1: a half-sine from 06:00 to 18:00, nothing at night. */
export function sunFactor(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  return h <= 6 || h >= 18 ? 0 : Math.sin((Math.PI * (h - 6)) / 12);
}

const WIND_SALT = 0x317d;
const WIND_MIN = 0.15;
/** Days for the wind to swing from calm to strong and back, roughly. */
const WIND_PERIOD_DAYS = 9;
const windNoise = new Map<number, Noise2D>();

/** Wind strength 0.15..1 on a given day: smooth seeded noise, the same for everyone. */
export function windFactor(seed: number, day: number): number {
  let n = windNoise.get(seed);
  if (!n) {
    n = createNoise2D(subSeed(seed, WIND_SALT));
    windNoise.set(seed, n);
  }
  const v = (n(day / WIND_PERIOD_DAYS, 0.5) + 1) / 2;
  return WIND_MIN + (1 - WIND_MIN) * Math.min(1, Math.max(0, v));
}

/** A plant's output this hour (batteries make nothing; see balancePower). */
export function plantOutput(def: BuildingDef, at: GridHour | null): number {
  const peak = def.supplies?.power ?? 0;
  const source = def.energy?.source;
  if (!at || source === undefined) return peak;
  if (source === 'wind') return Math.round(peak * windFactor(at.seed, at.day));
  if (source === 'solar') return Math.round(peak * sunFactor(at.hour));
  return source === 'battery' ? 0 : peak;
}

/** Output from a particular plant, including its current maintenance condition. */
export function buildingOutput(b: BuildingInstance, at: GridHour | null): number {
  const d: BuildingDef = buildingDef(b.def);
  if (!d.energy || d.energy.source === 'battery' || b.repairDays > 0) return 0;
  return Math.round(plantOutput(d, at) * Math.max(0, Math.min(1, b.condition)));
}

/** A building's power need this hour (the peak, without an hour). */
export function powerNeed(def: BuildingDef, at: GridHour | null): number {
  return at ? def.capacity * demandFactor(at.hour) : def.capacity;
}

function emptySources(): Record<EnergySource, number> {
  return { coal: 0, gas: 0, wind: 0, solar: 0, battery: 0 };
}

/**
 * Balance every island for one hour and set `powered` on the buildings that need power.
 * `buildings` is in id order; `islandOf` gives a building's road island (−1 = none);
 * `needs` says which buildings draw power. Working plants and batteries are given by `isWorking`.
 */
export function balancePower(
  buildings: readonly BuildingInstance[],
  islandOf: (b: BuildingInstance) => number,
  needs: (b: BuildingInstance) => boolean,
  isWorking: (b: BuildingInstance) => boolean,
  at: GridHour | null,
  powerConnected: (b: BuildingInstance) => boolean = () => true,
): PowerReport {
  const report: PowerReport = { supply: 0, demand: 0, short: 0, sources: emptySources(), stored: 0, storage: 0, repair: 0 };
  const production = new Map<number, number>();
  const demand = new Map<number, number>();
  const batteries = new Map<number, BuildingInstance[]>();

  for (const b of buildings) {
    const d: BuildingDef = BUILDINGS[b.def];
    if (d.energy && d.energy.source !== 'battery' && b.repairDays > 0) report.repair++;
    if (d.energy && isWorking(b) && powerConnected(b)) {
      const island = islandOf(b);
      if (d.energy.source === 'battery') {
        const list = batteries.get(island) ?? [];
        list.push(b);
        batteries.set(island, list);
        report.storage += d.energy.storage ?? 0;
      } else {
        const out = buildingOutput(b, at);
        production.set(island, (production.get(island) ?? 0) + out);
        report.sources[d.energy.source] += out;
      }
    }
    if (needs(b)) {
      const island = islandOf(b);
      demand.set(island, (demand.get(island) ?? 0) + powerNeed(d, at));
    }
  }

  // Batteries cover shortfalls and soak up surplus. Off the hourly step they only report what they could give.
  const available = new Map<number, number>();
  for (const [island, made] of production) available.set(island, made);
  for (const [island, list] of batteries) {
    let balance = (production.get(island) ?? 0) - (demand.get(island) ?? 0);
    let given = 0;
    for (const b of list) {
      const e = buildingDef(b.def).energy;
      const rate = e?.rate ?? 0;
      const storage = e?.storage ?? 0;
      if (balance < 0) {
        const give = Math.min(rate, b.stored, -balance);
        given += give;
        balance += give;
        if (at?.step) b.stored -= give;
      } else if (at?.step) {
        const take = Math.min(rate, storage - b.stored, balance);
        b.stored += take;
        balance -= take;
        report.sources.battery -= take;
      }
      report.stored += b.stored;
    }
    report.sources.battery += given;
    available.set(island, (available.get(island) ?? 0) + given);
  }

  // Hand the power out in building order.
  for (const b of buildings) {
    if (!needs(b)) {
      b.powered = true;
      continue;
    }
    const need = powerNeed(buildingDef(b.def), at);
    report.demand += need;
    const island = islandOf(b);
    const left = available.get(island) ?? 0;
    if (island !== -1 && powerConnected(b) && left >= need) {
      available.set(island, left - need);
      b.powered = true;
    } else {
      b.powered = false;
      report.short++;
    }
  }
  for (const [island, made] of production) report.supply += island === -1 ? 0 : made;
  report.supply += Math.max(0, report.sources.battery);
  report.demand = Math.round(report.demand);
  return report;
}
