import { Texture } from 'pixi.js';
import { BridgeAxis, RoadType, type BuildableRoad } from '../../sim/roads';
import { Decor, DECOR_KINDS, GROUND_VARIANTS, Terrain, type DecorId, type TerrainId } from '../../sim/terrain/types';
import { OVERLAY_TERRAINS } from '../transitions';
import { AtlasBuilder, type FramePainter } from './AtlasBuilder';
import { DECOR_VARIANTS, paintDecor } from './decorArt';
import { BRIDGE_FRAME_H, diamondPath, GROUND_FRAME_H, GROUND_FRAME_W, TREE_FRAME_H } from './geometry';
import { paintGround, WATER_PHASES } from './groundArt';
import { paintBridge, paintRoad } from './roadArt';
import { BUILDING_ROTATIONS, BUILDING_VARIANTS, buildingFrameSize, paintBuilding } from './buildingArt';
import {
  paintPerson,
  paintVehicle,
  PERSON_H,
  PERSON_VARIANTS,
  PERSON_W,
  VEHICLE_FRAME_H,
  VEHICLE_KINDS,
  VEHICLE_VARIANTS,
} from './agentArt';
import type { AgentKind } from '../../sim/traffic';
import { BUILDING_IDS, type BuildingId } from '../../sim/buildings/catalog';
import { CHIP_SIZE, LEAF_SIZE, paintChip, paintLeaf, paintPuff, PUFF_SIZE } from './fxArt';
import type { FxTextures } from '../fx/Effects';
import {
  foamOverlay,
  GRASS_SHAPE,
  LAND_SHAPE,
  maskedOverlay,
  SHALLOW_SHAPE,
  WOBBLE_VARIANTS,
  type MaskShape,
} from './transitionArt';
import { paintTreeCluster, TREE_VARIANTS } from './treeArt';
import { paintBusStop, STOP_FRAME_H, STOP_FRAME_W } from './stopArt';
import { paintSite, SITE_SIZES, SITE_STAGES, siteFrameSize, type SiteSize } from './constructionArt';

const ALL_TERRAINS: readonly TerrainId[] = [
  Terrain.DeepWater,
  Terrain.ShallowWater,
  Terrain.Sand,
  Terrain.Grass,
  Terrain.DryGrass,
  Terrain.Dirt,
  Terrain.Rock,
];

/** Overlay frames for a terrain, indexed [wobbleVariant][cornerMask]. Masks 0 and 15 are Texture.EMPTY (never drawn). */
export type MaskTextures = Texture[][];

export interface TerrainTextures {
  /** Static ground, indexed [variant]. Water entries are phase 0. */
  ground: Readonly<Record<TerrainId, Texture[]>>;
  /** Animated water, indexed [variant][phase]. */
  water: { deep: Texture[][]; shallow: Texture[][] };
  overlays: ReadonlyMap<TerrainId, MaskTextures>;
  foam: MaskTextures;
  /** Tree clusters, indexed [density 1..3][variant]. Index 0 is empty. */
  trees: Texture[][];
  /** Decorations, indexed [DecorId][variant]. Index 0 (None) is empty. */
  decor: Texture[][];
  /** Road pieces, indexed by road type then 4-bit connection mask. */
  roads: Readonly<Record<BuildableRoad, Texture[]>>;
  /** Bridge spans (taller frames: see BRIDGE_HEADROOM), indexed by road type then BridgeAxis (0 is Texture.EMPTY). */
  bridges: Readonly<Record<BuildableRoad, Texture[]>>;
  /** Plain white diamond for tool previews (tinted at runtime). */
  selection: Texture;
  /** Zoned-lot diamond with an outline (tinted by zone at runtime). */
  zoneLot: Texture;
  /** Construction sites, indexed by footprint size then stage (0 foundation, 1 scaffold). */
  sites: Readonly<Record<SiteSize, readonly Texture[]>>;
  /** Buildings, indexed by id, variant, then view rotation. Frames vary in size: see buildingFrameSize(). */
  buildings: Readonly<Record<BuildingId, Texture[][]>>;
  fx: FxTextures;
  /** Vehicles, indexed by kind, then variant, then direction (0 NE, 1 SE, 2 SW, 3 NW). */
  vehicles: Readonly<Record<Exclude<AgentKind, 'person'>, Texture[][]>>;
  /** Pedestrians, indexed by variant then walk frame (0/1). */
  people: Texture[][];
  /** Bus stop shelters, indexed by view side (0 −y, 1 +x, 2 +y, 3 −x). */
  busStops: Texture[];
  /** "No road access" warning badge. */
  warnRoad: Texture;
  hover: Texture;
  gridLine: Texture;
}

