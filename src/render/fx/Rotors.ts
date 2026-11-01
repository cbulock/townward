import { Container, Sprite, Texture } from 'pixi.js';
import type { BuildingInstance } from '../../sim/buildings/catalog';
import { rotorSources } from '../atlas/buildingArt';
import { drawRotor, ROTOR_RADIUS, ROTOR_SQUASH } from '../atlas/energy/rotor';
import type { BuildingRotation } from '../atlas/isoPaint';
import type { Rect } from '../Camera';
import { tileToWorld } from '../iso';
import { tileLift } from '../view/lift';
import type { ViewRef } from '../Renderer';

/** Seconds between rebuilding the list of turbines (buildings come and go slowly). */
const RESCAN = 1;
/** Texture resolution: drawn at 2×, shown at ½ so blades stay crisp when zoomed in. */
const RES = 2;
const MARGIN = ROTOR_RADIUS + 8;

interface Rotor {
  /** Squashes the turned blades sideways (we see them at an angle). */
  readonly frame: Container;
  readonly blades: Sprite;
  readonly id: number;
}

/** The blades as a texture, drawn once by the same code as still thumbnails. */
function rotorTexture(): Texture {
  const size = Math.ceil((ROTOR_RADIUS + 3) * 2 * RES);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(RES, 0, 0, RES, size / 2, size / 2);
    drawRotor(ctx);
  }
  return Texture.from(canvas);
}

/**
 * Spinning wind-turbine blades (docs/specs/energy.md). Each turbine's hub comes from its art,
 * so the blades sit on the painted nacelle in every view rotation. Speed follows the day's
 * wind and the game speed (still when paused); off-screen rotors are hidden.
 */
export class Rotors {
  readonly container = new Container();
  private readonly texture = rotorTexture();
  private rotors: Rotor[] = [];
  private readonly pool: Rotor[] = [];
  private rescanIn = 0;
  private readonly viewRef: ViewRef;

  constructor(viewRef: ViewRef) {
    this.viewRef = viewRef;
  }

  /** Rebuild now (after a rotation); otherwise turbines are rescanned every second. */
  invalidate() {
    this.rescanIn = 0;
  }

  private scan() {
    const ground = this.viewRef.ground;
    const r = this.viewRef.current.r as BuildingRotation;
    const old = new Map(this.rotors.map((x) => [x.id, x]));
    const next: Rotor[] = [];
    for (const b of ground.buildings.values()) {
      if (!spins(b)) continue;
      const sources = rotorSources(b.def, b.variant, r);
      if (sources.length === 0) continue;
      const s = sources[0];
      const rotor = old.get(b.id) ?? this.take(b.id);
      old.delete(b.id);
      const p = tileToWorld(b.x + s.u, b.y + s.v);
      rotor.frame.position.set(p.x + s.dx, p.y - tileLift(ground, b.x, b.y) - s.z);
      next.push(rotor);
    }
    for (const gone of old.values()) {
      gone.frame.visible = false;
      this.pool.push(gone);
    }
    this.rotors = next;
  }

  private take(id: number): Rotor {
    const reused = this.pool.pop();
    if (reused) return { ...reused, id };
    const frame = new Container();
    frame.scale.set(ROTOR_SQUASH, 1);
    const blades = new Sprite(this.texture);
    blades.anchor.set(0.5);
    blades.scale.set(1 / RES);
    frame.addChild(blades);
    this.container.addChild(frame);
    // Each turbine starts at its own angle, so a wind farm doesn't turn in lockstep.
    blades.rotation = (id * 2.399) % (Math.PI * 2);
    return { frame, blades, id };
  }

  /** `spin`: radians per real second (0 when paused). */
  update(dt: number, view: Rect, spin: number) {
    this.rescanIn -= dt;
    if (this.rescanIn <= 0) {
      this.scan();
      this.rescanIn = RESCAN;
    }
    for (const r of this.rotors) {
      const { x, y } = r.frame.position;
      const visible = x > view.minX - MARGIN && x < view.maxX + MARGIN && y > view.minY - MARGIN && y < view.maxY + MARGIN;
      r.frame.visible = visible;
      if (visible) r.blades.rotation += spin * dt;
    }
  }
}

/** Finished turbines turn (under construction they show the building site instead). */
function spins(b: BuildingInstance): boolean {
  return b.def === 'wind_turbine' && b.construction === 0;
}
