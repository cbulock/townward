import { Container, Sprite, type Texture } from 'pixi.js';
import { BUILDINGS } from '../../sim/buildings/catalog';
import type { BuildingInstance } from '../../sim/buildings/catalog';
import { smokeSources, type SmokeSource } from '../atlas/buildingArt';
import type { BuildingRotation } from '../atlas/isoPaint';
import type { Rect } from '../Camera';
import { tileToWorld } from '../iso';
import { tileLift } from '../view/lift';
import type { ViewRef } from '../Renderer';

/** Below this zoom plumes are too small to read, so nothing is emitted. */
const MIN_ZOOM = 0.3;
const MAX_PUFFS = 700;
/** Seconds between rebuilding the list of emitting stacks (buildings come and go slowly). */
const RESCAN = 1;
/** Cull margin (world px): plumes drift up and sideways out of their stack's spot. */
const MARGIN = 120;

interface PlumeStyle {
  /** Puffs per second per source. */
  rate: number;
  life: number;
  rise: number;
  scale0: number;
  scale1: number;
  alpha: number;
  tints: readonly number[];
}

const STYLES: Readonly<Record<SmokeSource['kind'], PlumeStyle>> = {
  smoke: { rate: 3.2, life: 3.6, rise: 13, scale0: 0.35, scale1: 1.7, alpha: 0.6, tints: [0x8f949b, 0x7d838a, 0xa3a7ad, 0x6f747b] },
  steam: { rate: 2.4, life: 4.2, rise: 10, scale0: 0.9, scale1: 3, alpha: 0.75, tints: [0xffffff, 0xf2f6fa, 0xe6edf3] },
};

/** Gentle wind, in world px per second. */
const WIND_X = 7;
const WIND_Y = -1.5;

interface Emitter {
  x: number;
  y: number;
  kind: SmokeSource['kind'];
  /** Fractional puff carried to the next frame. */
  budget: number;
}

interface Puff {
  sprite: Sprite;
  age: number;
  life: number;
  vx: number;
  vy: number;
  scale0: number;
  scale1: number;
  alpha: number;
  spin: number;
}

/**
 * Animated plumes from factory smokestacks and power-plant chimneys, and steam from cooling
 * towers (docs/specs/city-art.md). Sources come from the building art, so puffs leave the
 * painted stack tops in every view rotation. Only on-screen stacks emit, and puffs are pooled.
 */
export class Smoke {
  readonly container = new Container();
  private emitters: Emitter[] = [];
  private readonly puffs: Puff[] = [];
  private readonly free: Sprite[] = [];
  private rescanIn = 0;

  constructor(
    private readonly texture: Texture,
    private readonly viewRef: ViewRef,
  ) {}

  /** Rebuild the emitters now (after edits or a rotation); otherwise they refresh every second. */
  invalidate() {
    this.rescanIn = 0;
  }

  private scan() {
    const ground = this.viewRef.ground;
    const r = this.viewRef.current.r as BuildingRotation;
    const out: Emitter[] = [];
    for (const b of ground.buildings.values()) {
      if (!emits(b)) continue;
      const sources = smokeSources(b.def, b.variant, r);
      if (sources.length === 0) continue;
      const lift = tileLift(ground, b.x, b.y);
      for (const s of sources) {
        const p = tileToWorld(b.x + s.u, b.y + s.v);
        out.push({ x: p.x, y: p.y - lift - s.z, kind: s.kind, budget: Math.random() });
      }
    }
    this.emitters = out;
  }

  private spawn(e: Emitter) {
    const st = STYLES[e.kind];
    const s = this.free.pop() ?? new Sprite(this.texture);
    if (!s.parent) this.container.addChild(s);
    s.anchor.set(0.5);
    s.tint = st.tints[Math.floor(Math.random() * st.tints.length)];
    s.position.set(e.x + (Math.random() - 0.5) * 3, e.y);
    s.scale.set(st.scale0);
    s.alpha = 0;
    s.visible = true;
    this.puffs.push({
      sprite: s,
      age: 0,
      life: st.life * (0.8 + Math.random() * 0.4),
      vx: (Math.random() - 0.5) * 3,
      vy: -st.rise * (0.8 + Math.random() * 0.4),
      scale0: st.scale0,
      scale1: st.scale1 * (0.85 + Math.random() * 0.3),
      alpha: st.alpha,
      spin: (Math.random() - 0.5) * 0.6,
    });
  }

  update(dt: number, view: Rect, zoom: number) {
    this.rescanIn -= dt;
    if (this.rescanIn <= 0) {
      this.scan();
      this.rescanIn = RESCAN;
    }
    if (zoom >= MIN_ZOOM) {
      for (const e of this.emitters) {
        if (e.x < view.minX - MARGIN || e.x > view.maxX + MARGIN || e.y < view.minY - MARGIN || e.y > view.maxY + MARGIN) continue;
        e.budget += STYLES[e.kind].rate * dt;
        while (e.budget >= 1 && this.puffs.length < MAX_PUFFS) {
          e.budget -= 1;
          this.spawn(e);
        }
        e.budget = Math.min(e.budget, 1);
      }
    }
    for (let k = this.puffs.length - 1; k >= 0; k--) {
      const p = this.puffs[k];
      p.age += dt;
      const t = p.age / p.life;
      const s = p.sprite;
      if (t >= 1) {
        s.visible = false;
        this.free.push(s);
        this.puffs.splice(k, 1);
        continue;
      }
      // Rising slows as the plume spreads, and the wind takes over.
      const ease = 1 - t * 0.6;
      s.x += (p.vx + WIND_X * t) * dt;
      s.y += (p.vy * ease + WIND_Y) * dt;
      s.rotation += p.spin * dt;
      s.scale.set(p.scale0 + (p.scale1 - p.scale0) * Math.sqrt(t));
      // Quick fade in, long fade out.
      s.alpha = p.alpha * Math.min(1, t * 8) * (1 - t) ** 1.5;
    }
  }

  get active(): number {
    return this.puffs.length;
  }
}

/** Working buildings only: finished, and (for zoned industry) with someone at work. */
function emits(b: BuildingInstance): boolean {
  if (b.construction > 0) return false;
  return BUILDINGS[b.def].category === 'civic' || b.occupants > 0;
}
