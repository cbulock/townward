import { BALANCE } from '../../shared/balance';
import { BUILDINGS, type BuildingDef, type BuildingInstance } from '../buildings/catalog';
import type { World } from '../World';
import { serviceBit } from './coverage';
import type { DayOutcome, SimSystem } from '../core/System';
import { cityStats } from './population';

/** Fire system: buildings outside fire coverage can burn down (docs/specs/core.md). */

/**
 * Daily fire roll: once the city has BALANCE.firePopulation residents, each finished zoned
 * building outside fire coverage may burn down. The lot is cleared and the zone stays, so it
 * regrows. Returns what burned (already removed from the world).
 */
export function rollFires(world: World, population: number, rng: () => number): BuildingInstance[] {
  if (population < BALANCE.firePopulation) return [];
  const fire = serviceBit('fire');
  const burned: BuildingInstance[] = [];
  for (const b of [...world.buildings.values()]) {
    const d: BuildingDef = BUILDINGS[b.def];
    if (d.category === 'civic' || b.construction > 0 || b.services & fire) continue;
    if (rng() >= BALANCE.fireChance) continue;
    world.removeBuilding(b.id, d.size.w, d.size.h);
    burned.push(b);
  }
  return burned;
}

/** Rolls for fires each day; burned lots go into the day's outcome. */
export class FireSystem implements SimSystem {
  readonly name = 'fire';
  private readonly world: World;
  private readonly rng: () => number;
  constructor(world: World, rng: () => number) {
    this.world = world;
    this.rng = rng;
  }
  onDay(out: DayOutcome) {
    for (const b of rollFires(this.world, cityStats(this.world).population, this.rng)) {
      const { w, h } = BUILDINGS[b.def].size;
      out.burned.push(b);
      out.changed.push({ x: b.x, y: b.y, w, h });
    }
  }
}
