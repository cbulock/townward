import { LIGHT } from '../theme/tokens';
import { alpha, mix, shade } from './color';
import type { Box, Face, IsoFrame } from './iso';

/**
 * The lighting model every painter shares (D-066): a warm sun from the front-left, cool sky
 * light in the shade, ambient occlusion where walls meet the ground, a rim of light on the lit
 * corner and soft shadows falling to the right. Colours come from theme/tokens.ts.
 */

/** A face's colour at height fraction t (0 base, 1 top). */
export function faceTone(base: string, face: Face, t: number): string {
  if (face === 'sw') return shade(mix(base, LIGHT.sun, LIGHT.sunMix), LIGHT.litBase + (LIGHT.litTop - LIGHT.litBase) * t);
  return shade(mix(base, LIGHT.sky, LIGHT.skyMix), LIGHT.shadedBase + (LIGHT.shadedTop - LIGHT.shadedBase) * t);
}

/** The flat mid tone of a face (for small parts where a gradient wouldn't show). */
export function flatTone(base: string, face: Face): string {
  return faceTone(base, face, 0.5);
}

/** Top-face colour: brighter, a touch warm. */
export function topTone(base: string): string {
  return shade(mix(base, LIGHT.sun, LIGHT.sunMix * 0.6), LIGHT.top);
}

/** A wall span filled with its lit or shaded gradient. */
export function litWall(iso: IsoFrame, face: Face, at: number, a0: number, a1: number, z0: number, z1: number, base: string) {
  iso.wall(face, at, a0, a1, z0, z1, iso.wallGradient(face, at, a0, a1, z0, z1, faceTone(base, face, 1), faceTone(base, face, 0)));
}

/** Dark gradient at the foot of a wall, where it meets the ground (or a terrace). */
export function occlusion(iso: IsoFrame, face: Face, at: number, a0: number, a1: number, z: number, height = LIGHT.aoHeight, strength = 1) {
  const g = iso.wallGradient(face, at, a0, a1, z, z + height, alpha(LIGHT.ao, 0), alpha(LIGHT.ao, 0.34 * strength));
  iso.wall(face, at, a0, a1, z, z + height, g);
}

/** Light catching the front vertical corner and the two near top edges of a box. */
export function rimLight(iso: IsoFrame, b: Box, z0: number, z1: number) {
  const c = iso.ctx;
  c.strokeStyle = LIGHT.rim;
  c.lineWidth = 0.6;
  c.lineCap = 'round';
  c.beginPath();
  const corner = iso.p(b.u1, b.v1, z1);
  const foot = iso.p(b.u1, b.v1, z0 + Math.min(4, (z1 - z0) * 0.3));
  c.moveTo(foot[0], foot[1]);
  c.lineTo(corner[0], corner[1]);
  const left = iso.p(b.u0, b.v1, z1);
  const right = iso.p(b.u1, b.v0, z1);
  c.moveTo(left[0], left[1]);
  c.lineTo(corner[0], corner[1]);
  c.lineTo(right[0], right[1]);
  c.stroke();
}

/**
 * Soft shadow a box of height `h` casts on the ground: it falls to the right (+u, −v) and
 * fades with distance. Clipped to `clip` (the lot), so it never darkens a neighbour.
 */
export function castShadow(iso: IsoFrame, b: Box, h: number, clip: Box, strength = 1) {
  const c = iso.ctx;
  // Shadow length in tiles: tall buildings throw longer shadows, capped by the frame.
  const len = Math.min(0.9, 0.12 + h / 90);
  const du = len * 0.75;
  const dv = -len * 0.45;
  c.save();
  c.beginPath();
  const q = [iso.p(clip.u0, clip.v0), iso.p(clip.u1, clip.v0), iso.p(clip.u1, clip.v1), iso.p(clip.u0, clip.v1)];
  c.moveTo(q[0][0], q[0][1]);
  for (let k = 1; k < 4; k++) c.lineTo(q[k][0], q[k][1]);
  c.closePath();
  c.clip();
  // The footprint swept along the light direction: the hull of the base and the moved base.
  const pts = [
    iso.p(b.u1, b.v0),
    iso.p(b.u1 + du, b.v0 + dv),
    iso.p(b.u1 + du, b.v1 + dv),
    iso.p(b.u0 + du, b.v1 + dv),
    iso.p(b.u0, b.v1),
    iso.p(b.u1, b.v1),
  ];
  const [sx, sy] = iso.p(b.u1, (b.v0 + b.v1) / 2);
  const [ex, ey] = iso.p(b.u1 + du, (b.v0 + b.v1) / 2 + dv);
  const g = c.createLinearGradient(sx, sy, ex, ey);
  g.addColorStop(0, alpha(LIGHT.shadow, 0.3 * strength));
  g.addColorStop(1, alpha(LIGHT.shadow, 0));
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0], pts[k][1]);
  c.closePath();
  c.fillStyle = g;
  c.fill();
  c.restore();
  contactShadow(iso, b, strength);
}

/** Tight dark line where a box stands on the ground: anchors it so it doesn't float. */
export function contactShadow(iso: IsoFrame, b: Box, strength = 1) {
  const e = 0.035;
  iso.poly([iso.p(b.u0 - e, b.v1), iso.p(b.u1, b.v1), iso.p(b.u1, b.v0 - e), iso.p(b.u1 + e * 1.6, b.v0), iso.p(b.u1 + e * 1.6, b.v1 + e * 1.6), iso.p(b.u0, b.v1 + e * 1.6)], alpha(LIGHT.shadow, 0.28 * strength));
}

/** Soft round shadow under a standing object (tree, lamp, person) at frame point (x, y). */
export function blobShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, strength = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, alpha(LIGHT.shadow, 0.42 * strength));
  g.addColorStop(0.6, alpha(LIGHT.shadow, 0.22 * strength));
  g.addColorStop(1, alpha(LIGHT.shadow, 0));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.translate(-x, -y);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * A fully lit box from one base colour: graded walls, a lighter top, occlusion at its foot when
 * it stands on the ground, and a rim of light on its near edges.
 */
export function litBox(iso: IsoFrame, b: Box, z0: number, z1: number, base: string, top?: string) {
  litWall(iso, 'sw', b.v1, b.u0, b.u1, z0, z1, base);
  litWall(iso, 'se', b.u1, b.v0, b.v1, z0, z1, base);
  iso.floor(b.u0, b.u1, b.v0, b.v1, z1, top ?? topTone(base));
  if (z1 - z0 > 2.5) {
    const h = Math.min(LIGHT.aoHeight, (z1 - z0) * 0.6);
    occlusion(iso, 'sw', b.v1, b.u0, b.u1, z0, h, z0 === 0 ? 1 : 0.7);
    occlusion(iso, 'se', b.u1, b.v0, b.v1, z0, h, z0 === 0 ? 1 : 0.7);
  }
  rimLight(iso, b, z0, z1);
}
