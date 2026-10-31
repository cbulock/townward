import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { CHUNK_SIZE, HALF_H, HALF_W, TILE_H } from '../shared/constants';
import { roadMask, RoadType, type BuildableRoad } from '../sim/roads';
import { Decor, Terrain, type TerrainId } from '../sim/terrain/types';
import type { World } from '../sim/World';
import type { Rect } from './Camera';
import { DECOR_VARIANTS } from './atlas/decorArt';
import { GROUND_PAD, TREE_HEADROOM } from './atlas/geometry';
import { WATER_PHASES } from './atlas/groundArt';
import { GROUND_BASE, hexToNumber } from './atlas/palette';
import type { TerrainTextures } from './atlas/tiles';
import { WOBBLE_VARIANTS } from './atlas/transitionArt';
import { TREE_VARIANTS } from './atlas/treeArt';
import { tileToWorld } from './iso';
import { computeDualCell, isWaterTerrain } from './transitions';

/** Seconds per water animation frame. */
const WATER_FRAME_TIME = 0.16;
/** Height of the soil slab under the map's front edges (world px). */
const SLAB_DEPTH = 26;

interface WaterTile {
  sprite: Sprite;
  frames: Texture[];
  /** Per-cell phase offset so the shimmer doesn't pulse in lockstep. */
  offset: number;
}

interface Chunk {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  base: Container;
  overlay: Container;
  roads: Container;
  objects: Container;
  grid: Container | null;
  water: WaterTile[];
  bounds: Rect;
  visible: boolean;
}

