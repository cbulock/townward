import { HALF_H, HALF_W } from '../../shared/constants';
import { GROUND_PAD } from './geometry';
import { IsoFrame, shade } from './core';

/**
 * Construction sites for grown buildings (docs/specs/buildings.md, "Growth").
 * Stage 0 is the foundation (dirt, slab, materials), stage 1 the scaffold (concrete frame
 * wrapped in scaffolding; 2×2 sites also get a tower crane). Footprints are square, so one
 * frame serves every view rotation.
 */

export type SiteSize = 1 | 2;
export type SiteStage = 0 | 1;
export const SITE_SIZES: readonly SiteSize[] = [1, 2];
export const SITE_STAGES: readonly SiteStage[] = [0, 1];

const SLAB = '#cfccc3';
const CONCRETE = '#bdb9af';
const STEEL = '#8a8f96';
const SAFETY = '#f08a24';
const CRANE = '#f2c230';

/** Extra space above the footprint for the frame and crane. */
export function siteHeadroom(size: SiteSize): number {
  return size === 1 ? 44 : 104;
}

export function siteFrameSize(size: SiteSize): { w: number; h: number } {
  return { w: size * 2 * HALF_W + GROUND_PAD * 2, h: size * 2 * HALF_H + GROUND_PAD * 2 + siteHeadroom(size) };
}

function line(iso: IsoFrame, a: [number, number], b: [number, number], color: string, width: number) {
  const c = iso.ctx;
  c.beginPath();
  c.moveTo(a[0], a[1]);
  c.lineTo(b[0], b[1]);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}

export function paintSite(ctx: CanvasRenderingContext2D, size: SiteSize, stage: SiteStage) {
  const iso = new IsoFrame(ctx, GROUND_PAD + size * HALF_W, GROUND_PAD + siteHeadroom(size));
  const n = size;
  const s0 = 0.16;
  const s1 = n - 0.16;

  // Churned-up lot with tyre tracks.
  iso.floor(0.04, n - 0.04, 0.04, n - 0.04, 0, '#a77a4b');
  iso.floor(0.1, n * 0.42, n * 0.6, n - 0.1, 0, '#966b40');
  iso.floor(n * 0.62, n - 0.1, 0.1, n * 0.3, 0, '#b48857');

  // Slab.
  iso.box(s0, s1, s0, s1, 0, 3, shade(SLAB, -0.08), shade(SLAB, -0.22), SLAB);

  if (stage === 0) paintFoundation(iso, n, s0, s1);
  else paintFrame(iso, n, s0, s1);
  paintFence(iso, n);
}

/** Rebar grid poking out of the slab, plus stacked materials and cones. */
function paintFoundation(iso: IsoFrame, n: number, s0: number, s1: number) {
  const step = (s1 - s0) / (n * 3);
  for (let u = s0 + step; u < s1 - step / 2; u += step) {
    for (let v = s0 + step; v < s1 - step / 2; v += step) {
      line(iso, iso.p(u, v, 3), iso.p(u, v, 8), '#5c4a3a', 1);
    }
  }
  // Brick pallets and a pipe stack near the back corner.
  iso.box(0.08, 0.3, n - 0.42, n - 0.16, 0, 5, '#b4533a', '#8f412d', '#c9654a');
  iso.box(0.08, 0.3, n - 0.42, n - 0.16, 5, 9, '#a84c34', '#843b28', '#c05d43');
  for (let k = 0; k < 3; k++) iso.box(n - 0.42 + k * 0.08, n - 0.36 + k * 0.08, 0.06, 0.32, 0, 2.5 + k * 0.4, STEEL, '#6c7178', '#a3a8ae');
  // Cones at the front corner.
  for (const [u, v] of [
    [n - 0.12, n * 0.5],
    [n * 0.5, n - 0.12],
  ] as const) {
    const [x, y] = iso.p(u, v);
    iso.poly(
      [
        [x - 2.5, y],
        [x + 2.5, y],
        [x, y - 7],
      ],
      SAFETY,
    );
    iso.poly(
      [
        [x - 1.6, y - 2.5],
        [x + 1.6, y - 2.5],
        [x + 1, y - 4],
        [x - 1, y - 4],
      ],
      '#ffffff',
    );
  }
}

