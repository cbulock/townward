import { Container, Sprite, type Texture } from 'pixi.js';
import type { Rect } from '../Camera';

/** Flocks on screen at once, and birds per flock. */
const MAX_FLOCKS = 3;
const FLOCK_MIN = 4;
const FLOCK_MAX = 9;
/** How high flocks fly: their shadows fall this far below them (world px). */
const ALTITUDE = 70;
const MIN_ZOOM = 0.45;

interface Bird {
  body: Sprite;
  shadow: Sprite;
  /** Offset from the flock centre. */
  dx: number;
  dy: number;
  phase: number;
  /** Flaps per second. */
  rate: number;
}

interface Flock {
  x: number;
  y: number;
  vx: number;
  vy: number;
  birds: Bird[];
}

/**
 * Birds crossing the city by day (D-072): small V-shaped flocks with flapping wings and faint
 * shadows on the ground far below. They glide in from one edge of the view and out the other,
 * fade away at dusk, and stay home at night.
 */
export class Birds {
  readonly container = new Container();
  private readonly shadows = new Container();
  private readonly bodies = new Container();
  private flocks: Flock[] = [];
  private readonly pool: Bird[] = [];
  private spawnIn = 2;
  private time = 0;

  constructor(private readonly frames: readonly [Texture, Texture]) {
    this.container.addChild(this.shadows, this.bodies);
  }

  update(dt: number, view: Rect, zoom: number, level: number) {
    this.time += dt;
    const day = 1 - level;
    this.container.alpha = Math.min(1, day * 1.4);
    this.spawnIn -= dt;
    if (this.spawnIn <= 0 && day > 0.4 && zoom >= MIN_ZOOM && this.flocks.length < MAX_FLOCKS) {
      this.spawn(view);
      this.spawnIn = 6 + Math.random() * 10;
    }
    const margin = 120;
    this.flocks = this.flocks.filter((f) => {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      const out = f.x < view.minX - margin * 2 || f.x > view.maxX + margin * 2 || f.y < view.minY - margin * 2 || f.y > view.maxY + margin * 2;
      if (out) {
        for (const b of f.birds) {
          b.body.visible = false;
          b.shadow.visible = false;
          this.pool.push(b);
        }
        return false;
      }
      for (const b of f.birds) {
        // Gentle bobbing within the flock, and flapping with the odd glide.
        const bob = Math.sin(this.time * 1.3 + b.phase) * 2;
        const x = f.x + b.dx;
        const y = f.y + b.dy + bob;
        b.body.position.set(x, y);
        const glide = Math.sin(this.time * 0.6 + b.phase) > 0.55;
        b.body.texture = this.frames[glide ? 0 : Math.floor(this.time * b.rate + b.phase) % 2];
        b.shadow.position.set(x + 8, y + ALTITUDE);
      }
      return true;
    });
  }

  private spawn(view: Rect) {
    const h = view.maxY - view.minY;
    // Enter from the left or right edge, heading across with a little drift.
    const fromLeft = Math.random() < 0.5;
    const speed = 34 + Math.random() * 16;
    const vx = (fromLeft ? 1 : -1) * speed;
    const vy = (Math.random() - 0.5) * speed * 0.5;
    const flock: Flock = { x: fromLeft ? view.minX - 60 : view.maxX + 60, y: view.minY + h * (0.15 + Math.random() * 0.6), vx, vy, birds: [] };
    const n = FLOCK_MIN + Math.floor(Math.random() * (FLOCK_MAX - FLOCK_MIN + 1));
    const back = fromLeft ? -1 : 1;
    for (let k = 0; k < n; k++) {
      // A loose V: alternate sides, each pair further back.
      const rank = Math.ceil(k / 2);
      const side = k % 2 ? 1 : -1;
      const b = this.pool.pop() ?? this.make();
      b.dx = back * rank * 9 + (Math.random() - 0.5) * 3;
      b.dy = side * rank * 6 + (Math.random() - 0.5) * 3;
      b.phase = Math.random() * 10;
      b.rate = 5 + Math.random() * 2;
      b.body.scale.set(fromLeft ? 1 : -1, 1);
      b.body.visible = true;
      b.shadow.visible = true;
      flock.birds.push(b);
    }
    this.flocks.push(flock);
  }

  private make(): Bird {
    const body = new Sprite(this.frames[0]);
    body.anchor.set(0.5);
    const shadow = new Sprite(this.frames[1]);
    shadow.anchor.set(0.5);
    shadow.tint = 0x0a1020;
    shadow.alpha = 0.16;
    shadow.scale.set(0.9, 0.6);
    this.bodies.addChild(body);
    this.shadows.addChild(shadow);
    return { body, shadow, dx: 0, dy: 0, phase: 0, rate: 6 };
  }
}
