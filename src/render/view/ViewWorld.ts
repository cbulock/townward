import { BUILDINGS, type BuildingInstance } from '../../sim/buildings/catalog';
import { DIRS } from '../../sim/roads';
import { World } from '../../sim/World';
import type { ViewTransform } from './ViewTransform';

/**
 * The world's tile layers re-laid out in view space, so the chunk renderer, road
 * auto-tiling and dual-grid terrain can draw a rotated map without knowing about
 * rotation. Rebuilt by `sync()` after every edit; that's a few typed-array copies.
 */
export class ViewWorld extends World {
  /** View tile index → world tile index (for stable per-tile art variants across rotations). */
  readonly source: Int32Array;

  constructor(
    readonly view: ViewTransform,
    seed: number,
  ) {
    super(view.viewW, view.viewH, seed);
    this.source = new Int32Array(this.width * this.height);
  }

  sync(world: World) {
    const v = this.view;
    // One-way directions turn with the view: map each world direction through the transform.
    const c = { x: Math.floor(world.width / 2), y: Math.floor(world.height / 2) };
    const o = v.tileToView(c.x, c.y);
    const turnDir = DIRS.map(([dx, dy]) => {
      const t = v.tileToView(c.x + dx, c.y + dy);
      return DIRS.findIndex(([ex, ey]) => ex === t.x - o.x && ey === t.y - o.y);
    });
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const wi = y * world.width + x;
        const t = v.tileToView(x, y);
        const vi = t.y * this.width + t.x;
        this.source[vi] = wi;
        this.terrain[vi] = world.terrain[wi];
        this.elevation[vi] = world.elevation[wi];
        this.variant[vi] = world.variant[wi];
        this.tree[vi] = world.tree[wi];
        this.decor[vi] = world.decor[wi];
        this.road[vi] = world.road[wi];
        this.bridge[vi] = v.bridgeAxis(world.bridge[wi]);
        this.lane[vi] = world.lane[wi] === 0 ? 0 : turnDir[world.lane[wi] - 1] + 1;
        this.pave[vi] = world.pave[wi];
        this.zone[vi] = world.zone[wi];
        this.building[vi] = world.building[wi];
      }
    }
    // Same ids, footprints moved into view space.
    this.buildings.clear();
    for (const b of world.buildings.values()) {
      const { w, h } = BUILDINGS[b.def].size;
      const r = v.rectToView({ x: b.x, y: b.y, w, h });
      const instance: BuildingInstance = { ...b, x: r.x, y: r.y };
      this.buildings.set(b.id, instance);
    }
  }
}
