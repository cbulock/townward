import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { CHUNK_SIZE, HALF_W, HEIGHT_STEP, TILE_H } from '../shared/constants';
import { cornerHeight } from '../sim/terrain/elevation';
import { Terrain, type TerrainId } from '../sim/terrain/types';
import type { World } from '../sim/World';
import { GROUND_PAD, TREE_HEADROOM } from './atlas/geometry';
import { WATER_PHASES } from './atlas/groundArt';
import type { TerrainTextures } from './atlas/tiles';
import { WOBBLE_VARIANTS } from './atlas/transitionArt';
import { TREE_VARIANTS } from './atlas/treeArt';
import type { Rect } from './Camera';
import { flushUVs, QuadBatch, setQuadTexture, type QuadSlot, type Rgba, type Vec } from './ground/TileMesh';
import { tileToWorld } from './iso';
import { computeDualCell, isWaterTerrain } from './transitions';
import { cellQuadPoints, tileQuadPoints } from './view/lift';
import { GROUND_BASE, hexToRgb } from './atlas/palette';
import { ViewTransform } from './view/ViewTransform';
import { ViewWorld } from './view/ViewWorld';

/** Fog starts this share of the way across the ring and is total at the outer edge. */
const FOG_START = 0.12;
const FOG_END = 0.7;
/** Tree sprites this far out; beyond it the fog has mostly swallowed the land anyway. */
const TREE_SPRITE_RANGE = 20;
const CELL_GROW = 1.5;
const WATER_FRAME_TIME = 0.16;
/** The fog colour (matches TileMesh's FOG and --bg-app), 0..1 per channel. */
const FOG_BG: readonly [number, number, number] = [0.051, 0.067, 0.09];

interface Chunk {
  ground: Container;
  water: { slot: QuadSlot; frames: Texture[]; offset: number }[];
  bounds: Rect;
  visible: boolean;
}

