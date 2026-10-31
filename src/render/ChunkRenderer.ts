import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { CHUNK_SIZE, HALF_H, HALF_W, HEIGHT_STEP, MAX_LEVEL, TILE_H } from '../shared/constants';
import { BridgeAxis, roadMask, RoadType, type BuildableRoad } from '../sim/roads';
import { cornerHeight } from '../sim/terrain/elevation';
import { findEntrance } from '../sim/systems/access';
import { BALANCE } from '../shared/balance';
import { flushUVs, QuadBatch, setQuadTexture, shadeColor, tintColor, type QuadSlot, type Vec } from './ground/TileMesh';
import { cellQuadPoints, tileLift, tileQuadPoints } from './view/lift';
import { Decor, Terrain, type TerrainId } from '../sim/terrain/types';
import type { ViewWorld } from './view/ViewWorld';
import type { Rect } from './Camera';
import { DECOR_VARIANTS } from './atlas/decorArt';
import { buildingHeadroom } from './atlas/buildingArt';
import { BUILDINGS } from '../sim/buildings/catalog';
import { constructionStage } from '../sim/systems/growth';
import { isZoned } from '../sim/zones';
import { siteHeadroom } from './atlas/constructionArt';
import { BRIDGE_HEADROOM, GROUND_PAD, TREE_HEADROOM } from './atlas/geometry';
import { FURNITURE_HEADROOM } from './atlas/streetArt';
import { WATER_PHASES } from './atlas/groundArt';
import { GROUND_BASE, hexToNumber, ZONE_TINT } from './atlas/palette';
import { buildingTexture, type TerrainTextures } from './atlas/tiles';
import { WOBBLE_VARIANTS } from './atlas/transitionArt';
import { TREE_VARIANTS } from './atlas/treeArt';
import { tileToWorld } from './iso';
import { computeDualCell, isWaterTerrain } from './transitions';

/** Ground cells over-draw their neighbours by this much (px), so the sloped meshes never seam. */
const CELL_GROW = 1.5;
/** Zoned lots with no road within reach: grey, so it's clear they won't grow. */
const STRANDED_TINT = 0x9aa6b8;
/** Seconds per water animation frame. */
const WATER_FRAME_TIME = 0.16;

interface WaterTile {
  slot: QuadSlot;
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
  zones: Container;
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
  /** Zoned-lot tints, under roads and objects. Its alpha switches for the zone view. */
  readonly zonesRoot = new Container();
  readonly roadsRoot = new Container();
  readonly gridRoot = new Container();
  readonly objectsRoot = new Container();
  /** Map-shaped mask: dual cells on the border overhang the map by half a tile. */
  readonly groundMask: Graphics;
  private readonly chunks: Chunk[] = [];
  private gridOnState = false;
  private waterTimer = 0;
  private waterPhase = 0;
  visibleChunks = 0;
  visibleSprites = 0;

  constructor(
    /** The world as seen from the current rotation; everything here is in view space. */
    private readonly world: ViewWorld,
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
    const zones = new Container({ isRenderGroup: true });
    const roads = new Container({ isRenderGroup: true });
    const objects = new Container({ isRenderGroup: true });
    const water: WaterTile[] = [];


    const top = tileToWorld(x0, y0);
    const right = tileToWorld(x1, y0);
    const bottom = tileToWorld(x1, y1);
    const left = tileToWorld(x0, y1);
    // Half a tile of slack for dual cells, plus headroom so tall buildings aren't culled early.
    const bounds: Rect = {
      minX: left.x - HALF_W,
      maxX: right.x + HALF_W,
      minY: top.y - TILE_H * 8 - MAX_LEVEL * HEIGHT_STEP,
      maxY: bottom.y + HALF_H,
    };

    this.baseRoot.addChild(base);
    this.overlayRoot.addChild(overlay);
    this.zonesRoot.addChild(zones);
    this.roadsRoot.addChild(roads);
    this.objectsRoot.addChild(objects);
    const chunk: Chunk = { x0, y0, x1, y1, base, overlay, zones, roads, objects, grid: null, water, bounds, visible: true };
    this.fillGround(chunk);
    this.fillRoadsAndObjects(chunk);
    this.chunks.push(chunk);
  }

