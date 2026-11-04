import type { PreviewTile } from '../render/overlays/ToolPreview';
import { buildingHeadroom } from '../render/atlas/buildings';
import { BRIDGE_HEADROOM } from '../render/atlas/geometry';
import { bridgeTexture, buildingTexture, roadTexture, type TerrainTextures } from '../render/atlas/tiles';
import { roadVariant } from '../render/atlas/roads';
import { DECK_LIFT } from '../render/atlas/roadArt';
import type { ViewTransform } from '../render/view/ViewTransform';
import { BUILDINGS, type BuildingDef, type BuildingId, type ServiceKind } from '../sim/buildings/catalog';
import { planClear, planMove, planPlace, planRail, planRoad, planZone, type MovePlan, type Plan, type PlacePlan } from '../sim/commands';
import { isCornerMask, isRail, Rail, railDragPath } from '../sim/rail';
import type { RailCurve } from '../render/atlas/rail';
import { ZoneType, type ZonedType } from '../sim/zones';
import { findEntrance } from '../sim/systems/access';
import { BALANCE } from '../shared/balance';
import { ZONE_TINT } from '../render/atlas/theme/palette';
import { rectTiles, roadPath, RoadType, type BuildableRoad, type TilePos } from '../sim/roads';
import type { World } from '../sim/World';
import { ROAD_SPECS } from '../sim/roadTypes';

export type ZoneToolId = 'zone-r' | 'zone-rh' | 'zone-c' | 'zone-ch' | 'zone-i';
/** Tools that lay roads, and the road type each lays (sim/roadTypes.ts). */
export const ROAD_TOOLS = {
  pedestrian: RoadType.Pedestrian,
  road: RoadType.Road,
  avenue: RoadType.Avenue,
  boulevard: RoadType.Boulevard,
  ramp: RoadType.Ramp,
  highway: RoadType.Highway,
  expressway: RoadType.Expressway,
} as const satisfies Record<string, BuildableRoad>;
export type RoadToolId = keyof typeof ROAD_TOOLS;
export const ROAD_TOOL_IDS = Object.keys(ROAD_TOOLS) as RoadToolId[]; // the keys of a literal object, in order

export function isRoadTool(tool: ToolId): tool is RoadToolId {
  return tool in ROAD_TOOLS;
}

export type ToolId = 'select' | 'clear' | 'move' | RoadToolId | 'rail' | 'build' | ZoneToolId;

/** What each zone tool paints. Removing a zone is done with Clear (D-051). */
export const ZONE_TOOLS: Readonly<Record<ZoneToolId, ZonedType>> = {
  'zone-r': ZoneType.Residential,
  'zone-rh': ZoneType.ResidentialHigh,
  'zone-c': ZoneType.Commercial,
  'zone-ch': ZoneType.CommercialHigh,
  'zone-i': ZoneType.Industrial,
};

export function isZoneTool(tool: ToolId): tool is ZoneToolId {
  return tool in ZONE_TOOLS;
}

/** Keyboard shortcuts, also shown in the toolbar. */
export const TOOL_KEYS: Readonly<Record<ToolId, string>> = {
  select: 'KeyQ',
  clear: 'KeyB',
  move: 'KeyP',
  rail: 'KeyZ',
  pedestrian: 'KeyK',
  road: 'KeyR',
  avenue: 'KeyV',
  boulevard: 'KeyU',
  ramp: 'KeyJ',
  highway: 'KeyH',
  expressway: 'KeyX',
  build: 'KeyE',
  'zone-r': 'Digit1',
  'zone-rh': 'Digit2',
  'zone-c': 'Digit3',
  'zone-ch': 'Digit4',
  'zone-i': 'Digit5',
};

export interface ToolDrag {
  start: TilePos;
  current: TilePos;
  /** Shift held: roads go straight, no bend. */
  straight: boolean;
}

