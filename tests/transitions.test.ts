import { describe, expect, it } from 'vitest';
import { computeDualCell } from '../src/render/transitions';
import { Terrain, type TerrainId } from '../src/sim/terrain/types';
import { World } from '../src/sim/World';

/** Build a world from rows of single-char codes: ~ deep, w shallow, s sand, g grass, d dirt. */
function fromRows(rows: string[]): World {
  const codes: Record<string, TerrainId> = {
    '~': Terrain.DeepWater,
    w: Terrain.ShallowWater,
    s: Terrain.Sand,
    g: Terrain.Grass,
    d: Terrain.Dirt,
  };
  const n = rows.length;
  const w = new World(n, n, 0);
  rows.forEach((row, y) => [...row].forEach((c, x) => (w.terrain[y * n + x] = codes[c])));
  return w;
}

describe('dual-grid terrain cells', () => {
  it('uniform area is just the base, no overlays', () => {
    const w = fromRows(['gg', 'gg']);
    expect(computeDualCell(w, 1, 1)).toEqual({ base: Terrain.Grass, overlays: [], shore: 0 });
  });

  it('corner bits follow top, right, bottom, left tiles', () => {
    // Dual cell (1,1) corners: top (0,0), right (1,0), bottom (1,1), left (0,1).
    expect(computeDualCell(fromRows(['gw', 'ww']), 1, 1).overlays).toEqual([{ terrain: Terrain.Grass, mask: 0b0001 }]);
    expect(computeDualCell(fromRows(['wg', 'ww']), 1, 1).overlays).toEqual([{ terrain: Terrain.Grass, mask: 0b0010 }]);
    expect(computeDualCell(fromRows(['ww', 'wg']), 1, 1).overlays).toEqual([{ terrain: Terrain.Grass, mask: 0b0100 }]);
    expect(computeDualCell(fromRows(['ww', 'gw']), 1, 1).overlays).toEqual([{ terrain: Terrain.Grass, mask: 0b1000 }]);
  });

  it('base is the lowest terrain; higher terrains stack with inclusive masks', () => {
    // top sand, right grass, bottom water, left grass
    const cell = computeDualCell(fromRows(['sg', 'gw']), 1, 1);
    expect(cell.base).toBe(Terrain.ShallowWater);
    // Sand's mask includes grass corners too, so no water gap opens between sand and grass.
    expect(cell.overlays).toEqual([
      { terrain: Terrain.Sand, mask: 0b1011 },
      { terrain: Terrain.Grass, mask: 0b1010 },
    ]);
  });

  it('terrains not present in the cell are skipped', () => {
    const cell = computeDualCell(fromRows(['gw', 'ww']), 1, 1);
    expect(cell.overlays.map((o) => o.terrain)).toEqual([Terrain.Grass]);
  });

  it('shore mask marks land corners on water-based cells', () => {
    expect(computeDualCell(fromRows(['sw', 'wd']), 1, 1).shore).toBe(0b0101);
    expect(computeDualCell(fromRows(['sg', 'gd']), 1, 1).shore).toBe(0);
  });

  it('border cells clamp to the edge tiles', () => {
    const w = fromRows(['gw', 'ww']);
    // Dual cell (0,0): all four corners clamp to tile (0,0).
    expect(computeDualCell(w, 0, 0)).toEqual({ base: Terrain.Grass, overlays: [], shore: 0 });
  });
});