/** Concrete columns and floor plates, scaffolding on the camera-facing sides, and a crane on big sites. */
function paintFrame(iso: IsoFrame, n: number, s0: number, s1: number) {
  const floors = n === 1 ? 2 : 4;
  const floorH = n === 1 ? 10 : 11;
  const H = floors * floorH;
  const c = 0.09;
  const a0 = s0 + 0.04;
  const a1 = s1 - 0.04;

  if (n === 2) paintCrane(iso, n, H);

  for (let k = 0; k < floors; k++) {
    const z0 = 3 + k * floorH;
    const z1 = z0 + floorH - 2;
    // Back columns first, front-most last.
    for (const [u, v] of [
      [a0, a0],
      [a1 - c, a0],
      [a0, a1 - c],
      [(a0 + a1) / 2, a1 - c],
      [a1 - c, (a0 + a1) / 2],
      [a1 - c, a1 - c],
    ] as const) {
      iso.box(u, u + c, v, v + c, z0, z1, CONCRETE, shade(CONCRETE, -0.22), shade(CONCRETE, 0.05));
    }
    // The top floor is still open.
    if (k < floors - 1) iso.box(a0, a1, a0, a1, z1, z1 + 2, shade(SLAB, -0.08), shade(SLAB, -0.24), SLAB);
  }

  // Scaffolding a little proud of the SW (v = at) and SE (u = at) faces.
  const at = s1 + 0.06;
  const top = H + 6;
  const poles = n * 4;
  for (let k = 0; k <= poles; k++) {
    const a = s0 + ((at - s0) * k) / poles;
    line(iso, iso.p(a, at, 0), iso.p(a, at, top), STEEL, 1);
    line(iso, iso.p(at, a, 0), iso.p(at, a, top), STEEL, 1);
  }
  for (let z = floorH; z <= top; z += floorH) {
    line(iso, iso.p(s0, at, z), iso.p(at, at, z), '#c9a46a', 1.6);
    line(iso, iso.p(at, s0, z), iso.p(at, at, z), '#c9a46a', 1.6);
  }
  // Safety netting over the upper half of the lit face.
  iso.wall('sw', at, s0, at, H * 0.5, top, 'rgba(70, 160, 110, 0.35)');
}

function paintCrane(iso: IsoFrame, n: number, H: number) {
  const mu = 0.32;
  const mv = 0.32;
  const w = 0.14;
  const top = H + 44;
  // Lattice mast.
  iso.box(mu, mu + w, mv, mv + w, 0, top, CRANE, shade(CRANE, -0.2), CRANE);
  for (let z = 4; z < top - 4; z += 6) {
    line(iso, iso.p(mu, mv + w, z), iso.p(mu + w, mv + w, z + 6), '#9a7a12', 0.8);
    line(iso, iso.p(mu + w, mv, z), iso.p(mu + w, mv + w, z + 6), '#7d6310', 0.8);
  }
  // Jib along +u with a counterweight behind the mast, and the operator's cab.
  iso.box(-0.12, n + 0.1, mv + 0.02, mv + w - 0.02, top, top + 3, CRANE, shade(CRANE, -0.2), shade(CRANE, 0.08));
  iso.box(-0.1, 0.12, mv - 0.02, mv + w + 0.02, top - 5, top, '#8d8a84', '#6f6c67', '#a19e98');
  iso.box(mu + w, mu + w + 0.14, mv, mv + w, top - 7, top, '#e9ecef', '#c4c9ce', '#f5f7f8');
  // Cable and a hanging steel beam.
  const tip = n - 0.2;
  const hookZ = H + 16;
  line(iso, iso.p(tip, mv + w / 2, top), iso.p(tip, mv + w / 2, hookZ), '#3b3b3b', 0.8);
  iso.box(tip - 0.22, tip + 0.22, mv + 0.03, mv + w - 0.03, hookZ - 3, hookZ, '#b0533a', '#8c4230', '#c86249');
}

/** Low orange-and-white barrier along the two camera-facing lot edges. */
function paintFence(iso: IsoFrame, n: number) {
  const segs = n * 5;
  const e = n - 0.04;
  for (let k = 0; k < segs; k++) {
    const a0 = 0.04 + ((e - 0.04) * k) / segs;
    const a1 = 0.04 + ((e - 0.04) * (k + 1)) / segs;
    const fill = k % 2 === 0 ? SAFETY : '#f4f1ea';
    iso.wall('sw', e, a0, a1, 0, 4, fill);
    iso.wall('se', e, a0, a1, 0, 4, k % 2 === 0 ? shade('#f08a24', -0.2) : '#d6d2ca');
  }
}
