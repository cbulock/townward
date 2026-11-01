import type { RotorSource } from '../energy/rotor';
import type { IsoFrame, Orient, Rng } from '../core';

/**
 * The shared kit for buildings with their own painters (parks, civic buildings, utilities):
 * the painter contract, plume sources, and drawing standing items back to front. Each painter
 * lives in its own small module (D-066) and builds on this.
 */

/** Where an animated plume leaves a building (render/fx/Smoke.ts): view tile point plus height in px. */
export interface SmokeSource {
  u: number;
  v: number;
  z: number;
  kind: 'smoke' | 'steam';
}

/** A building drawn by its own painter instead of a recipe (render/atlas/buildingRecipes.ts). */
export interface CivicArt {
  variants: number;
  headroom: (variant: number) => number;
  paint: (iso: IsoFrame, o: Orient, rng: Rng, variant: number) => void;
  /** Plume sources in view space (local layout mapped through `o`). */
  smoke?: (o: Orient, variant: number) => SmokeSource[];
  /** Spinning rotors (wind turbines) in view space; animated in the game, still in thumbnails. */
  rotors?: (o: Orient, variant: number) => RotorSource[];
}

/** Something standing on the lot, drawn in depth order (u + v of its base, view space). */
export interface Item {
  depth: number;
  draw: () => void;
}

export function drawItems(items: Item[]) {
  items.sort((a, b) => a.depth - b.depth);
  for (const it of items) it.draw();
}

/** A local point mapped to view space, plus its depth. */
export function at(o: Orient, u: number, v: number): { u: number; v: number; depth: number } {
  const [vu, vv] = o.point(u, v);
  return { u: vu, v: vv, depth: vu + vv };
}

/** Vertical pole from the ground at a view point. */
export function pole(iso: IsoFrame, u: number, v: number, z0: number, z1: number, w: number, color: string) {
  const [x, y] = iso.p(u, v, z0);
  iso.ctx.fillStyle = color;
  iso.ctx.fillRect(x - w / 2, y - (z1 - z0), w, z1 - z0);
}

/** A plume source at a local point, mapped to view space. */
export function plume(o: Orient, u: number, v: number, z: number, kind: SmokeSource['kind']): SmokeSource {
  const [vu, vv] = o.point(u, v);
  return { u: vu, v: vv, z, kind };
}
