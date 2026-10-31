import { Sprite, type Texture } from 'pixi.js';
import { HALF_W } from '../../shared/constants';
import { GROUND_PAD } from '../atlas/geometry';
import { tileToWorld } from '../iso';
import type { ViewRef } from '../Renderer';

/** Gently pulsing diamond over the tile under the cursor. */
export class HoverHighlight {
  readonly sprite: Sprite;
  private t = 0;

  constructor(
    texture: Texture,
    private readonly viewRef: ViewRef,
  ) {
    this.sprite = new Sprite(texture);
    this.sprite.visible = false;
  }

  /** Highlight a world tile (or hide with null). */
  set(tile: { x: number; y: number } | null) {
    if (!tile) {
      this.sprite.visible = false;
      return;
    }
    const v = this.viewRef.current.tileToView(tile.x, tile.y);
    const p = tileToWorld(v.x, v.y);
    this.sprite.x = p.x - HALF_W - GROUND_PAD;
    this.sprite.y = p.y - GROUND_PAD;
    this.sprite.visible = true;
  }

  update(dt: number) {
    this.t += dt;
    this.sprite.alpha = 0.8 + 0.2 * Math.sin(this.t * 4);
  }
}
