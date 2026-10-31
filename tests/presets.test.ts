import { describe, expect, it } from 'vitest';
import { generateRiverValley, generateTerrain } from '../src/sim/terrain/generate';
import { PRESET_IDS, presetSettings } from '../src/sim/terrain/presets';
import { Terrain } from '../src/sim/terrain/types';
import type { World } from '../src/sim/World';

function hash(w: World): number {
  let h = 2166136261;
  for (const layer of [w.terrain, w.tree, w.decor, w.variant]) for (const v of layer) h = Math.imul(h ^ v, 16777619) >>> 0;
  return h;
}

function share(w: World, pred: (t: number, i: number) => boolean): number {
  let c = 0;
  w.terrain.forEach((t, i) => {
    if (pred(t, i)) c++;
  });
  return c / w.terrain.length;
}

const isWater = (t: number) => t === Terrain.DeepWater || t === Terrain.ShallowWater;

describe('terrain presets', () => {
  it('River Valley at its defaults is still the approved map (byte-identical)', () => {
    expect(hash(generateRiverValley({ seed: 42, size: 128 }))).toBe(3805481968);
    expect(hash(generateRiverValley({ seed: 7, size: 64 }))).toBe(238731292);
  });

  it('every preset is deterministic and generates 128×128 within budget', () => {
    for (const p of PRESET_IDS) {
      const t0 = performance.now();
      const a = generateTerrain(presetSettings(p, 99, 128));
      expect(performance.now() - t0).toBeLessThan(150);
      expect(hash(generateTerrain(presetSettings(p, 99, 128)))).toBe(hash(a));
      // Always leave room to build.
      expect(share(a, (t) => !isWater(t) && t !== Terrain.Rock)).toBeGreaterThan(0.35);
    }
  });

  it('presets look like their names', () => {
    const island = generateTerrain(presetSettings('island', 5, 128));
    const n = island.width;
    // Water all around the edge, land in the middle.
    expect(isWater(island.terrain[0]) && isWater(island.terrain[n * n - 1])).toBe(true);
    expect(isWater(island.terrain[(n / 2) * n + n / 2])).toBe(false);

    const forest = (p: Parameters<typeof presetSettings>[0]) => {
      const w = generateTerrain(presetSettings(p, 5, 128));
      return share(w, (_, i) => w.tree[i] > 0);
    };
    expect(forest('forested')).toBeGreaterThan(forest('riverValley'));
    expect(forest('plains')).toBeLessThan(forest('riverValley'));

    const plains = generateTerrain(presetSettings('plains', 5, 128));
    expect(share(plains, (t) => t === Terrain.DryGrass || t === Terrain.Dirt)).toBeGreaterThan(0.1);

    const lakes = generateTerrain(presetSettings('lakes', 5, 128));
    const valley = generateTerrain(presetSettings('riverValley', 5, 128));
    expect(share(lakes, isWater)).toBeGreaterThan(share(valley, isWater));
  });

  it('sliders change the map: more water, fewer trees, no rivers', () => {
    const base = presetSettings('riverValley', 11, 128);
    const wet = generateTerrain({ ...base, water: 1 });
    const dry = generateTerrain({ ...base, water: 0, rivers: 0 });
    expect(share(wet, isWater)).toBeGreaterThan(share(dry, isWater));
    const bare = generateTerrain({ ...base, trees: 0 });
    const lush = generateTerrain({ ...base, trees: 1 });
    expect(share(lush, (_, i) => lush.tree[i] > 0)).toBeGreaterThan(share(bare, (_, i) => bare.tree[i] > 0) * 2);
  });
});
