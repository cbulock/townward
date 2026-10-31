import { BALANCE } from '../shared/balance';
import { MAX_LEVEL } from '../shared/constants';
import { clearCost, type ApplyResult, type Plan, type PlannedTile } from './commands';
import type { City } from './City';
import { RoadType, type TilePos } from './roads';
import { isWaterTile } from './terrain/elevation';
import { Decor } from './terrain/types';
import type { World } from './World';

/**
 * Raise, lower and level (docs/specs/elevation.md, "Terraform Tools"). Each dragged tile
 * gets its new level, and neighbours ripple outward to keep 4-neighbours within one level.
 * Water, roads and buildings never move. A dragged tile whose ripple would need to move one
 * is refused (and its ripple undone).
 */

export type TerraformOp = { kind: 'raise' } | { kind: 'lower' } | { kind: 'level'; level: number };

export interface TerraformPlan extends Plan {
  /** Tile index → new level, for every tile that changes (dragged and ripple). */
  readonly changes: ReadonlyMap<number, number>;
}

function locked(world: World, i: number): boolean {
  return isWaterTile(world, i) || world.road[i] !== RoadType.None || world.building[i] !== -1;
}

function target(op: TerraformOp, current: number): number {
  if (op.kind === 'raise') return Math.min(MAX_LEVEL, current + 1);
  if (op.kind === 'lower') return Math.max(0, current - 1);
  return op.level;
}

export function planTerraform(world: World, region: readonly TilePos[], op: TerraformOp): TerraformPlan {
  const w = world.width;
  const changes = new Map<number, number>();
  const level = (i: number) => changes.get(i) ?? world.elevation[i];
  const dragged = new Set<number>();
  const refused = new Set<number>();
  for (const p of region) if (world.inBounds(p.x, p.y)) dragged.add(world.index(p.x, p.y));

  for (const start of dragged) {
    const want = target(op, level(start));
    if (want === level(start)) continue;
    if (locked(world, start)) {
      refused.add(start);
      continue;
    }
    // Try this tile's ripple on top of what's planned so far; roll back if it hits a locked tile.
    const attempt = new Map<number, number>([[start, want]]);
    const queue = [start];
    let ok = true;
    while (ok && queue.length > 0) {
      const i = queue.pop()!;
      const v = attempt.get(i)!;
      const x = i % w;
      const y = (i - x) / w;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        if (!world.inBounds(x + dx, y + dy)) continue;
        const j = world.index(x + dx, y + dy);
        const cur = attempt.get(j) ?? level(j);
        const fixed = Math.min(v + 1, Math.max(v - 1, cur));
        if (fixed === cur) continue;
        if (locked(world, j)) {
          ok = false;
          break;
        }
        attempt.set(j, fixed);
        queue.push(j);
      }
    }
    if (!ok) {
      refused.add(start);
      continue;
    }
    for (const [i, v] of attempt) changes.set(i, v);
  }

  // Drop entries that ended up back at their original level.
  for (const [i, v] of changes) if (v === world.elevation[i]) changes.delete(i);

  const tiles: PlannedTile[] = [];
  let cost = 0;
  for (const i of dragged) {
    if (changes.has(i) || refused.has(i)) continue;
    tiles.push({ x: i % w, y: Math.floor(i / w), valid: false, cost: 0 });
  }
  for (const i of refused) tiles.push({ x: i % w, y: Math.floor(i / w), valid: false, cost: 0 });
  for (const [i, v] of changes) {
    const c = Math.abs(v - world.elevation[i]) * BALANCE.terraformCost + clearCost(world, i);
    tiles.push({ x: i % w, y: Math.floor(i / w), valid: true, cost: c, ...(!dragged.has(i) && { ripple: true }) });
    cost += c;
  }
  return { tiles, cost, count: changes.size, changes };
}

export function applyTerraform(city: City, plan: TerraformPlan): ApplyResult {
  if (plan.changes.size === 0) return { ok: false, reason: 'nothing-to-do' };
  if (plan.cost > city.funds) return { ok: false, reason: 'insufficient-funds' };
  const w = city.world;
  for (const [i, v] of plan.changes) {
    w.elevation[i] = v;
    // Reshaped ground loses its trees and rocks.
    w.tree[i] = 0;
    w.decor[i] = Decor.None;
  }
  city.funds -= plan.cost;
  const valid = plan.tiles.filter((t) => t.valid);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const t of valid) {
    minX = Math.min(minX, t.x);
    minY = Math.min(minY, t.y);
    maxX = Math.max(maxX, t.x);
    maxY = Math.max(maxY, t.y);
  }
  return { ok: true, changed: { minX, minY, maxX, maxY }, tiles: valid };
}
