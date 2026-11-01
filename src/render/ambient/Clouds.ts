import { Container, Sprite, type Texture } from 'pixi.js';
import type { Rect } from '../Camera';

const COUNT = 6;
/** Wind (world px per second): the same direction as the smoke drifts. */
const WIND_X = 9;
const WIND_Y = -2;
const SHADE = 0x1a2740;
const STRENGTH = 0.15;

/**
 * Shadows of passing clouds (D-072): a few large soft shapes drifting with the wind across the
 * view, darkening ground, roofs and trees as they pass. Clouds that drift out of view re-enter
 * upwind. They fade out at night, when there's no sun to cast them.
 */
export class Clouds {
  readonly container = new Container();
  private readonly clouds: Sprite[] = [];
  private placed = false;

  constructor(texture: Texture) {
    for (let k = 0; k < COUNT; k++) {
      const s = new Sprite(texture);
      s.anchor.set(0.5);
      s.tint = SHADE;
      const scale = 3 + Math.random() * 3;
      s.scale.set(scale, scale * (0.8 + Math.random() * 0.4));
      s.rotation = (Math.random() - 0.5) * 0.4;
      this.clouds.push(s);
      this.container.addChild(s);
    }
  }

  update(dt: number, view: Rect, level: number) {
    const w = view.maxX - view.minX;
    const h = view.maxY - view.minY;
    const mx = Math.max(w, 600) * 0.6;
    const my = Math.max(h, 400) * 0.6;
    this.container.alpha = STRENGTH * (1 - level);
    this.container.visible = this.container.alpha > 0.005;
    for (const s of this.clouds) {
      if (!this.placed) s.position.set(view.minX - mx + Math.random() * (w + 2 * mx), view.minY - my + Math.random() * (h + 2 * my));
      s.x += WIND_X * dt;
      s.y += WIND_Y * dt;
      // Out of the padded view: come back in on the upwind side (left), anywhere along it.
      if (s.x > view.maxX + mx || s.x < view.minX - mx * 1.5 || s.y < view.minY - my || s.y > view.maxY + my) {
        s.x = view.minX - mx * (0.5 + Math.random() * 0.5);
        s.y = view.minY - my * 0.5 + Math.random() * (h + my);
      }
    }
    this.placed = true;
  }
}
