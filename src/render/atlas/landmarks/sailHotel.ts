import { alpha, shade, type IsoFrame, type Orient, type Rng } from '../core';
import { drawItems, type Item } from '../civic/lot';
import { drawFacets, facet, type Facet, type V3 } from '../modern/facets';
import { loft, planShadow, prism, sweep } from '../modern/loft';
import { halo, slab } from '../modern/parts';
import { circle, rect, sail, type Pt } from '../modern/plans';
import { fabric, glass, solid } from '../modern/skins';
import { localFloor } from '../civic/kit';
import { palm, pool } from './plaza';

/**
 * Sail Hotel (3×3 landmark): a tower shaped like a sail filling with wind, on its own island in
 * a turquoise lagoon. The curved front is white fabric over glass; the straight back is a glass
 * wall braced by a white mast with X-trusses; a round helipad cantilevers out near the top.
 */

const BASE_Z = 4;
const SAIL_H = 214;
const MAST_H = SAIL_H + 36;
export const SAIL_HOTEL_TOP = BASE_Z + MAST_H + 14;

/** The sail's back edge stays put while the belly shrinks, so the mast stands straight. */
const BACK_V = 1.05;
const width = (t: number) => 0.92 * (1 - t ** 1.7 * 0.9) + 0.04;
const belly = (t: number) => 1.25 * (1 - t) ** 0.75 + 0.08;

interface Look {
  readonly sail: string;
  readonly glass: string;
  readonly lagoon: string;
  readonly accent: string;
}

const LOOKS: readonly Look[] = [
  { sail: '#f7f8fb', glass: '#4c7ea6', lagoon: '#39b7d6', accent: '#e4a33a' },
  { sail: '#fbf6ee', glass: '#5b7f8f', lagoon: '#2fb5b0', accent: '#d8615a' },
  { sail: '#f4f7fa', glass: '#6a6f9a', lagoon: '#4aa6e0', accent: '#8f6ad8' },
];

export function paintSailHotel(iso: IsoFrame, o: Orient, rng: Rng, variant: number) {
  const look = LOOKS[variant % LOOKS.length];
  const w = o.w;
  const h = o.h;
  const lot = { u0: 0, u1: o.vw, v0: 0, v1: o.vh };
  // Lagoon over the whole lot, an island in the middle, and a causeway to the front edge.
  localFloor(iso, o, { u0: 0.02, u1: w - 0.02, v0: 0.02, v1: h - 0.02 }, 0, '#d9d2c2');
  pool(iso, o, { u0: 0.1, u1: w - 0.1, v0: 0.1, v1: h - 0.1 }, look.lagoon);
  const island = circle(1.0, 28);
  prism(iso, o, [1.5, 1.45], island, 0, BASE_Z, solid('#e9dfc8'), '#efe6d2');
  localFloor(iso, o, { u0: 1.32, u1: 1.68, v0: 2.3, v1: h - 0.05 }, BASE_Z * 0.5, '#e7dfcc');
  for (const s of [-1, 1]) localFloor(iso, o, { u0: 1.5 + s * 0.18 - 0.015, u1: 1.5 + s * 0.18 + 0.015, v0: 2.3, v1: h - 0.05 }, BASE_Z * 0.5 + 0.4, '#ffffff');

  const back: Item[] = [];
  const front: Item[] = [];
  for (const [u, v] of [[0.75, 0.95], [2.25, 0.95], [0.6, 1.75], [2.4, 1.8]] as const) (v < 1.4 ? back : front).push(palm(iso, o, u, v, 14, u < 1.5 ? 1 : -1));
  drawItems(back);

  const centre = (t: number): Pt => [1.5, BACK_V + belly(t) * 0.25];
  planShadow(iso, o, [1.5, 1.4], rect(0.9, 0.6), 220, lot, 1.2);
  // Lobby podium tucked behind the sail.
  prism(iso, o, [1.5, BACK_V - 0.1], rect(0.7, 0.28), BASE_Z, BASE_Z + 16, glass({ tint: look.glass, floorH: 8, mullion: 0.12 }), '#e9edf2');

  // The mast: two white columns at the back corners rising past the sail, braced with X-trusses.
  // They sit behind the sail unless the view looks at its back.
  // The two legs lean in from the back corners and meet above the sail's tip, then a mast runs on.
  const top = BASE_Z + SAIL_H + 8;
  const leg = (s: number) => (t: number): Pt => [1.5 + s * 0.99 * (1 - t), BACK_V - 0.05];
  const paintMast = () => {
    for (const s of [-1, 1]) loft(iso, o, sweep(BASE_Z, top, 12, leg(s), () => rect(0.055, 0.055)), solid('#f4f6f8'));
    prism(iso, o, [1.5, BACK_V - 0.05], rect(0.04, 0.04), top, BASE_Z + MAST_H, solid('#f4f6f8'));
    truss(iso, o, look);
  };
  const backShows = o.faceOf('back') !== null;
  if (!backShows) paintMast();
  const sections = sweep(BASE_Z, BASE_Z + SAIL_H, 30, centre, (t) => sail(width(t), belly(t), 1, 18));
  loft(iso, o, sections, fabric(look.sail), look.sail);
  backWall(iso, o, sections.map((s) => ({ z: s.z, hw: width((s.z - BASE_Z) / SAIL_H) })), look);
  if (backShows) paintMast();

  // Helipad on a cantilever near the top, on the right.
  const padZ = BASE_Z + SAIL_H * 0.78;
  slab(iso, o, [2.05, BACK_V + 0.15], rect(0.28, 0.06), padZ - 3, 2, '#e8ecf0');
  slab(iso, o, [2.3, BACK_V + 0.18], circle(0.26, 20), padZ - 1, 2.2, '#dfe4ea');
  const [pu, pv] = o.point(2.3, BACK_V + 0.18);
  iso.disc(pu, pv, 0.2, padZ + 1.25, '#3d4652');
  const [hx, hy] = iso.p(pu, pv, padZ + 1.3);
  iso.ctx.strokeStyle = look.accent;
  iso.ctx.lineWidth = 0.6;
  iso.ctx.beginPath();
  iso.ctx.ellipse(hx, hy, 5.2, 2.6, 0, 0, Math.PI * 2);
  iso.ctx.stroke();
  iso.ctx.fillStyle = '#ffffff';
  iso.ctx.font = "bold 4px 'IBM Plex Sans', system-ui, sans-serif";
  iso.ctx.textAlign = 'center';
  iso.ctx.textBaseline = 'middle';
  iso.ctx.fillText('H', hx, hy);
  iso.mark('beacon', 'sw', hx + 5, hy);

  // A warm glow at the crown of the mast.
  const [mx, my] = iso.p(...o.point(1.5, BACK_V - 0.05), BASE_Z + MAST_H);
  halo(iso, mx, my, 5, look.accent);
  iso.mark('beacon', 'sw', mx, my);
  drawItems(front);
  void rng;
}

