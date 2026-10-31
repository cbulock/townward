import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/shared/balance';
import { BUILDINGS } from '../src/sim/buildings/catalog';
import { City } from '../src/sim/City';
import { applyPlace, applyRoad, planPlace, planRoad } from '../src/sim/commands';
import { cityStats, collectBudget, monthlyBudget, simulateDay, updateRoadAccess } from '../src/sim/population';
import { roadPath, RoadType } from '../src/sim/roads';
import { Terrain } from '../src/sim/terrain/types';
import { agentPose, findRoute, Traffic } from '../src/sim/traffic';
import { World } from '../src/sim/World';

function town() {
  const w = new World(16, 16, 0);
  w.terrain.fill(Terrain.Grass);
  const city = new City(w, 100_000);
  // A road along y = 5 from x = 0..15.
  applyRoad(city, planRoad(w, roadPath({ x: 0, y: 5 }, { x: 15, y: 5 }, true), RoadType.Road), RoadType.Road);
  return { w, city };
}

const place = (city: City, id: Parameters<typeof planPlace>[1], x: number, y: number) =>
  applyPlace(city, planPlace(city.world, id, x, y), 0);

describe('road access', () => {
  it('finds a road touching the footprint', () => {
    const { w, city } = town();
    place(city, 'cottage', 2, 4); // just north of the road
    place(city, 'cottage', 2, 1); // far from it
    updateRoadAccess(w);
    const [near, far] = [...w.buildings.values()];
    expect(near.entrance).toBe(w.index(2, 5));
    expect(far.entrance).toBe(-1);
  });
});

describe('population and jobs', () => {
  it('homes with road access fill up over days; cut-off homes stay empty', () => {
    const { w, city } = town();
    place(city, 'walkup', 3, 4);
    place(city, 'walkup', 3, 1);
    updateRoadAccess(w);
    for (let d = 0; d < 40; d++) simulateDay(w);
    const [connected, isolated] = [...w.buildings.values()];
    expect(connected.occupants).toBeGreaterThan(0);
    expect(isolated.occupants).toBe(0);
  });

  it('without jobs homes stop part-full; adding jobs lets them fill', () => {
    const { w, city } = town();
    place(city, 'walkup', 3, 4);
    updateRoadAccess(w);
    for (let d = 0; d < 60; d++) simulateDay(w);
    const home = [...w.buildings.values()][0];
    const capped = home.occupants;
    expect(capped).toBeLessThanOrEqual(Math.round(BUILDINGS.walkup.capacity * BALANCE.minHousingFill));

    place(city, 'small_office', 6, 4);
    updateRoadAccess(w);
    for (let d = 0; d < 60; d++) simulateDay(w);
    expect(home.occupants).toBeGreaterThan(capped);
    const stats = cityStats(w);
    expect(stats.workers).toBeGreaterThan(0);
    expect(stats.workers).toBeLessThanOrEqual(Math.floor(stats.population * BALANCE.workforceShare));
  });

  it('never exceeds capacity', () => {
    const { w, city } = town();
    place(city, 'cottage', 1, 4);
    place(city, 'office_tower', 4, 3);
    updateRoadAccess(w);
    for (let d = 0; d < 200; d++) simulateDay(w);
    for (const b of w.buildings.values()) expect(b.occupants).toBeLessThanOrEqual(BUILDINGS[b.def].capacity);
  });

  it('losing road access empties a building', () => {
    const { w, city } = town();
    place(city, 'cottage', 2, 4);
    updateRoadAccess(w);
    for (let d = 0; d < 10; d++) simulateDay(w);
    w.road.fill(RoadType.None);
    updateRoadAccess(w);
    expect([...w.buildings.values()][0].occupants).toBe(0);
  });
});

describe('budget', () => {
  it('taxes residents and workers, pays road upkeep', () => {
    const { w, city } = town();
    const empty = monthlyBudget(w);
    expect(empty.income).toBe(0);
    expect(empty.expenses).toBe(Math.round(16 * BALANCE.roadUpkeep));
    place(city, 'walkup', 3, 4);
    updateRoadAccess(w);
    for (let d = 0; d < 30; d++) simulateDay(w);
    const before = city.funds;
    const r = collectBudget(city);
    expect(r.income).toBeGreaterThan(0);
    expect(city.funds).toBe(before + r.net);
  });

  it('calendar rolls months and years', () => {
    const { city } = town();
    city.day = BALANCE.daysPerMonth * 13 + 4;
    expect(city.date).toEqual({ year: 2, month: 1, dayOfMonth: 5 });
  });
});

describe('traffic', () => {
  it('routes along connected roads only', () => {
    const { w } = town();
    const r = findRoute(w, w.index(0, 5), w.index(9, 5));
    expect(r).not.toBeNull();
    expect(r!.length).toBe(10);
    expect(findRoute(w, w.index(0, 5), w.index(0, 6))).toBeNull(); // not a road
  });

  it('cars spawn from populated homes and drive to destinations', () => {
    const { w, city } = town();
    place(city, 'apartment_block', 3, 3);
    place(city, 'office_tower', 10, 3);
    updateRoadAccess(w);
    for (let d = 0; d < 60; d++) simulateDay(w);
    const traffic = new Traffic(w, 7);
    traffic.refreshDemand();
    for (let k = 0; k < 200; k++) traffic.update(0.1);
    const cars = traffic.agents.filter((a) => a.kind !== 'person');
    expect(cars.length).toBeGreaterThan(0);
    for (const a of traffic.agents) {
      const pose = agentPose(w, a);
      // Everyone stays within half a tile of the road (y = 5).
      expect(Math.abs(pose.y - 5.5)).toBeLessThan(0.6);
    }
  });

  it('drives on the right: eastbound cars sit south of the centre line', () => {
    const { w } = town();
    const path = findRoute(w, w.index(1, 5), w.index(6, 5))!;
    const pose = agentPose(w, { kind: 'car', path, seg: 1, t: 0.5, speed: 1, variant: 0, age: 0, wait: 0, dwell: 0, stopSeg: -1 });
    expect(pose.dir).toBe(1);
    expect(pose.y).toBeGreaterThan(5.5);
  });

  it('removing roads drops agents on them', () => {
    const { w, city } = town();
    place(city, 'walkup', 3, 4);
    place(city, 'small_office', 9, 4);
    updateRoadAccess(w);
    for (let d = 0; d < 40; d++) simulateDay(w);
    const traffic = new Traffic(w, 3);
    traffic.refreshDemand();
    for (let k = 0; k < 100; k++) traffic.update(0.1);
    w.road.fill(RoadType.None);
    traffic.invalidateRoutes();
    expect(traffic.agents).toHaveLength(0);
  });
});
