import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/shared/balance';
import { City } from '../src/sim/City';
import { applyRoad, planPlace, planRoad } from '../src/sim/commands';
import { rectTiles, roadPath, RoadType } from '../src/sim/roads';
import { applyTerraform, planTerraform } from '../src/sim/terraform';
import { isFlat, smoothElevation, surfaceHeight } from '../src/sim/terrain/elevation';
import { generateTerrain } from '../src/sim/terrain/generate';
import { presetSettings } from '../src/sim/terrain/presets';
import { Terrain } from '../src/sim/terrain/types';
import { World } from '../src/sim/World';

function flat(size = 16) {
  const w = new World(size, size, 0);
  w.terrain.fill(Terrain.Grass);
  return { w, city: new City(w, 1_000_000) };
}

/** Every pair of 4-neighbours differs by at most one level. */
function smooth(w: World): boolean {
  for (let y = 0; y < w.height; y++) {
    for (let x = 0; x < w.width; x++) {
      const h = w.elevation[w.index(x, y)];
      if (x + 1 < w.width && Math.abs(h - w.elevation[w.index(x + 1, y)]) > 1) return false;
      if (y + 1 < w.height && Math.abs(h - w.elevation[w.index(x, y + 1)]) > 1) return false;
    }
  }
  return true;
}

describe('elevation', () => {
  it('generated hills keep the slope rule, water at 0, and River Valley terrain unchanged', () => {
    for (const p of ['riverValley', 'forested', 'island'] as const) {
      const w = generateTerrain(presetSettings(p, 3, 128));
      expect(smooth(w)).toBe(true);
      expect(Math.max(...w.elevation)).toBeGreaterThan(2);
      w.terrain.forEach((t, i) => {
        if (t === Terrain.DeepWater || t === Terrain.ShallowWater) expect(w.elevation[i]).toBe(0);
      });
    }
    const flatValley = generateTerrain({ ...presetSettings('riverValley', 3, 64), hills: 0 });
    expect(Math.max(...flatValley.elevation)).toBe(0);
  });

  it('smoothing lowers spikes to fit the rule', () => {
    const { w } = flat(8);
    w.elevation[w.index(4, 4)] = 9;
    smoothElevation(w);
    expect(w.elevation[w.index(4, 4)]).toBe(1);
    expect(smooth(w)).toBe(true);
  });

  it('surface height is bilinear between tile centres', () => {
    const { w } = flat(4);
    w.elevation[w.index(1, 1)] = 2;
    expect(surfaceHeight(w, 1.5, 1.5)).toBe(2);
    expect(surfaceHeight(w, 2, 1.5)).toBe(1);
  });
});

describe('terraforming', () => {
  it('raising a tile ripples its neighbours to keep the slope rule, priced per level', () => {
    const { w, city } = flat();
    for (let k = 0; k < 3; k++) applyTerraform(city, planTerraform(w, [{ x: 8, y: 8 }], { kind: 'raise' }));
    expect(w.elevation[w.index(8, 8)]).toBe(3);
    expect(w.elevation[w.index(9, 8)]).toBe(2);
    expect(w.elevation[w.index(10, 8)]).toBe(1);
    expect(smooth(w)).toBe(true);

    const plan = planTerraform(w, [{ x: 8, y: 8 }], { kind: 'raise' });
    expect(plan.cost).toBe(plan.count * BALANCE.terraformCost); // every change here is one level
    expect(plan.tiles.some((t) => t.ripple)).toBe(true);
  });

  it('level flattens an area so a 2×2 building fits', () => {
    const { w, city } = flat();
    applyTerraform(city, planTerraform(w, [{ x: 5, y: 5 }], { kind: 'raise' }));
    expect(planPlace(w, 'town_hall', 5, 5).ok).toBe(false);
    applyTerraform(city, planTerraform(w, rectTiles({ x: 5, y: 5 }, { x: 6, y: 6 }), { kind: 'level', level: 0 }));
    expect(isFlat(w, 5, 5, 2, 2)).toBe(true);
    expect(planPlace(w, 'town_hall', 5, 5).ok).toBe(true);
  });

  it('never moves water or roads; a tile whose ripple would is refused', () => {
    const { w, city } = flat();
    w.terrain[w.index(3, 3)] = Terrain.ShallowWater;
    applyRoad(city, planRoad(w, roadPath({ x: 0, y: 10 }, { x: 15, y: 10 }, true), RoadType.Road), RoadType.Road);
    // Next to water: can go to 1, never 2.
    applyTerraform(city, planTerraform(w, [{ x: 4, y: 3 }], { kind: 'raise' }));
    const second = planTerraform(w, [{ x: 4, y: 3 }], { kind: 'raise' });
    expect(second.count).toBe(0);
    expect(second.tiles[0].valid).toBe(false);
    // The road can't be raised, and stays flat under a nearby raise.
    expect(planTerraform(w, [{ x: 5, y: 10 }], { kind: 'raise' }).count).toBe(0);
    applyTerraform(city, planTerraform(w, [{ x: 5, y: 8 }], { kind: 'raise' }));
    expect(w.elevation[w.index(5, 10)]).toBe(0);
    expect(w.elevation[w.index(3, 3)]).toBe(0);
  });
});

describe('borderlands', () => {
  it('copy the map in the middle, continue edge water outward, stay low and keep the slope rule', async () => {
    const { borderRing, generateBorderlands } = await import('../src/sim/terrain/borderlands');
    const map = generateTerrain(presetSettings('coastal', 4, 64));
    const ring = borderRing(64);
    const ext = generateBorderlands(map, ring);
    expect(ext.width).toBe(64 + 2 * ring);
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const i = map.index(x, y);
        const j = ext.index(x + ring, y + ring);
        expect(ext.terrain[j]).toBe(map.terrain[i]);
        expect(ext.elevation[j]).toBe(map.elevation[i]);
      }
    }
    expect(smooth(ext)).toBe(true);
    // Water at an edge tile carries on just outside it.
    const isW = (t: number) => t === Terrain.DeepWater || t === Terrain.ShallowWater;
    let continued = 0;
    let edgeWater = 0;
    for (let x = 0; x < 64; x++) {
      if (!isW(map.terrain[map.index(x, 0)])) continue;
      edgeWater++;
      if (isW(ext.terrain[ext.index(x + ring, ring - 1)])) continued++;
    }
    expect(edgeWater === 0 || continued / edgeWater > 0.8).toBe(true);
    // Away from the map the ring stays low and gentle (no mountains).
    for (let x = 0; x < ext.width; x++) expect(ext.elevation[ext.index(x, 0)]).toBeLessThanOrEqual(2);
  });
});