/** Glass wall on the sail's straight back, between the back corners of each section. */
function backWall(iso: IsoFrame, o: Orient, rows: readonly { z: number; hw: number }[], look: Look) {
  const facets: Facet[] = [];
  const pt = (u: number, z: number): V3 => {
    const [a, b] = o.point(u, BACK_V);
    return [a, b, z];
  };
  const [cu, cv] = o.point(1.5, BACK_V + 0.5);
  for (let k = 0; k + 1 < rows.length; k++) {
    const a = rows[k];
    const b = rows[k + 1];
    facets.push(facet([pt(1.5 - a.hw, a.z), pt(1.5 + a.hw, a.z), pt(1.5 + b.hw, b.z), pt(1.5 - b.hw, b.z)], [cu, cv, (a.z + b.z) / 2]));
  }
  drawFacets(iso, facets, glass({ tint: look.glass, floorH: 7, mullion: 0.16 }), rows[0].z, rows[rows.length - 1].z);
}

/** X-bracing between the mast columns, behind or in front of the sail as the view turns. */
function truss(iso: IsoFrame, o: Orient, look: Look) {
  const c = iso.ctx;
  const p = (u: number, z: number) => iso.p(...o.point(u, BACK_V - 0.04), z);
  c.strokeStyle = alpha('#f4f6f8', 0.95);
  c.lineWidth = 0.9;
  // Half the gap between the leaning legs at height z.
  const legTop = BASE_Z + SAIL_H + 8;
  const span = (z: number) => 0.99 * (1 - (z - BASE_Z) / (legTop - BASE_Z));
  const steps = 8;
  for (let k = 0; k < steps; k++) {
    const z0 = BASE_Z + 14 + k * 24;
    const z1 = Math.min(legTop, z0 + 24);
    const hw0 = span(z0);
    const hw1 = span(z1);
    const pts = [p(1.5 - hw0, z0), p(1.5 + hw1, z1), p(1.5 + hw0, z0), p(1.5 - hw1, z1)];
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    c.lineTo(pts[1][0], pts[1][1]);
    c.moveTo(pts[2][0], pts[2][1]);
    c.lineTo(pts[3][0], pts[3][1]);
    c.stroke();
  }
  c.strokeStyle = shade(look.sail, -0.1);
  c.lineWidth = 0.4;
  c.beginPath();
  const [a, b] = [p(1.5, BASE_Z + 14), p(1.5, legTop)];
  c.moveTo(a[0], a[1]);
  c.lineTo(b[0], b[1]);
  c.stroke();
}
