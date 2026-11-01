import { Container, Sprite, type Texture } from 'pixi.js';
import { BUILDINGS, type BuildingInstance } from '../../sim/buildings/catalog';
import { needsUtilities } from '../../sim/systems/utilities';
import type { World } from '../../sim/World';
import { buildingHeadroom } from '../atlas/buildings';
import { liftWorld } from '../view/lift';
import type { ViewRef } from '../Renderer';

export interface BadgeTextures {
  road: Texture;
  power: Texture;
  water: Texture;
}

/** Floating badges above buildings that need attention: no road access, then no power, then no water. */
export class Indicators {
  readonly container = new Container();
  private readonly pool: Sprite[] = [];
  private t = 0;
  private bases: number[] = [];

  constructor(
    private readonly badges: BadgeTextures,
    private readonly viewRef: ViewRef,
  ) {}

  /** Which badge a building needs, if any (one at a time, most basic problem first). */
  private badgeFor(b: BuildingInstance): Texture | null {
    if (b.entrance === -1) return this.badges.road;
    if (b.construction > 0 || !needsUtilities(BUILDINGS[b.def])) return null;
    if (!b.powered) return this.badges.power;
    if (!b.watered) return this.badges.water;
    return null;
  }

  /** Rebuild badges from the world; call after road access or utilities change. */
  sync(world: World) {
    let used = 0;
    this.bases = [];
    for (const b of world.buildings.values()) {
      const badge = this.badgeFor(b);
      if (!badge) continue;
      const { w, h } = BUILDINGS[b.def].size;
      let s = this.pool[used];
      if (!s) {
        s = new Sprite();
        s.anchor.set(0.5, 1);
        this.pool.push(s);
        this.container.addChild(s);
      }
      s.texture = badge;
      // Above the roof: footprint centre, raised by most of the building's height.
      const c = liftWorld(this.viewRef, b.x + w / 2, b.y + h / 2);
      const y = c.y - Math.max(18, buildingHeadroom(b.def, b.variant) - 14);
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
