import { Sprite } from 'pixi.js';
import type { FrameMark } from '../atlas/core';
import type { AmbientTextures } from '../atlas/tiles';

/**
 * Lit windows at night (D-071). Each window the art recorded can light up; a stable hash decides
 * which ones and how early, so a city fills with light gradually through the evening and lights
 * flick on and off now and then. Unpowered and abandoned buildings stay dark.
 *
 * Lights are sprites placed right after their building in its chunk's objects, so buildings in
 * front hide them correctly. The night darkening of objects is a per-sprite tint (not the
 * multiply layer) so these lights stay bright.
 */

/** Most windows a single building lights (big towers would otherwise dominate the sprite count). */
const MAX_PER_BUILDING = 24;
/** Share of a building's windows that are candidates at all. */
const CANDIDATES = 0.6;
/** Warm interiors, a few cooler ones (screens, fluorescent offices). */
const COLORS = [0xffd98a, 0xffe6a8, 0xffcf7a, 0xfff0cc, 0xffe0a0, 0xcfe6ff] as const;

export interface WindowLight {
  readonly sprite: Sprite;
  /** World building id (its power and abandonment are checked when lights are applied). */
  readonly building: number;
  /** The light is on when the evening level passes this. */
  readonly threshold: number;
  /** Phase for the occasional on/off flicker. */
  readonly phase: number;
}

/** Stable 0..1 hash of a building and a window index. */
function hash01(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return ((h >>> 0) % 100000) / 100000;
}

/** Light sprites for one building's window marks; `ox, oy` is the building frame's world top-left. */
export function buildingLights(marks: readonly FrameMark[], ox: number, oy: number, building: number, tex: AmbientTextures): WindowLight[] {
  const out: WindowLight[] = [];
  for (let k = 0; k < marks.length && out.length < MAX_PER_BUILDING; k++) {
    const m = marks[k];
    if (m.kind !== 'window') continue;
    const h = hash01(building, k);
    if (h > CANDIDATES) continue;
    const s = new Sprite(tex.glow[m.face]);
    s.anchor.set(0.5);
    s.position.set(ox + m.x, oy + m.y);
    // The glow frame is sheared like the wall; size it to the window (plus the shear drop).
    s.width = Math.max(1.2, m.w * 0.92);
    s.height = Math.max(1.2, m.h * 0.88 + m.w * 0.46);
    s.tint = COLORS[Math.floor(hash01(k, building) * COLORS.length)];
    s.visible = false;
    out.push({ sprite: s, building, threshold: h / CANDIDATES, phase: hash01(building + 7, k) * Math.PI * 2 });
  }
  return out;
}

/**
 * How lit the city is (0 day … 1 full night), from the daylight tint the game sets: the green
 * channel falls from 255 at noon to about 0x7b at night.
 */
export function eveningLevel(daylight: number): number {
  const g = (daylight >> 8) & 255;
  return Math.min(1, Math.max(0, (250 - g) / (250 - 0x86)));
}

/** Share of windows lit at a given evening level. */
export const LIT_SHARE = 0.62;

/** Whether a light is on at this level and time (seconds), with a slow flicker of a few windows. */
export function lightOn(l: WindowLight, level: number, time: number): boolean {
  const flicker = 0.06 * Math.sin(time * 0.07 + l.phase);
  return l.threshold < level * LIT_SHARE + flicker;
}

/** Multiply two 0xRRGGBB colours (a sprite's own tint by the night tint). */
export function mulColor(a: number, b: number): number {
  const ch = (s: number) => Math.round((((a >> s) & 255) * ((b >> s) & 255)) / 255) << s;
  return ch(16) | ch(8) | ch(0);
}
