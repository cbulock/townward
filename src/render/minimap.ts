import { BUILDINGS, type BuildingCategory } from '../sim/buildings/catalog';
import { RoadType } from '../sim/roads';
import type { TerrainId } from '../sim/terrain/types';
import type { World } from '../sim/World';
import { isZoned } from '../sim/zones';
import { GROUND_BASE, hexToRgb, numberToRgb, ZONE_TINT } from './atlas/theme/palette';
import type { Point, ViewTransform } from './view/ViewTransform';

/**
 * Minimap painter (docs/04-ui-ux.md, "Minimap"): one pixel per tile, drawn as an iso
 * diamond in the current view rotation. Pure canvas code, also used by the New Game preview.
 */

/** Where the diamond sits in the canvas: view tile (vx, vy) → (ox + (vx − vy)·s, oy + (vx + vy)·s/2). */
export interface MinimapLayout {
  readonly s: number;
  readonly ox: number;
  readonly oy: number;
}

const FOREST: readonly [number, number, number] = [38, 120, 46];
const ROAD: readonly [number, number, number] = [58, 61, 68];
const HIGHWAY: readonly [number, number, number] = [36, 38, 43];
/** Avenues read a touch green on the minimap: their planted medians. */
const AVENUE: readonly [number, number, number] = [62, 84, 60];
const SITE: readonly [number, number, number] = [240, 138, 36];
const CATEGORY: Readonly<Record<BuildingCategory, readonly [number, number, number]>> = {
  residential: [222, 244, 228],
  commercial: [196, 222, 255],
  industrial: [250, 226, 140],
  civic: [240, 228, 196],
};

const TERRAIN_RGB = new Map<number, readonly [number, number, number]>(
  Object.entries(GROUND_BASE).map(([k, hex]) => [Number(k), hexToRgb(hex)]),
);

const mix = (a: readonly number[], b: readonly number[], k: number): [number, number, number] => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
];

/** Fit a view-space map of viewW × viewH tiles into a canvas, centred, with `pad` px margin. */
export function minimapLayout(view: ViewTransform, width: number, height: number, pad = 4): MinimapLayout {
  const span = view.viewW + view.viewH;
  const s = Math.min((width - pad * 2) / span, ((height - pad * 2) * 2) / span);
  const ox = (width - span * s) / 2 + view.viewH * s;
  const oy = (height - (span * s) / 2) / 2;
  return { s, ox, oy };
}

/** Canvas px for a continuous view-tile point. */
export function viewTileToMinimap(l: MinimapLayout, p: Point): Point {
  return { x: l.ox + (p.x - p.y) * l.s, y: l.oy + ((p.x + p.y) * l.s) / 2 };
}

/** Continuous view-tile point for canvas px. */
export function minimapToViewTile(l: MinimapLayout, px: number, py: number): Point {
  const a = (px - l.ox) / l.s;
  const b = ((py - l.oy) * 2) / l.s;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** One RGBA pixel per view tile. */
function paintTiles(world: World, view: ViewTransform): ImageData {
  const W = view.viewW;
  const H = view.viewH;
  const img = new ImageData(W, H);
  const d = img.data;
  for (let vy = 0; vy < H; vy++) {
    for (let vx = 0; vx < W; vx++) {
      const t = view.tileToWorld(vx, vy);
      const i = world.index(t.x, t.y);
      let c: readonly number[] = TERRAIN_RGB.get(world.terrain[i] as TerrainId) ?? [0, 0, 0];
      const b = world.buildings.get(world.building[i]);
      const z = world.zone[i];
      if (b) c = b.construction > 0 ? SITE : CATEGORY[BUILDINGS[b.def].category];
      else if (world.road[i] !== RoadType.None) c = world.road[i] === RoadType.Highway ? HIGHWAY : world.road[i] === RoadType.Avenue ? AVENUE : ROAD;
      else {
        if (world.tree[i] > 0) c = mix(c, FOREST, 0.35 + world.tree[i] * 0.15);
        if (isZoned(z)) c = mix(c, numberToRgb(ZONE_TINT[z]), 0.5);
      }
      const o = (vy * W + vx) * 4;
      d[o] = c[0];
      d[o + 1] = c[1];
      d[o + 2] = c[2];
      d[o + 3] = 255;
    }
  }
  return img;
}

/** Paint the whole map into `ctx` (cleared first). Returns the layout for hit-testing and overlays. */
export function paintMinimap(ctx: CanvasRenderingContext2D, world: World, view: ViewTransform, width: number, height: number): MinimapLayout {
  const layout = minimapLayout(view, width, height);
  const tiles = document.createElement('canvas');
  tiles.width = view.viewW;
  tiles.height = view.viewH;
  tiles.getContext('2d')?.putImageData(paintTiles(world, view), 0, 0);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = false;
  const { s, ox, oy } = layout;
  // Image pixel (vx, vy) lands on the diamond: an affine map of the tile grid.
  ctx.setTransform(s, s / 2, -s, s / 2, ox, oy);
  ctx.drawImage(tiles, 0, 0);
  ctx.restore();
  return layout;
}
