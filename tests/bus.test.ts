import { describe, expect, it } from 'vitest';
import { City } from '../src/sim/City';
import { applyPlace, applyRoad, planPlace, planRoad } from '../src/sim/commands';
import { Simulation } from '../src/sim/core/Simulation';
import { roadPath, RoadType } from '../src/sim/roads';
import { Stage } from '../src/sim/stages';
import { Terrain } from '../src/sim/terrain/types';
import { World } from '../src/sim/World';

/** Bus stations (docs/specs/evolution.md, "Bus stations"). */
function town() {
  const w = new World(48, 48, 6);
  w.terrain.fill(Terrain.Grass);
  const city = new City(w, 1e9);
  const road = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    applyRoad(city, planRoad(w, roadPath(a, b, true), RoadType.Road), RoadType.Road);
  road({ x: 2, y: 20 }, { x: 45, y: 20 });
  road({ x: 30, y: 4 }, { x: 30, y: 44 });
  const place = (id: Parameters<typeof planPlace>[1], x: number, y: number) => applyPlace(city, planPlace(w, id, x, y), 0);
  for (const x of [40, 42, 44]) place('power_plant', x, 22);
  for (let x = 32; x < 39; x++) place('water_tower', x, 22);
  // Water reaches 14 tiles (D-093): towers by the homes and by the offices.
  for (const x of [6, 20]) place('water_tower', x, 22);
  place('water_tower', 29, 10);
  for (let x = 2; x < 28; x++) for (const y of [18, 19]) place('walkup', x, y);
  for (let y = 4; y < 16; y += 2) place('office_tower', 32, y);
  return { w, city, place };
}

describe('bus stations', () => {
  it('unlock with the Town stage in cities that lock, and face the street they are built against', () => {
    const { w, city, place } = town();
    city.locked = true;
    city.stage = Stage.Village;
    expect(place('bus_station', 10, 23)).toMatchObject({ ok: false, reason: 'locked' });
    city.stage = Stage.Town;
    expect(place('bus_station', 10, 23).ok).toBe(true);
    const st = [...w.buildings.values()].find((b) => b.def === 'bus_station');
    expect(st?.variant).toBe(0); // the street is along its north-east side (y − 1)
  });

  it('runs a fleet: buses leave its bays, run round trips over the roads, and come back', () => {
    const { w, city, place } = town();
    place('bus_station', 10, 23);
    const sim = new Simulation(city);
    sim.worldChanged({ roads: true });
    sim.runDays(3);
    const st = [...w.buildings.values()].find((b) => b.def === 'bus_station');
    expect(st && st.entrance !== -1).toBe(true);
    if (!st) return;
    const traffic = sim.traffic.traffic;
    let most = 0;
    for (let f = 0; f < 600; f++) {
      traffic.update(1 / 10, 8);
      most = Math.max(most, traffic.fleetOut(st.entrance));
    }
    expect(most).toBeGreaterThanOrEqual(2);
    expect(most).toBeLessThanOrEqual(4);
    const bus = traffic.agents.find((a) => a.kind === 'bus' && a.path[0] === st.entrance);
    expect(bus?.path[bus.path.length - 1]).toBe(st.entrance);
  });

  it('nearby homes send some commuters by bus, taking cars off the roads', () => {
    const { city, place } = town();
    const sim = new Simulation(city);
    sim.worldChanged({ roads: true });
    sim.runDays(8);
    const before = sim.commute.report;
    expect(before.busRiders).toBe(0);
    place('bus_station', 10, 23);
    sim.worldChanged({ roads: true });
    sim.runDays(1);
    const after = sim.commute.report;
    expect(after.busRiders).toBeGreaterThan(0);
    expect(after.busRiders / after.commuters).toBeGreaterThan(0.05);
  });
});
