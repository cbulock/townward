import type { BuildingId } from '../sim/buildings/catalog';
import type { ZoneDemand } from '../sim/growth';
import type { ToolId } from './tools';

/** Typed event bus: the game emits, the UI bridge / renderer listen. Nothing polls. */
export interface GameEventMap {
  stats: DebugStats;
  hover: { x: number; y: number } | null;
  grid: boolean;
  tool: ToolId;
  building: BuildingId;
  funds: number;
  /** Live cost label for an in-progress drag; null when there's nothing to show. */
  toolPreview: ToolPreviewInfo | null;
  notice: Notice;
  muted: boolean;
  /** View rotation in quarter turns (0–3). */
  rotation: number;
  city: CityInfo;
  /** Hour of day on the clock (0–24), a few times a second. */
  clock: number;
  dayNight: boolean;
  /** Version counter, bumped when tiles or buildings change (minimap repaint). */
  worldChanged: number;
  /** Building shown in the info panel, or null when it's closed. */
  inspect: InspectInfo | null;
}

export interface CityInfo {
  population: number;
  housing: number;
  jobs: number;
  workers: number;
  unemployed: number;
  date: { year: number; month: number; dayOfMonth: number };
  /** Index into GAME_SPEEDS (0 = paused). */
  speed: number;
  cars: number;
  people: number;
  /** R/C/I demand, each in [−1, 1]. */
  demand: ZoneDemand;
}

export interface InspectInfo {
  id: number;
  name: string;
  category: string;
  level: number;
  description: string;
  occupants: number;
  capacity: number;
  /** 'Residents' for homes, 'Workers' otherwise. */
  occupantLabel: string;
  hasRoad: boolean;
  size: { w: number; h: number };
  /** Grew on a zone (vs placed with the Build tool). */
  grown: boolean;
  /** Days of construction left; 0 when finished. */
  constructionDays: number;
}

export interface ToolPreviewInfo {
  tool: ToolId;
  /** Name shown instead of the tool verb (e.g. the building being placed). */
  label: string | null;
  /** The action can't happen here (e.g. building footprint blocked). */
  blocked: boolean;
  /** Cursor position in canvas CSS px. */
  screen: { x: number; y: number };
  cost: number;
  /** Tiles that will change. */
  count: number;
  affordable: boolean;
  /** Extra warning under the cost (e.g. zone tiles that no road reaches). */
  note: string | null;
}

export interface Notice {
  id: number;
  kind: 'error' | 'info';
  message: string;
}

export interface DebugStats {
  fps: number;
  frameMs: number;
  drawCalls: number;
  visibleChunks: number;
  totalChunks: number;
  visibleSprites: number;
  agents: number;
  agentsDrawn: number;
  bootAtlasMs: number;
  bootChunksMs: number;
  zoom: number;
  mapSize: number;
  seed: number;
  simTick: number;
}

type Listener<T> = (payload: T) => void;

export class EventBus<M> {
  private listeners: { [K in keyof M]?: Set<Listener<M[K]>> } = {};

  on<K extends keyof M>(type: K, fn: Listener<M[K]>): () => void {
    const set = (this.listeners[type] ??= new Set());
    set.add(fn);
    return () => set.delete(fn);
  }

  emit<K extends keyof M>(type: K, payload: M[K]) {
    this.listeners[type]?.forEach((fn) => fn(payload));
  }

  clear() {
    this.listeners = {};
  }
}

export type GameEvents = EventBus<GameEventMap>;
