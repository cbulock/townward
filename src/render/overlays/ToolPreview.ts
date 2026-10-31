import { Container, Sprite, type Texture } from 'pixi.js';
import { HALF_W } from '../../shared/constants';
import { GROUND_PAD } from '../atlas/geometry';
import { tileToWorld } from '../iso';
import type { ViewRef } from '../Renderer';

export interface PreviewTile {
  x: number;
  y: number;
  texture: Texture;
  tint: number;
  alpha: number;
  /** Extra room above the diamond in this texture's frame (e.g. bridges, buildings). */
  offsetY?: number;
  /**
   * For multi-tile ghosts (buildings): the world footprint whose top-left is (x, y).
   * The sprite is placed at the footprint's top tile *in the view*.
   */
  footprint?: { w: number; h: number };
}

/** Ghost sprites showing what a tool will do. Sprites are pooled; a drag can redraw every frame. */
export class ToolPreview {
  readonly container = new Container();
  private readonly pool: Sprite[] = [];
  private t = 0;

  constructor(private readonly viewRef: ViewRef) {}

  show(tiles: readonly PreviewTile[]) {
    while (this.pool.length < tiles.length) {
      const s = new Sprite();
      this.pool.push(s);
      this.container.addChild(s);
    }
    tiles.forEach((tile, k) => {
      const s = this.pool[k];
      const view = this.viewRef.current;
      // Tiles are given in world space; place them at their view-space position.
      const fp = tile.footprint;
      const r = view.rectToView({ x: tile.x, y: tile.y, w: fp?.w ?? 1, h: fp?.h ?? 1 });
      const p = tileToWorld(r.x, r.y);
      s.texture = tile.texture;
      s.x = p.x - HALF_W - GROUND_PAD - (r.h - 1) * HALF_W;
      s.y = p.y - GROUND_PAD - (tile.offsetY ?? 0);
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
