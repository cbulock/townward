import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/shared/balance';
import { BUILDING_IDS, BUILDINGS, footprintOrigin } from '../src/sim/buildings/catalog';
import { City } from '../src/sim/City';
import { applyClear, applyPlace, applyRoad, planClear, planPlace, planRoad } from '../src/sim/commands';
import { rectTiles, RoadType } from '../src/sim/roads';
import { Terrain } from '../src/sim/terrain/types';
import { World } from '../src/sim/World';

function grassWorld(n = 10): World {
  const w = new World(n, n, 0);
  w.terrain.fill(Terrain.Grass);
  return w;
}

describe('building catalog', () => {
  it('has the essential types in every category', () => {
    const cats = new Set(BUILDING_IDS.map((id) => BUILDINGS[id].category));
    expect([...cats].sort()).toEqual(['civic', 'commercial', 'industrial', 'residential']);
    expect(BUILDING_IDS).toEqual(expect.arrayContaining(['cottage', 'walkup', 'apartment_block', 'hotel', 'factory']));
  });

  it('zoned buildings carry their zone and a level', () => {
    for (const id of BUILDING_IDS) {
      const d = BUILDINGS[id];
      if (d.category === 'civic') expect(d.zone).toBeNull();
      else expect(d.level).toBeGreaterThan(0);
    }
  });

  it('centres footprints on the cursor tile', () => {
    expect(footprintOrigin('cottage', 5, 5)).toEqual({ x: 5, y: 5 });
    expect(footprintOrigin('hotel', 5, 5)).toEqual({ x: 5, y: 5 });
  });
});

describe('planPlace / applyPlace', () => {
  it('places on clear land and stamps the footprint', () => {
    const w = grassWorld();
    const city = new City(w, 10_000);
    const plan = planPlace(w, 'hotel', 3, 3);
    expect(plan.ok).toBe(true);
    expect(plan.cost).toBe(BUILDINGS.hotel.cost);
    const res = applyPlace(city, plan, 1);
    expect(res.ok).toBe(true);
    const id = w.building[w.index(3, 3)];
    expect(id).toBeGreaterThan(0);
    for (const t of rectTiles({ x: 3, y: 3 }, { x: 4, y: 4 })) expect(w.building[w.index(t.x, t.y)]).toBe(id);
    expect(w.buildings.get(id)).toMatchObject({ def: 'hotel', x: 3, y: 3, variant: 1 });
    expect(city.funds).toBe(10_000 - BUILDINGS.hotel.cost);
  });

  it('adds clearing cost for trees in the footprint and clears them', () => {
    const w = grassWorld();
    w.tree[w.index(2, 2)] = 3;
    const city = new City(w, 10_000);
    const plan = planPlace(w, 'cottage', 2, 2);
    expect(plan.cost).toBe(BUILDINGS.cottage.cost + 3 * BALANCE.treeClearCost);
    applyPlace(city, plan, 0);
    expect(w.tree[w.index(2, 2)]).toBe(0);
  });

  it('rejects water, roads, other buildings and the map edge', () => {
    const w = grassWorld();
    w.terrain[w.index(1, 1)] = Terrain.ShallowWater;
    expect(planPlace(w, 'cottage', 1, 1).ok).toBe(false);
    w.road[w.index(5, 5)] = RoadType.Road;
    expect(planPlace(w, 'hotel', 4, 4).ok).toBe(false);
    const city = new City(w, 10_000);
    applyPlace(city, planPlace(w, 'cottage', 7, 7), 0);
    expect(planPlace(w, 'cottage', 7, 7).ok).toBe(false);
    expect(planPlace(w, 'hotel', 9, 9).ok).toBe(false); // 2×2 hangs off the map
  });

  it('roads cannot go through buildings', () => {
    const w = grassWorld();
    const city = new City(w, 10_000);
    applyPlace(city, planPlace(w, 'cottage', 3, 0), 0);
    const plan = planRoad(w, [{ x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }], RoadType.Road);
    expect(plan.tiles.map((t) => t.valid)).toEqual([true, false, true]);
    expect(applyRoad(city, plan, RoadType.Road).ok).toBe(true);
  });

  it('refuses when funds are short', () => {
    const w = grassWorld();
    const city = new City(w, 100);
    expect(applyPlace(city, planPlace(w, 'office_tower', 3, 3), 0).reason).toBe('insufficient-funds');
    expect(w.buildings.size).toBe(0);
  });
});

describe('clearing buildings', () => {
  it('selecting one tile removes the whole building', () => {
    const w = grassWorld();
    const city = new City(w, 10_000);
    applyPlace(city, planPlace(w, 'factory', 3, 3), 0);
    const res = applyClear(city, planClear(w, [{ x: 4, y: 4 }]));
    expect(res.ok).toBe(true);
    expect(w.buildings.size).toBe(0);
    for (const t of rectTiles({ x: 3, y: 3 }, { x: 4, y: 4 })) expect(w.building[w.index(t.x, t.y)]).toBe(-1);
    expect(res.changed).toEqual({ minX: 3, minY: 3, maxX: 4, maxY: 4 });
  });
});
