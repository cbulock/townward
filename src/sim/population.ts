import { BALANCE } from '../shared/balance';
import { BUILDINGS } from './buildings/catalog';
import { upkeepOf, type BuildingDef, type BuildingInstance } from './buildings/catalog';
import { needsUtilities, serviceFactor } from './services';
import type { City } from './City';
import { BridgeAxis, RoadType } from './roads';
import type { World } from './World';

/**
 * City dynamics: road access, people moving in, jobs filling up and the monthly budget.
 * Pure functions over City/World so they're easy to test. See docs/specs/simulation.md.
 */

export interface CityStats {
  population: number;
  /** Homes' total capacity. */
  housing: number;
  jobs: number;
  workers: number;
  /** Working-age residents without a job. */
  unemployed: number;
}

export interface BudgetReport {
  income: number;
  expenses: number;
  net: number;
  /** Tax rate (percent) the income was collected at. */
  taxRate: number;
  breakdown: { roads: number; services: number; utilities: number; parks: number };
}

/** A land road tile (bridges have no kerb to stop at, so they never count as an entrance). */
function isLandRoad(world: World, i: number): boolean {
  return world.road[i] !== RoadType.None && world.bridge[i] === BridgeAxis.None;
}

/**
 * Index of the nearest land road within `range` tiles of the footprint (x, y, w, h), or −1.
 * Rings are searched outward. Within a ring the road with the fewest straight steps to the
 * footprint wins (so a road in front beats one at a corner); ties go to the front (south)
 * edge, then east, north and west.
 */
export function findEntrance(world: World, x: number, y: number, w: number, h: number, range: number): number {
  for (let d = 1; d <= range; d++) {
    const x0 = x - d;
    const y0 = y - d;
    const x1 = x + w - 1 + d;
    const y1 = y + h - 1 + d;
    let best = -1;
    let bestSteps = Infinity;
    const check = (tx: number, ty: number) => {
      if (!world.inBounds(tx, ty) || !isLandRoad(world, world.index(tx, ty))) return;
      // Straight-line (Manhattan) steps from the footprint's edge.
      const steps = Math.max(0, x - tx, tx - (x + w - 1)) + Math.max(0, y - ty, ty - (y + h - 1));
      if (steps < bestSteps) {
        best = world.index(tx, ty);
        bestSteps = steps;
      }
    };
    for (let tx = x0; tx <= x1; tx++) check(tx, y1);
    for (let ty = y1 - 1; ty >= y0; ty--) check(x1, ty);
    for (let tx = x1 - 1; tx >= x0; tx--) check(tx, y0);
    for (let ty = y0 + 1; ty < y1; ty++) check(x0, ty);
    if (best !== -1) return best;
  }
  return -1;
}

/** Give every building its entrance road tile (within BALANCE.roadAccessRange), or −1. */
export function updateRoadAccess(world: World) {
  for (const b of world.buildings.values()) {
    const { w, h } = BUILDINGS[b.def].size;
    b.entrance = findEntrance(world, b.x, b.y, w, h, BALANCE.roadAccessRange);
    // A building cut off from the roads empties out.
    if (b.entrance === -1) b.occupants = 0;
  }
}

/** Finished and connected: the building can have residents or jobs. */
export function isActive(b: BuildingInstance): boolean {
  return b.construction === 0 && b.entrance !== -1;
}

export function cityStats(world: World): CityStats {
  let population = 0;
  let housing = 0;
  let jobs = 0;
  let workers = 0;
  for (const b of world.buildings.values()) {
    // Construction sites keep carried-over occupants for later but don't count yet.
    if (b.construction > 0) continue;
    const d = BUILDINGS[b.def];
    if (d.category === 'residential') {
      population += b.occupants;
      housing += d.capacity;
    } else {
      jobs += b.entrance === -1 || !hasUtilities(b) ? 0 : d.capacity;
      workers += b.occupants;
    }
  }
  const workforce = Math.floor(population * BALANCE.workforceShare);
  return { population, housing, jobs, workers, unemployed: Math.max(0, workforce - workers) };
}

