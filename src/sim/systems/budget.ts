import { BALANCE } from '../../shared/balance';
import { BUILDINGS, upkeepOf, type BuildingDef, type BuildingInstance } from '../buildings/catalog';
import { isWorking } from './utilities';
import type { City } from '../City';
import { BridgeAxis, RoadType } from '../roads';
import { roadSpec } from '../roadTypes';
import type { World } from '../World';
import { cityStats } from './population';
import type { DayOutcome, SimSystem } from '../core/System';

/** Budget system: monthly taxes (by lifestyle) and recycling sales against road and civic upkeep (docs/specs/core.md, "Budget & Taxes"). */

export interface BudgetReport {
  income: number;
  expenses: number;
  net: number;
  /** Tax rate (percent) the income was collected at. */
  taxRate: number;
  breakdown: { roads: number; services: number; utilities: number; parks: number };
  /** Part of the income from materials recycling centres sold (docs/specs/evolution.md). */
  recycling: number;
}

/** Taxes scale with the rate: the base rate gives the BALANCE per-resident and per-worker amounts. */
export function monthlyBudget(world: World, taxRate: number = BALANCE.baseTaxRate): BudgetReport {
  const s = cityStats(world);
  const rate = taxRate / BALANCE.baseTaxRate;
  // Better-off residents pay more (docs/specs/evolution.md); cityStats' population is the same homes.
  let residentTax = 0;
  let recycled = 0;
  for (const b of world.buildings.values()) {
    const d: BuildingDef = BUILDINGS[b.def];
    if (d.category === 'residential' && b.construction === 0 && !b.abandoned) {
      residentTax += b.occupants * BALANCE.taxPerResident * BALANCE.lifestyleTax[b.lifestyle];
    }
    // Recycling centres count this month's tons in `filled` (sim/systems/garbage.ts).
    if (d.garbage?.recycles) recycled += b.filled * d.garbage.recycles;
  }
  const recycling = Math.round(recycled * BALANCE.recyclePrice);
  const income = Math.round((residentTax + s.workers * BALANCE.taxPerWorker) * rate) + recycling;
  let roads = 0;
  for (let i = 0; i < world.road.length; i++) {
    const r = world.road[i];
    if (r === RoadType.None) continue;
    roads += world.bridge[i] !== BridgeAxis.None ? BALANCE.bridgeUpkeep : (roadSpec(r)?.upkeep ?? BALANCE.roadUpkeep);
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
    recycling,
  };
}

/** What happened to this month's taxes when they wait at the Town Hall (docs/specs/evolution.md, E5). */
export interface HeldTaxes {
  /** Waiting in the chest now. */
  waiting: number;
  /** Lost because the chest was full. */
  lost: number;
  /** The chest is past the warning line. */
  filling: boolean;
}

/** Apply a month's budget to the city: upkeep from the funds, taxes to the funds or the Town Hall's chest. */
export function collectBudget(city: City): BudgetReport & { held: HeldTaxes | null } {
  const r = monthlyBudget(city.world, city.taxRate);
  if (!city.collectsTaxes) {
    city.funds += r.net;
    return { ...r, held: null };
  }
  city.funds -= r.expenses;
  const cap = Math.max(0, r.income) * BALANCE.chestMonths;
  const total = city.uncollected + r.income;
  city.uncollected = Math.min(total, Math.max(cap, city.uncollected));
  return {
    ...r,
    held: { waiting: city.uncollected, lost: total - city.uncollected, filling: city.uncollected >= r.income * BALANCE.chestWarnMonths },
  };
}

/** The working Town Hall that taxes are collected at, if the city has one. */
export function townHall(world: World): BuildingInstance | null {
  for (const b of world.buildings.values()) if (b.def === 'town_hall' && isWorking(b)) return b;
  return null;
}

/** Collect the taxes waiting at the Town Hall. Returns the amount, or why it couldn't. */
export function collectTaxes(city: City): { ok: true; amount: number } | { ok: false; reason: 'nothing-waiting' | 'no-town-hall' } {
  if (city.uncollected <= 0) return { ok: false, reason: 'nothing-waiting' };
  if (!townHall(city.world)) return { ok: false, reason: 'no-town-hall' };
  const amount = Math.round(city.uncollected);
  city.funds += amount;
  city.uncollected = 0;
  return { ok: true, amount };
}

/** Collects the monthly budget and keeps the last report. */
export class BudgetSystem implements SimSystem {
  readonly name = 'budget';
  last: BudgetReport | null = null;
  /** This month's taxes held at the Town Hall (cities that collect by hand). */
  held: HeldTaxes | null = null;
  private readonly city: City;
  constructor(city: City) {
    this.city = city;
  }
  onMonth(out: DayOutcome) {
    const r = collectBudget(this.city);
    this.held = r.held;
    this.last = r;
    out.budget = r;
  }
  /** Next month at today's numbers. */
  forecast(): BudgetReport {
    return monthlyBudget(this.city.world, this.city.taxRate);
  }
}