export type ToolPlan =
  | { kind: 'road'; tool: RoadToolId; plan: Plan; roadType: BuildableRoad }
  | { kind: 'clear'; tool: 'clear'; plan: Plan }
  | { kind: 'zone'; tool: ZoneToolId; plan: Plan; zone: ZonedType }
  | { kind: 'place'; tool: 'build'; plan: PlacePlan }
  | { kind: 'move'; tool: 'move'; plan: MovePlan }
  | { kind: 'rail'; tool: 'rail'; plan: Plan };

const TINT_VALID = 0x8ff7ec;
const TINT_INVALID = 0xff5a5a;
const TINT_CLEAR = 0xff9a4d;
const TINT_NO_ROAD = 0xffb547;

/** A land road is within reach of this tile (zones only grow there). */
export function nearRoad(world: World, x: number, y: number): boolean {
  return findEntrance(world, x, y, 1, 1, BALANCE.roadAccessRange) !== -1;
}

/** Service colours for the coverage preview. */
const SERVICE_TINT: Readonly<Record<ServiceKind, number>> = {
  police: 0x4f8cff,
  fire: 0xff6a4d,
  health: 0xff8fb0,
  education: 0xffc94d,
  hospital: 0xff5c7a,
  university: 0x9b8cff,
};

/** Coverage tint for a service, water or power building, used by placement and inspection previews. */
export function coveragePreviewTiles(world: World, tex: TerrainTextures, id: BuildingId, origin: TilePos): PreviewTile[] {
  const d: BuildingDef = BUILDINGS[id];
  const water = d.supplies?.water !== undefined;
  const radius = d.service || water ? d.radius : (d.energy?.coverage ?? d.substation?.radius);
  if ((!d.service && !water && !d.energy && !d.substation) || !radius) return [];
  const cx = origin.x + d.size.w / 2;
  const cy = origin.y + d.size.h / 2;
  const r = radius;
  const out: PreviewTile[] = [];
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (!world.inBounds(x, y) || (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r * r) continue;
      const tint = d.service ? SERVICE_TINT[d.service] : water ? 0x3a9bf0 : d.substation ? 0x55b7ff : 0xf2c94c;
      out.push({ x, y, texture: tex.selection, tint, alpha: 0.32 });
    }
  }
  return out;
}

/** How many of a zone plan's tiles no road reaches. */
export function strandedZoneTiles(world: World, p: ToolPlan): number {
  if (p.kind !== 'zone') return 0;
  return p.plan.tiles.filter((t) => t.valid && !nearRoad(world, t.x, t.y)).length;
}

/**
 * What the active tool would do for the current drag (or the hovered tile, before a drag starts).
 * The Build tool places at the drag's current tile, so you can press, slide to adjust, and release.
 */
export function planTool(
  world: World,
  tool: ToolId,
  drag: ToolDrag | null,
  hovered: TilePos | null,
  building: BuildingId,
  /** The Move tool: the building picked up (id), if any. */
  carrying: number | null = null,
  /** Road tools: carry the new road over the roads it crosses instead of joining them (TX2). */
  flyover = false,
): ToolPlan | null {
  if (tool === 'select') return null;
  if (tool === 'move') {
    const plan = carrying !== null && hovered ? planMove(world, carrying, hovered.x, hovered.y) : null;
    return plan ? { kind: 'move', tool, plan } : null;
  }
  const anchor = drag ?? (hovered ? { start: hovered, current: hovered, straight: false } : null);
  if (!anchor) return null;

  if (isRoadTool(tool)) {
    const roadType = ROAD_TOOLS[tool];
    // Two-tile roads are laid in straight runs (docs/specs/transport.md).
    const straight = anchor.straight || ROAD_SPECS[roadType].width === 2;
    const path = roadPath(anchor.start, anchor.current, straight);
    return { kind: 'road', tool, plan: planRoad(world, path, roadType, { flyover }), roadType };
  }
  switch (tool) {
    case 'rail':
      // A roughly diagonal drag lays a 45° staircase that's drawn as one diagonal line (D-089).
      return { kind: 'rail', tool, plan: planRail(world, railDragPath(anchor.start, anchor.current, anchor.straight)) };
    case 'clear':
      return { kind: 'clear', tool, plan: planClear(world, rectTiles(anchor.start, anchor.current)) };
    case 'build':
      return { kind: 'place', tool, plan: planPlace(world, building, anchor.current.x, anchor.current.y) };
    case 'zone-r':
    case 'zone-rh':
    case 'zone-c':
    case 'zone-ch':
    case 'zone-i': {
      const zone = ZONE_TOOLS[tool];
      return { kind: 'zone', tool, plan: planZone(world, rectTiles(anchor.start, anchor.current), zone), zone };
    }
  }
}

