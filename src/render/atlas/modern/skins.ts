import { HALF_W } from '../../../shared/constants';
import { alpha, mix, shade } from '../core/color';
import { GLASS } from '../theme/tokens';
import { facetGradient, fillShape, onQuad, toneOf, type ScreenFacet, type Skin } from './facets';

/**
 * Surface materials for the modern kit: painted render, sky-reflecting curtain glass with floor
 * lines and mullions, horizontal bands (balconies over ribbon glass) and sail fabric. Each paints
 * a facet in its own light (facets.ts), so curved and slanted surfaces shade correctly.
 */

/** Length of a quad facet's foot in tiles (z ignored). */
function footLength(f: ScreenFacet): number {
  const [a, b] = f.pts;
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function heightOf(f: ScreenFacet): number {
  return Math.max(...f.pts.map((p) => p[2])) - Math.min(...f.pts.map((p) => p[2]));
}

function line(f: ScreenFacet, iso: { ctx: CanvasRenderingContext2D }, a0: number, t0: number, a1: number, t1: number, color: string, width: number) {
  const c = iso.ctx;
  const p = onQuad(f, a0, t0);
  const q = onQuad(f, a1, t1);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(p[0], p[1]);
  c.lineTo(q[0], q[1]);
  c.stroke();
}

/** Plain lit render or cladding. */
export function solid(base: string): Skin {
  return {
    base,
    paint(iso, f) {
      fillShape(iso, f.xy, facetGradient(iso, f, toneOf(base, f.side, f.up, f.t1), toneOf(base, f.side, f.up, f.t0)));
    },
  };
}

export interface GlassStyle {
  /** Deep tint of the glass. */
  readonly tint: string;
  /** Mullion and floor-line colour. */
  readonly frame?: string;
  /** Floor height in px (0: no floor lines). */
  readonly floorH?: number;
  /** Mullion spacing in tiles (0: none). */
  readonly mullion?: number;
  /** Record windows for night lights. */
  readonly lights?: boolean;
}

/**
 * Curtain glass: the sky reflected at the top of the building fading to the deep tint at its
 * foot, brighter on the sunlit side, with a soft diagonal glint, floor lines and mullions.
 */
export function glass(style: GlassStyle): Skin {
  const frame = style.frame ?? '#e8eef4';
  const floorH = style.floorH ?? 7;
  const mullion = style.mullion ?? 0.18;
  return {
    base: style.tint,
    paint(iso, f) {
      if (f.up > 0.6) {
        fillShape(iso, f.xy, toneOf(style.tint, f.side, f.up, 1));
        return;
      }
      const sky = (t: number) => mix(mix(GLASS.reflect, style.tint, 0.2 + 0.5 * f.side), toneOf(style.tint, f.side, 0, t), 0.25 + (1 - t) * 0.55);
      fillShape(iso, f.xy, facetGradient(iso, f, sky(f.t1), sky(f.t0)));
      if (f.xy.length !== 4) return;
      // A broad soft glint on glass that faces the sun.
      if (f.side < 0.55) {
        const k = (0.55 - f.side) * 0.35;
        const g = [onQuad(f, 0.15, 1), onQuad(f, 0.55, 1), onQuad(f, 0.85, 0), onQuad(f, 0.45, 0)];
        fillShape(iso, g, `rgba(255, 255, 255, ${k.toFixed(3)})`, false);
      }
      const h = heightOf(f);
      const len = footLength(f);
      const lineCol = alpha(f.side < 0.5 ? frame : shade(frame, -0.35), 0.55);
      if (floorH > 0 && h > floorH) {
        const zLo = Math.min(...f.pts.map((p) => p[2]));
        for (let z = Math.ceil(zLo / floorH) * floorH; z < zLo + h - 0.5; z += floorH) {
          const t = (z - zLo) / h;
          if (t > 0.01) line(f, iso, 0, t, 1, t, lineCol, 0.45);
        }
      }
      if (mullion > 0 && len > mullion * 1.2) {
        const cols = Math.round(len / mullion);
        for (let k = 1; k < cols; k++) line(f, iso, k / cols, 0, k / cols, 1, alpha(lineCol, 0.35), 0.35);
        // Night lights on walls square to a box face (sheared glows only match those).
        if ((style.lights ?? true) && f.up < 0.1 && (f.side < 0.12 || f.side > 0.88) && floorH > 0) {
          const floors = Math.floor(h / floorH);
          for (let r = 0; r < floors; r++) {
            for (let k = 0; k < cols; k++) {
              const [x, y] = onQuad(f, (k + 0.5) / cols, (r + 0.5) / Math.max(1, h / floorH));
              iso.mark('window', f.face, x, y, (len / cols) * HALF_W * 0.8, floorH * 0.6);
            }
          }
        }
      }
    },
  };
}

export interface BandStyle {
  /** Slab or spandrel colour. */
  readonly wall: string;
  readonly tint: string;
  readonly floorH: number;
  /** Share of each floor that is glass (the rest is slab). */
  readonly glazed: number;
}

/** Horizontal bands: bright slab edges over ribbon glass, floor by floor (balconies, hotels). */
export function bands(style: BandStyle): Skin {
  const g = glass({ tint: style.tint, floorH: 0, mullion: 0.22, lights: false });
  return {
    base: style.wall,
    paint(iso, f) {
      if (f.up > 0.6 || f.xy.length !== 4) {
        fillShape(iso, f.xy, toneOf(style.wall, f.side, f.up, 1));
        return;
      }
      g.paint(iso, f);
      const h = heightOf(f);
      const zLo = Math.min(...f.pts.map((p) => p[2]));
      const slab = style.floorH * (1 - style.glazed);
      for (let z = Math.floor(zLo / style.floorH) * style.floorH; z < zLo + h; z += style.floorH) {
        const t0 = Math.max(0, (z - zLo) / h);
        const t1 = Math.min(1, (z + slab - zLo) / h);
        if (t1 <= t0) continue;
        const tone = toneOf(style.wall, f.side, 0, (z - zLo) / h);
        fillShape(iso, [onQuad(f, 0, t0), onQuad(f, 1, t0), onQuad(f, 1, t1), onQuad(f, 0, t1)], tone, false);
        // A bright lip along each slab edge.
        line(f, iso, 0, t1, 1, t1, alpha('#ffffff', f.side < 0.5 ? 0.45 : 0.2), 0.4);
      }
    },
  };
}

/** Sail fabric: bright white panels with faint seams across and up the surface. */
export function fabric(base: string, seam = 14): Skin {
  return {
    base,
    paint(iso, f) {
      fillShape(iso, f.xy, facetGradient(iso, f, toneOf(base, f.side * 0.8, f.up, f.t1), toneOf(base, f.side * 0.8, f.up, f.t0 * 0.8)));
      if (f.xy.length !== 4) return;
      line(f, iso, 0.5, 0, 0.5, 1, alpha(shade(base, -0.25), 0.2), 0.3);
      // Horizontal seams where the fabric panels meet, every `seam` px.
      const h = heightOf(f);
      const zLo = Math.min(...f.pts.map((p) => p[2]));
      for (let z = Math.ceil(zLo / seam) * seam; z < zLo + h; z += seam) {
        const t = (z - zLo) / h;
        if (t > 0.01) line(f, iso, 0, t, 1, t, alpha(shade(base, -0.3), 0.35), 0.45);
      }
    },
  };
}


/** Corrugated metal cladding: lit panels with fine vertical ribs every `rib` tiles. */
export function metal(base: string, rib = 0.045): Skin {
  return {
    base,
    paint(iso, f) {
      fillShape(iso, f.xy, facetGradient(iso, f, toneOf(base, f.side, f.up, f.t1), toneOf(base, f.side, f.up, f.t0)));
      if (f.xy.length !== 4 || f.up > 0.6) return;
      const cols = Math.round(footLength(f) / rib);
      for (let k = 1; k < cols; k++) line(f, iso, k / cols, 0, k / cols, 1, alpha(shade(base, -0.35), 0.28), 0.3);
    },
  };
}

/** Smooth render with a darker plinth band at its foot, the finish of low modern buildings. */
export function render(base: string, plinth = 2.5): Skin {
  const s = solid(base);
  return {
    base,
    paint(iso, f) {
      s.paint(iso, f);
      if (f.xy.length !== 4 || f.up > 0.6) return;
      const h = heightOf(f);
      const zLo = Math.min(...f.pts.map((p) => p[2]));
      if (zLo > 0.5 || h < plinth * 2) return;
      const t = plinth / h;
      fillShape(iso, [onQuad(f, 0, 0), onQuad(f, 1, 0), onQuad(f, 1, t), onQuad(f, 0, t)], alpha(shade(base, -0.4), 0.35), false);
    },
  };
}
