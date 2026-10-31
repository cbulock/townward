import { BALANCE } from '../shared/balance';
import { BUILDINGS } from './buildings/catalog';
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
}

/**
 * Give every building the index of a road tile touching its footprint (its "entrance"),
 * or −1. Prefers the road nearest the front (south) of the building.
 */
export function updateRoadAccess(world: World) {
  for (const b of world.buildings.values()) {
    const { w, h } = BUILDINGS[b.def].size;
    let entrance = -1;
    // Walk the ring around the footprint, front edges first.
    const ring: [number, number][] = [];
    for (let x = b.x; x < b.x + w; x++) ring.push([x, b.y + h]);
    for (let y = b.y; y < b.y + h; y++) ring.push([b.x + w, y]);
    for (let x = b.x; x < b.x + w; x++) ring.push([x, b.y - 1]);
    for (let y = b.y; y < b.y + h; y++) ring.push([b.x - 1, y]);
    for (const [x, y] of ring) {
      if (!world.inBounds(x, y)) continue;
      const i = world.index(x, y);
      // Bridges have no kerb to stop at; only land roads count as an entrance.
      if (world.road[i] !== RoadType.None && world.bridge[i] === BridgeAxis.None) {
        entrance = i;
        break;
      }
    }
    b.entrance = entrance;
    // A building cut off from the roads empties out.
    if (entrance === -1) b.occupants = 0;
  }
}

export function cityStats(world: World): CityStats {
  let population = 0;
  let housing = 0;
  let jobs = 0;
  let workers = 0;
  for (const b of world.buildings.values()) {
    const d = BUILDINGS[b.def];
    if (d.category === 'residential') {
      population += b.occupants;
      housing += d.capacity;
    } else {
      jobs += b.entrance === -1 ? 0 : d.capacity;
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
    if (d.category !== 'residential' || b.entrance === -1) continue;
    const target = Math.round(d.capacity * fill);
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
    if (d.category === 'residential') continue;
    b.occupants = b.entrance === -1 ? 0 : Math.floor(d.capacity * share);
  }
}

export function monthlyBudget(world: World): BudgetReport {
  const s = cityStats(world);
  const income = Math.round(s.population * BALANCE.taxPerResident + s.workers * BALANCE.taxPerWorker);
  let upkeep = 0;
  for (let i = 0; i < world.road.length; i++) {
    const r = world.road[i];
    if (r === RoadType.None) continue;
    upkeep += world.bridge[i] !== BridgeAxis.None ? BALANCE.bridgeUpkeep : r === RoadType.Highway ? BALANCE.highwayUpkeep : BALANCE.roadUpkeep;
  }
  for (const b of world.buildings.values()) {
    const d = BUILDINGS[b.def];
    if (d.category === 'civic') upkeep += d.cost * BALANCE.civicUpkeepShare;
  }
  const expenses = Math.round(upkeep);
  return { income, expenses, net: income - expenses };
}

/** Apply a month's budget to the city. */
export function collectBudget(city: City): BudgetReport {
  const r = monthlyBudget(city.world);
  city.funds += r.net;
  return r;
}
