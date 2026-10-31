import { Container, Sprite, type Texture } from 'pixi.js';
import { BUILDINGS, type BuildingInstance } from '../../sim/buildings/catalog';
import type { BuildingNeeds, ComplaintKind } from '../../sim/systems/needs';
import type { World } from '../../sim/World';
import { buildingHeadroom } from '../atlas/buildingArt';
import type { Rect } from '../Camera';
import { liftWorld } from '../view/lift';
import type { ViewRef } from '../Renderer';

/** Bubbles on screen at once, how long each lasts (s), and the zoom below which they hide. */
const MAX_BUBBLES = 12;
const LIFETIME = 3.2;
const MIN_ZOOM = 0.5;

interface Bubble {
  sprite: Sprite;
  building: number;
  kind: ComplaintKind;
  age: number;
}

/**
 * Speech bubbles over complaining buildings (docs/specs/needs.md, "Complaints"). A few at a
 * time over buildings in view; each pops in, floats for a few seconds, fades, and is replaced
 * by another complaint, so the screen stays readable.
 */
export class Bubbles {
  readonly container = new Container();
  private readonly bubbles: Bubble[] = [];
  private readonly free: Sprite[] = [];
  private spawnTimer = 0;

  constructor(
    private readonly textures: Readonly<Record<ComplaintKind, Texture>>,
    private readonly viewRef: ViewRef,
  ) {}

  update(dt: number, world: World, needs: ReadonlyMap<number, BuildingNeeds>, view: Rect, zoom: number) {
    const show = zoom >= MIN_ZOOM;
    for (let k = this.bubbles.length - 1; k >= 0; k--) {
      const b = this.bubbles[k];
      b.age += dt;
      const building = world.buildings.get(b.building);
      if (!show || !building || b.age >= LIFETIME || needs.get(b.building)?.complaint !== b.kind) {
        b.sprite.visible = false;
        this.free.push(b.sprite);
        this.bubbles.splice(k, 1);
        continue;
      }
      this.place(b, building);
    }
    if (!show) return;
    // Add a new bubble every so often, over a complaining building in view that has none yet.
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0 || this.bubbles.length >= MAX_BUBBLES) return;
    this.spawnTimer = LIFETIME / MAX_BUBBLES;
    const shown = new Set(this.bubbles.map((b) => b.building));
    const candidates: { b: BuildingInstance; kind: ComplaintKind }[] = [];
    for (const [id, n] of needs) {
      if (!n.complaint || shown.has(id)) continue;
      const b = world.buildings.get(id);
      if (!b) continue;
      const p = this.anchor(b);
      if (p.x < view.minX || p.x > view.maxX || p.y < view.minY || p.y > view.maxY) continue;
      candidates.push({ b, kind: n.complaint });
    }
    if (candidates.length === 0) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const sprite = this.free.pop() ?? new Sprite();
    if (!sprite.parent) this.container.addChild(sprite);
    sprite.texture = this.textures[pick.kind];
    sprite.anchor.set(0.5, 1);
    sprite.visible = true;
    const bubble: Bubble = { sprite, building: pick.b.id, kind: pick.kind, age: 0 };
    this.bubbles.push(bubble);
    this.place(bubble, pick.b);
  }

  /** Point just above the roof, in the current view. */
  private anchor(b: BuildingInstance) {
    const { w, h } = BUILDINGS[b.def].size;
    const c = liftWorld(this.viewRef, b.x + w / 2, b.y + h / 2);
    return { x: c.x, y: c.y - Math.max(20, buildingHeadroom(b.def, b.variant) - 8) };
  }

  /** Pop in, bob gently, fade out at the end. */
  private place(b: Bubble, building: BuildingInstance) {
    const p = this.anchor(building);
    const t = b.age;
    const pop = t < 0.25 ? 0.6 + (t / 0.25) * 0.5 : t < 0.4 ? 1.1 - ((t - 0.25) / 0.15) * 0.1 : 1;
    b.sprite.scale.set(pop);
    b.sprite.alpha = t > LIFETIME - 0.5 ? (LIFETIME - t) / 0.5 : 1;
    b.sprite.position.set(p.x, p.y - Math.sin(t * 3) * 1.5);
  }

  clear() {
    for (const b of this.bubbles) b.sprite.visible = false;
    this.bubbles.length = 0;
  }
}
