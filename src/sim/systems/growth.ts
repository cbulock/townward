import { BALANCE } from '../../shared/balance';
import {
  ART_VARIANTS,
  BUILDINGS,
  SERVICE_KINDS,
  startLevel,
  zonedBuildings,
  type BuildingDef,
  type BuildingId,
  type BuildingInstance,
} from '../buildings/catalog';
import { findEntrance } from './access';
import { cityStats } from './population';
import { hasUtilities } from './utilities';
import { serviceScore } from './coverage';
import { Decor } from '../terrain/types';
import { isFlat } from '../terrain/elevation';
import type { World } from '../World';
import { isZoned, ZONE_DENSITY, ZONE_LETTER, ZONED_TYPES, zoneOf, type ZonedType } from '../zones';
import type { City } from '../City';
import type { DayOutcome, SimSystem } from '../core/System';

/**
 * Zoned growth: demand, new lots, construction and levelling up. Runs once per in-game day.
 * See docs/specs/buildings.md, "Growth".
 */

type Rng = () => number;

/** Demand per zone in [−1, 1]. Positive means the city wants more of it. */
export interface ZoneDemand {
  readonly r: number;
  readonly c: number;
  readonly i: number;
}

/** A rectangle of world tiles. */
export interface TileArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GrowthResult {
  /** Areas whose buildings changed today (for render refresh). */
  readonly changed: readonly TileArea[];
  /** Ids of construction sites started today (new lots and upgrades). */
  readonly started: readonly number[];
  /** Ids of buildings that finished construction today. */
  readonly completed: readonly number[];
}

const DEMAND_FLOOR = { r: 50, c: 20, i: 20 } as const;

function ratio(want: number, have: number, floor: number): number {
  return Math.max(-1, Math.min(1, (want - have) / Math.max(want, floor)));
}

/**
 * Homes need jobs and jobs follow homes. Supply counts every building, including sites
 * under construction, so demand drops as soon as a lot starts and growth doesn't overshoot.
 */
/** Higher taxes than the base rate cool demand, lower ones warm it (docs/specs/core.md). */
export function zoneDemand(world: World, taxRate: number = BALANCE.baseTaxRate): ZoneDemand {
  let housing = 0;
  let commercial = 0;
  let industrial = 0;
  let civic = 0;
  for (const b of world.buildings.values()) {
    const d = BUILDINGS[b.def];
    if (d.category === 'residential') housing += d.capacity;
    else if (d.category === 'commercial') commercial += d.capacity;
    else if (d.category === 'industrial') industrial += d.capacity;
    else civic += d.capacity;
  }
  const workforce = housing * BALANCE.workforceShare;
  const wantC = workforce * BALANCE.commercialJobShare + BALANCE.seedCommercialJobs;
  const wantI = workforce * (1 - BALANCE.commercialJobShare) + BALANCE.seedIndustrialJobs;
  const jobs = commercial + industrial + civic;
  const wantR = (jobs / BALANCE.workforceShare) * BALANCE.housingSlack + BALANCE.seedHousing;
  const tax = (taxRate - BALANCE.baseTaxRate) * BALANCE.taxDemandStep;
  const adjust = (d: number) => Math.max(-1, Math.min(1, d - tax));
  return {
    r: adjust(ratio(wantR, housing, DEMAND_FLOOR.r)),
    c: adjust(ratio(wantC, commercial, DEMAND_FLOOR.c)),
    i: adjust(ratio(wantI, industrial, DEMAND_FLOOR.i)),
  };
}

export function demandFor(demand: ZoneDemand, zone: ZonedType): number {
  const letter = ZONE_LETTER[zone];
  return letter === 'R' ? demand.r : letter === 'C' ? demand.c : demand.i;
}

/** 0 = foundation, 1 = scaffold. Only meaningful while `construction > 0`. */
export function constructionStage(b: BuildingInstance): 0 | 1 {
  return b.construction > BALANCE.constructionDays / 2 ? 0 : 1;
}

/** Up to `n` items in random order (partial Fisher–Yates; shuffles `items` in place). */
function sample<T>(items: T[], n: number, rng: Rng): T[] {
  const k = Math.min(n, items.length);
  for (let a = 0; a < k; a++) {
    const b = a + Math.floor(rng() * (items.length - a));
    [items[a], items[b]] = [items[b], items[a]];
  }
  return items.slice(0, k);
}

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

