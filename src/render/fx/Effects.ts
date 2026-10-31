import { Container, Sprite, type Texture } from 'pixi.js';
import { tileToWorld } from '../iso';
import type { ViewRef } from '../Renderer';

export type BurstKind = 'dust' | 'leaves' | 'rocks' | 'splash';

export interface FxTextures {
  puff: Texture;
  chip: Texture;
  leaf: Texture;
}

/** Hard cap so a huge clear can't flood the GPU. */
const MAX_PARTICLES = 1500;
const POP_TIME = 0.32;

interface Particle {
  sprite: Sprite;
  delay: number;
  age: number;
  life: number;
  vx: number;
  vy: number;
  gravity: number;
  spin: number;
  scale0: number;
  scale1: number;
  alpha0: number;
}

interface Pop {
  sprite: Sprite;
  delay: number;
  age: number;
}

const DUST_TINTS = [0xd9c9a3, 0xcbb98f, 0xe6dcc2];
const LEAF_TINTS = [0x2e8c3a, 0x4cb34a, 0x1f6b2e, 0x7b4a22];
const ROCK_TINTS = [0x9ba2aa, 0x6e767f, 0xcdd2d7];
const SPLASH_TINTS = [0xc4eeff, 0xffffff, 0x7cc8f0];

/**
 * Build feedback: a staggered white "pop" over newly placed pieces and small
 * particle bursts (dust, leaves, rock grit, splashes). Sprites are pooled.
 */
export class Effects {
  readonly container = new Container();
  private readonly particles: Particle[] = [];
  private readonly pops: Pop[] = [];
  private readonly free: Sprite[] = [];

  constructor(
    private readonly tex: FxTextures,
    private readonly viewRef: ViewRef,
  ) {}

  /** Centre of a world tile (fractional coords allowed) in world pixels of the current view. */
  private tileCenter(x: number, y: number) {
    const v = this.viewRef.current.pointToView(x + 0.5, y + 0.5);
    const p = tileToWorld(v.x, v.y);
    return { x: p.x, y: p.y };
  }

  private sprite(texture: Texture): Sprite {
    const s = this.free.pop() ?? new Sprite();
    s.texture = texture;
    s.anchor.set(0.5);
    s.rotation = 0;
    s.blendMode = 'normal';
    s.visible = false;
    if (!s.parent) this.container.addChild(s);
    return s;
  }

  private release(s: Sprite) {
    s.visible = false;
    this.free.push(s);
  }

  /** Flash a copy of each new piece, rippling along the build order. */
  pop(tiles: readonly { x: number; y: number; texture: Texture; anchorY?: number }[], stagger: number) {
    tiles.forEach((t, k) => {
      const s = this.sprite(t.texture);
      s.anchor.set(0.5, t.anchorY ?? 0.5);
      const c = this.tileCenter(t.x, t.y);
      s.position.set(c.x, c.y);
      s.blendMode = 'add';
      this.pops.push({ sprite: s, delay: k * stagger, age: 0 });
    });
  }

  burst(x: number, y: number, kind: BurstKind, count: number, delay = 0) {
    const c = this.tileCenter(x, y);
    for (let k = 0; k < count && this.particles.length < MAX_PARTICLES; k++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 10 + Math.random() * 22;
      const base = {
        delay: delay + Math.random() * 0.05,
        age: 0,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed * 0.5,
      };
      let p: Omit<Particle, 'sprite' | 'delay' | 'age' | 'vx' | 'vy'>;
      let texture: Texture;
      let tints: readonly number[];
      if (kind === 'dust') {
        texture = this.tex.puff;
        tints = DUST_TINTS;
        p = { life: 0.5 + Math.random() * 0.35, gravity: -18, spin: 0, scale0: 0.35, scale1: 1.1, alpha0: 0.75 };
      } else if (kind === 'leaves') {
        texture = Math.random() < 0.75 ? this.tex.leaf : this.tex.chip;
        tints = LEAF_TINTS;
        base.vy -= 30 + Math.random() * 20;
        p = { life: 0.7 + Math.random() * 0.4, gravity: 70, spin: (Math.random() - 0.5) * 10, scale0: 1, scale1: 0.8, alpha0: 1 };
      } else if (kind === 'rocks') {
        texture = this.tex.chip;
        tints = ROCK_TINTS;
        base.vy -= 35 + Math.random() * 20;
        p = { life: 0.45 + Math.random() * 0.2, gravity: 160, spin: (Math.random() - 0.5) * 6, scale0: 1, scale1: 0.9, alpha0: 1 };
      } else {
        texture = this.tex.chip;
        tints = SPLASH_TINTS;
        base.vy -= 25 + Math.random() * 15;
        p = { life: 0.4 + Math.random() * 0.2, gravity: 140, spin: 0, scale0: 0.8, scale1: 0.5, alpha0: 0.9 };
      }
      const s = this.sprite(texture);
      s.tint = tints[Math.floor(Math.random() * tints.length)];
      s.position.set(c.x + (Math.random() - 0.5) * 16, c.y + (Math.random() - 0.5) * 8);
      this.particles.push({ sprite: s, ...base, ...p });
    }
  }

  update(dt: number) {
    for (let k = this.pops.length - 1; k >= 0; k--) {
      const p = this.pops[k];
      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }
      p.age += dt;
      const t = Math.min(1, p.age / POP_TIME);
      const s = p.sprite;
      s.visible = true;
      // Quick overshoot then settle, while the glow fades out.
      s.scale.set(1 + 0.16 * Math.sin(t * Math.PI) * (1 - t));
      s.alpha = 0.85 * (1 - t) * (1 - t);
      if (t >= 1) {
        this.release(s);
        this.pops.splice(k, 1);
      }
    }

    for (let k = this.particles.length - 1; k >= 0; k--) {
      const p = this.particles[k];
      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }
      p.age += dt;
      const t = p.age / p.life;
      const s = p.sprite;
      if (t >= 1) {
        this.release(s);
        this.particles.splice(k, 1);
        continue;
      }
      s.visible = true;
      p.vy += p.gravity * dt;
      s.x += p.vx * dt;
      s.y += p.vy * dt;
      s.rotation += p.spin * dt;
      s.scale.set(p.scale0 + (p.scale1 - p.scale0) * t);
      s.alpha = p.alpha0 * (1 - t * t);
    }
  }

  get active(): number {
    return this.particles.length + this.pops.length;
  }
}
