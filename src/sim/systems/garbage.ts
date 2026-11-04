import { BALANCE } from '../../shared/balance';
import { BUILDINGS, buildingDef, type BuildingDef, type BuildingInstance } from '../buildings/catalog';
import type { City } from '../City';
import type { SimSystem } from '../core/System';
import { Stage } from '../stages';
import { isActive } from './access';
import { isWorking, roadIslands } from './utilities';

/**
 * Garbage system (docs/specs/evolution.md, E2; D-086), from the Village stage on. Every active
 * zoned building makes garbage each day, which piles up until a landfill, recycling centre or
 * incinerator on the same road island and within reach collects it. Each facility empties the
 * nearest bins first until its daily truck capacity runs out. Landfills fill up; recycling
 * centres count the tons they take this month (sold by the budget), then start again.
 */

/** Tons a building makes per day (0 for civic buildings and empty ones). */
export function garbageRate(b: BuildingInstance): number {
  const d: BuildingDef = BUILDINGS[b.def];
  if (d.category === 'residential') return b.occupants * BALANCE.garbagePerResident;
  if (d.category === 'commercial') return b.occupants * BALANCE.garbagePerWorker;
  if (d.category === 'industrial') return b.occupants * BALANCE.garbagePerIndustrialWorker;
  return 0;
}

/** The garbage need: 1 with an empty bin, 0 once the pile is BALANCE.garbageDays of output. */
export function garbageScore(b: BuildingInstance): number {
  const limit = garbageRate(b) * BALANCE.garbageDays;
  if (b.garbage <= 0) return 1;
  if (limit <= 0) return 0;
  return Math.max(0, 1 - b.garbage / limit);
}

/** Whether a landfill has room left. Facilities without a limit always do. */
export function hasRoom(b: BuildingInstance): boolean {
  const holds = buildingDef(b.def).garbage?.holds;
  return holds === undefined || b.filled < holds;
}

export interface GarbageReport {
  /** Tons made and collected today, and lying uncollected across the city. */
  made: number;
  collected: number;
  uncollected: number;
}

/** One day of garbage. Pure over the city so tests can call it. */
export function garbageDay(city: City, collectedBy?: Map<number, number>): GarbageReport {
  const report: GarbageReport = { made: 0, collected: 0, uncollected: 0 };
  if (city.stage < Stage.Village) return report;
  const w = city.world;
  const all = [...w.buildings.values()];
  for (const b of all) {
    if (!isActive(b) || b.abandoned) continue;
    const t = garbageRate(b);
    b.garbage = Math.min(b.garbage + t, t * BALANCE.garbageMaxDays);
    report.made += t;
  }

  const facilities = all.filter((b) => buildingDef(b.def).garbage && isActive(b) && isWorking(b));
  if (facilities.length > 0) {
    const islands = roadIslands(w);
    const islandOf = (b: BuildingInstance) => (b.entrance === -1 ? -1 : islands[b.entrance]);
    const centre = (b: BuildingInstance) => {
      const s = BUILDINGS[b.def].size;
      return { x: b.x + s.w / 2, y: b.y + s.h / 2 };
    };
    const bins = all.filter((b) => b.garbage > 0).map((b) => ({ b, island: islandOf(b), ...centre(b) }));
    for (const f of facilities) {
      const spec = buildingDef(f.def).garbage;
      if (!spec || !hasRoom(f)) continue;
      const island = islandOf(f);
      const c = centre(f);
      const r2 = spec.reach * spec.reach;
      const near = bins
        .filter((n) => n.island === island && n.b.garbage > 0 && (n.x - c.x) ** 2 + (n.y - c.y) ** 2 <= r2)
        .sort((a, b) => (a.x - c.x) ** 2 + (a.y - c.y) ** 2 - ((b.x - c.x) ** 2 + (b.y - c.y) ** 2));
      let left = spec.trucks;
      if (spec.holds !== undefined) left = Math.min(left, spec.holds - f.filled);
      let taken = 0;
      for (const n of near) {
        if (left <= 0) break;
        const t = Math.min(left, n.b.garbage);
        n.b.garbage -= t;
        left -= t;
        taken += t;
      }
      // Landfills keep what they bury; recycling centres count this month's tons.
      if (spec.holds !== undefined || spec.recycles) f.filled += taken;
      report.collected += taken;
      collectedBy?.set(f.id, taken);
    }
  }
  for (const b of all) report.uncollected += b.garbage;
  return report;
}

/** Makes and collects garbage daily; resets recycling counts each month after the budget sold them. */
export class GarbageSystem implements SimSystem {
  readonly name = 'garbage';
  report: GarbageReport = { made: 0, collected: 0, uncollected: 0 };
  /** Tons each facility collected today, for the info panel. */
  readonly collectedToday = new Map<number, number>();
  private readonly city: City;
  constructor(city: City) {
    this.city = city;
  }
  onDay() {
    this.collectedToday.clear();
    this.report = garbageDay(this.city, this.collectedToday);
  }
  onMonth() {
    for (const b of this.city.world.buildings.values()) if (buildingDef(b.def).garbage?.recycles) b.filled = 0;
  }
}
