/** Typed event bus: the game emits, the UI bridge / renderer listen. Nothing polls. */
export interface GameEventMap {
  stats: DebugStats;
  hover: { x: number; y: number } | null;
  grid: boolean;
}

export interface DebugStats {
  fps: number;
  frameMs: number;
  drawCalls: number;
  visibleChunks: number;
  totalChunks: number;
  visibleSprites: number;
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