function areaOf(b: BuildingInstance): TileArea {
  const { w, h } = BUILDINGS[b.def].size;
  return { x: b.x, y: b.y, w, h };
}

/** One day of growth. Mutates the world; the caller refreshes rendering and road access. */
export function growDay(world: World, rng: Rng, taxRate: number = BALANCE.baseTaxRate): GrowthResult {
  const changed: TileArea[] = [];
  const started: number[] = [];
  const completed: number[] = [];

  // 1. Construction counts down; the scaffold appears halfway.
  for (const b of world.buildings.values()) {
    if (b.construction > 0) {
      b.construction--;
      if (b.construction === 0) completed.push(b.id);
      if (b.construction === 0 || b.construction === Math.floor(BALANCE.constructionDays / 2)) changed.push(areaOf(b));
    } else if (b.grown) {
      const cap = BUILDINGS[b.def].capacity;
      b.fullDays = cap > 0 && b.occupants >= cap * BALANCE.upgradeOccupancy ? b.fullDays + 1 : 0;
    }
  }

  const demand = zoneDemand(world, taxRate);
  const build = (def: BuildingId, x: number, y: number, occupants = 0) => {
    const { w, h } = BUILDINGS[def].size;
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) {
        const i = world.index(tx, ty);
        world.tree[i] = 0;
        world.decor[i] = Decor.None;
      }
    }
    const capacity: number = BUILDINGS[def].capacity;
    const b = world.addBuilding(
      {
        def,
        x,
        y,
        variant: Math.floor(rng() * ART_VARIANTS),
        grown: true,
        construction: BALANCE.constructionDays,
        occupants: Math.min(capacity, occupants),
      },
      w,
      h,
    );
    started.push(b.id);
    changed.push(areaOf(b));
  };

  // 2. New lots on empty zoned tiles with road access, at their density's first level.
  const empty = new Map<ZonedType, { x: number; y: number }[]>(ZONED_TYPES.map((z) => [z, []]));
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const i = world.index(x, y);
      const z = world.zone[i];
      if (!isZoned(z) || world.building[i] !== -1) continue;
      if (findEntrance(world, x, y, 1, 1, BALANCE.roadAccessRange) === -1) continue;
      empty.get(z)?.push({ x, y });
    }
  }
  for (const z of ZONED_TYPES) {
    const d = demandFor(demand, z);
    if (d <= 0) continue;
    const ids = zonedBuildings(ZONE_LETTER[z], ZONE_DENSITY[z], startLevel(ZONE_LETTER[z], ZONE_DENSITY[z]), 1);
    if (ids.length === 0) continue;
    for (const t of sample(empty.get(z) ?? [], Math.ceil(d * BALANCE.growthPerDay), rng)) build(pick(ids, rng), t.x, t.y);
  }

  // 3. Thriving grown buildings level up, in place or by merging a 2×2 block.
  const population = cityStats(world).population;
  const candidates = new Map<ZonedType, BuildingInstance[]>(ZONED_TYPES.map((z) => [z, []]));
  for (const b of world.buildings.values()) {
    const def: BuildingDef = BUILDINGS[b.def];
    if (!b.grown || b.abandoned || b.construction > 0 || b.entrance === -1 || def.zone === null || def.density === null || def.level >= 3) continue;
    if (b.fullDays < BALANCE.upgradeAfterDays || population < BALANCE.levelPopulation[def.level + 1]) continue;
    // Level 2 needs at least one service nearby and some happiness; level 3 needs all four
    // services and happy residents (and power and water).
    const toLevel3 = def.level + 1 >= 3;
    if (!hasUtilities(b) || serviceScore(b) < (toLevel3 ? SERVICE_KINDS.length : 1)) continue;
    if (b.happiness < (toLevel3 ? BALANCE.happyLevel3 : BALANCE.happyLevel2)) continue;
    candidates.get(zoneOf(def.zone, def.density))?.push(b);
  }
  for (const z of ZONED_TYPES) {
    const d = demandFor(demand, z);
    if (d <= 0) continue;
    let budget = Math.ceil(d * BALANCE.upgradesPerDay);
    for (const b of sample(candidates.get(z) ?? [], Infinity, rng)) {
      if (budget === 0) break;
      // An earlier merge today may already have absorbed this building.
      if (world.buildings.get(b.id) !== b) continue;
      if (upgrade(world, b, z, rng, build)) budget--;
    }
  }

  return { changed, started, completed };
}