/**
 * One in-game day. Homes with road access fill toward a target that rises with job
 * availability; job buildings take workers from the workforce in proportion to capacity.
 */
export function simulateDay(world: World) {
  const before = cityStats(world);
  const workforce = Math.floor(before.population * BALANCE.workforceShare);
  // How well jobs cover the workforce: 1 when every worker could have a job.
  const jobCover = workforce === 0 ? (before.jobs > 0 ? 1 : 0) : Math.min(1, before.jobs / workforce);
  const fill = BALANCE.minHousingFill + (1 - BALANCE.minHousingFill) * jobCover;

  for (const b of world.buildings.values()) {
    const d = BUILDINGS[b.def];
    if (d.category !== 'residential' || !isActive(b)) continue;
    // No power or water: people leave. Otherwise services set how full a home gets (docs/specs/core.md).
    const target = hasUtilities(b) ? Math.round(d.capacity * fill * serviceFactor(b)) : 0;
    if (b.occupants < target) b.occupants += Math.max(1, Math.round((target - b.occupants) * BALANCE.moveInRate));
    else if (b.occupants > target) b.occupants -= Math.max(1, Math.round((b.occupants - target) * BALANCE.moveInRate));
    b.occupants = Math.min(d.capacity, Math.max(0, b.occupants));
  }

  // Share the (new) workforce across job buildings by capacity.
  const after = cityStats(world);
  const available = Math.floor(after.population * BALANCE.workforceShare);
  const share = after.jobs === 0 ? 0 : Math.min(1, available / after.jobs);
  for (const b of world.buildings.values()) {
    const d = BUILDINGS[b.def];
    if (d.category === 'residential' || b.construction > 0) continue;
    const factor = d.category === 'civic' ? 1 : serviceFactor(b);
    b.occupants = b.entrance === -1 || !hasUtilities(b) ? 0 : Math.floor(d.capacity * share * factor);
  }
}

/** Has the power and water it needs (civic buildings need none). */
export function hasUtilities(b: BuildingInstance): boolean {
  return !needsUtilities(BUILDINGS[b.def]) || (b.powered && b.watered);
}

/** Taxes scale with the rate: the base rate gives the BALANCE per-resident and per-worker amounts. */
export function monthlyBudget(world: World, taxRate: number = BALANCE.baseTaxRate): BudgetReport {
  const s = cityStats(world);
  const rate = taxRate / BALANCE.baseTaxRate;
  const income = Math.round((s.population * BALANCE.taxPerResident + s.workers * BALANCE.taxPerWorker) * rate);
  let roads = 0;
  for (let i = 0; i < world.road.length; i++) {
    const r = world.road[i];
    if (r === RoadType.None) continue;
    roads += world.bridge[i] !== BridgeAxis.None ? BALANCE.bridgeUpkeep : r === RoadType.Highway ? BALANCE.highwayUpkeep : BALANCE.roadUpkeep;
  }
  let services = 0;
  let utilities = 0;
  let parks = 0;
  for (const b of world.buildings.values()) {
    const d: BuildingDef = BUILDINGS[b.def];
    const upkeep = upkeepOf(b.def);
    if (d.group === 'services') services += upkeep;
    else if (d.group === 'utilities') utilities += upkeep;
    else parks += upkeep;
  }
  const expenses = Math.round(roads + services + utilities + parks);
  return {
    income,
    expenses,
    net: income - expenses,
    taxRate,
    breakdown: { roads: Math.round(roads), services, utilities, parks },
  };
}

/** Apply a month's budget to the city. */
export function collectBudget(city: City): BudgetReport {
  const r = monthlyBudget(city.world, city.taxRate);
  city.funds += r.net;
  return r;
}
