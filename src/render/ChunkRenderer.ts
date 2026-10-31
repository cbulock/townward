import { Container, Graphics, Sprite } from 'pixi.js';
import { CHUNK_SIZE, HALF_W, TILE_H } from '../shared/constants';
import type { World } from '../sim/World';
import type { Rect } from './Camera';
import { GROUND_PAD, type TileTextures } from './atlas/tiles';
import { tileToWorld } from './iso';

const UNDERLAY_COLOR = 0x5aa848;

interface Chunk {
  container: Container;
  sprites: Sprite[];
  tileIndices: number[];
  bounds: Rect;
}

/**
 * Draws ground tiles in CHUNK_SIZE² chunks. Each chunk is its own Pixi render
 * group, so a static chunk costs almost nothing per frame. Off-screen chunks
 * are hidden (culled). See docs/decisions.md D-017.
 */
export class ChunkRenderer {
  readonly root = new Container();
  private readonly chunks: Chunk[] = [];
  private grid = false;
  visibleChunks = 0;
  visibleTiles = 0;

  constructor(
    private readonly world: World,
    private readonly tex: TileTextures,
  ) {
    const cw = Math.ceil(world.width / CHUNK_SIZE);
    const ch = Math.ceil(world.height / CHUNK_SIZE);
    // Add chunks back-to-front so overlapping edges draw in the right order.
    const order: [number, number][] = [];
    for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) order.push([cx, cy]);
    order.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
    this.root.addChild(this.buildUnderlay());
    for (const [cx, cy] of order) this.buildChunk(cx, cy);
  }

  private buildChunk(cx: number, cy: number) {
    const w = this.world;
    const x0 = cx * CHUNK_SIZE;
    const y0 = cy * CHUNK_SIZE;
    const x1 = Math.min(x0 + CHUNK_SIZE, w.width);
    const y1 = Math.min(y0 + CHUNK_SIZE, w.height);

    const container = new Container({ isRenderGroup: true });
    const sprites: Sprite[] = [];
    const tileIndices: number[] = [];

    // Back-to-front by diagonal (x + y).
    for (let d = x0 + y0; d <= x1 - 1 + (y1 - 1); d++) {
      for (let x = x0; x < x1; x++) {
        const y = d - x;
        if (y < y0 || y >= y1) continue;
        const i = w.index(x, y);
        const p = tileToWorld(x, y);
        const s = new Sprite(this.groundTexture(i));
        s.x = p.x - HALF_W - GROUND_PAD;
        s.y = p.y - GROUND_PAD;
        container.addChild(s);
        sprites.push(s);
        tileIndices.push(i);
      }
    }

    // Bounding box of the chunk's diamond (corners: top = (x0,y0), right = (x1,y0), bottom = (x1,y1), left = (x0,y1)).
    const top = tileToWorld(x0, y0);
    const right = tileToWorld(x1, y0);
    const bottom = tileToWorld(x1, y1);
    const left = tileToWorld(x0, y1);
    // Generous vertical margin so tall objects added in later phases aren't culled early.
    const bounds: Rect = {
      minX: left.x - 2,
      maxX: right.x + 2,
      minY: top.y - TILE_H * 4,
      maxY: bottom.y + 2,
    };

    this.root.addChild(container);
    this.chunks.push({ container, sprites, tileIndices, bounds });
  }

  /**
   * Map-shaped fill under all tiles. When zoomed far out, mipmapped tile edges
   * go slightly transparent; this makes them blend into grass instead of the
   * dark background (which shows as a diamond moiré).
   */
  private buildUnderlay() {
    const w = this.world;
    const pts = [tileToWorld(0, 0), tileToWorld(w.width, 0), tileToWorld(w.width, w.height), tileToWorld(0, w.height)];
    return new Graphics().poly(pts.flatMap((p) => [p.x, p.y])).fill(UNDERLAY_COLOR);
  }

  private groundTexture(i: number) {
    const v = this.world.variant[i];
    return this.grid ? this.tex.grassGrid[v] : this.tex.grass[v];
  }

  setGrid(on: boolean) {
    if (on === this.grid) return;
    this.grid = on;
    for (const c of this.chunks) {
      for (let k = 0; k < c.sprites.length; k++) c.sprites[k].texture = this.groundTexture(c.tileIndices[k]);
    }
  }

  get gridOn() {
    return this.grid;
  }

  /** Hide chunks outside the viewport. Only flips `visible` when it actually changes. */
  cull(view: Rect) {
    let chunks = 0;
    let tiles = 0;
    for (const c of this.chunks) {
      const b = c.bounds;
      const vis = b.maxX >= view.minX && b.minX <= view.maxX && b.maxY >= view.minY && b.minY <= view.maxY;
      if (c.container.visible !== vis) c.container.visible = vis;
      if (vis) {
        chunks++;
        tiles += c.sprites.length;
      }
    }
    this.visibleChunks = chunks;
    this.visibleTiles = tiles;
  }

  get totalChunks() {
    return this.chunks.length;
  }
}

