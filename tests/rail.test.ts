import { describe, expect, it } from 'vitest';
import { City } from '../src/sim/City';
import { applyPlace, applyRail, applyRoad, planPlace, planRail, planRoad } from '../src/sim/commands';
import { Simulation } from '../src/sim/core/Simulation';
import { Rail, railMask, railNetwork } from '../src/sim/rail';
import { roadPath, RoadType } from '../src/sim/roads';
import { deserialize, parseSave, serialize } from '../src/sim/save';
import { Terrain } from '../src/sim/terrain/types';
import { World } from '../src/sim/World';

/** Rail (docs/specs/evolution.md, E7b). */
function flat(n = 40) {
  const w = new World(n, n, 2);
  w.terrain.fill(Terrain.Grass);
  return { w, city: new City(w, 1e9) };
}
const rail = (city: City, a: { x: number; y: number }, b: { x: number; y: number }) => applyRail(city, planRail(city.world, roadPath(a, b, true)));
const road = (city: City, a: { x: number; y: number }, b: { x: number; y: number }) =>
  applyRoad(city, planRoad(city.world, roadPath(a, b, true), RoadType.Road), RoadType.Road);

describe('rail track', () => {
  it('joins in every direction, crosses a street at right angles, but never runs along one', () => {
    const { w, city } = flat();
    road(city, { x: 10, y: 2 }, { x: 10, y: 30 }); // a street running along y
    expect(rail(city, { x: 4, y: 12 }, { x: 16, y: 12 }).ok).toBe(true); // crosses it along x
    expect(w.rail[w.index(10, 12)]).toBe(Rail.Track);
    expect(w.road[w.index(10, 12)]).toBe(RoadType.Road); // a level crossing keeps both
    expect(railMask(w, 10, 12)).toBe(0b1010);
    const along = planRail(w, roadPath({ x: 10, y: 14 }, { x: 10, y: 20 }, true));
    expect(along.tiles.every((t) => !t.valid)).toBe(true);
  });

  it('bridges straight over water, and blocks zones and buildings on its tiles', () => {
    const { w, city } = flat();
    for (let y = 0; y < 40; y++) for (const x of [20, 21, 22]) w.terrain[w.index(x, y)] = Terrain.DeepWater;
    expect(rail(city, { x: 15, y: 8 }, { x: 28, y: 8 }).ok).toBe(true);
    expect(w.rail[w.index(21, 8)]).toBe(Rail.Bridge);
    expect(planPlace(w, 'park', 16, 8).ok).toBe(false);
  });

  it('a station needs track beside it; stations on one line know the ride between them', () => {
    const { w, city } = flat();
    road(city, { x: 2, y: 10 }, { x: 37, y: 10 });
    expect(planPlace(w, 'train_station', 5, 13).ok).toBe(false);
    expect(planPlace(w, 'train_station', 5, 13).note).toMatch(/track/);
    rail(city, { x: 2, y: 15 }, { x: 37, y: 15 });
    expect(applyPlace(city, planPlace(w, 'train_station', 5, 13), 0).ok).toBe(true);
    expect(applyPlace(city, planPlace(w, 'train_station', 33, 13), 0).ok).toBe(true);
    const sim = new Simulation(city);
    sim.worldChanged({ roads: true });
    const net = railNetwork(w);
    expect(net.stations).toHaveLength(2);
    expect(net.minutes[1]).toBeGreaterThan(0);
    expect(net.minutes[1]).toBeLessThan(Infinity);
  });

  it('needs the Rapid transit research in cities that lock by stage', () => {
    const { city } = flat();
    city.locked = true;
    expect(rail(city, { x: 2, y: 5 }, { x: 10, y: 5 })).toMatchObject({ ok: false, reason: 'locked' });
    city.research.done = 6;
    expect(rail(city, { x: 2, y: 5 }, { x: 10, y: 5 }).ok).toBe(true);
  });

  it('track survives a save', () => {
    const { w, city } = flat();
    rail(city, { x: 2, y: 5 }, { x: 10, y: 5 });
    const terrain = { preset: 'plains', seed: 2, size: 40, water: 0, trees: 0, rivers: 0, coastSides: 0 } as const;
    const loaded = deserialize(parseSave(JSON.parse(JSON.stringify(serialize(city, terrain, 'Rail')))));
    for (let x = 2; x <= 10; x++) expect(loaded.world.rail[loaded.world.index(x, 5)]).toBe(Rail.Track);
    expect(w.rail[w.index(11, 5)]).toBe(Rail.None);
  });
});

describe('commuting by train', () => {
  it('a line between a suburb and downtown takes 15%+ of commutes off the roads', () => {
    const w = new World(72, 40, 4);
    w.terrain.fill(Terrain.Grass);
    const city = new City(w, 1e9);
    // Suburb at the west, downtown at the east, joined by one long winding road.
    road(city, { x: 2, y: 8 }, { x: 14, y: 8 });
    road(city, { x: 14, y: 8 }, { x: 14, y: 34 });
    road(city, { x: 14, y: 34 }, { x: 58, y: 34 });
    road(city, { x: 58, y: 34 }, { x: 58, y: 8 });
    road(city, { x: 58, y: 8 }, { x: 70, y: 8 });
    const place = (id: Parameters<typeof planPlace>[1], x: number, y: number) => applyPlace(city, planPlace(w, id, x, y), 0);
    for (const x of [6, 7, 8]) place('power_plant', x * 2 - 6, 11);
    for (let x = 3; x < 13; x++) place('water_tower', x, 6);
    for (let x = 2; x < 13; x++) for (const y of [9, 10]) place('walkup', x, y);
    for (let x = 60; x < 70; x += 2) place('office_tower', x, 6);
    const sim = new Simulation(city);
    sim.worldChanged({ roads: true });
    sim.runDays(10);
    const before = sim.commute.report;
    expect(before.commuters).toBeGreaterThan(100);
    expect(before.trainRiders).toBe(0);

    // A straight line under the two districts, with a station at each end (3 tiles from the road).
    // It crosses the two north–south roads at right angles (level crossings).
    expect(rail(city, { x: 2, y: 13 }, { x: 70, y: 13 }).ok).toBe(true);
    expect(place('train_station', 2, 11).ok).toBe(true);
    expect(place('train_station', 68, 11).ok).toBe(true);
    sim.worldChanged({ roads: true });
    sim.runDays(10);
    const after = sim.commute.report;
    expect(after.trainRiders / after.commuters).toBeGreaterThan(0.15);
    // Fewer cars on the roads than before the line opened, though the town kept growing.
    expect(after.commuters - after.trainRiders).toBeLessThan(before.commuters);
  });
});
