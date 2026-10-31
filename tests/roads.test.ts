import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/shared/balance';
import { City } from '../src/sim/City';
import { applyClear, applyRoad, planClear, planRoad } from '../src/sim/commands';
import { rectTiles, roadMask, roadPath, RoadType } from '../src/sim/roads';
import { Decor, Terrain } from '../src/sim/terrain/types';
import { World } from '../src/sim/World';

function grassWorld(n = 8): World {
  const w = new World(n, n, 0);
  w.terrain.fill(Terrain.Grass);
  return w;
}

describe('roadPath', () => {
  it('runs along the dominant axis first, then bends', () => {
    expect(roadPath({ x: 0, y: 0 }, { x: 3, y: 1 }, false)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 1 },
    ]);
  });

  it('straight mode stays on the dominant axis', () => {
    expect(roadPath({ x: 2, y: 2 }, { x: 3, y: 6 }, true)).toEqual([
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 2, y: 4 },
      { x: 2, y: 5 },
      { x: 2, y: 6 },
    ]);
  });

  it('single click is a single tile', () => {
    expect(roadPath({ x: 4, y: 4 }, { x: 4, y: 4 }, false)).toEqual([{ x: 4, y: 4 }]);
  });
});

describe('rectTiles', () => {
  it('covers the rectangle regardless of drag direction', () => {
    expect(rectTiles({ x: 2, y: 3 }, { x: 1, y: 2 })).toHaveLength(4);
  });
});

describe('roadMask', () => {
  it('sets NE, SE, SW, NW bits for neighbouring roads of any type', () => {
    const w = grassWorld();
    w.road[w.index(3, 2)] = RoadType.Road; // NE of (3,3)
    w.road[w.index(4, 3)] = RoadType.Highway; // SE
    expect(roadMask(w, 3, 3)).toBe(0b0011);
    w.road[w.index(3, 4)] = RoadType.Road; // SW
    w.road[w.index(2, 3)] = RoadType.Road; // NW
    expect(roadMask(w, 3, 3)).toBe(0b1111);
  });
});

describe('planRoad / applyRoad', () => {
  it('prices road tiles plus tree and rock clearing', () => {
    const w = grassWorld();
    w.tree[w.index(1, 0)] = 2;
    w.decor[w.index(2, 0)] = Decor.Boulder;
    const plan = planRoad(w, roadPath({ x: 0, y: 0 }, { x: 2, y: 0 }, false), RoadType.Road);
    expect(plan.count).toBe(3);
    expect(plan.cost).toBe(3 * BALANCE.roadCost + 2 * BALANCE.treeClearCost + BALANCE.boulderClearCost);
  });

  it('stops at water: only the contiguous run from the start is valid', () => {
    const w = grassWorld();
    w.terrain[w.index(2, 0)] = Terrain.ShallowWater;
    const plan = planRoad(w, roadPath({ x: 0, y: 0 }, { x: 4, y: 0 }, false), RoadType.Road);
    expect(plan.tiles.map((t) => t.valid)).toEqual([true, true, false, false, false]);
    expect(plan.count).toBe(2);
  });

  it('existing roads are free; roads never downgrade highways', () => {
    const w = grassWorld();
    w.road[w.index(1, 0)] = RoadType.Highway;
    const plan = planRoad(w, roadPath({ x: 0, y: 0 }, { x: 2, y: 0 }, false), RoadType.Road);
    expect(plan.count).toBe(2);
    const city = new City(w, 1000);
    expect(applyRoad(city, plan, RoadType.Road).ok).toBe(true);
    expect(w.road[w.index(1, 0)]).toBe(RoadType.Highway);
  });

  it('highways upgrade roads', () => {
    const w = grassWorld();
    w.road[w.index(0, 0)] = RoadType.Road;
    const plan = planRoad(w, [{ x: 0, y: 0 }], RoadType.Highway);
    expect(plan.cost).toBe(BALANCE.highwayCost);
  });

  it('applies: sets road, clears tree/decor, deducts funds', () => {
    const w = grassWorld();
    w.tree[w.index(1, 1)] = 3;
    const city = new City(w, 500);
    const plan = planRoad(w, [{ x: 1, y: 1 }], RoadType.Road);
    const res = applyRoad(city, plan, RoadType.Road);
    expect(res.ok).toBe(true);
    expect(w.road[w.index(1, 1)]).toBe(RoadType.Road);
    expect(w.tree[w.index(1, 1)]).toBe(0);
    expect(city.funds).toBe(500 - plan.cost);
    expect(res.changed).toEqual({ minX: 1, minY: 1, maxX: 1, maxY: 1 });
  });

  it('refuses when funds are short and changes nothing', () => {
    const w = grassWorld();
    const city = new City(w, 5);
    const plan = planRoad(w, [{ x: 1, y: 1 }], RoadType.Road);
    expect(applyRoad(city, plan, RoadType.Road)).toEqual({ ok: false, reason: 'insufficient-funds' });
    expect(w.road[w.index(1, 1)]).toBe(RoadType.None);
    expect(city.funds).toBe(5);
  });
});

describe('planClear / applyClear', () => {
  it('only tiles with something on them count', () => {
    const w = grassWorld();
    w.tree[w.index(0, 0)] = 1;
    w.decor[w.index(1, 0)] = Decor.Rocks;
    w.road[w.index(0, 1)] = RoadType.Road;
    const plan = planClear(w, rectTiles({ x: 0, y: 0 }, { x: 1, y: 1 }));
    expect(plan.count).toBe(3);
    expect(plan.cost).toBe(BALANCE.treeClearCost + BALANCE.rocksClearCost);
  });

  it('clears trees, decor and roads', () => {
    const w = grassWorld();
    w.tree[w.index(0, 0)] = 2;
    w.decor[w.index(1, 0)] = Decor.FlowersWhite;
    w.road[w.index(1, 1)] = RoadType.Highway;
    const city = new City(w, 100);
    const res = applyClear(city, planClear(w, rectTiles({ x: 0, y: 0 }, { x: 1, y: 1 })));
    expect(res.ok).toBe(true);
    expect(w.tree[w.index(0, 0)]).toBe(0);
    expect(w.decor[w.index(1, 0)]).toBe(Decor.None);
    expect(w.road[w.index(1, 1)]).toBe(RoadType.None);
  });

  it('empty region is a no-op', () => {
    const w = grassWorld();
    const city = new City(w, 100);
    expect(applyClear(city, planClear(w, rectTiles({ x: 0, y: 0 }, { x: 3, y: 3 }))).reason).toBe('nothing-to-do');
  });
});
