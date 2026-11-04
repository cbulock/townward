import { describe, expect, it } from 'vitest';
import { City } from '../src/sim/City';
import { applyClear, applyPlace, applyRoad, planClear, planPlace, planRoad } from '../src/sim/commands';
import { Simulation } from '../src/sim/core/Simulation';
import { rectTiles, roadPath, RoadType } from '../src/sim/roads';
import { findRoute } from '../src/sim/systems/traffic';
import { Terrain } from '../src/sim/terrain/types';
import { World } from '../src/sim/World';

/** Flyovers (docs/specs/transport.md, TX2). */
function crossing() {
  const w = new World(24, 24, 3);
  w.terrain.fill(Terrain.Grass);
  const city = new City(w, 1e9);
  applyRoad(city, planRoad(w, roadPath({ x: 1, y: 12 }, { x: 22, y: 12 }, true), RoadType.Road), RoadType.Road);
  const plan = planRoad(w, roadPath({ x: 12, y: 1 }, { x: 12, y: 22 }, true), RoadType.Road, { flyover: true });
  applyRoad(city, plan, RoadType.Road);
  return { w, city, plan };
}

describe('flyovers', () => {
  it('carries the new road over the crossing road on a deck, priced as a flyover', () => {
    const { w, plan } = crossing();
    const i = w.index(12, 12);
    expect(w.road[i]).toBe(RoadType.Road); // the road underneath stays
    expect(w.over[i]).toBe(RoadType.Road); // the deck above it
    expect(w.overAxis[i]).toBe(2); // running along y
    expect(plan.tiles.find((t) => t.x === 12 && t.y === 12)?.overAxis).toBe(2);
  });

  it('the two roads never meet: straight on works on both levels, turning there does not', () => {
    const { w } = crossing();
    const west = w.index(1, 12);
    const east = w.index(22, 12);
    const north = w.index(12, 1);
    const south = w.index(12, 22);
    expect(findRoute(w, west, east)).not.toBeNull();
    expect(findRoute(w, north, south)).not.toBeNull();
    expect(findRoute(w, west, south)).toBeNull();
  });

  it('puts up no junction or lights, and commuters use the deck', () => {
    const { w, city } = crossing();
    const place = (id: Parameters<typeof planPlace>[1], x: number, y: number) => applyPlace(city, planPlace(w, id, x, y), 0);
    place('power_plant', 2, 14);
    place('water_tower', 10, 3);
    place('water_tower', 10, 20);
    for (let y = 2; y < 8; y++) place('walkup', 13, y);
    for (let y = 16; y < 21; y += 2) place('office_tower', 13, y);
    const sim = new Simulation(city);
    sim.worldChanged({ roads: true });
    sim.runDays(5);
    expect(sim.traffic.traffic.lights()).toHaveLength(0);
    expect(sim.commute.deckVolume[w.index(12, 12)]).toBeGreaterThan(0);
  });

  it('clearing removes the deck too', () => {
    const { w, city } = crossing();
    applyClear(city, planClear(w, rectTiles({ x: 12, y: 12 }, { x: 12, y: 12 })));
    expect(w.over[w.index(12, 12)]).toBe(0);
  });
});

describe('saving flyovers', () => {
  it('keeps the deck and its axis', async () => {
    const { deserialize, parseSave, serialize } = await import('../src/sim/save');
    const { city } = crossing();
    const terrain = { preset: 'plains', seed: 3, size: 24, water: 0, trees: 0, rivers: 0, coastSides: 0 } as const;
    const loaded = deserialize(parseSave(JSON.parse(JSON.stringify(serialize(city, terrain, 'Fly')))));
    const i = loaded.world.index(12, 12);
    expect(loaded.world.over[i]).toBe(RoadType.Road);
    expect(loaded.world.overAxis[i]).toBe(2);
  });
});
