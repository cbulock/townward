import { describe, expect, it } from 'vitest';
import { City } from '../src/sim/City';
import { applyPlace, applyRoad, planPlace, planRoad } from '../src/sim/commands';
import { Simulation } from '../src/sim/core/Simulation';
import { roadPath, RoadType } from '../src/sim/roads';
import { demandFactor, sunFactor, windFactor } from '../src/sim/systems/energy';
import { Terrain } from '../src/sim/terrain/types';
import { World } from '../src/sim/World';
import type { BuildingId } from '../src/sim/buildings/catalog';

/** A road with some cottages (power need 3 each at peak) and the given power buildings. */
function grid(power: readonly BuildingId[], homes = 40) {
  const w = new World(48, 8, 7);
  w.terrain.fill(Terrain.Grass);
  const city = new City(w, 1e9);
  applyRoad(city, planRoad(w, roadPath({ x: 0, y: 3 }, { x: 47, y: 3 }, true), RoadType.Road), RoadType.Road);
  let x = 0;
  for (const id of power) {
    applyPlace(city, planPlace(w, id, x, 4), 0);
    x += id === 'solar_farm' || id === 'gas_plant' || id === 'power_plant' ? 2 : 1;
  }
  for (let k = 0; k < homes; k++) applyPlace(city, planPlace(w, 'cottage', k % 47, k < 47 ? 2 : 1), 0);
  const sim = new Simulation(city);
  sim.worldChanged({ roads: true });
  return sim;
}

/** Tick until the clock reads `hour` (the hourly step has then run for it). */
function runTo(sim: Simulation, hour: number) {
  for (let t = 0; t < 3000 && Math.floor(sim.city.hour) !== hour; t++) sim.tick();
}

describe('energy (docs/specs/energy.md)', () => {
  it('sun, wind and demand follow the clock and the days, the same every time', () => {
    expect(sunFactor(3)).toBe(0);
    expect(sunFactor(12)).toBeCloseTo(1);
    expect(sunFactor(20)).toBe(0);
    expect(demandFactor(19)).toBe(1);
    expect(demandFactor(3)).toBeLessThan(0.6);
    const winds = Array.from({ length: 60 }, (_, d) => windFactor(42, d));
    expect(Math.min(...winds)).toBeGreaterThanOrEqual(0.15);
    expect(Math.max(...winds) - Math.min(...winds)).toBeGreaterThan(0.2); // it really changes
    expect(windFactor(42, 17)).toBe(windFactor(42, 17));
  });

  it('a solar-only grid browns out at night and recovers at noon', () => {
    const sim = grid(['solar_farm']);
    runTo(sim, 2);
    expect(sim.utilities.report.power.short).toBe(40);
    runTo(sim, 12);
    expect(sim.utilities.report.power.short).toBe(0);
  });

  it('batteries charge on surplus and carry the evening', () => {
    const solarOnly = grid(['solar_farm']);
    const stored = grid(['solar_farm', 'solar_farm', 'battery_bank', 'battery_bank']);
    runTo(solarOnly, 12);
    runTo(stored, 12);
    runTo(solarOnly, 19);
    runTo(stored, 19);
    const banks = [...stored.world.buildings.values()].filter((b) => b.def === 'battery_bank');
    expect(banks.some((b) => b.stored > 0)).toBe(true);
    expect(solarOnly.utilities.report.power.short).toBe(40);
    expect(stored.utilities.report.power.short).toBe(0);
    expect(stored.utilities.report.power.sources.battery).toBeGreaterThan(0);
  });

  it('a steady plant covers every hour', () => {
    const sim = grid(['gas_plant']);
    for (const h of [2, 8, 13, 19, 23]) {
      runTo(sim, h);
      expect(sim.utilities.report.power.short).toBe(0);
      expect(sim.utilities.report.power.sources.gas).toBe(5000);
    }
  });

  it('plants with headroom never wear, however many there are; an overloaded grid does', () => {
    // Regression: wear compared the whole city's demand with ONE plant's output, so every
    // plant in a multi-plant city wore out and the city browned out for good.
    // Five turbines (2,000 together) under a row of apartments: more than one turbine's safe
    // share, well under the grid's.
    const turbines = ['wind_turbine', 'wind_turbine', 'wind_turbine', 'wind_turbine', 'wind_turbine'] as const;
    const healthy = grid(turbines, 0);
    for (let x = 0; x < 47; x++) applyPlace(healthy.city, planPlace(healthy.world, 'walkup', x, 2), 0);
    healthy.worldChanged({ roads: false });
    healthy.runDays(40);
    const demand = healthy.utilities.report.power.demand;
    expect(demand).toBeGreaterThan(400 * 0.8);
    expect(demand).toBeLessThan(2000 * 0.8);
    for (const b of healthy.world.buildings.values()) if (b.def === 'wind_turbine') expect(b.condition).toBe(1);

    // One wind turbine under two rows of apartments: the grid runs far above its safe share.
    const overloaded = grid(['wind_turbine'], 0);
    for (let x = 0; x < 47; x++) for (const y of [1, 2]) applyPlace(overloaded.city, planPlace(overloaded.world, 'walkup', x, y), 0);
    overloaded.worldChanged({ roads: false });
    overloaded.runDays(10);
    const plant = [...overloaded.world.buildings.values()].find((b) => b.def === 'wind_turbine');
    expect(overloaded.utilities.report.power.demand).toBeGreaterThan(400);
    expect(plant && (plant.condition < 1 || plant.repairDays > 0)).toBe(true);
  });
});
