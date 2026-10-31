import { Container, Sprite, type Texture } from 'pixi.js';
import { HALF_W } from '../../shared/constants';
import { GROUND_PAD } from '../atlas/geometry';
import { tileToWorld } from '../iso';

export interface PreviewTile {
  x: number;
  y: number;
  texture: Texture;
  tint: number;
  alpha: number;
}

/** Ghost sprites showing what a tool will do. Sprites are pooled; a drag can redraw every frame. */
export class ToolPreview {
  readonly container = new Container();
  private readonly pool: Sprite[] = [];
  private t = 0;

  show(tiles: readonly PreviewTile[]) {
    while (this.pool.length < tiles.length) {
      const s = new Sprite();
      this.pool.push(s);
      this.container.addChild(s);
    }
    tiles.forEach((tile, k) => {
      const s = this.pool[k];
      const p = tileToWorld(tile.x, tile.y);
      s.texture = tile.texture;
      s.x = p.x - HALF_W - GROUND_PAD;
      s.y = p.y - GROUND_PAD;
      s.tint = tile.tint;
      s.alpha = tile.alpha;
      s.visible = true;
    });
    for (let k = tiles.length; k < this.pool.length; k++) this.pool[k].visible = false;
  }

  clear() {
    this.show([]);
  }

  /** Gentle pulse so the ghost reads as "not built yet". */
  update(dt: number) {
    this.t += dt;
    this.container.alpha = 0.85 + 0.15 * Math.sin(this.t * 5);
  }
}