  /** Ground meshes (underlay, water, land, transitions); rebuilt when the terrain is reshaped. */
  private fillGround(c: Chunk) {
    const w = this.world;
    c.water.length = 0;
    c.base.addChild(this.buildUnderlay(c.x0, c.y0, c.x1, c.y1));
    // Dual cells: the last chunk in each direction also owns the extra row/column (i = width).
    const i1 = c.x1 === w.width ? c.x1 + 1 : c.x1;
    const j1 = c.y1 === w.height ? c.y1 + 1 : c.y1;
    const batches = { land: new QuadBatch(), water: new QuadBatch(), overlay: new QuadBatch() };
    for (let j = c.y0; j < j1; j++) for (let i = c.x0; i < i1; i++) this.buildDualCell(i, j, batches, c.water);
    c.base.addChild(batches.water.build(), batches.land.build());
    c.overlay.addChild(batches.overlay.build());
  }

  /** Zones, roads and objects change with play (building, clearing); terrain doesn't, so only these get rebuilt. */
  private fillRoadsAndObjects(c: Chunk) {
    const w = this.world;
    const zones = new QuadBatch();
    const roads = new QuadBatch();
    for (let y = c.y0; y < c.y1; y++) {
      for (let x = c.x0; x < c.x1; x++) {
        const i = w.index(x, y);
        const z = w.zone[i];
        if (!isZoned(z)) continue;
        // Developed lots show only a faint tint; empty lots no road reaches are greyed out (they can't grow).
        const stranded = w.building[i] === -1 && findEntrance(w, x, y, 1, 1, BALANCE.roadAccessRange) === -1;
        const color = stranded ? tintColor(STRANDED_TINT, 0.8) : tintColor(ZONE_TINT[z], w.building[i] === -1 ? 0.75 : 0.35);
        zones.add({ texture: this.tex.zoneLot, points: tileQuadPoints(w, x, y), colors: [color, color, color, color, color], grow: 0 });
      }
    }
    for (let y = c.y0; y < c.y1; y++) {
      for (let x = c.x0; x < c.x1; x++) {
        const type = w.road[w.index(x, y)];
        if (type === RoadType.None) continue;
        const bridge = w.bridge[w.index(x, y)];
        if (!bridge) {
          const shade = shadeColor(1);
          const texture = this.tex.roads[type as BuildableRoad][roadMask(w, x, y)];
          roads.add({ texture, points: tileQuadPoints(w, x, y), colors: [shade, shade, shade, shade, shade], grow: 0.5 });
          continue;
        }
        // Bridge decks are level, at the height of the land they start from.
        const p = tileToWorld(x, y);
        const s = new Sprite(this.tex.bridges[type as BuildableRoad][bridge]);
        s.x = p.x - HALF_W - GROUND_PAD;
        s.y = p.y - GROUND_PAD - BRIDGE_HEADROOM - this.deckLevel(x, y, bridge) * HEIGHT_STEP;
        c.roads.addChild(s);
      }
    }
    if (!zones.empty) c.zones.addChild(zones.build());
    if (!roads.empty) c.roads.addChildAt(roads.build(), 0);
    // Objects back-to-front by diagonal (x + y).
    for (let d = c.x0 + c.y0; d <= c.x1 - 1 + (c.y1 - 1); d++) {
      for (let x = c.x0; x < c.x1; x++) {
        const y = d - x;
        if (y >= c.y0 && y < c.y1) this.buildObjects(x, y, c.objects);
      }
    }
  }

  /**
   * Rebuild zones, roads and objects for every chunk touching any of the view-tile rectangles
   * (each grown by one tile, because a road change alters its neighbours' connection masks).
   * A chunk touched by several rectangles is rebuilt once.
   */
  refresh(rects: readonly { minX: number; minY: number; maxX: number; maxY: number }[]) {
    for (const c of this.chunks) {
      const hit = rects.some((r) => !(c.x1 <= r.minX - 1 || c.x0 > r.maxX + 1 || c.y1 <= r.minY - 1 || c.y0 > r.maxY + 1));
      if (!hit) continue;
      for (const layer of [c.zones, c.roads, c.objects]) layer.removeChildren().forEach((s) => s.destroy({ children: true }));
      this.fillRoadsAndObjects(c);
    }
  }

  /** Level of a bridge deck: the higher of the land tiles at its two ends (view space). */
  private deckLevel(x: number, y: number, axis: number): number {
    const w = this.world;
    const [dx, dy] = axis === BridgeAxis.X ? [1, 0] : [0, 1];
    let level = 0;
    for (const dir of [-1, 1]) {
      let tx = x;
      let ty = y;
      while (w.inBounds(tx, ty) && w.bridge[w.index(tx, ty)] !== BridgeAxis.None) {
        tx += dx * dir;
        ty += dy * dir;
      }
      if (w.inBounds(tx, ty)) level = Math.max(level, w.elevation[w.index(tx, ty)]);
    }
    return level;
  }

