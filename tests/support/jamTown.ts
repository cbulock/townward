import { City } from '../../src/sim/City';
import { applyPlace, applyRoad, applyZone, planPlace, planRoad, planZone } from '../../src/sim/commands';
import { Simulation } from '../../src/sim/core/Simulation';
import { rectTiles, roadPath, RoadType } from '../../src/sim/roads';
import { Terrain } from '../../src/sim/terrain/types';
import { World } from '../../src/sim/World';
import { ZoneType } from '../../src/sim/zones';

/**
 * The layout from the user's gridlock screenshot: a residential district and a job district
 * joined by one long connector road, with power, water and all four services. Grown for a
 * few months so it has about 2,000 residents.
 */
export function jamTown(days = 150): Simulation {
  const w = new World(64, 64, 7);
  w.terrain.fill(Terrain.Grass);
  const city = new City(w, 1e9);
  const road = (ax: number, ay: number, bx: number, by: number) =>
    applyRoad(city, planRoad(w, roadPath({ x: ax, y: ay }, { x: bx, y: by }, true), RoadType.Road), RoadType.Road);
  // Homes along y = 10 (x 4..40), jobs along y = 50 (x 4..40), one connector at x = 40.
  road(4, 10, 40, 10);
  road(4, 50, 40, 50);
  road(40, 10, 40, 50);
  const place = (id: Parameters<typeof planPlace>[1], x: number, y: number) => applyPlace(city, planPlace(w, id, x, y), 0);
  place('power_plant', 42, 11);
  place('power_plant', 42, 13);
  place('water_tower', 41, 9);
  place('water_tower', 42, 9);
  place('police_station', 20, 11);
  place('fire_station', 21, 11);
  place('clinic', 22, 11);
  place('school', 23, 11);
  place('police_station', 20, 49);
  place('fire_station', 21, 49);
  const zone = (x0: number, y0: number, x1: number, y1: number, z: Parameters<typeof planZone>[2]) =>
    applyZone(city, planZone(w, rectTiles({ x: x0, y: y0 }, { x: x1, y: y1 }), z), z);
  zone(4, 7, 39, 9, ZoneType.ResidentialHigh);
  zone(4, 11, 19, 13, ZoneType.Residential);
  zone(4, 51, 39, 53, ZoneType.Industrial);
  zone(4, 47, 19, 49, ZoneType.Commercial);
  const sim = new Simulation(city);
  sim.worldChanged({ roads: true });
  for (let d = 0; d < days; d++) sim.day();
  return sim;
}

export interface FlowStats {
  cars: number;
  /** Share of cars that barely moved over the last second (gridlock, or waiting at a red light). */
  stopped: number;
  /** Share that moved, but at under half their free speed (congestion). */
  slow: number;
}

/** Run traffic for `seconds` at rush hour and report the last second. */
export function runTraffic(sim: Simulation, seconds: number): FlowStats {
  const t = sim.traffic.traffic;
  const dt = 1 / 30;
  for (let k = 0; k < seconds / dt; k++) t.update(dt, 8);
  const before = new Map(t.agents.filter((a) => a.kind !== 'person').map((a) => [a, a.seg + a.t]));
  for (let k = 0; k < 30; k++) t.update(dt, 8);
  let stopped = 0;
  let slow = 0;
  let cars = 0;
  for (const [a, p] of before) {
    if (!t.agents.includes(a)) continue;
    cars++;
    const moved = a.seg + a.t - p;
    if (moved < 0.05) stopped++;
    else if (moved < a.speed * 0.5) slow++;
  }
  return { cars, stopped: cars === 0 ? 0 : stopped / cars, slow: cars === 0 ? 0 : slow / cars };
}
