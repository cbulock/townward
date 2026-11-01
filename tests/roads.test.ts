import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/shared/balance';
import { City } from '../src/sim/City';
import { applyClear, applyPlace, applyRoad, planClear, planPlace, planRoad } from '../src/sim/commands';
import { BridgeAxis, rectTiles, roadMask, roadPath, RoadType } from '../src/sim/roads';
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

  it('rock blocks only its own tiles; the rest of the drag still builds', () => {
    const w = grassWorld();
    w.terrain[w.index(2, 0)] = Terrain.Rock;
    w.terrain[w.index(3, 0)] = Terrain.Rock;
    const plan = planRoad(w, roadPath({ x: 0, y: 0 }, { x: 5, y: 0 }, false), RoadType.Road);
    expect(plan.tiles.map((t) => t.valid)).toEqual([true, true, false, false, true, true]);
    expect(plan.count).toBe(4);
    expect(plan.cost).toBe(4 * BALANCE.roadCost);
  });

  it('a building blocks only its own tile', () => {
    const w = grassWorld();
    const city = new City(w, 10_000);
    applyPlace(city, planPlace(w, 'park', 2, 0), 0);
    const plan = planRoad(w, roadPath({ x: 0, y: 0 }, { x: 4, y: 0 }, false), RoadType.Road);
    expect(plan.tiles.map((t) => t.valid)).toEqual([true, true, false, true, true]);
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

  it('bigger roads upgrade smaller ones in place, paying the difference; never the reverse', () => {
    const w = grassWorld();
    const city = new City(w, 10_000);
    applyRoad(city, planRoad(w, roadPath({ x: 0, y: 0 }, { x: 3, y: 0 }, true), RoadType.Road), RoadType.Road);
    const avenue = planRoad(w, roadPath({ x: 0, y: 0 }, { x: 3, y: 0 }, true), RoadType.Avenue);
    expect(avenue.cost).toBe(4 * (BALANCE.avenueCost - BALANCE.roadCost));
    applyRoad(city, avenue, RoadType.Avenue);
    expect(w.road[w.index(2, 0)]).toBe(RoadType.Avenue);
    const highway = planRoad(w, [{ x: 0, y: 0 }], RoadType.Highway);
    expect(highway.cost).toBe(BALANCE.highwayCost - BALANCE.avenueCost);
    // A street dragged over the avenue keeps the avenue, for free.
    const street = planRoad(w, roadPath({ x: 0, y: 0 }, { x: 3, y: 0 }, true), RoadType.Road);
    expect(street.cost).toBe(0);
    expect(street.tiles.every((t) => t.valid)).toBe(true);
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

describe('bridges', () => {
  /** Grass world with a vertical river (all y) at the given x columns. */
  function riverWorld(cols: number[], n = 12): World {
    const w = grassWorld(n);
    for (let y = 0; y < n; y++) for (const x of cols) w.terrain[w.index(x, y)] = Terrain.ShallowWater;
    return w;
  }

  it('crosses water in a straight line from land to land', () => {
    const w = riverWorld([3, 4, 5]);
    const plan = planRoad(w, roadPath({ x: 1, y: 2 }, { x: 7, y: 2 }, false), RoadType.Road);
    expect(plan.tiles.every((t) => t.valid)).toBe(true);
    expect(plan.tiles.filter((t) => t.bridge === BridgeAxis.X)).toHaveLength(3);
    expect(plan.cost).toBe(4 * BALANCE.roadCost + 3 * BALANCE.bridgeCost);
  });

  it('a bridge must start and land on buildable land', () => {
    const w = riverWorld([3, 4, 5]);
    w.terrain[w.index(6, 2)] = Terrain.Rock; // far bank is rock
    const plan = planRoad(w, roadPath({ x: 1, y: 2 }, { x: 8, y: 2 }, false), RoadType.Road);
    expect(plan.tiles.map((t) => t.valid)).toEqual([true, true, false, false, false, false, true, true]);
  });

  it('cannot end over water', () => {
    const w = riverWorld([3, 4, 5]);
    const plan = planRoad(w, roadPath({ x: 1, y: 2 }, { x: 4, y: 2 }, false), RoadType.Road);
    expect(plan.tiles.map((t) => t.valid)).toEqual([true, true, false, false]);
  });

  it('cannot start in water', () => {
    const w = riverWorld([3, 4, 5]);
    const plan = planRoad(w, roadPath({ x: 4, y: 2 }, { x: 7, y: 2 }, false), RoadType.Road);
    // No bridge from mid-river; the land after it still builds.
    expect(plan.tiles.map((t) => t.valid)).toEqual([false, false, true, true]);
  });

  it('cannot bend over water', () => {
    const w = riverWorld([3, 4, 5]);
    // L-path: along x to (4,2), then turns along y while still in the river.
    const plan = planRoad(w, roadPath({ x: 1, y: 2 }, { x: 4, y: 6 }, false), RoadType.Road);
    expect(plan.tiles.filter((t) => t.valid).every((t) => w.terrain[w.index(t.x, t.y)] === Terrain.Grass)).toBe(true);
  });

  it('respects the maximum span', () => {
    const span = BALANCE.maxBridgeSpan + 1;
    const w = riverWorld(Array.from({ length: span }, (_, k) => 2 + k), span + 6);
    const plan = planRoad(w, roadPath({ x: 1, y: 0 }, { x: span + 3, y: 0 }, true), RoadType.Road);
    // The too-long crossing is red as a whole; the land on both sides still builds.
    expect(plan.tiles.filter((t) => t.valid).map((t) => t.x)).toEqual([1, span + 2, span + 3]);
  });

  it('applies the bridge axis and clearing removes it', () => {
    const w = riverWorld([3]);
    const city = new City(w, 10_000);
    const plan = planRoad(w, roadPath({ x: 3, y: 1 }, { x: 3, y: 1 }, false), RoadType.Road);
    expect(plan.count).toBe(0); // a lone tile in water is not a bridge
    const vertical = planRoad(w, roadPath({ x: 2, y: 5 }, { x: 4, y: 5 }, true), RoadType.Highway);
    applyRoad(city, vertical, RoadType.Highway);
    expect(w.bridge[w.index(3, 5)]).toBe(BridgeAxis.X);
    applyClear(city, planClear(w, [{ x: 3, y: 5 }]));
    expect(w.bridge[w.index(3, 5)]).toBe(BridgeAxis.None);
    expect(w.road[w.index(3, 5)]).toBe(RoadType.None);
  });

  /** Grass world with a rectangular lake covering x0..x1, y0..y1. */
  function lakeWorld(x0: number, x1: number, y0: number, y1: number): World {
    const w = grassWorld(12);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) w.terrain[w.index(x, y)] = Terrain.ShallowWater;
    return w;
  }

  it('bridges only connect along their axis', () => {
    const w = riverWorld([3]);
    w.terrain[w.index(3, 4)] = Terrain.Grass; // a bit of bank right beside the bridge
    const city = new City(w, 10_000);
    applyRoad(city, planRoad(w, roadPath({ x: 2, y: 5 }, { x: 4, y: 5 }, true), RoadType.Road), RoadType.Road);
    w.road[w.index(3, 4)] = RoadType.Road;
    expect(roadMask(w, 3, 5)).toBe(0b1010); // the bridge ignores the road on its side
    expect(roadMask(w, 3, 4)).toBe(0); // and that road doesn't branch into the bridge
  });

  it('cannot cross an existing bridge sideways', () => {
    const w = lakeWorld(3, 5, 3, 7);
    const city = new City(w, 10_000);
    applyRoad(city, planRoad(w, roadPath({ x: 2, y: 5 }, { x: 6, y: 5 }, true), RoadType.Road), RoadType.Road);
    const across = planRoad(w, roadPath({ x: 4, y: 2 }, { x: 4, y: 8 }, true), RoadType.Road);
    const at = (x: number, y: number) => across.tiles.find((t) => t.x === x && t.y === y)!;
    // The whole crossing is refused (half a bridge would dangle); the banks still build.
    for (let y = 3; y <= 7; y++) expect(at(4, y).valid).toBe(false);
    expect(at(4, 2).valid && at(4, 8).valid).toBe(true);
  });
});