  /** Ground for dual cell (i, j): a sloped diamond centred on the top vertex of tile (i, j). */
  private buildDualCell(i: number, j: number, b: { land: QuadBatch; water: QuadBatch; overlay: QuadBatch }, water: WaterTile[]) {
    const tex = this.tex;
    const w = this.world;
    const cell = computeDualCell(w, i, j);
    const hash = cellHash(i, j);
    const variant = hash % 4;
    const wobble = (hash >>> 3) % WOBBLE_VARIANTS;
    const points = cellQuadPoints(w, i, j);
    // No hill light: on gentle slopes it read as random dark patches (D-047).
    const white = shadeColor(1);
    const colors = [white, white, white, white, white];
    const add = (texture: Texture, into: QuadBatch, onSlot?: (s: QuadSlot) => void) =>
      into.add({ texture, points, colors, grow: CELL_GROW }, onSlot);

    if (isWaterTerrain(cell.base)) {
      const frames = (cell.base === Terrain.DeepWater ? tex.water.deep : tex.water.shallow)[variant];
      const offset = (hash >>> 6) % WATER_PHASES;
      add(frames[offset], b.water, (slot) => water.push({ slot, frames, offset }));
    } else {
      add(tex.ground[cell.base][variant], b.land);
    }

    // Shallow water first, then the surf line, then land, so the land edge sits on the surf's inner side.
    let foamDrawn = cell.shore === 0;
    for (const o of cell.overlays) {
      if (!foamDrawn && !isWaterTerrain(o.terrain)) {
        add(tex.foam[wobble][cell.shore], b.overlay);
        foamDrawn = true;
      }
      const set = tex.overlays.get(o.terrain);
      if (set) add(set[wobble][o.mask], b.overlay);
    }
  }

  private buildObjects(x: number, y: number, objects: Container) {
    const w = this.world;
    const i = w.index(x, y);
    const bid = w.building[i];
    if (bid !== -1) {
      this.buildBuilding(x, y, bid, objects);
      return;
    }
    if (w.road[i] !== RoadType.None) {
      const furniture = this.streetFurniture(x, y);
      if (furniture) {
        const p = tileToWorld(x, y);
        const s = new Sprite(furniture);
        s.x = p.x - HALF_W - GROUND_PAD;
        s.y = p.y - GROUND_PAD - FURNITURE_HEADROOM - tileLift(w, x, y);
        objects.addChild(s);
      }
      return;
    }
    // Hash the *world* tile so trees and rocks keep their look when the view rotates.
    const hash = cellHash(w.source[i] + 7919, 104729);
    let texture: Texture | null = null;
    const density = w.tree[i];
    const decor = w.decor[i];
    if (density > 0) texture = this.tex.trees[Math.min(density, 3)][hash % TREE_VARIANTS];
    else if (decor !== Decor.None) texture = this.tex.decor[decor][hash % DECOR_VARIANTS];
    if (!texture) return;

    const p = tileToWorld(x, y);
    const s = new Sprite(texture);
    s.x = p.x - HALF_W - GROUND_PAD;
    s.y = p.y - GROUND_PAD - TREE_HEADROOM - tileLift(w, x, y);
    objects.addChild(s);
  }

  /**
   * Street furniture for a road tile (docs/specs/city-art.md), or null. Choices hash the *world*
   * tile, and overbridges and gantries use world coordinates, so they stay put when the view rotates.
   */
  private streetFurniture(x: number, y: number): Texture | null {
    const w = this.world;
    const i = w.index(x, y);
    if (w.bridge[i] !== BridgeAxis.None) return null;
    const f = this.tex.furniture;
    const mask = roadMask(w, x, y);
    const straight = mask === 0b0101 || mask === 0b1010;
    const axis = mask === 0b1010 ? 'u' : 'v';
    const src = w.source[i];
    const hash = cellHash(src + 7919, 104729);
    if (w.road[i] === RoadType.Highway) {
      if (!straight) return null;
      const ww = w.view.w;
      const k = ((src % ww) + Math.floor(src / ww)) % 8;
      // Overbridges need dry land at both ends.
      const [sx, sy] = axis === 'u' ? [0, 1] : [1, 0];
      const dry = (tx: number, ty: number) => w.inBounds(tx, ty) && !isWaterTerrain(w.terrain[w.index(tx, ty)] as TerrainId);
      if (k === 0 && dry(x - sx, y - sy) && dry(x + sx, y + sy)) return f.overbridge[axis];
      if (k === 4) return f.gantry[axis];
      return k % 2 === 1 ? f.highwayLamp[axis] : null;
    }
    if (straight) {
      const style = hash % 5;
      return style < f.street[axis].length ? f.street[axis][style] : null;
    }
    const t = f.lights[mask] !== Texture.EMPTY ? f.lights[mask] : f.cornerLamp[mask];
    return t === Texture.EMPTY ? null : t;
  }

