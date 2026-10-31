import { describe, expect, it } from 'vitest';
import { generateRiverValley } from '../src/sim/terrain/riverValley';
import { Decor, Terrain } from '../src/sim/terrain/types';
import type { World } from '../src/sim/World';

const SEEDS = [1, 42, 1337, 9001, 123456];

function isWater(w: World, i: number) {
  return w.terrain[i] === Terrain.DeepWater || w.terrain[i] === Terrain.ShallowWater;
}

/** True if water connects the two opposite edges along either axis. */
function riverCrossesMap(w: World): boolean {
  const n = w.width;
  for (const alongX of [true, false]) {
    const seen = new Uint8Array(n * n);
    const stack: number[] = [];
    for (let k = 0; k < n; k++) {
      const i = alongX ? k * n : k;
      if (isWater(w, i)) {
        seen[i] = 1;
        stack.push(i);
      }
    }
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % n;
      const y = (i - x) / n;
      if (alongX ? x === n - 1 : y === n - 1) return true;
      const next = [x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1, y > 0 ? i - n : -1, y < n - 1 ? i + n : -1];
      for (const j of next) {
        if (j >= 0 && !seen[j] && isWater(w, j)) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
  }
  return false;
}

describe('River Valley generator', () => {
  it('is deterministic for a given seed', () => {
    const a = generateRiverValley({ seed: 77, size: 128 });
    const b = generateRiverValley({ seed: 77, size: 128 });
    expect(a.terrain).toEqual(b.terrain);
    expect(a.tree).toEqual(b.tree);
    expect(a.variant).toEqual(b.variant);
  });

  it('produces different maps for different seeds', () => {
    const a = generateRiverValley({ seed: 1, size: 64 });
    const b = generateRiverValley({ seed: 2, size: 64 });
    expect(a.terrain).not.toEqual(b.terrain);
  });

  it.each(SEEDS)('seed %i: a river crosses the whole map', (seed) => {
    expect(riverCrossesMap(generateRiverValley({ seed, size: 128 }))).toBe(true);
  });

  it.each(SEEDS)('seed %i: no isolated 1-tile water or land specks', (seed) => {
    const w = generateRiverValley({ seed, size: 128 });
    const n = w.width;
    for (let y = 1; y < n - 1; y++) {
      for (let x = 1; x < n - 1; x++) {
        const i = y * n + x;
        const self = isWater(w, i);
        const same = [i - 1, i + 1, i - n, i + n].filter((j) => isWater(w, j) === self).length;
        expect(same, `tile ${x},${y}`).toBeGreaterThan(0);
      }
    }
  });

  it.each(SEEDS)('seed %i: sensible terrain mix', (seed) => {
    const w = generateRiverValley({ seed, size: 128 });
    const total = w.terrain.length;
    const count = (t: number) => w.terrain.filter((v) => v === t).length / total;
    const water = count(Terrain.DeepWater) + count(Terrain.ShallowWater);
    expect(water).toBeGreaterThan(0.03);
    expect(water).toBeLessThan(0.3);
    expect(count(Terrain.Grass)).toBeGreaterThan(0.35);
    expect(count(Terrain.Sand)).toBeGreaterThan(0.005);
    const trees = w.tree.filter((d) => d > 0).length / total;
    expect(trees).toBeGreaterThan(0.1);
    expect(trees).toBeLessThan(0.6);
  });

  it('never puts trees on water, sand or rock', () => {
    const w = generateRiverValley({ seed: 5, size: 128 });
    for (let i = 0; i < w.terrain.length; i++) {
      if (w.tree[i] > 0) {
        expect([Terrain.Grass, Terrain.DryGrass]).toContain(w.terrain[i]);
      }
    }
  });

  it('decorations sit on open ground (grass, or stones on sand)', () => {
    const w = generateRiverValley({ seed: 8, size: 128 });
    let count = 0;
    for (let i = 0; i < w.decor.length; i++) {
      if (w.decor[i] === Decor.None) continue;
      count++;
      expect([Terrain.Grass, Terrain.Sand]).toContain(w.terrain[i]);
      if (w.terrain[i] === Terrain.Sand) expect(w.decor[i]).toBe(Decor.Rocks);
      expect(w.tree[i]).toBe(0);
    }
    expect(count).toBeGreaterThan(50);
  });

  it('generates 128×128 within the live-preview budget', () => {
    generateRiverValley({ seed: 3, size: 128 }); // warm up JIT
    const t0 = performance.now();
    generateRiverValley({ seed: 4, size: 128 });
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(100);
  });
});
