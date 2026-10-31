import { describe, expect, it } from 'vitest';
import { ViewTransform, type Rotation } from '../src/render/view/ViewTransform';
import { ViewWorld } from '../src/render/view/ViewWorld';
import { City } from '../src/sim/City';
import { applyPlace, applyRoad, planPlace, planRoad } from '../src/sim/commands';
import { BridgeAxis, roadMask, roadPath, RoadType } from '../src/sim/roads';
import { Terrain } from '../src/sim/terrain/types';
import { World } from '../src/sim/World';

const ROTATIONS: Rotation[] = [0, 1, 2, 3];

describe('ViewTransform', () => {
  it.each(ROTATIONS)('r=%i: points and tiles round-trip', (r) => {
    const v = new ViewTransform(12, 8, r);
    for (const [x, y] of [
      [0, 0],
      [3.25, 7.5],
      [11.9, 0.1],
    ]) {
      const back = v.pointToWorld(v.pointToView(x, y).x, v.pointToView(x, y).y);
      expect(back.x).toBeCloseTo(x);
      expect(back.y).toBeCloseTo(y);
    }
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 12; x++) {
        const t = v.tileToView(x, y);
        expect(t.x).toBeGreaterThanOrEqual(0);
        expect(t.x).toBeLessThan(v.viewW);
        expect(t.y).toBeLessThan(v.viewH);
        expect(v.tileToWorld(t.x, t.y)).toEqual({ x, y });
      }
    }
  });

  it('a quarter turn moves +x to the SW heading', () => {
    const v = new ViewTransform(10, 10, 1);
    const a = v.pointToView(2, 5);
    const b = v.pointToView(3, 5);
    expect(b.x - a.x).toBeCloseTo(0);
    expect(b.y - a.y).toBeCloseTo(1); // +y in view = SW
    expect(v.dir(1)).toBe(2);
  });

  it('rotates connection masks and swaps bridge axes on odd turns', () => {
    const v = new ViewTransform(10, 10, 1);
    expect(v.mask(0b0001)).toBe(0b0010);
    expect(v.mask(0b1000)).toBe(0b0001);
    expect(v.bridgeAxis(BridgeAxis.X)).toBe(BridgeAxis.Y);
    expect(new ViewTransform(10, 10, 2).bridgeAxis(BridgeAxis.X)).toBe(BridgeAxis.X);
  });

  it('rectangles stay the same size', () => {
    const v = new ViewTransform(10, 10, 3);
    expect(v.rectToView({ x: 2, y: 3, w: 2, h: 2 })).toEqual({ x: 3, y: 6, w: 2, h: 2 });
  });
});

describe('ViewWorld', () => {
  function town() {
    const w = new World(12, 12, 0);
    w.terrain.fill(Terrain.Grass);
    const city = new City(w, 100_000);
    applyRoad(city, planRoad(w, roadPath({ x: 1, y: 5 }, { x: 8, y: 5 }, true), RoadType.Road), RoadType.Road);
    applyRoad(city, planRoad(w, roadPath({ x: 4, y: 5 }, { x: 4, y: 9 }, true), RoadType.Road), RoadType.Road);
    applyPlace(city, planPlace(w, 'hotel', 6, 2), 0);
    return w;
  }

  it.each(ROTATIONS)('r=%i: road masks in the view equal rotated world masks', (r) => {
    const w = town();
    const view = new ViewTransform(w.width, w.height, r);
    const vw = new ViewWorld(view, 0);
    vw.sync(w);
    for (let y = 0; y < w.height; y++) {
      for (let x = 0; x < w.width; x++) {
        if (w.road[w.index(x, y)] === RoadType.None) continue;
        const t = view.tileToView(x, y);
        expect(roadMask(vw, t.x, t.y)).toBe(view.mask(roadMask(w, x, y)));
      }
    }
  });

  it.each(ROTATIONS)('r=%i: building footprints cover the same tiles', (r) => {
    const w = town();
    const view = new ViewTransform(w.width, w.height, r);
    const vw = new ViewWorld(view, 0);
    vw.sync(w);
    const [b] = [...vw.buildings.values()];
    for (let y = b.y; y < b.y + 2; y++) for (let x = b.x; x < b.x + 2; x++) expect(vw.building[vw.index(x, y)]).toBe(b.id);
    const src = vw.source[vw.index(b.x, b.y)];
    expect(w.building[src]).toBe(b.id);
  });
});