/**
 * Ghost sprites for a plan, in world tiles (ToolPreview places them in the view).
 * Road ghosts are auto-tiled as if the plan were already built, then rotated into the view.
 */
export function previewTiles(world: World, tex: TerrainTextures, p: ToolPlan, view: ViewTransform, pave = 0): PreviewTile[] {
  if (p.kind === 'zone') {
    const tint = ZONE_TINT[p.zone];
    return p.plan.tiles.map((t) => {
      // Zone tiles no road reaches won't grow: show them amber so it's clear before you let go.
      const stranded = t.valid && !nearRoad(world, t.x, t.y);
      return {
        x: t.x,
        y: t.y,
        texture: tex.zoneLot,
        tint: !t.valid ? 0xffffff : stranded ? TINT_NO_ROAD : tint,
        alpha: !t.valid ? 0.25 : stranded ? 0.7 : 0.85,
      };
    });
  }

  if (p.kind === 'clear') {
    return p.plan.tiles.map((t) => ({
      x: t.x,
      y: t.y,
      texture: tex.selection,
      tint: t.valid ? TINT_CLEAR : 0xffffff,
      alpha: t.valid ? 0.75 : 0.3,
    }));
  }

  if (p.kind === 'move') {
    const { building, origin, ok, moving } = p.plan;
    const b = world.buildings.get(moving);
    const { w, h } = BUILDINGS[building].size;
    // The lot it's leaving, dimmed, then the new footprint and a ghost of the building itself.
    const leaving: PreviewTile[] = b
      ? rectTiles({ x: b.x, y: b.y }, { x: b.x + w - 1, y: b.y + h - 1 }).map((t) => ({ ...t, texture: tex.selection, tint: 0x4fd1c5, alpha: 0.3 }))
      : [];
    const footprint: PreviewTile[] = p.plan.tiles.map((t) => ({
      x: t.x,
      y: t.y,
      texture: tex.selection,
      tint: t.valid ? TINT_VALID : TINT_INVALID,
      alpha: t.valid ? 0.35 : 0.65,
    }));
    const ghost: PreviewTile = {
      x: origin.x,
      y: origin.y,
      texture: buildingTexture(tex, building, b?.variant ?? 0, view.r),
      footprint: BUILDINGS[building].size,
      offsetY: buildingHeadroom(building, b?.variant ?? 0),
      tint: ok ? 0xffffff : TINT_INVALID,
      alpha: ok ? 0.85 : 0.55,
    };
    return [...leaving, ...footprint, ghost];
  }

  if (p.kind === 'place') {
    const { building, origin, ok } = p.plan;
    const footprint: PreviewTile[] = p.plan.tiles.map((t) => ({
      x: t.x,
      y: t.y,
      texture: tex.selection,
      tint: t.valid ? TINT_VALID : TINT_INVALID,
      alpha: t.valid ? 0.35 : 0.65,
    }));
    const ghost: PreviewTile = {
      x: origin.x,
      y: origin.y,
      texture: tex.buildings[building][0][view.r],
      footprint: BUILDINGS[building].size,
      offsetY: buildingHeadroom(building),
      tint: ok ? 0xffffff : TINT_INVALID,
      alpha: ok ? 0.8 : 0.55,
    };
    return [...coveragePreviewTiles(world, tex, building, origin), ...footprint, ghost];
  }

  if (p.kind === 'rail') {
    // Track ghosts, auto-tiled as if the plan were already laid (masks turned into the view).
    const laid = new Set(p.plan.tiles.filter((t) => t.valid).map((t) => world.index(t.x, t.y)));
    const hasRail = (x: number, y: number) => world.inBounds(x, y) && (laid.has(world.index(x, y)) || isRail(world, world.index(x, y)));
    const maskAt = (x: number, y: number) =>
      (hasRail(x, y - 1) ? 1 : 0) | (hasRail(x + 1, y) ? 2 : 0) | (hasRail(x, y + 1) ? 4 : 0) | (hasRail(x - 1, y) ? 8 : 0);
    const STEPS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
    /** As the built track will bend (sim/rail.ts railCornerShape), with the plan counted in. */
    const curveAt = (x: number, y: number, mask: number): RailCurve | null => {
      if (!isCornerMask(mask)) return null;
      const opposite = ~mask & 0b1111;
      return STEPS.some(([dx, dy], d) => mask & (1 << d) && maskAt(x + dx, y + dy) === opposite) ? 'chord' : 'arc';
    };
    return p.plan.tiles.map((t) => {
      const mask = maskAt(t.x, t.y);
      const i = world.index(t.x, t.y);
      const over = world.road[i] !== RoadType.None;
      const look = t.rail === Rail.Bridge ? 'bridge' : 'track';
      const curve = look === 'track' && !over ? curveAt(t.x, t.y, mask) : null;
      const texture = over ? tex.railOverpass[view.mask(mask)] : curve ? tex.railCurves[curve][view.mask(mask)] : tex.rail[look][view.mask(mask)];
      return { x: t.x, y: t.y, texture, tint: t.valid ? 0xffffff : TINT_INVALID, alpha: t.valid ? 0.85 : 0.45 };
    });
  }

  const planned = new Set(p.plan.tiles.filter((t) => t.valid).map((t) => world.index(t.x, t.y)));
  const hasRoad = (x: number, y: number) =>
    world.inBounds(x, y) && (planned.has(world.index(x, y)) || world.road[world.index(x, y)] !== RoadType.None);
  const roadType = p.roadType;
  return p.plan.tiles.map((t) => {
    let mask =
      (hasRoad(t.x, t.y - 1) ? 1 : 0) | (hasRoad(t.x + 1, t.y) ? 2 : 0) | (hasRoad(t.x, t.y + 1) ? 4 : 0) | (hasRoad(t.x - 1, t.y) ? 8 : 0);
    // One-way rows preview as plain carriageways: end-to-end links only.
    if (t.lane !== undefined) mask &= (1 << t.lane) | (1 << ((t.lane + 2) % 4));
    // The look the renderer will use: the direction turned into the view, or the pavement.
    const viewLane = t.lane === undefined ? 0 : Math.log2(view.mask(1 << t.lane)) + 1;
    const variant = roadVariant(roadType, viewLane, pave);
    // A flyover deck shows as the raised deck, its axis turned into the view.
    const deckAxis = t.overAxis === undefined ? 0 : view.r % 2 === 0 ? t.overAxis : 3 - t.overAxis;
    const texture = !t.valid
      ? tex.selection
      : deckAxis
        ? tex.decks[roadType][deckAxis - 1]
        : t.bridge
          ? bridgeTexture(tex, roadType, view.bridgeAxis(t.bridge), variant)
          : roadTexture(tex, roadType, view.mask(mask), variant);
    return {
      x: t.x,
      y: t.y,
      texture,
      offsetY: t.valid && t.bridge ? BRIDGE_HEADROOM : t.valid && deckAxis ? DECK_LIFT : 0,
      tint: t.valid ? TINT_VALID : TINT_INVALID,
      alpha: t.valid ? 0.85 : 0.6,
    };
  });
}
