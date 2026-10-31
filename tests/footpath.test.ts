import { describe, expect, it } from 'vitest';
import { RoadType } from '../src/sim/roads';
import { Terrain } from '../src/sim/terrain/types';
import { agentPose, findRoute, TRAFFIC, walkPoint, type Agent } from '../src/sim/systems/traffic';
import { World } from '../src/sim/World';

/** A street along y = 4 (x 0..9) with a side street down x = 5, and a highway along y = 8. */
function streets() {
  const w = new World(12, 12, 0);
  w.terrain.fill(Terrain.Grass);
  for (let x = 0; x < 10; x++) w.road[w.index(x, 4)] = RoadType.Road;
  for (let y = 5; y < 8; y++) w.road[w.index(5, y)] = RoadType.Road;
  for (let x = 0; x < 10; x++) w.road[w.index(x, 8)] = RoadType.Highway;
  return w;
}

const person = (path: Int32Array, seg: number, t: number): Agent => ({
  kind: 'person',
  path,
  seg,
  t,
  speed: 1,
  variant: 0,
  age: 0,
  wait: 0,
  dwell: 0,
  stopSeg: -1,
});

describe('pedestrians on footpaths', () => {
  it('walk on the right-hand footpath of a straight street', () => {
    const w = streets();
    const path = findRoute(w, w.index(1, 4), w.index(4, 4))!;
    for (const t of [0, 0.3, 0.7]) {
      const pose = agentPose(w, person(path, 1, t));
      // Eastbound: the right-hand side is +y, out on the footpath rather than the carriageway.
      expect(pose.y - 4.5).toBeCloseTo(TRAFFIC.sidewalkOffset);
    }
  });

  it('turn on the footpath corner (a mitre), never cutting across the junction', () => {
    const w = streets();
    // East along y = 4, then south down x = 5: a right turn.
    const path = findRoute(w, w.index(3, 4), w.index(5, 6))!;
    const k = path.indexOf(w.index(5, 4));
    const [x, y] = walkPoint(w, path, k);
    const o = TRAFFIC.sidewalkOffset;
    // Inside corner of the bend: both offsets applied.
    expect(x - 5.5).toBeCloseTo(-o);
    expect(y - 4.5).toBeCloseTo(o);
    // Every waypoint stays the footpath offset from the centre line on at least one axis.
    for (let i = 0; i < path.length; i++) {
      const [px, py] = walkPoint(w, path, i);
      const cx = (path[i] % w.width) + 0.5;
      const cy = Math.floor(path[i] / w.width) + 0.5;
      expect(Math.max(Math.abs(px - cx), Math.abs(py - cy))).toBeCloseTo(o);
    }
  });

  it('never stroll onto highways', async () => {
    const { Traffic } = await import('../src/sim/systems/traffic');
    const w = streets();
    const traffic = new Traffic(w, 5);
    // Spawn strolls straight from the internals: homes on the street and the highway.
    const internals = traffic as unknown as { homes: number[]; destinations: number[]; spawnPerson(): void };
    // Safe: the test pokes private demand lists so strolls start on both road types.
    internals.homes = [w.index(2, 4), w.index(3, 8), w.index(5, 6)];
    internals.destinations = [w.index(7, 8)];
    for (let k = 0; k < 200; k++) internals.spawnPerson();
    const people = traffic.agents.filter((a) => a.kind === 'person');
    expect(people.length).toBeGreaterThan(0);
    for (const a of people) for (const i of a.path) expect(w.road[i]).toBe(RoadType.Road);
  });
});
