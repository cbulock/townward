import { describe, expect, it } from 'vitest';
import { borderRing, generateBorderlands } from '../src/sim/terrain/borderlands';
import { smoothElevation, surfaceHeight } from '../src/sim/terrain/elevation';
import { generateTerrain } from '../src/sim/terrain/generate';
import { PRESET_IDS, presetSettings } from '../src/sim/terrain/presets';
import { Terrain } from '../src/sim/terrain/types';
import { World } from '../src/sim/World';

const isW = (t: number) => t === Terrain.DeepWater || t === Terrain.ShallowWater;

describe('flat terrain (D-051)', () => {
  it('every preset generates flat land', () => {
    for (const p of PRESET_IDS) {
      const w = generateTerrain(presetSettings(p, 3, 64));
      expect(Math.max(...w.elevation)).toBe(0);
    }
  });

  it('the height helpers still behave (the renderer reads them)', () => {
    const w = new World(8, 8, 0);
    w.terrain.fill(Terrain.Grass);
    w.elevation[w.index(4, 4)] = 9;
    smoothElevation(w);
    expect(w.elevation[w.index(4, 4)]).toBe(1);
    expect(surfaceHeight(w, 4.5, 4.5)).toBe(1);
  });
});

describe('borderlands', () => {
  it('copy the map in the middle, continue edge water outward and stay flat', () => {
    const map = generateTerrain(presetSettings('coastal', 4, 64));
    const ring = borderRing(64);
    const ext = generateBorderlands(map, ring);
    expect(ext.width).toBe(64 + 2 * ring);
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        expect(ext.terrain[ext.index(x + ring, y + ring)]).toBe(map.terrain[map.index(x, y)]);
      }
    }
    expect(Math.max(...ext.elevation)).toBe(0);
    let continued = 0;
    let edgeWater = 0;
    for (let x = 0; x < 64; x++) {
      if (!isW(map.terrain[map.index(x, 0)])) continue;
      edgeWater++;
      if (isW(ext.terrain[ext.index(x + ring, ring - 1)])) continued++;
    }
    expect(edgeWater === 0 || continued / edgeWater > 0.8).toBe(true);
  });
});
