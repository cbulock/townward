import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/shared/balance';
import { City } from '../src/sim/City';
import { applyPlace, applyRoad, planPlace, planRoad } from '../src/sim/commands';
import { Simulation } from '../src/sim/core/Simulation';
import { roadPath, RoadType } from '../src/sim/roads';
import { cityStats } from '../src/sim/systems/population';
import { Terrain } from '../src/sim/terrain/types';
import { World } from '../src/sim/World';

/** A 40×40 town: one road along y = 20, with power and water at the east end. */
function town() {
  const w = new World(40, 40, 3);
  w.terrain.fill(Terrain.Grass);
  const city = new City(w, 1e9);
  applyRoad(city, planRoad(w, roadPath({ x: 0, y: 20 }, { x: 39, y: 20 }, true), RoadType.Road), RoadType.Road);
  const place = (id: Parameters<typeof planPlace>[1], x: number, y: number) => applyPlace(city, planPlace(w, id, x, y), 0);
  place('power_plant', 36, 21);
  place('water_tower', 35, 21);
  const sim = new Simulation(city);
  return { w, city, sim, place };
}

const building = (w: World, def: string, x: number) => [...w.buildings.values()].find((b) => b.def === def && b.x === x)!;

describe('needs and happiness', () => {
  it('a home with services, shops, parks and jobs nearby is happy; one without complains', () => {
    const { w, sim, place } = town();
    place('walkup', 4, 19); // serviced end
    place('walkup', 33, 19); // far end: nothing nearby but the power plant
    for (const id of ['police_station', 'fire_station', 'clinic'] as const) place(id, [5, 6, 7][['police_station', 'fire_station', 'clinic'].indexOf(id)], 21);
    place('school', 8, 21);
    place('corner_shop', 10, 21);
    place('small_office', 11, 21);
    place('park', 3, 19);
    place('park', 2, 19);
    sim.worldChanged({ roads: true });
    for (let d = 0; d < 20; d++) sim.day();
    const good = sim.needs.byBuilding.get(building(w, 'walkup', 4).id)!;
    const bad = sim.needs.byBuilding.get(building(w, 'walkup', 33).id)!;
    expect(good.happiness).toBeGreaterThan(0.7);
    expect(good.complaint).toBeNull();
    expect(bad.happiness).toBeLessThan(good.happiness);
    expect(bad.scores.safety).toBe(0);
    expect(bad.scores.air).toBeLessThan(1); // the power plant next door
    expect(sim.needs.report.complaints.length).toBeGreaterThan(0);
  });

  it('happier homes fill up more', () => {
    const { w, sim, place } = town();
    place('walkup', 4, 19);
    place('walkup', 30, 19);
    place('police_station', 5, 21);
    place('fire_station', 6, 21);
    place('clinic', 7, 21);
    place('school', 8, 21);
    place('small_office', 11, 21);
    sim.worldChanged({ roads: true });
    for (let d = 0; d < 60; d++) sim.day();
    expect(building(w, 'walkup', 4).occupants).toBeGreaterThan(building(w, 'walkup', 30).occupants);
  });

  it('a long unhappy spell abandons a building; fixing its needs brings it back', () => {
    const { w, sim, place } = town();
    place('factory', 20, 18); // industry with no services and nobody to work there
    const factory = building(w, 'factory', 20);
    sim.worldChanged({ roads: true });
    for (let d = 0; d < BALANCE.abandonDays + 5; d++) sim.day();
    expect(factory.abandoned).toBe(true);
    expect(factory.occupants).toBe(0);
    // Abandoned jobs don't count: only the power plant's and water tower's 50 remain.
    expect(cityStats(w).jobs).toBe(50);
    expect(sim.needs.byBuilding.get(factory.id)?.complaint).toBe('abandoned');

    // Services and a neighbourhood of workers fix it.
    place('police_station', 22, 21);
    place('fire_station', 23, 21);
    for (let x = 0; x < 10; x++) place('walkup', x, 19);
    for (let x = 0; x < 6; x++) place('clinic', 12 + x, 21);
    sim.worldChanged({ roads: false });
    for (let d = 0; d < BALANCE.recoverDays + 20; d++) sim.day();
    expect(factory.abandoned).toBe(false);
  });
});