function cellHash(x: number, y: number): number {
  let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Draws the borderlands ring (docs/specs/elevation.md) round the map in the current view.
 * The extended world is rotated like the map, so the map sits at an offset of `ring` tiles
 * in view space; every position is shifted back by that offset. Ground meshes are chunked
 * and culled; trees near the map are sprites split into a layer behind the map's objects
 * and one in front of them.
 */
export class BorderRenderer {
  readonly ground = new Container();
  readonly backObjects = new Container();
  readonly frontObjects = new Container();
  /** Faint dashed line on the map border. */
  readonly line = new Graphics();
  private readonly chunks: Chunk[] = [];
  private readonly view: ViewWorld;
  private readonly shift: Vec;
  private waterTimer = 0;
  private waterPhase = 0;

  constructor(
    ext: World,
    private readonly ring: number,
    /** The map's view-space world (for the border line). */
    private readonly map: World,
    rotation: 0 | 1 | 2 | 3,
    private readonly tex: TerrainTextures,
  ) {
    this.view = new ViewWorld(new ViewTransform(ext.width, ext.height, rotation), ext.seed);
    this.view.sync(ext);
    const s = tileToWorld(ring, ring);
    this.shift = { x: s.x, y: s.y };
    const n = ext.width;
    const chunks = Math.ceil((n + 1) / CHUNK_SIZE);
    const order: [number, number][] = [];
    for (let cy = 0; cy < chunks; cy++) for (let cx = 0; cx < chunks; cx++) order.push([cx, cy]);
    order.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
    for (const [cx, cy] of order) this.buildChunk(cx, cy);
    this.buildTrees();
    this.drawLine();
  }

  /** Map view-tile distance outside the map (0 inside). */
  private outside(i: number, j: number): number {
    const x = i - this.ring;
    const y = j - this.ring;
    const dx = x < 0 ? -x : x >= this.map.width ? x - this.map.width + 1 : 0;
    const dy = y < 0 ? -y : y >= this.map.height ? y - this.map.height + 1 : 0;
    return Math.max(dx, dy);
  }

  private fogAt(i: number, j: number): number {
    return smoothstep(this.ring * FOG_START, this.ring * FOG_END, this.outside(i, j));
  }

  private buildChunk(cx: number, cy: number) {
    const n = this.view.width;
    const i0 = cx * CHUNK_SIZE;
    const j0 = cy * CHUNK_SIZE;
    const i1 = Math.min(i0 + CHUNK_SIZE, n + 1);
    const j1 = Math.min(j0 + CHUNK_SIZE, n + 1);
    const land = new QuadBatch();
    const waterBatch = new QuadBatch();
    const overlay = new QuadBatch();
    const water: Chunk['water'] = [];
    const ring = this.ring;
    const mw = this.map.width;
    const mh = this.map.height;
    for (let j = j0; j < j1; j++) {
      for (let i = i0; i < i1; i++) {
        // Skip cells entirely inside the map (its own renderer draws those); keep the seam cells.
        if (i > ring && i < ring + mw && j > ring && j < ring + mh) continue;
        const fog = this.fogAt(i, j);
        if (fog >= 0.995) continue;
        this.buildCell(i, j, { land, water: waterBatch, overlay }, water);
      }
    }
    if (land.empty && waterBatch.empty && overlay.empty) return;
    const ground = new Container({ isRenderGroup: true });
    ground.addChild(this.buildUnderlay(i0, j0, Math.min(i1, n), Math.min(j1, n)), waterBatch.build(), land.build(), overlay.build());
    this.ground.addChild(ground);
    const a = this.at(i0, j0);
    const b = this.at(i1, j0);
    const c = this.at(i1, j1);
    const d = this.at(i0, j1);
    const bounds: Rect = { minX: d.x - HALF_W, maxX: b.x + HALF_W, minY: a.y - TILE_H * 2 - 255 * HEIGHT_STEP, maxY: c.y + TILE_H };
    this.chunks.push({ ground, water, bounds, visible: true });
  }

  /**
   * Flat colour diamonds under the ring's tiles, in the same fogged colour as the ground.
   * Far out, mipmapped tile edges go slightly transparent; this stops the dark background
   * showing through as a lattice (the map's own underlay does the same job).
   */
  private buildUnderlay(i0: number, j0: number, i1: number, j1: number): Graphics {
    const v = this.view;
    const g = new Graphics();
    for (let y = j0; y < j1; y++) {
      for (let x = i0; x < i1; x++) {
        if (this.outside(x, y) === 0) continue;
        const fog = this.fogAt(x, y);
        if (fog >= 0.995) continue;
        const k = v.index(x, y);
        const [r, gg, b] = hexToRgb(GROUND_BASE[v.terrain[k] as TerrainId]);
        const ch = (c: number, bg: number) => Math.round(c * (1 - fog) + bg * 255 * fog);
        const color = (ch(r, FOG_BG[0]) << 16) | (ch(gg, FOG_BG[1]) << 8) | ch(b, FOG_BG[2]);
        const q = tileQuadPoints(v, x, y).map((p) => ({ x: p.x - this.shift.x, y: p.y - this.shift.y }));
        g.poly([q[0].x, q[0].y, q[1].x, q[1].y, q[2].x, q[2].y, q[3].x, q[3].y]).fill(Math.min(0xffffff, color));
      }
    }
    return g;
  }

  /** Unlifted screen-world point of an extended view-tile corner, shifted onto the map. */
  private at(x: number, y: number): Vec {
    const p = tileToWorld(x, y);
    return { x: p.x - this.shift.x, y: p.y - this.shift.y };
  }

  private buildCell(i: number, j: number, b: { land: QuadBatch; water: QuadBatch; overlay: QuadBatch }, water: Chunk['water']) {
    const v = this.view;
    const tex = this.tex;
    const cell = computeDualCell(v, i, j);
    const hash = cellHash(i, j);
    const variant = hash % 4;
    const wobble = (hash >>> 3) % WOBBLE_VARIANTS;
    const points = cellQuadPoints(v, i, j).map((p) => ({ x: p.x - this.shift.x, y: p.y - this.shift.y }));
    const tiles: [number, number][] = [
      [i - 1, j - 1],
      [i, j - 1],
      [i, j],
      [i - 1, j],
    ];
    const white: Rgba = [1, 1, 1, 1];
    const colors = [white, white, white, white, white];
    const fogs = [...tiles.map(([x, y]) => this.fogAt(x, y)), this.fogAt(i, j)];
    const add = (texture: Texture, into: QuadBatch, onSlot?: (s: QuadSlot) => void) =>
      into.add({ texture, points, colors, fog: fogs, grow: CELL_GROW }, onSlot);

    if (isWaterTerrain(cell.base)) {
      const frames = (cell.base === Terrain.DeepWater ? tex.water.deep : tex.water.shallow)[variant];
      const offset = (hash >>> 6) % WATER_PHASES;
      add(frames[offset], b.water, (slot) => water.push({ slot, frames, offset }));
    } else {
      add(tex.ground[cell.base][variant], b.land);
    }
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

  /** Tree sprites in the band next to the map, back-to-front, split into behind/in front of the map. */
  private buildTrees() {
    const v = this.view;
    const n = v.width;
    const ring = this.ring;
    for (let d = 0; d <= 2 * (n - 1); d++) {
      for (let x = Math.max(0, d - n + 1); x <= Math.min(d, n - 1); x++) {
        const y = d - x;
        const out = this.outside(x, y);
        if (out === 0 || out > TREE_SPRITE_RANGE) continue;
        const k = v.index(x, y);
        const density = v.tree[k];
        if (density === 0) continue;
        const p = this.at(x, y);
        const s = new Sprite(this.tex.trees[Math.min(density, 3)][cellHash(x + 7919, y) % TREE_VARIANTS]);
        s.x = p.x - HALF_W - GROUND_PAD;
        s.y = p.y - GROUND_PAD - TREE_HEADROOM - v.elevation[k] * HEIGHT_STEP;
        s.alpha = 1 - this.fogAt(x, y) * 0.8;
        // In front of the map: past its far-right or far-left edge in view space.
        const front = x - ring >= this.map.width || y - ring >= this.map.height;
        (front ? this.frontObjects : this.backObjects).addChild(s);
      }
    }
  }

  /** Faint dashes along the map border, one per tile, following the terrain. */
  private drawLine() {
    const m = this.map;
    const g = this.line;
    const pt = (x: number, y: number) => {
      const p = tileToWorld(x, y);
      return { x: p.x, y: p.y - cornerHeight(m, x, y) * HEIGHT_STEP };
    };
    const edges: [number, number, number, number][] = [];
    for (let x = 0; x < m.width; x++) edges.push([x, 0, x + 1, 0], [x, m.height, x + 1, m.height]);
    for (let y = 0; y < m.height; y++) edges.push([0, y, 0, y + 1], [m.width, y, m.width, y + 1]);
    for (const [ax, ay, bx, by] of edges) {
      const a = pt(ax, ay);
      const b = pt(bx, by);
      // A dash over the middle 60% of each tile edge.
      g.moveTo(a.x + (b.x - a.x) * 0.2, a.y + (b.y - a.y) * 0.2).lineTo(a.x + (b.x - a.x) * 0.8, a.y + (b.y - a.y) * 0.8);
    }
    g.stroke({ width: 1.5, color: 0xffffff, alpha: 0.35 });
  }

  cull(view: Rect) {
    for (const c of this.chunks) {
      const b = c.bounds;
      const vis = b.maxX >= view.minX && b.minX <= view.maxX && b.maxY >= view.minY && b.minY <= view.maxY;
      if (vis !== c.visible) {
        c.visible = vis;
        c.ground.visible = vis;
      }
    }
  }

  update(dt: number) {
    this.waterTimer += dt;
    if (this.waterTimer < WATER_FRAME_TIME) return;
    this.waterTimer %= WATER_FRAME_TIME;
    this.waterPhase = (this.waterPhase + 1) % WATER_PHASES;
    for (const c of this.chunks) {
      if (!c.visible || c.water.length === 0) continue;
      for (const w of c.water) setQuadTexture(w.slot, w.frames[(this.waterPhase + w.offset) % WATER_PHASES]);
      flushUVs(c.water[0].slot.mesh);
    }
  }

  destroy() {
    for (const c of [this.ground, this.backObjects, this.frontObjects, this.line]) c.destroy({ children: true });
  }
}