const ROAD_TYPES: readonly BuildableRoad[] = [RoadType.Road, RoadType.Highway];

function shapeFor(t: TerrainId): MaskShape {
  if (t === Terrain.ShallowWater) return SHALLOW_SHAPE;
  if (t === Terrain.Grass) return GRASS_SHAPE;
  return LAND_SHAPE;
}

function paintToCanvas(w: number, h: number, r: number, paint: FramePainter): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * r);
  c.height = Math.ceil(h * r);
  const ctx = c.getContext('2d')!;
  ctx.setTransform(r, 0, 0, r, 0, 0);
  paint(ctx, w, h);
  return c;
}

/** A painter that blits pixel data (already at atlas resolution) 1:1. */
function blitImage(img: ImageData): FramePainter {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d')!.putImageData(img, 0, 0);
  return (ctx, w, h) => ctx.drawImage(c, 0, 0, w, h);
}

function paintHover(ctx: CanvasRenderingContext2D) {
  diamondPath(ctx, -1);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function paintSelection(ctx: CanvasRenderingContext2D) {
  diamondPath(ctx, -0.5);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Map-pin style badge with a little road glyph: "this building has no road". */
function paintWarnRoad(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(9, 18.5, 3.5, 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a1d14';
  ctx.beginPath();
  ctx.arc(9, 8, 8, 0, Math.PI * 2);
  ctx.moveTo(5, 13);
  ctx.lineTo(9, 18);
  ctx.lineTo(13, 13);
  ctx.fill();
  ctx.fillStyle = '#ff6a3d';
  ctx.beginPath();
  ctx.arc(9, 8, 6.8, 0, Math.PI * 2);
  ctx.fill();
  // Road glyph: two edges and a dashed centre line.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(5.5, 4, 1.2, 8);
  ctx.fillRect(11.3, 4, 1.2, 8);
  ctx.fillRect(8.5, 4, 1, 2);
  ctx.fillRect(8.5, 7, 1, 2);
  ctx.fillRect(8.5, 10, 1, 2);
}

function paintZoneLot(ctx: CanvasRenderingContext2D) {
  diamondPath(ctx, -1.5);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = 1.25;
  ctx.stroke();
}

function paintGridLine(ctx: CanvasRenderingContext2D) {
  diamondPath(ctx, -0.25);
  ctx.strokeStyle = 'rgba(10, 40, 10, 0.22)';
  ctx.lineWidth = 0.75;
  ctx.stroke();
}

/** Over-draw for overlay sources (logical px); cellCoords() trims it back to ~1px past the edge. */
const OVERLAY_SOURCE_GROW = 3;

const range = <T>(n: number, f: (i: number) => T): T[] => Array.from({ length: n }, (_, i) => f(i));

/** Paint every terrain frame procedurally and pack them into one atlas. */
export function buildTerrainTextures(): TerrainTextures {
  const b = new AtlasBuilder(2);
  const r = b.resolution;
  const W = GROUND_FRAME_W;
  const H = GROUND_FRAME_H;

  for (const t of ALL_TERRAINS) {
    for (let v = 0; v < GROUND_VARIANTS; v++) b.add(`ground_${t}_${v}`, W, H, (ctx) => paintGround(ctx, t, v));
  }
  for (const t of [Terrain.DeepWater, Terrain.ShallowWater]) {
    for (let v = 0; v < GROUND_VARIANTS; v++) {
      for (let p = 0; p < WATER_PHASES; p++) b.add(`water_${t}_${v}_${p}`, W, H, (ctx) => paintGround(ctx, t, v, p));
    }
  }

  // Dual-grid overlays: the terrain painted once per wobble variant, then masked per corner case.
  for (const t of OVERLAY_TERRAINS) {
    const shape = shapeFor(t);
    for (let w = 0; w < WOBBLE_VARIANTS; w++) {
      // Painted oversized so the masked copy is fully opaque right up to the cell edge.
      const src = paintToCanvas(W, H, r, (ctx) => paintGround(ctx, t, w % GROUND_VARIANTS, 0, OVERLAY_SOURCE_GROW));
      const img = src.getContext('2d')!.getImageData(0, 0, src.width, src.height);
      for (let m = 1; m < 15; m++) b.add(`ov_${t}_${w}_${m}`, W, H, blitImage(maskedOverlay(img, r, m, w, shape)));
    }
  }
  const fw = Math.ceil(W * r);
  const fh = Math.ceil(H * r);
  for (let w = 0; w < WOBBLE_VARIANTS; w++) {
    for (let m = 1; m < 15; m++) b.add(`foam_${w}_${m}`, W, H, blitImage(foamOverlay(fw, fh, r, m, w)));
  }

  for (const d of [1, 2, 3] as const) {
    for (let v = 0; v < TREE_VARIANTS; v++) b.add(`tree_${d}_${v}`, W, TREE_FRAME_H, (ctx) => paintTreeCluster(ctx, d, v));
  }
  const decorKinds = range(DECOR_KINDS, (k) => (k + 1) as Exclude<DecorId, typeof Decor.None>);
  for (const k of decorKinds) {
    for (let v = 0; v < DECOR_VARIANTS; v++) b.add(`decor_${k}_${v}`, W, TREE_FRAME_H, (ctx) => paintDecor(ctx, k, v));
  }
  for (const t of ROAD_TYPES) {
    for (let m = 0; m < 16; m++) b.add(`road_${t}_${m}`, W, H, (ctx) => paintRoad(ctx, t, m));
    for (const axis of [BridgeAxis.X, BridgeAxis.Y]) b.add(`bridge_${t}_${axis}`, W, BRIDGE_FRAME_H, (ctx) => paintBridge(ctx, t, axis));
  }
  b.add('selection', W, H, paintSelection);
  b.add('zone_lot', W, H, paintZoneLot);
  for (const size of SITE_SIZES) {
    const f = siteFrameSize(size);
    for (const stage of SITE_STAGES) b.add(`site_${size}_${stage}`, f.w, f.h, (ctx) => paintSite(ctx, size, stage));
  }
  for (const id of BUILDING_IDS) {
    const f = buildingFrameSize(id);
    for (let v = 0; v < BUILDING_VARIANTS; v++) {
      for (const r of BUILDING_ROTATIONS) b.add(`bld_${id}_${v}_${r}`, f.w, f.h, (ctx) => paintBuilding(ctx, id, v, r));
    }
  }
  for (const k of VEHICLE_KINDS) {
    for (let v = 0; v < VEHICLE_VARIANTS; v++) {
      for (let d = 0; d < 4; d++) b.add(`veh_${k}_${v}_${d}`, W, VEHICLE_FRAME_H, (ctx) => paintVehicle(ctx, k, v, d));
    }
  }
  for (let v = 0; v < PERSON_VARIANTS; v++) {
    for (let f = 0; f < 2; f++) b.add(`person_${v}_${f}`, PERSON_W, PERSON_H, (ctx) => paintPerson(ctx, v, f));
  }
  for (const side of [0, 1, 2, 3] as const) b.add(`stop_${side}`, STOP_FRAME_W, STOP_FRAME_H, (ctx) => paintBusStop(ctx, side));
  b.add('warn_road', 18, 20, paintWarnRoad);
  b.add('fx_puff', PUFF_SIZE, PUFF_SIZE, paintPuff);
  b.add('fx_chip', CHIP_SIZE, CHIP_SIZE, paintChip);
  b.add('fx_leaf', LEAF_SIZE, LEAF_SIZE, paintLeaf);
  b.add('hover', W, H, paintHover);
  b.add('grid', W, H, paintGridLine);

  const tex = b.build();
  const get = (name: string): Texture => {
    const t = tex.get(name);
    if (!t) throw new Error(`atlas frame missing: ${name}`);
    return t;
  };
  const masks = (prefix: string): MaskTextures =>
    range(WOBBLE_VARIANTS, (w) => range(16, (m) => (m === 0 || m === 15 ? Texture.EMPTY : get(`${prefix}_${w}_${m}`))));

  const ground = Object.fromEntries(
    ALL_TERRAINS.map((t) => [t, range(GROUND_VARIANTS, (v) => get(`ground_${t}_${v}`))]),
  ) as Record<TerrainId, Texture[]>;
  const water = (t: TerrainId) => range(GROUND_VARIANTS, (v) => range(WATER_PHASES, (p) => get(`water_${t}_${v}_${p}`)));

  return {
    ground,
    water: { deep: water(Terrain.DeepWater), shallow: water(Terrain.ShallowWater) },
    overlays: new Map(OVERLAY_TERRAINS.map((t) => [t, masks(`ov_${t}`)])),
    foam: masks('foam'),
    trees: [[], ...([1, 2, 3] as const).map((d) => range(TREE_VARIANTS, (v) => get(`tree_${d}_${v}`)))],
    decor: [[], ...decorKinds.map((k) => range(DECOR_VARIANTS, (v) => get(`decor_${k}_${v}`)))],
    roads: Object.fromEntries(ROAD_TYPES.map((t) => [t, range(16, (m) => get(`road_${t}_${m}`))])) as Record<
      BuildableRoad,
      Texture[]
    >,
    bridges: Object.fromEntries(
      ROAD_TYPES.map((t) => [t, [Texture.EMPTY, get(`bridge_${t}_${BridgeAxis.X}`), get(`bridge_${t}_${BridgeAxis.Y}`)]]),
    ) as Record<BuildableRoad, Texture[]>,
    selection: get('selection'),
    zoneLot: get('zone_lot'),
    sites: { 1: SITE_STAGES.map((st) => get(`site_1_${st}`)), 2: SITE_STAGES.map((st) => get(`site_2_${st}`)) },
    buildings: Object.fromEntries(
      BUILDING_IDS.map((id) => [
        id,
        range(BUILDING_VARIANTS, (v) => BUILDING_ROTATIONS.map((r) => get(`bld_${id}_${v}_${r}`))),
      ]),
    ) as Record<BuildingId, Texture[][]>,
    vehicles: Object.fromEntries(
      VEHICLE_KINDS.map((k) => [k, range(VEHICLE_VARIANTS, (v) => range(4, (d) => get(`veh_${k}_${v}_${d}`)))]),
    ) as Record<Exclude<AgentKind, 'person'>, Texture[][]>,
    people: range(PERSON_VARIANTS, (v) => range(2, (f) => get(`person_${v}_${f}`))),
    busStops: range(4, (side) => get(`stop_${side}`)),
    warnRoad: get('warn_road'),
    fx: { puff: get('fx_puff'), chip: get('fx_chip'), leaf: get('fx_leaf') },
    hover: get('hover'),
    gridLine: get('grid'),
  };
}
