import { Container, Sprite, type Texture } from 'pixi.js';
import { HALF_W } from '../../shared/constants';
import { GROUND_FRAME_H, GROUND_FRAME_W, GROUND_PAD } from '../atlas/geometry';
import { QuadBatch, tintColor } from '../ground/TileMesh';
import { tileLift, tileQuadPoints } from '../view/lift';
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
  private readonly diamonds = new Container();
  private readonly sprites = new Container();
  private readonly pool: Sprite[] = [];
  private t = 0;

  constructor(private readonly viewRef: ViewRef) {
    this.container.addChild(this.diamonds, this.sprites);
  }

  show(tiles: readonly PreviewTile[]) {
    // Flat tile diamonds (selection, roads, zones) bend to the terrain as one mesh;
    // everything taller (buildings, bridges) is a sprite lifted to its tile's height.
    this.diamonds.removeChildren().forEach((c) => c.destroy({ children: true }));
    const batch = new QuadBatch();
    const ground = this.viewRef.ground;
    const view = this.viewRef.current;
    let used = 0;
    for (const tile of tiles) {
      const fp = tile.footprint;
      const r = view.rectToView({ x: tile.x, y: tile.y, w: fp?.w ?? 1, h: fp?.h ?? 1 });
      const f = tile.texture.frame;
      if (!fp && !tile.offsetY && f.width === GROUND_FRAME_W && f.height === GROUND_FRAME_H) {
        const c = tintColor(tile.tint, tile.alpha);
        batch.add({ texture: tile.texture, points: tileQuadPoints(ground, r.x, r.y), colors: [c, c, c, c, c], grow: 0 });
        continue;
      }
      let s = this.pool[used];
      if (!s) {
        s = new Sprite();
        this.pool.push(s);
        this.sprites.addChild(s);
      }
      used++;
      const p = tileToWorld(r.x, r.y);
      s.texture = tile.texture;
      s.x = p.x - HALF_W - GROUND_PAD - (r.h - 1) * HALF_W;
      s.y = p.y - GROUND_PAD - (tile.offsetY ?? 0) - tileLift(ground, r.x, r.y);
      s.tint = tile.tint;
      s.alpha = tile.alpha;
      s.visible = true;
    }
    if (!batch.empty) this.diamonds.addChild(batch.build());
    for (let k = used; k < this.pool.length; k++) this.pool[k].visible = false;
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
