import { HALF_W } from '../../../../shared/constants';
import { alpha, flatTone, mix, pOn, shade, wallOn, type FaceRef, type IsoFrame, type Rng } from '../../core';
import { GLASS } from '../../theme/tokens';

/**
 * A window set into a wall: glass that reflects the sky at the top and darkens toward the bottom,
 * a shadowed reveal on its upper and left edges (the wall is thick), and a light sill. Some
 * windows show blinds. Each window is recorded as a mark, so it can light up at night.
 */
export interface GlazingStyle {
  /** Glass tint (the deep colour at the bottom of the pane). */
  glass?: string;
  /** Chance of blinds or curtains showing (0 for office glass). */
  blinds?: number;
  /** Draw the sill (punched windows have one, ribbon glazing doesn't). */
  sill?: boolean;
  /** Record the window for night lights. */
  light?: boolean;
}

export function glassFill(iso: IsoFrame, f: FaceRef, a0: number, a1: number, z0: number, z1: number, glass = GLASS.deep): CanvasGradient {
  const deep = flatTone(glass, f.face);
  const sky = f.face === 'sw' ? mix(GLASS.reflect, glass, 0.25) : mix(GLASS.reflect, glass, 0.55);
  return iso.wallGradient(f.face, f.at, a0, a1, z0, z1, sky, deep);
}

/** Record a lit-at-night window mark at the centre of a wall rectangle. */
export function markWindow(iso: IsoFrame, f: FaceRef, a0: number, a1: number, z0: number, z1: number) {
  const [x, y] = pOn(iso, f, (a0 + a1) / 2, 0, (z0 + z1) / 2);
  iso.mark('window', f.face, x, y, (a1 - a0) * HALF_W, z1 - z0);
}

export function glazing(iso: IsoFrame, f: FaceRef, a0: number, a1: number, z0: number, z1: number, rng: Rng | null, style: GlazingStyle = {}) {
  const glass = style.glass ?? GLASS.deep;
  wallOn(iso, f, a0, a1, z0, z1, glassFill(iso, f, a0, a1, z0, z1, glass));
  if (rng && rng() < (style.blinds ?? 0.18)) {
    // Blinds part-drawn: a pale band at the top of the pane.
    const c = GLASS.blinds[Math.floor(rng() * GLASS.blinds.length)];
    const zb = z1 - (z1 - z0) * (0.3 + rng() * 0.35);
    wallOn(iso, f, a0, a1, zb, z1, alpha(flatTone(c, f.face), 0.85));
  }
  // Reveal: the wall's thickness shades the top and the left edge of the opening.
  const w = Math.min(0.012, (a1 - a0) * 0.18);
  wallOn(iso, f, a0, a1, z1 - Math.min(0.9, (z1 - z0) * 0.2), z1, GLASS.reveal);
  wallOn(iso, f, a0, a0 + w, z0, z1, alpha(GLASS.reveal, 0.25));
  // A glint across the upper corner of lit-side glass.
  if (f.face === 'sw' && z1 - z0 > 3) wallOn(iso, f, a0 + (a1 - a0) * 0.55, a0 + (a1 - a0) * 0.7, z1 - (z1 - z0) * 0.6, z1 - 0.9, 'rgba(255, 255, 255, 0.16)');
  if (style.sill ?? true) wallOn(iso, f, a0 - 0.008, a1 + 0.008, z0 - 0.7, z0, f.face === 'sw' ? GLASS.sill : alpha(GLASS.sill, 0.3));
  if (style.light ?? true) markWindow(iso, f, a0, a1, z0, z1);
}

/** Spandrel or frame colour for a wall material on a face. */
export function frameTone(wall: string, f: FaceRef, f0 = 0): string {
  return shade(flatTone(wall, f.face), f0);
}
