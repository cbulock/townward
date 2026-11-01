import { hexToRgb } from '../theme/palette';

export type Rgb = readonly [number, number, number];

/** Parse '#rrggbb', 'rgb(r, g, b)' or 'rgba(r, g, b, a)' (alpha is dropped). */
export function parseColor(color: string): Rgb {
  if (color.startsWith('#')) return hexToRgb(color);
  const m = color.match(/\d+(\.\d+)?/g);
  return m && m.length >= 3 ? [Number(m[0]), Number(m[1]), Number(m[2])] : [128, 128, 128];
}

const clamp = (c: number) => Math.round(Math.max(0, Math.min(255, c)));
const rgb = (r: number, g: number, b: number) => `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`;

/** Lighten (f > 0, toward white) or darken (f < 0, toward black) a colour. */
export function shade(color: string, f: number): string {
  const [r, g, b] = parseColor(color);
  const k = (c: number) => (f >= 0 ? c + (255 - c) * f : c * (1 + f));
  return rgb(k(r), k(g), k(b));
}

/** Blend `a` toward `b` by t ∈ [0, 1]. */
export function mix(a: string, b: string, t: number): string {
  const p = parseColor(a);
  const q = parseColor(b);
  return rgb(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t);
}

/** The colour with an alpha. */
export function alpha(color: string, a: number): string {
  const [r, g, b] = parseColor(color);
  return `rgba(${clamp(r)}, ${clamp(g)}, ${clamp(b)}, ${a})`;
}

/** Shift hue-free "temperature": t > 0 warms (more red, less blue), t < 0 cools. */
export function warm(color: string, t: number): string {
  const [r, g, b] = parseColor(color);
  return rgb(r + 40 * t, g + 8 * t, b - 40 * t);
}
