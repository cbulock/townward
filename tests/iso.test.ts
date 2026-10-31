import { describe, expect, it } from 'vitest';
import { tileToWorld, worldToTile, worldToTileFloat } from '../src/render/iso';
import { HALF_H, HALF_W } from '../src/shared/constants';

describe('iso projection', () => {
  it('round-trips tile -> world -> tile', () => {
    for (let x = -5; x < 40; x += 3) {
      for (let y = -5; y < 40; y += 7) {
        const w = tileToWorld(x, y);
        const t = worldToTileFloat(w.x, w.y);
        expect(t.x).toBeCloseTo(x, 9);
        expect(t.y).toBeCloseTo(y, 9);
      }
    }
  });

  it('picks the tile whose diamond contains the point', () => {
    const top = tileToWorld(10, 4);
    const cx = top.x;
    const cy = top.y + HALF_H;
    // centre
    expect(worldToTile(cx, cy)).toEqual({ x: 10, y: 4 });
    // just inside each of the four vertices
    expect(worldToTile(cx, cy - HALF_H + 1)).toEqual({ x: 10, y: 4 });
    expect(worldToTile(cx, cy + HALF_H - 1)).toEqual({ x: 10, y: 4 });
    expect(worldToTile(cx - HALF_W + 2, cy)).toEqual({ x: 10, y: 4 });
    expect(worldToTile(cx + HALF_W - 2, cy)).toEqual({ x: 10, y: 4 });
    // just outside each edge lands on the neighbour across that edge
    expect(worldToTile(cx + HALF_W / 2 + 1, cy - HALF_H / 2 - 1)).toEqual({ x: 10, y: 3 }); // NE edge
    expect(worldToTile(cx + HALF_W / 2 + 1, cy + HALF_H / 2 + 1)).toEqual({ x: 11, y: 4 }); // SE edge
    expect(worldToTile(cx - HALF_W / 2 - 1, cy + HALF_H / 2 + 1)).toEqual({ x: 10, y: 5 }); // SW edge
    expect(worldToTile(cx - HALF_W / 2 - 1, cy - HALF_H / 2 - 1)).toEqual({ x: 9, y: 4 }); // NW edge
  });
});
