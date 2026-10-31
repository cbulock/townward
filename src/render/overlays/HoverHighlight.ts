import { Container, type Texture } from 'pixi.js';
import { QuadBatch, shadeColor } from '../ground/TileMesh';
import { tileQuadPoints } from '../view/lift';
import type { ViewRef } from '../Renderer';

/** Gently pulsing diamond over the tile under the cursor, bent to the terrain. */
export class HoverHighlight {
  readonly container = new Container();
  private t = 0;

  constructor(
    private readonly texture: Texture,
    private readonly viewRef: ViewRef,
  ) {
    this.container.visible = false;
  }

  /** Highlight a world tile (or hide with null). */
  set(tile: { x: number; y: number } | null) {
    this.container.removeChildren().forEach((c) => c.destroy({ children: true }));
    if (!tile) {
      this.container.visible = false;
      return;
    }
    const v = this.viewRef.current.tileToView(tile.x, tile.y);
    const white = shadeColor(1);
    const batch = new QuadBatch();
    batch.add({ texture: this.texture, points: tileQuadPoints(this.viewRef.ground, v.x, v.y), colors: [white, white, white, white, white], grow: 0 });
    this.container.addChild(batch.build());
    this.container.visible = true;
  }

  update(dt: number) {
    this.t += dt;
    this.container.alpha = 0.8 + 0.2 * Math.sin(this.t * 4);
  }
}
