import { Container, Sprite, type Texture } from 'pixi.js';
import { BUILDINGS } from '../../sim/buildings/catalog';
import type { World } from '../../sim/World';
import { buildingHeadroom } from '../atlas/buildingArt';
import { liftWorld } from '../view/lift';
import type { ViewRef } from '../Renderer';

/** Floating badges above buildings that need attention (for now: no road access). */
export class Indicators {
  readonly container = new Container();
  private readonly pool: Sprite[] = [];
  private t = 0;
  private bases: number[] = [];

  constructor(
    private readonly warnRoad: Texture,
    private readonly viewRef: ViewRef,
  ) {}

  /** Rebuild badges from the world; call after anything changes road access. */
  sync(world: World) {
    let used = 0;
    this.bases = [];
    for (const b of world.buildings.values()) {
      if (b.entrance !== -1) continue;
      const { w, h } = BUILDINGS[b.def].size;
      let s = this.pool[used];
      if (!s) {
        s = new Sprite(this.warnRoad);
        s.anchor.set(0.5, 1);
        this.pool.push(s);
        this.container.addChild(s);
      }
      // Above the roof: footprint centre, raised by most of the building's height.
      const c = liftWorld(this.viewRef, b.x + w / 2, b.y + h / 2);
      const y = c.y - Math.max(18, buildingHeadroom(b.def) - 14);
      s.position.set(c.x, y);
      this.bases.push(y);
      s.visible = true;
      used++;
    }
    for (let k = used; k < this.pool.length; k++) this.pool[k].visible = false;
  }

  /** Gentle bob so the badges catch the eye. */
  update(dt: number) {
    this.t += dt;
    this.bases.forEach((y, k) => {
      this.pool[k].y = y + Math.sin(this.t * 4 + k) * 2;
    });
  }
}