type Build = (def: BuildingId, x: number, y: number, occupants?: number) => void;

function upgrade(world: World, b: BuildingInstance, zone: ZonedType, rng: Rng, build: Build): boolean {
  const def: BuildingDef = BUILDINGS[b.def];
  const letter = ZONE_LETTER[zone];
  const density = ZONE_DENSITY[zone];
  const next = def.level + 1;
  const replace = (olds: readonly BuildingInstance[], x: number, y: number, id: BuildingId) => {
    let occupants = 0;
    for (const o of olds) {
      const s = BUILDINGS[o.def].size;
      occupants += o.occupants;
      world.removeBuilding(o.id, s.w, s.h);
    }
    build(id, x, y, occupants);
  };

  if (def.size.w === 2) {
    const two = zonedBuildings(letter, density, next, 2);
    if (two.length === 0) return false;
    replace([b], b.x, b.y, pick(two, rng));
    return true;
  }

  const one = zonedBuildings(letter, density, next, 1);
  const two = zonedBuildings(letter, density, next, 2);
  const tryMerge = () => {
    if (two.length === 0) return false;
    const square = findMergeSquare(world, b, zone, def.level, rng);
    if (!square) return false;
    replace(square.buildings, square.x, square.y, pick(two, rng));
    return true;
  };
  // Merge when there's no 1×1 option, otherwise half the time (falling back to in place).
  if ((one.length === 0 || rng() < 0.5) && tryMerge()) return true;
  if (one.length === 0) return false;
  replace([b], b.x, b.y, pick(one, rng));
  return true;
}

/**
 * A 2×2 square containing `b` whose tiles are all zoned `zone` and hold only empty lots or
 * finished grown 1×1 buildings of at most `level`, with road access. Returns its origin and buildings.
 */
function findMergeSquare(
  world: World,
  b: BuildingInstance,
  zone: ZonedType,
  level: number,
  rng: Rng,
): { x: number; y: number; buildings: BuildingInstance[] } | null {
  const offsets = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ] as const;
  const start = Math.floor(rng() * offsets.length);
  for (let k = 0; k < offsets.length; k++) {
    const [ox, oy] = offsets[(start + k) % offsets.length];
    const sx = b.x - ox;
    const sy = b.y - oy;
    const found: BuildingInstance[] = [];
    let ok = world.inBounds(sx, sy) && world.inBounds(sx + 1, sy + 1);
    for (let ty = sy; ok && ty < sy + 2; ty++) {
      for (let tx = sx; ok && tx < sx + 2; tx++) {
        const i = world.index(tx, ty);
        if (world.zone[i] !== zone) {
          ok = false;
          break;
        }
        const id = world.building[i];
        if (id === -1) continue;
        const o = world.buildings.get(id);
        const d = o && BUILDINGS[o.def];
        if (!o || !d || !o.grown || o.construction > 0 || d.size.w !== 1 || d.level > level) ok = false;
        else found.push(o);
      }
    }
    if (ok && isFlat(world, sx, sy, 2, 2) && findEntrance(world, sx, sy, 2, 2, BALANCE.roadAccessRange) !== -1) {
      return { x: sx, y: sy, buildings: found };
    }
  }
  return null;
}

/** Zoned growth once a day; new and finished sites go into the day's outcome. */
export class GrowthSystem implements SimSystem {
  readonly name = 'growth';
  private readonly city: City;
  private readonly rng: Rng;
  constructor(city: City, rng: Rng) {
    this.city = city;
    this.rng = rng;
  }
  onDay(out: DayOutcome) {
    const g = growDay(this.city.world, this.rng, this.city.taxRate);
    out.changed.push(...g.changed);
    out.started.push(...g.started);
    out.completed.push(...g.completed);
  }
  demand(): ZoneDemand {
    return zoneDemand(this.city.world, this.city.taxRate);
  }
}