  /** A building is one sprite, added when we reach its front (south) tile so it sorts with trees. */
  private buildBuilding(x: number, y: number, id: number, objects: Container) {
    const b = this.world.buildings.get(id);
    if (!b) return;
    const r = this.world.view.r;
    const size = BUILDINGS[b.def].size;
    // Footprint in view space (quarter turns swap width and height).
    const w = r % 2 === 0 ? size.w : size.h;
    const h = r % 2 === 0 ? size.h : size.w;
    if (x !== b.x + w - 1 || y !== b.y + h - 1) return;
    const p = tileToWorld(b.x, b.y);
    // Grown footprints are square (1×1 or 2×2), so a site frame fits any rotation.
    const site = b.construction > 0 && (size.w === 1 || size.w === 2) ? size.w : null;
    const s = new Sprite(site ? this.tex.sites[site][constructionStage(b)] : buildingTexture(this.tex, b.def, b.variant, r));
    s.x = p.x - h * HALF_W - GROUND_PAD;
    // Footprints are flat (docs/specs/elevation.md), so the origin tile's level lifts the whole building.
    s.y = p.y - GROUND_PAD - (site ? siteHeadroom(site) : buildingHeadroom(b.def, b.variant)) - tileLift(this.world, b.x, b.y);
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
        const q = tileQuadPoints(this.world, x, y);
        g.poly([q[0].x, q[0].y, q[1].x, q[1].y, q[2].x, q[2].y, q[3].x, q[3].y]).fill(hexToNumber(GROUND_BASE[t]));
      }
    }
    return g;
  }

  /** Points along the map border at tile corners, lifted by height: clockwise from the top corner. */
  private borderPoints(): Vec[] {
    const { width: n, height: m } = this.world;
    const pts: Vec[] = [];
    const at = (x: number, y: number) => {
      const p = tileToWorld(x, y);
      pts.push({ x: p.x, y: p.y - cornerHeight(this.world, x, y) * HEIGHT_STEP });
    };
    for (let x = 0; x < n; x++) at(x, 0);
    for (let y = 0; y < m; y++) at(n, y);
    for (let x = n; x > 0; x--) at(x, m);
    for (let y = m; y > 0; y--) at(0, y);
    return pts;
  }

  private buildMapShape(g: Graphics): Graphics {
    return g.poly(this.borderPoints().flatMap((p) => [p.x, p.y]));
  }

  /**
   * Diorama-style soil slab under the two front edges, so the map reads as a
   * solid piece of land rather than ending in a hard cut. Water along the edge
   * shows as a blue band on the slab.
   */
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
    const batch = new QuadBatch();
    const white = shadeColor(1);
    for (let y = c.y0; y < c.y1; y++) {
      for (let x = c.x0; x < c.x1; x++) {
        batch.add({ texture: this.tex.gridLine, points: tileQuadPoints(this.world, x, y), colors: [white, white, white, white, white], grow: 0 });
      }
    }
    const grid = new Container({ isRenderGroup: true });
    grid.addChild(batch.build());
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
      if (!c.visible || c.water.length === 0) continue;
      for (const wt of c.water) setQuadTexture(wt.slot, wt.frames[(this.waterPhase + wt.offset) % WATER_PHASES]);
      // All of a chunk's water shares one mesh (one atlas page).
      flushUVs(c.water[0].slot.mesh);
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
        c.zones.visible = vis;
        c.roads.visible = vis;
        c.objects.visible = vis;
        if (c.grid) c.grid.visible = vis;
      }
      if (vis) {
        chunks++;
        sprites +=
          c.base.children.length +
          c.overlay.children.length +
          c.zones.children.length +
          c.roads.children.length +
          c.objects.children.length;
      }
    }
    this.visibleChunks = chunks;
    this.visibleSprites = sprites;
  }

  /** Free every display object (used when the view rotates and the terrain is rebuilt). */
  destroy() {
    for (const c of [this.groundRoot, this.zonesRoot, this.roadsRoot, this.gridRoot, this.objectsRoot, this.groundMask]) {
      c.destroy({ children: true });
    }
  }

  get totalChunks() {
    return this.chunks.length;
  }
}
