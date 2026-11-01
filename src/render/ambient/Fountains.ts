import { Container, Sprite, type Texture } from 'pixi.js';
import type { Rect } from '../Camera';
import type { ViewRef } from '../Renderer';
import { collectMarks, type WorldMark } from './marks';

/** Below this zoom spray is too small to see. */
const MIN_ZOOM = 0.6;
const MAX_DROPS = 700;
/** Droplets per second per jet. */
const RATE = 34;
const GRAVITY = 70;
const RESCAN = 1;
const MARGIN = 40;

interface Drop {
  sprite: Sprite;
  vx: number;
  vy: number;
  age: number;
  life: number;
  floor: number;
}

/**
 * Fountain jets in parks and plazas (D-071): droplets leap from the jet recorded in the art,
 * arc down and fade into the basin. Pooled, and only on-screen jets spray.
 */
export class Fountains {
  readonly container = new Container();
  private jets: WorldMark[] = [];
  private budget = new Map<WorldMark, number>();
  private readonly drops: Drop[] = [];
  private readonly free: Sprite[] = [];
  private rescanIn = 0;

  constructor(
    private readonly texture: Texture,
    private readonly viewRef: ViewRef,
  ) {}

  invalidate() {
    this.rescanIn = 0;
  }

  update(dt: number, view: Rect, zoom: number) {
    this.rescanIn -= dt;
    if (this.rescanIn <= 0) {
      this.jets = collectMarks(this.viewRef, 'fountain');
      this.budget = new Map(this.jets.map((j) => [j, this.budget.get(j) ?? Math.random()]));
      this.rescanIn = RESCAN;
    }
    if (zoom >= MIN_ZOOM) {
      for (const j of this.jets) {
        if (j.x < view.minX - MARGIN || j.x > view.maxX + MARGIN || j.y < view.minY - MARGIN || j.y > view.maxY + MARGIN) continue;
        let b = (this.budget.get(j) ?? 0) + RATE * dt;
        while (b >= 1 && this.drops.length < MAX_DROPS) {
          b -= 1;
          this.spawn(j);
        }
        this.budget.set(j, Math.min(b, 1));
      }
    }
    for (let k = this.drops.length - 1; k >= 0; k--) {
      const d = this.drops[k];
      d.age += dt;
      d.vy += GRAVITY * dt;
      const s = d.sprite;
      s.x += d.vx * dt;
      s.y += d.vy * dt;
      if (d.age >= d.life || (d.vy > 0 && s.y > d.floor)) {
        s.visible = false;
        this.free.push(s);
        this.drops.splice(k, 1);
        continue;
      }
      s.alpha = Math.min(1, (1 - d.age / d.life) * 1.4);
    }
  }

  private spawn(j: WorldMark) {
    const s = this.free.pop() ?? new Sprite(this.texture);
    if (!s.parent) this.container.addChild(s);
    s.anchor.set(0.5);
    s.position.set(j.x + (Math.random() - 0.5) * 1.2, j.y - 1);
    s.scale.set(0.35 + Math.random() * 0.3);
    s.visible = true;
    s.alpha = 1;
    const a = Math.random() * Math.PI * 2;
    const spread = 4 + Math.random() * 5;
    this.drops.push({
      sprite: s,
      vx: Math.cos(a) * spread,
      vy: -(22 + Math.random() * 10),
      age: 0,
      life: 1.1,
      floor: j.y + 4 + Math.sin(a) * 2,
    });
  }
}
