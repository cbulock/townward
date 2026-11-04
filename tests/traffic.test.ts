import { describe, expect, it } from 'vitest';
import { City } from '../src/sim/City';
import { Simulation } from '../src/sim/core/Simulation';
import { applyPlace, applyRoad, planPlace, planRoad } from '../src/sim/commands';
import { updateRoadAccess } from '../src/sim/systems/access';
import { roadPath, RoadType } from '../src/sim/roads';
import { Terrain } from '../src/sim/terrain/types';
import { computeBusStops, findRoute, outboundShare, Traffic, TRAFFIC, tripRate, type Agent } from '../src/sim/systems/traffic';
import { World } from '../src/sim/World';

function grid() {
  const w = new World(24, 24, 0);
  w.terrain.fill(Terrain.Grass);
  const city = new City(w, 1_000_000);
  const road = (ax: number, ay: number, bx: number, by: number) =>
    applyRoad(city, planRoad(w, roadPath({ x: ax, y: ay }, { x: bx, y: by }, true), RoadType.Road), RoadType.Road);
  road(0, 10, 23, 10); // east–west
  road(10, 0, 10, 23); // north–south, crossing at (10, 10)
  return { w, city };
}

const car = (path: Int32Array, t: number): Agent => ({
  kind: 'car',
  path,
  seg: 0,
  t,
  speed: TRAFFIC.carSpeed,
  variant: 0,
  age: 0,
  wait: 0,
  dwell: 0,
  stopSeg: -1,
});

describe('rush hours', () => {
  it('peaks morning and evening, quiet at night', () => {
    expect(tripRate(8)).toBe(2);
    expect(tripRate(17.5)).toBe(2);
    expect(tripRate(13)).toBe(1);
    expect(tripRate(3)).toBeLessThan(0.5);
    expect(outboundShare(8)).toBeGreaterThan(0.5);
    expect(outboundShare(18)).toBeLessThan(0.5);
  });
});

describe('queuing', () => {
  it('a car stops behind the car ahead in its lane', () => {
    const { w } = grid();
    const traffic = new Traffic(w, 1);
    const path = findRoute(w, w.index(0, 10), w.index(8, 10))!;
    const lead = car(path, 0.9);
    lead.dwell = 100; // parked (as if at a stop)
    const back = car(path, 0);
    traffic.agents.push(lead, back);
    for (let k = 0; k < 60; k++) traffic.update(1 / 30);
    expect(lead.seg).toBe(0);
    expect(back.seg).toBe(0);
    // The follower closed up to the gap and stopped there.
    expect(back.t).toBeGreaterThan(0.4);
    expect(lead.t - back.t).toBeGreaterThanOrEqual(TRAFFIC.gap - 1e-9);
  });

  it('crossing traffic takes turns at a traffic light', () => {
    const { w } = grid();
    const traffic = new Traffic(w, 1);
    const ew = car(findRoute(w, w.index(8, 10), w.index(14, 10))!, 0);
    const ns = car(findRoute(w, w.index(10, 8), w.index(10, 14))!, 0);
    traffic.agents.push(ew, ns);
    let together = 0;
    for (let k = 0; k < 240; k++) {
      traffic.update(1 / 30);
      const inBox = (a: Agent) => {
        const at = (i: number) => a.path[i] === w.index(10, 10);
        return (at(a.seg + 1) && a.t >= 0.5) || (at(a.seg) && a.t < 0.5);
      };
      if (inBox(ew) && inBox(ns)) together++;
    }
    expect(together).toBe(0);
  });
});

describe('bus stops', () => {
  it('sit on straight road outside big buildings, spaced apart, facing the building', () => {
    const { w, city } = grid();
    applyPlace(city, planPlace(w, 'walkup', 3, 9), 0); // north of the east–west road
    applyPlace(city, planPlace(w, 'walkup', 4, 9), 0); // too close to the first for a second stop
    applyPlace(city, planPlace(w, 'small_office', 17, 11), 0); // south of it
    updateRoadAccess(w);
    for (const b of w.buildings.values()) b.occupants = 1;
    const stops = computeBusStops(w);
    expect(stops.length).toBe(2);
    const office = stops.find((s) => s.tile === w.index(17, 10));
    expect(office?.side).toBe(2);
  });
});

describe('junction control (docs/specs/transport.md, "Junctions")', () => {
  it('a quiet crossroads gives way; lights go up only when it gets busy, and stay up through small dips', () => {
    const w = new World(20, 20, 1);
    w.terrain.fill(Terrain.Grass);
    const city = new City(w, 1e9);
    applyRoad(city, planRoad(w, roadPath({ x: 2, y: 10 }, { x: 18, y: 10 }, true), RoadType.Road), RoadType.Road);
    applyRoad(city, planRoad(w, roadPath({ x: 10, y: 2 }, { x: 10, y: 18 }, true), RoadType.Road), RoadType.Road);
    const sim = new Simulation(city);
    sim.worldChanged({ roads: true });
    sim.runDays(1);
    const lights = () => sim.traffic.traffic.lights().length;
    expect(lights()).toBe(0);
    const junction = w.index(10, 10);
    sim.commute.congestion[junction] = 0.5;
    sim.traffic.traffic.updateControls();
    expect(lights()).toBe(1);
    sim.commute.congestion[junction] = 0.3; // inside the band: lights stay
    sim.traffic.traffic.updateControls();
    expect(lights()).toBe(1);
    sim.commute.congestion[junction] = 0.1;
    sim.traffic.traffic.updateControls();
    expect(lights()).toBe(0);
  });
});

describe('bus stops', () => {
  it('never go on a highway, where a stopped bus would block the road', () => {
    const w = new World(30, 12, 3);
    w.terrain.fill(Terrain.Grass);
    const city = new City(w, 1e9);
    applyRoad(city, planRoad(w, roadPath({ x: 0, y: 5 }, { x: 29, y: 5 }, true), RoadType.Highway), RoadType.Highway);
    for (let x = 2; x < 28; x += 2) applyPlace(city, planPlace(w, 'apartment_block', x, 3), 0);
    updateRoadAccess(w);
    expect(computeBusStops(w)).toHaveLength(0);
  });
});
