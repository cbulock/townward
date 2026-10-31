import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/shared/balance';
import { City } from '../src/sim/City';
import { applyPlace, applyRoad, applyZone, planPlace, planRoad, planZone } from '../src/sim/commands';
import { Simulation } from '../src/sim/core/Simulation';
import { rectTiles, roadPath, RoadType } from '../src/sim/roads';
import { Terrain } from '../src/sim/terrain/types';
import { World } from '../src/sim/World';
import { ZoneType } from '../src/sim/zones';

/** A small town with a road, power, water, and a strip of homes zoned along it. */
function town() {
  const w = new World(24, 24, 0);
  w.terrain.fill(Terrain.Grass);
  const city = new City(w, 1_000_000);
  applyRoad(city, planRoad(w, roadPath({ x: 0, y: 8 }, { x: 23, y: 8 }, true), RoadType.Road), RoadType.Road);
  applyPlace(city, planPlace(w, 'power_plant', 20, 9), 0);
  applyPlace(city, planPlace(w, 'water_tower', 18, 9), 0);
  applyZone(city, planZone(w, rectTiles({ x: 0, y: 5 }, { x: 15, y: 7 }), ZoneType.Residential), ZoneType.Residential);
  return { w, city, sim: new Simulation(city) };
}

describe('simulation core', () => {
  it('an edit brings access, utilities and traffic up to date', () => {
    const { w, sim } = town();
    const plant = [...w.buildings.values()].find((b) => b.def === 'power_plant')!;
    expect(plant.entrance).toBe(-1);
    sim.worldChanged({ roads: true });
    expect(plant.entrance).not.toBe(-1);
    expect(sim.utilities.report.power.supply).toBe(4000);
  });

  it('a day grows the city and reports what changed; month end collects the budget', () => {
    const { city, sim } = town();
    sim.worldChanged({ roads: true });
    const first = sim.day();
    expect(city.day).toBe(1);
    expect(first.started.length).toBeGreaterThan(0);
    expect(first.changed.length).toBeGreaterThan(0);
    expect(first.budget).toBeNull();

    let budgetDays = 0;
    for (let d = 1; d < BALANCE.daysPerMonth * 2; d++) if (sim.day().budget) budgetDays++;
    expect(budgetDays).toBe(2);
    expect(sim.budget.last).not.toBeNull();
    // People moved into the finished homes.
    expect(sim.population).toBeDefined();
    expect([...city.world.buildings.values()].some((b) => b.def !== 'power_plant' && b.def !== 'water_tower' && b.occupants > 0)).toBe(true);
  });

  it('is deterministic: the same seed and actions give the same city', () => {
    const run = () => {
      const { w, sim } = town();
      sim.worldChanged({ roads: true });
      for (let d = 0; d < 60; d++) sim.day();
      return [...w.buildings.values()].map((b) => `${b.def}@${b.x},${b.y}:${b.occupants}`).join(' ');
    };
    expect(run()).toBe(run());
  });
});
