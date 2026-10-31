import type { PreviewTile } from '../render/overlays/ToolPreview';
import type { TerrainTextures } from '../render/atlas/tiles';
import { planClear, planRoad, type Plan } from '../sim/commands';
import { rectTiles, roadPath, RoadType, type BuildableRoad, type TilePos } from '../sim/roads';
import type { World } from '../sim/World';

export type ToolId = 'select' | 'clear' | 'road' | 'highway';

/** Keyboard shortcuts, also shown in the toolbar. */
export const TOOL_KEYS: Readonly<Record<ToolId, string>> = {
  select: 'KeyQ',
  clear: 'KeyB',
  road: 'KeyR',
  highway: 'KeyH',
};

const ROAD_OF: Readonly<Partial<Record<ToolId, BuildableRoad>>> = {
  road: RoadType.Road,
  highway: RoadType.Highway,
};

export interface ToolDrag {
  start: TilePos;
  current: TilePos;
  /** Shift held: roads go straight, no bend. */
  straight: boolean;
}

export interface ToolPlan {
  tool: Exclude<ToolId, 'select'>;
  plan: Plan;
  roadType: BuildableRoad | null;
}

const TINT_VALID = 0x8ff7ec;
const TINT_INVALID = 0xff5a5a;
const TINT_CLEAR = 0xff9a4d;

/** What the active tool would do for the current drag (or the hovered tile, before a drag starts). */
export function planTool(world: World, tool: ToolId, drag: ToolDrag | null, hovered: TilePos | null): ToolPlan | null {
  if (tool === 'select') return null;
  const anchor = drag ?? (hovered ? { start: hovered, current: hovered, straight: false } : null);
  if (!anchor) return null;

  const roadType = ROAD_OF[tool] ?? null;
  if (roadType !== null) {
    const path = roadPath(anchor.start, anchor.current, anchor.straight);
    return { tool, plan: planRoad(world, path, roadType), roadType };
  }
  return { tool, plan: planClear(world, rectTiles(anchor.start, anchor.current)), roadType: null };
}

/** Ghost sprites for a plan. Road ghosts are auto-tiled as if the plan were already built. */
export function previewTiles(world: World, tex: TerrainTextures, p: ToolPlan): PreviewTile[] {
  if (p.roadType === null) {
    return p.plan.tiles.map((t) => ({
      x: t.x,
      y: t.y,
      texture: tex.selection,
      tint: t.valid ? TINT_CLEAR : 0xffffff,
      alpha: t.valid ? 0.75 : 0.3,
    }));
  }

  const planned = new Set(p.plan.tiles.filter((t) => t.valid).map((t) => world.index(t.x, t.y)));
  const hasRoad = (x: number, y: number) =>
    world.inBounds(x, y) && (planned.has(world.index(x, y)) || world.road[world.index(x, y)] !== RoadType.None);
  const roads = tex.roads[p.roadType];
  return p.plan.tiles.map((t) => {
    const mask =
      (hasRoad(t.x, t.y - 1) ? 1 : 0) | (hasRoad(t.x + 1, t.y) ? 2 : 0) | (hasRoad(t.x, t.y + 1) ? 4 : 0) | (hasRoad(t.x - 1, t.y) ? 8 : 0);
    return {
      x: t.x,
      y: t.y,
      texture: t.valid ? roads[mask] : tex.selection,
      tint: t.valid ? TINT_VALID : TINT_INVALID,
      alpha: t.valid ? 0.85 : 0.6,
    };
  });
}
