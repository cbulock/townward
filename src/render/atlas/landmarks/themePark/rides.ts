import { blobShadow, shade, type IsoFrame, type Orient } from '../../core';
import { at, type Item } from '../../civic/lot';
import { fillShape, facetGradient, mid, toneOf, type Skin } from '../../modern/facets';
import { loft, prism, sweep } from '../../modern/loft';
import { halo } from '../../modern/parts';
import { circle, rect, type Pt } from '../../modern/plans';
import { solid } from '../../modern/skins';

/** Theme-park rides and stands: carousel, drop tower, food kiosks and balloon sellers. */

/** Stripes round a cone or drum: each facet takes a colour by its angle round the centre. */
function striped(colors: readonly string[], o: Orient, centre: Pt, count: number): Skin {
  const [cu, cv] = o.point(centre[0], centre[1]);
  return {
    base: colors[0],
    paint(iso, f) {
      const m = mid(f.pts);
      const a = Math.atan2(m[1] - cv, m[0] - cu);
      const k = Math.floor(((a + Math.PI) / (Math.PI * 2)) * count) % colors.length;
      const col = colors[k];
      fillShape(iso, f.xy, facetGradient(iso, f, toneOf(col, f.side, f.up, f.t1), toneOf(col, f.side, f.up, f.t0)));
    },
  };
}

export function carousel(iso: IsoFrame, o: Orient, p: Pt, colors: readonly string[]): Item {
  return {
    depth: at(o, p[0], p[1]).depth,
    draw: () => {
      const c = iso.ctx;
      const [u, v] = o.point(p[0], p[1]);
      const [gx, gy] = iso.p(u, v);
      blobShadow(c, gx + 3, gy + 1, 16, 6, 0.7);
      prism(iso, o, p, circle(0.4, 24), 0, 2.5, solid('#efe2c8'), '#f6ecd8');
      // Poles and the painted horses between them.
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const [hu, hv] = o.point(p[0] + Math.cos(a) * 0.3, p[1] + Math.sin(a) * 0.3);
        const [x, y] = iso.p(hu, hv, 2.5);
        c.fillStyle = '#e6c15a';
        c.fillRect(x - 0.25, y - 9, 0.5, 9);
        c.fillStyle = colors[k % colors.length];
        c.beginPath();
        c.ellipse(x, y - 3.5 - (k % 2) * 1.5, 1.5, 0.9, 0, 0, Math.PI * 2);
        c.fill();
      }
      prism(iso, o, p, circle(0.12, 12), 2.5, 11, solid('#f4d36b'), null);
      prism(iso, o, p, circle(0.44, 24), 11, 13, striped(['#ffffff', colors[0]], o, p, 24), null);
      loft(iso, o, sweep(13, 22, 4, p, (t) => circle(0.46 * (1 - t) + 0.02, 24)), striped(['#ffffff', colors[0]], o, p, 24), null);
      const [tx, ty] = iso.p(u, v, 22);
      c.fillStyle = '#f4c542';
      c.beginPath();
      c.arc(tx, ty - 1, 1.2, 0, Math.PI * 2);
      c.fill();
      for (let k = 0; k < 24; k += 3) {
        const a = (k / 24) * Math.PI * 2;
        const [lu, lv] = o.point(p[0] + Math.cos(a) * 0.44, p[1] + Math.sin(a) * 0.44);
        const [x, y] = iso.p(lu, lv, 11);
        c.fillStyle = '#fff4c2';
        c.fillRect(x - 0.4, y - 0.4, 0.8, 0.8);
        if (k % 6 === 0) iso.mark('beacon', 'sw', x, y);
      }
    },
  };
}

export const DROP_TOWER_H = 126;

export function dropTower(iso: IsoFrame, o: Orient, p: Pt, accent: string): Item {
  return {
    depth: at(o, p[0], p[1]).depth,
    draw: () => {
      prism(iso, o, p, circle(0.2, 16), 0, 4, solid('#d8dde3'), '#e6eaee');
      prism(iso, o, p, rect(0.065, 0.065), 4, DROP_TOWER_H, solid('#eef2f6'));
      // Seats ring, stopped two-thirds of the way up.
      prism(iso, o, p, circle(0.18, 16), 74, 80, striped([accent, '#ffffff'], o, p, 16), accent);
      prism(iso, o, p, circle(0.11, 12), DROP_TOWER_H, DROP_TOWER_H + 5, solid(accent), accent);
      const [u, v] = o.point(p[0], p[1]);
      const [x, y] = iso.p(u, v, DROP_TOWER_H + 7);
      halo(iso, x, y, 4, '#ff6a5a');
      iso.mark('beacon', 'sw', x, y);
    },
  };
}

/** A food kiosk: a little box under a striped awning roof. */
export function kiosk(iso: IsoFrame, o: Orient, p: Pt, color: string): Item {
  return {
    depth: at(o, p[0], p[1]).depth,
    draw: () => {
      prism(iso, o, p, rect(0.12, 0.1), 0, 6, solid('#f6efe3'), null);
      loft(iso, o, sweep(6, 9, 1, p, (t) => rect(0.16 * (1 - t * 0.6), 0.14 * (1 - t * 0.6))), striped([color, '#ffffff'], o, p, 8), shade(color, 0.1));
    },
  };
}

/** A cluster of balloons on strings. */
export function balloons(iso: IsoFrame, o: Orient, p: Pt, colors: readonly string[]): Item {
  return {
    depth: at(o, p[0], p[1]).depth,
    draw: () => {
      const c = iso.ctx;
      const [u, v] = o.point(p[0], p[1]);
      const [x, y] = iso.p(u, v);
      c.strokeStyle = 'rgba(60,60,60,0.5)';
      c.lineWidth = 0.25;
      colors.forEach((col, k) => {
        const bx = x + (k - colors.length / 2) * 1.6;
        const by = y - 13 - (k % 2) * 2;
        c.beginPath();
        c.moveTo(x, y - 4);
        c.lineTo(bx, by);
        c.stroke();
        c.fillStyle = col;
        c.beginPath();
        c.ellipse(bx, by - 1.2, 1.3, 1.6, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.6)';
        c.fillRect(bx - 0.6, by - 2, 0.5, 0.6);
      });
      c.fillStyle = '#5a4a8a';
      c.fillRect(x - 0.5, y - 4, 1, 4);
    },
  };
}
