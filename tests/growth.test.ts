import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/shared/balance';
import { mulberry32 } from '../src/shared/rng';
import { BUILDINGS, chooseBuilding } from '../src/sim/buildings/catalog';
import { City } from '../src/sim/City';
import { applyClear, applyPlace, applyRoad, applyZone, planClear, planPlace, planRoad, planZone } from '../src/sim/commands';
import { growDay, zoneDemand } from '../src/sim/growth';
import { cityStats, findEntrance, simulateDay, updateRoadAccess } from '../src/sim/population';
import { rectTiles, roadPath, RoadType } from '../src/sim/roads';
import { Terrain } from '../src/sim/terrain/types';
import { World } from '../src/sim/World';
import { ZoneType, type ZoneTypeId } from '../src/sim/zones';

function town(size = 24) {
  const w = new World(size, size, 0);
  w.terrain.fill(Terrain.Grass);
  const city = new City(w, 1_000_000);
  // A road along y = 8 across the map.
  applyRoad(city, planRoad(w, roadPath({ x: 0, y: 8 }, { x: size - 1, y: 8 }, true), RoadType.Road), RoadType.Road);
  return { w, city };
}

const zone = (city: City, x0: number, y0: number, x1: number, y1: number, z: ZoneTypeId) =>
  applyZone(city, planZone(city.world, rectTiles({ x: x0, y: y0 }, { x: x1, y: y1 }), z), z);

/** Run the daily loop the way Game does: growth, access, then population. */
function runDays(w: World, days: number, seed = 1) {
  const rng = mulberry32(seed);
  for (let d = 0; d < days; d++) {
    growDay(w, rng);
    updateRoadAccess(w);
    simulateDay(w);
  }
}

describe('zoning', () => {
  it('zones land at a per-tile cost, skipping roads, water and tiles already zoned', () => {
    const { w, city } = town();
    w.terrain[w.index(3, 3)] = Terrain.DeepWater;
    const region = rectTiles({ x: 2, y: 2 }, { x: 4, y: 8 }); // 3×7, the last row is road
    const plan = planZone(w, region, ZoneType.Residential);
    expect(plan.count).toBe(3 * 6 - 1);
    expect(plan.cost).toBe(plan.count * BALANCE.zoneCost);

    const funds = city.funds;
    expect(applyZone(city, plan, ZoneType.Residential).ok).toBe(true);
    expect(city.funds).toBe(funds - plan.cost);
    expect(w.zone[w.index(2, 2)]).toBe(ZoneType.Residential);
    expect(w.zone[w.index(3, 3)]).toBe(ZoneType.None);
    expect(planZone(w, region, ZoneType.Residential).count).toBe(0);
  });

  it('dezoning is free; roads and placed buildings clear the zone under them', () => {
    const { w, city } = town();
    zone(city, 2, 2, 6, 7, ZoneType.Commercial);
    const dezone = planZone(w, rectTiles({ x: 2, y: 2 }, { x: 2, y: 7 }), ZoneType.None);
    expect(dezone.count).toBe(6);
    expect(dezone.cost).toBe(0);

    applyRoad(city, planRoad(w, roadPath({ x: 4, y: 2 }, { x: 4, y: 7 }, true), RoadType.Road), RoadType.Road);
    expect(w.zone[w.index(4, 5)]).toBe(ZoneType.None);
    applyPlace(city, planPlace(w, 'park', 6, 6), 0);
    expect(w.zone[w.index(6, 6)]).toBe(ZoneType.None);
    expect(planZone(w, [{ x: 6, y: 6 }], ZoneType.Commercial).count).toBe(0); // placed buildings block zoning
  });
});

describe('road access range', () => {
  it('finds the nearest land road within the range', () => {
    const { w } = town();
    expect(findEntrance(w, 5, 7, 1, 1, 3)).toBe(w.index(5, 8));
    expect(findEntrance(w, 5, 5, 1, 1, 3)).toBe(w.index(5, 8));
    expect(findEntrance(w, 5, 4, 1, 1, 3)).toBe(-1);
  });
});

