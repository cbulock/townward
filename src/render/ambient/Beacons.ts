import { Container, Sprite, type Texture } from 'pixi.js';
import type { Rect } from '../Camera';
import type { ViewRef } from '../Renderer';
import { collectMarks } from './marks';

const RESCAN = 1;
/** Seconds per blink cycle, and the share of it the lamp is on. */
const PERIOD = 1.6;
const ON = 0.22;
const RED = 0xff4a3d;

interface Beacon {
  sprite: Sprite;
  phase: number;
}

/**
 * Aircraft warning lights on masts and spires (D-071): a red blink, small by day and a soft
 * glow at night. Drawn above the night layer so they shine.
 */
export class Beacons {
  readonly container = new Container();
  private beacons: Beacon[] = [];
  private readonly pool: Sprite[] = [];
  private rescanIn = 0;
  private time = 0;

  constructor(
    private readonly texture: Texture,
    private readonly viewRef: ViewRef,
  ) {}

  invalidate() {
    this.rescanIn = 0;
  }

  update(dt: number, view: Rect, level: number) {
    this.time += dt;
    this.rescanIn -= dt;
    if (this.rescanIn <= 0) {
      this.rescan();
      this.rescanIn = RESCAN;
    }
    const size = 0.45 + level * 0.9;
    for (const b of this.beacons) {
      const s = b.sprite;
      const vis = s.x > view.minX - 10 && s.x < view.maxX + 10 && s.y > view.minY - 10 && s.y < view.maxY + 10;
      s.visible = vis;
      if (!vis) continue;
      const t = ((this.time + b.phase) % PERIOD) / PERIOD;
      const on = t < ON ? Math.sin((t / ON) * Math.PI) : 0;
      s.alpha = on * (0.55 + 0.45 * level);
      s.scale.set(size * (0.8 + on * 0.4));
    }
  }

  private rescan() {
    const marks = collectMarks(this.viewRef, 'beacon');
    for (const b of this.beacons) {
      b.sprite.visible = false;
      this.pool.push(b.sprite);
    }
    this.beacons = marks.map((m, k) => {
      const s = this.pool.pop() ?? this.make();
      s.position.set(m.x, m.y);
      // Masts on one building blink together; buildings don't.
      return { sprite: s, phase: ((m.building * 0.618) % 1) * PERIOD + (k % 2) * 0.05 };
    });
  }

  private make(): Sprite {
    const s = new Sprite(this.texture);
    s.anchor.set(0.5);
    s.tint = RED;
    s.blendMode = 'add';
    this.container.addChild(s);
    return s;
  }
}