/** Cheap deterministic per-cell hash for picking art variants. */
function cellHash(x: number, y: number): number {
  let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

/**
 * Draws the terrain in CHUNK_SIZE² chunks. Ground uses the dual grid
 * (render/transitions.ts); trees and decorations sit on the normal tile grid.
 * Each chunk owns separate Pixi render groups for ground, grid and objects, so
 * static chunks cost almost nothing per frame. Off-screen chunks are hidden.
 * See docs/decisions.md D-017 and D-019.
 */
export class ChunkRenderer {
  readonly groundRoot = new Container();
  /** Pass 1: every cell's base terrain. Pass 2: transitions and surf, which cover pass-1 over-draw. */
  private readonly baseRoot = new Container();
  private readonly overlayRoot = new Container();
  readonly roadsRoot = new Container();
  readonly gridRoot = new Container();
  readonly objectsRoot = new Container();
  /** Soil slab under the map edges; drawn beneath everything else. */
  readonly slab: Graphics;
  /** Map-shaped mask: dual cells on the border overhang the map by half a tile. */
  readonly groundMask: Graphics;
  private readonly chunks: Chunk[] = [];
  private gridOnState = false;
  private waterTimer = 0;
  private waterPhase = 0;
  visibleChunks = 0;
  visibleSprites = 0;

  constructor(
    private readonly world: World,
    private readonly tex: TerrainTextures,
  ) {
    const cw = Math.ceil(world.width / CHUNK_SIZE);
    const ch = Math.ceil(world.height / CHUNK_SIZE);
    // Back-to-front so tall objects overlap correctly across chunk borders.
    const order: [number, number][] = [];
    for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) order.push([cx, cy]);
    order.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
    this.groundRoot.addChild(this.baseRoot, this.overlayRoot);
    for (const [cx, cy] of order) this.buildChunk(cx, cy);

    this.slab = this.buildSlab();
    this.groundMask = this.buildMapShape(new Graphics()).fill(0xffffff);
    this.groundRoot.mask = this.groundMask;
  }

  private buildChunk(cx: number, cy: number) {
    const w = this.world;
    const x0 = cx * CHUNK_SIZE;
    const y0 = cy * CHUNK_SIZE;
    const x1 = Math.min(x0 + CHUNK_SIZE, w.width);
    const y1 = Math.min(y0 + CHUNK_SIZE, w.height);

    const base = new Container({ isRenderGroup: true });
    const overlay = new Container({ isRenderGroup: true });
    const roads = new Container({ isRenderGroup: true });
    const objects = new Container({ isRenderGroup: true });
    const water: WaterTile[] = [];
    base.addChild(this.buildUnderlay(x0, y0, x1, y1));

    // Dual cells: the last chunk in each direction also owns the extra row/column (i = width).
    const i1 = x1 === w.width ? x1 + 1 : x1;
    const j1 = y1 === w.height ? y1 + 1 : y1;
    for (let j = y0; j < j1; j++) for (let i = x0; i < i1; i++) this.buildDualCell(i, j, base, overlay, water);


    const top = tileToWorld(x0, y0);
    const right = tileToWorld(x1, y0);
    const bottom = tileToWorld(x1, y1);
    const left = tileToWorld(x0, y1);
    // Half a tile of slack for dual cells, plus headroom so tall objects aren't culled early.
    const bounds: Rect = {
      minX: left.x - HALF_W,
      maxX: right.x + HALF_W,
      minY: top.y - TILE_H * 4,
      maxY: bottom.y + HALF_H,
    };

    this.baseRoot.addChild(base);
    this.overlayRoot.addChild(overlay);
    this.roadsRoot.addChild(roads);
    this.objectsRoot.addChild(objects);
    const chunk: Chunk = { x0, y0, x1, y1, base, overlay, roads, objects, grid: null, water, bounds, visible: true };
    this.fillRoadsAndObjects(chunk);
    this.chunks.push(chunk);
  }

  /** Roads and objects change with play (building, clearing); terrain doesn't, so only these get rebuilt. */
  private fillRoadsAndObjects(c: Chunk) {
    const w = this.world;
    for (let y = c.y0; y < c.y1; y++) {
      for (let x = c.x0; x < c.x1; x++) {
        const type = w.road[w.index(x, y)];
        if (type === RoadType.None) continue;
        const p = tileToWorld(x, y);
        const s = new Sprite(this.tex.roads[type as BuildableRoad][roadMask(w, x, y)]);
        s.x = p.x - HALF_W - GROUND_PAD;
        s.y = p.y - GROUND_PAD;
        c.roads.addChild(s);
      }
    }
    // Objects back-to-front by diagonal (x + y).
    for (let d = c.x0 + c.y0; d <= c.x1 - 1 + (c.y1 - 1); d++) {
      for (let x = c.x0; x < c.x1; x++) {
        const y = d - x;
        if (y >= c.y0 && y < c.y1) this.buildObjects(x, y, c.objects);
      }
    }
  }

  /**
   * Rebuild roads and objects for every chunk touching the tile rectangle, grown by one tile
   * because a road change alters its neighbours' connection masks.
   */
  refresh(minX: number, minY: number, maxX: number, maxY: number) {
    for (const c of this.chunks) {
      if (c.x1 <= minX - 1 || c.x0 > maxX + 1 || c.y1 <= minY - 1 || c.y0 > maxY + 1) continue;
      c.roads.removeChildren().forEach((s) => s.destroy());
      c.objects.removeChildren().forEach((s) => s.destroy());
      this.fillRoadsAndObjects(c);
    }
  }

  /** Ground for dual cell (i, j): a diamond centred on the top vertex of tile (i, j). */
  private buildDualCell(i: number, j: number, base: Container, overlay: Container, water: WaterTile[]) {
    const tex = this.tex;
    const cell = computeDualCell(this.world, i, j);
    const hash = cellHash(i, j);
    const variant = hash % 4;
    const wobble = (hash >>> 3) % WOBBLE_VARIANTS;
    const v = tileToWorld(i, j);
    const sx = v.x - HALF_W - GROUND_PAD;
    const sy = v.y - HALF_H - GROUND_PAD;

    const add = (texture: Texture, into: Container) => {
      const s = new Sprite(texture);
      s.x = sx;
      s.y = sy;
      into.addChild(s);
      return s;
    };

    if (isWaterTerrain(cell.base)) {
      const frames = (cell.base === Terrain.DeepWater ? tex.water.deep : tex.water.shallow)[variant];
      const offset = (hash >>> 6) % WATER_PHASES;
      water.push({ sprite: add(frames[offset], base), frames, offset });
    } else {
      add(tex.ground[cell.base][variant], base);
    }

    // Shallow water first, then the surf line, then land, so the land edge sits on the surf's inner side.
    let foamDrawn = cell.shore === 0;
    for (const o of cell.overlays) {
      if (!foamDrawn && !isWaterTerrain(o.terrain)) {
        add(tex.foam[wobble][cell.shore], overlay);
        foamDrawn = true;
      }
      const set = tex.overlays.get(o.terrain);
      if (set) add(set[wobble][o.mask], overlay);
    }
  }

  private buildObjects(x: number, y: number, objects: Container) {
    const w = this.world;
    const i = w.index(x, y);
    const hash = cellHash(x + 7919, y + 104729);
    let texture: Texture | null = null;
    const density = w.tree[i];
    const decor = w.decor[i];
    if (density > 0) texture = this.tex.trees[Math.min(density, 3)][hash % TREE_VARIANTS];
    else if (decor !== Decor.None) texture = this.tex.decor[decor][hash % DECOR_VARIANTS];
    if (!texture) return;

    const p = tileToWorld(x, y);
    const s = new Sprite(texture);
    s.x = p.x - HALF_W - GROUND_PAD;
    s.y = p.y - GROUND_PAD - TREE_HEADROOM;
    objects.addChild(s);
  }

  /**
   * Flat colour diamonds under the tiles. When zoomed far out, mipmapped tile
   * edges go slightly transparent; this makes them blend into the right colour
   * instead of the dark background (which shows as a diamond moiré).
   */
  private buildUnderlay(x0: number, y0: number, x1: number, y1: number) {
    const g = new Graphics();
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const t = this.world.terrain[this.world.index(x, y)] as TerrainId;
        const a = tileToWorld(x, y);
        const b = tileToWorld(x + 1, y);
        const c = tileToWorld(x + 1, y + 1);
        const d = tileToWorld(x, y + 1);
        g.poly([a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y]).fill(hexToNumber(GROUND_BASE[t]));
      }
    }
    return g;
  }

  private buildMapShape(g: Graphics): Graphics {
    const { width: n, height: m } = this.world;
    const pts = [tileToWorld(0, 0), tileToWorld(n, 0), tileToWorld(n, m), tileToWorld(0, m)];
    return g.poly(pts.flatMap((p) => [p.x, p.y]));
  }

  /**
   * Diorama-style soil slab under the two front edges, so the map reads as a
   * solid piece of land rather than ending in a hard cut. Water along the edge
   * shows as a blue band on the slab.
   */
  private buildSlab(): Graphics {
    const w = this.world;
    const n = w.width;
    const m = w.height;
    const g = new Graphics();
    const face = (ax: number, ay: number, bx: number, by: number, color: number) =>
      g.poly([ax, ay, bx, by, bx, by + SLAB_DEPTH, ax, ay + SLAB_DEPTH]).fill(color);

    // South-west face (along y = m) is lit, south-east face (along x = n) is in shade.
    for (let x = 0; x < n; x++) {
      const a = tileToWorld(x, m);
      const b = tileToWorld(x + 1, m);
      const water = isWaterTerrain(w.terrain[w.index(x, m - 1)]);
      face(a.x, a.y, b.x, b.y, water ? 0x2f78c0 : 0x8a5a33);
    }
    for (let y = 0; y < m; y++) {
      const a = tileToWorld(n, y);
      const b = tileToWorld(n, y + 1);
      const water = isWaterTerrain(w.terrain[w.index(n - 1, y)]);
      face(a.x, a.y, b.x, b.y, water ? 0x245f9e : 0x6b4426);
    }
    // Darker strata line and a grass lip along the top edge.
    const left = tileToWorld(0, m);
    const bottom = tileToWorld(n, m);
    const right = tileToWorld(n, 0);
    g.moveTo(left.x, left.y + SLAB_DEPTH * 0.55)
      .lineTo(bottom.x, bottom.y + SLAB_DEPTH * 0.55)
      .lineTo(right.x, right.y + SLAB_DEPTH * 0.55)
      .stroke({ width: 2, color: 0x000000, alpha: 0.12 });
    g.moveTo(left.x, left.y + 1.5)
      .lineTo(bottom.x, bottom.y + 1.5)
      .lineTo(right.x, right.y + 1.5)
      .stroke({ width: 3, color: 0x3f8f2a, alpha: 0.9 });
    return g;
  }

  setGrid(on: boolean) {
    if (on === this.gridOnState) return;
    this.gridOnState = on;
    for (const c of this.chunks) {
      if (on) {
        c.grid = this.buildGrid(c);
        c.grid.visible = c.visible;
        this.gridRoot.addChild(c.grid);
      } else if (c.grid) {
        c.grid.destroy({ children: true });
        c.grid = null;
      }
    }
  }

  private buildGrid(c: Chunk): Container {
    const grid = new Container({ isRenderGroup: true });
    for (let y = c.y0; y < c.y1; y++) {
      for (let x = c.x0; x < c.x1; x++) {
        const p = tileToWorld(x, y);
        const s = new Sprite(this.tex.gridLine);
        s.x = p.x - HALF_W - GROUND_PAD;
        s.y = p.y - GROUND_PAD;
        grid.addChild(s);
      }
    }
    return grid;
  }

  get gridOn() {
    return this.gridOnState;
  }

  /** Advance water animation; only visible chunks are touched. */
  update(dt: number) {
    this.waterTimer += dt;
    if (this.waterTimer < WATER_FRAME_TIME) return;
    this.waterTimer %= WATER_FRAME_TIME;
    this.waterPhase = (this.waterPhase + 1) % WATER_PHASES;
    for (const c of this.chunks) {
      if (!c.visible) continue;
      for (const wt of c.water) wt.sprite.texture = wt.frames[(this.waterPhase + wt.offset) % WATER_PHASES];
    }
  }

  /** Hide chunks outside the viewport. Only flips `visible` when it actually changes. */
  cull(view: Rect) {
    let chunks = 0;
    let sprites = 0;
    for (const c of this.chunks) {
      const b = c.bounds;
      const vis = b.maxX >= view.minX && b.minX <= view.maxX && b.maxY >= view.minY && b.minY <= view.maxY;
      if (c.visible !== vis) {
        c.visible = vis;
        c.base.visible = vis;
        c.overlay.visible = vis;
        c.roads.visible = vis;
        c.objects.visible = vis;
        if (c.grid) c.grid.visible = vis;
      }
      if (vis) {
        chunks++;
        sprites +=
          c.base.children.length + c.overlay.children.length + c.roads.children.length + c.objects.children.length;
      }
    }
    this.visibleChunks = chunks;
    this.visibleSprites = sprites;
  }

  get totalChunks() {
    return this.chunks.length;
  }
}
