import { describe, expect, it } from 'vitest';
import { City } from '../src/sim/City';
import { applyPlace, applyRoad, planPlace, planRoad } from '../src/sim/commands';
import { Simulation } from '../src/sim/core/Simulation';
import { roadPath, RoadType, type BuildableRoad } from '../src/sim/roads';
import { ROAD_SPECS } from '../src/sim/roadTypes';
import { Terrain } from '../src/sim/terrain/types';
import { World } from '../src/sim/World';

/** Homes at the west end, jobs at the east, joined by one corridor of the given road type. */
function corridor(type: BuildableRoad) {
  const w = new World(64, 10, 5);
  w.terrain.fill(Terrain.Grass);
  const city = new City(w, 1e9);
  applyRoad(city, planRoad(w, roadPath({ x: 0, y: 5 }, { x: 63, y: 5 }, true), type), type);
  // Utilities right by the road (within the 3-tile access range).
  applyPlace(city, planPlace(w, 'power_plant', 30, 3), 0);
  applyPlace(city, planPlace(w, 'water_tower', 32, 4), 0);
  applyPlace(city, planPlace(w, 'water_tower', 33, 4), 0);
  for (let x = 0; x < 14; x++) for (const y of [3, 4, 6, 7]) applyPlace(city, planPlace(w, 'walkup', x, y), 0);
  for (let x = 50; x < 64; x += 2) for (const y of [3, 6]) applyPlace(city, planPlace(w, 'office_tower', x, y), 0);
  const sim = new Simulation(city);
  sim.worldChanged({ roads: true });
  sim.runDays(30);
  const mid = w.index(32, 5);
  return { congestion: sim.commute.congestion[mid], minutes: sim.commute.report.avgMinutes, commuters: sim.commute.report.commuters };
}

describe('road hierarchy (docs/specs/transport.md, T1)', () => {
  it('every road type is fully described, and bigger roads carry more, faster', () => {
    const order = [RoadType.Road, RoadType.Avenue, RoadType.Highway] as const;
    for (let k = 1; k < order.length; k++) {
      const a = ROAD_SPECS[order[k - 1]];
      const b = ROAD_SPECS[order[k]];
      expect(b.rank).toBeGreaterThan(a.rank);
      expect(b.capacity).toBeGreaterThan(a.capacity);
      expect(b.minutes).toBeLessThan(a.minutes);
    }
    expect(ROAD_SPECS[RoadType.Avenue].lanes).toHaveLength(2);
    expect(ROAD_SPECS[RoadType.Highway].footpath).toBeNull();
  });

  it('an avenue corridor jams less and commutes faster than a street', () => {
    const street = corridor(RoadType.Road);
    const avenue = corridor(RoadType.Avenue);
    expect(street.commuters).toBeGreaterThan(500);
    expect(avenue.congestion).toBeLessThan(street.congestion * 0.6);
    expect(avenue.minutes).toBeLessThan(street.minutes);
  });
});
