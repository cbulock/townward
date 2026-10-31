import { Sprite, type Texture } from 'pixi.js';
import { HALF_W } from '../../shared/constants';
import { GROUND_PAD } from '../atlas/geometry';
import { tileToWorld } from '../iso';

/** Gently pulsing diamond over the tile under the cursor. */
export class HoverHighlight {
  readonly sprite: Sprite;
  private t = 0;

  constructor(texture: Texture) {
    this.sprite = new Sprite(texture);
    this.sprite.visible = false;
  }

  set(tile: { x: number; y: number } | null) {
    if (!tile) {
      this.sprite.visible = false;
      return;
    }
    const p = tileToWorld(tile.x, tile.y);
    this.sprite.x = p.x - HALF_W - GROUND_PAD;
    this.sprite.y = p.y - GROUND_PAD;
    this.sprite.visible = true;
  }

  update(dt: number) {
    this.t += dt;
    this.sprite.alpha = 0.8 + 0.2 * Math.sin(this.t * 4);
  }
}
