import { expect, it } from 'vitest';
import { toolPlanCanCommit, planTool } from '../src/game/tools';
import { World } from '../src/sim/World';
import { Terrain } from '../src/sim/terrain/types';
import { ZoneType } from '../src/sim/zones';

it('clearing a tree and adjacent empty ground remains confirmable', () => {
  const world = new World(8, 8, 0);
  world.terrain.fill(Terrain.Grass);
  world.tree[world.index(2, 2)] = 1;
  const p = planTool(
    world,
    'clear',
    { start: { x: 2, y: 2 }, current: { x: 3, y: 2 }, straight: false },
    null,
    'park',
    null,
  );
  expect(p).not.toBeNull();
  expect(toolPlanCanCommit(world, p!, 10000)).toBe(true);
  expect(toolPlanCanCommit(world, p!, 0)).toBe(false);
});

it('overlapping existing zoning is a no-op but obstructed zoning cannot partially apply', () => {
  const world = new World(8, 8, 0);
  world.terrain.fill(Terrain.Grass);
  world.zone[world.index(2, 2)] = ZoneType.Residential;
  const draft = { start: { x: 2, y: 2 }, current: { x: 3, y: 2 }, straight: false };
  const p = planTool(world, 'zone-r', draft, null, 'park', null);
  expect(toolPlanCanCommit(world, p!, 10000)).toBe(true);
  world.terrain[world.index(2, 2)] = Terrain.DeepWater;
  world.zone[world.index(2, 2)] = ZoneType.None;
  const blocked = planTool(world, 'zone-r', draft, null, 'park', null);
  expect(toolPlanCanCommit(world, blocked!, 10000)).toBe(false);
});