describe('growth', () => {
  it('a new town wants homes first, and homes create demand for jobs', () => {
    const { w } = town();
    const d0 = zoneDemand(w);
    expect(d0.r).toBeGreaterThan(0);
    expect(d0.c).toBeGreaterThan(0);
    expect(d0.i).toBeGreaterThan(0);
  });

  it('zoned tiles near a road grow construction sites that finish after constructionDays', () => {
    const { w, city } = town();
    zone(city, 2, 5, 9, 7, ZoneType.Residential); // within 3 of the road
    zone(city, 2, 1, 9, 3, ZoneType.Residential); // too far
    const rng = mulberry32(7);
    const day1 = growDay(w, rng);
    expect(day1.started.length).toBe(BALANCE.growthPerDay);
    for (const id of day1.started) {
      const b = w.buildings.get(id)!;
      expect(b.grown).toBe(true);
      expect(b.construction).toBe(BALANCE.constructionDays);
      expect(b.y).toBeGreaterThanOrEqual(5);
      expect(BUILDINGS[b.def].level).toBe(1);
    }
    // Sites don't count as population until they finish.
    updateRoadAccess(w);
    simulateDay(w);
    expect(cityStats(w).housing).toBe(0);

    const finished: number[] = [];
    for (let d = 0; d < BALANCE.constructionDays; d++) finished.push(...growDay(w, rng).completed);
    expect(finished).toEqual(expect.arrayContaining([...day1.started]));
    for (const id of day1.started) expect(w.buildings.get(id)?.construction).toBe(0);
  });

  it('a zoned town grows, levels up and merges lots over time', () => {
    const { w, city } = town(32);
    zone(city, 0, 5, 31, 7, ZoneType.Residential);
    zone(city, 0, 9, 15, 11, ZoneType.Commercial);
    zone(city, 16, 9, 31, 11, ZoneType.Industrial);
    runDays(w, 400);

    const stats = cityStats(w);
    expect(stats.population).toBeGreaterThan(BALANCE.levelPopulation[3]);
    const levels = [...w.buildings.values()].map((b) => BUILDINGS[b.def].level);
    expect(Math.max(...levels)).toBe(3);
    expect([...w.buildings.values()].some((b) => BUILDINGS[b.def].size.w === 2)).toBe(true);
    // Every grown building sits on its own zone.
    for (const b of w.buildings.values()) {
      const z = BUILDINGS[b.def].zone;
      const expected = z === 'R' ? ZoneType.Residential : z === 'C' ? ZoneType.Commercial : ZoneType.Industrial;
      expect(w.zone[w.index(b.x, b.y)]).toBe(expected);
    }
  });

  it('is deterministic for a given seed', () => {
    const grow = () => {
      const { w, city } = town();
      zone(city, 0, 5, 23, 7, ZoneType.Residential);
      zone(city, 0, 9, 23, 10, ZoneType.Industrial);
      runDays(w, 120, 99);
      return [...w.buildings.values()].map((b) => `${b.def}@${b.x},${b.y}`).join(' ');
    };
    expect(grow()).toBe(grow());
  });

  it('Clear removes a grown building and its zone (there is no separate Dezone)', () => {
    const { w, city } = town();
    zone(city, 2, 7, 2, 7, ZoneType.Residential);
    runDays(w, 2);
    const b = [...w.buildings.values()][0];
    expect(b).toBeDefined();
    applyClear(city, planClear(w, [{ x: b.x, y: b.y }]));
    expect(w.buildings.size).toBe(0);
    expect(w.zone[w.index(2, 7)]).toBe(ZoneType.None);
    runDays(w, 4);
    expect(w.buildings.size).toBe(0);
  });

  it('chooseBuilding picks from the matching zone, level and size', () => {
    const rng = mulberry32(3);
    expect(['cottage', 'family_house']).toContain(chooseBuilding('R', 1, 1, rng));
    expect(chooseBuilding('I', 2, 1, rng)).toBeNull();
    expect(chooseBuilding('I', 2, 2, rng)).toBe('warehouse');
  });
});
