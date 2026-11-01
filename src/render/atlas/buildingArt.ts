import { HALF_H, HALF_W } from '../../shared/constants';
import { mulberry32 } from '../../shared/rng';
import { ART_VARIANTS, BUILDINGS, type BuildingId } from '../../sim/buildings/catalog';
import { ART, type BuildingArt, type CustomArtId, type Extra, type Facade, type RecipeId } from './buildingRecipes';
import { CIVIC_ART } from './civicArt';
import type { SmokeSource } from './lot';
import { paintRotorStill, type RotorSource } from './energy/rotor';
import { GROUND_PAD } from './geometry';
import {
  boxOut,
  faceRef,
  floorOut,
  inFront,
  IsoFrame,
  Orient,
  paintParkedCar,
  paintRoundTree,
  pOn,
  shade,
  wallOn,
  type Box,
  type BuildingRotation,
  type FaceRef,
  type Prop,
  type Rng,
  type Side,
} from './isoPaint';

export { BUILDING_ROTATIONS, type BuildingRotation } from './isoPaint';
export type { SmokeSource } from './lot';

/**
 * Procedural building art (docs/specs/buildings.md, docs/specs/city-art.md).
 *
 * Every building is a stack of iso boxes ("masses") in its own frame. Recipes
 * (buildingRecipes.ts) are written in *local* space with the front at +v; the painter
 * rotates them for each of the 4 view rotations, so front details (doors, shopfronts,
 * signs) appear only when the front faces the camera. Parks, the town hall and the
 * utilities have their own painters (civicArt.ts).
 */

/** Most variants any building has; the sim picks a variant below this (catalog ART_VARIANTS). */
export const BUILDING_VARIANTS = ART_VARIANTS;

function isCustom(id: BuildingId): id is CustomArtId {
  return id in CIVIC_ART;
}

/** How many distinct variants a building has; instance variants wrap round with `%`. */
export function buildingVariantCount(id: BuildingId): number {
  return isCustom(id) ? CIVIC_ART[id].variants : ART[id].length;
}

function recipe(id: RecipeId, variant: number): BuildingArt {
  const list = ART[id];
  return list[variant % list.length];
}

const totalHeight = (art: BuildingArt) => art.masses.reduce((s, m) => s + m.floors, 0) * art.floorH;

/** Height above the top of the walls taken by rooftop and tall ground extras (px). */
function extrasAbove(art: BuildingArt, H: number): number {
  const ex = new Set(art.extras);
  let up = art.roofH ?? 0;
  if (ex.has('spire')) up = Math.max(up, 36);
  if (ex.has('antenna')) up = Math.max(up, 22);
  if (ex.has('crown') || ex.has('watertank') || ex.has('hosetower')) up = Math.max(up, 22);
  if (ex.has('smokestack') || ex.has('smokestacks')) up = Math.max(up, 34);
  // Silos stand on the ground, so only the part above the walls needs room.
  if (ex.has('silo')) up = Math.max(up, 46 - H);
  return up;
}

/** Extra space above the footprint for walls, roof and rooftop extras. */
export function buildingHeadroom(id: BuildingId, variant = 0): number {
  if (isCustom(id)) return CIVIC_ART[id].headroom(variant % CIVIC_ART[id].variants);
  const art = recipe(id, variant);
  const H = totalHeight(art);
  return H + extrasAbove(art, H) + 26;
}

export function buildingFrameSize(id: BuildingId, variant = 0): { w: number; h: number } {
  const { w, h } = BUILDINGS[id].size;
  return { w: (w + h) * HALF_W + GROUND_PAD * 2, h: (w + h) * HALF_H + GROUND_PAD * 2 + buildingHeadroom(id, variant) };
}

const smokeCache = new Map<string, readonly SmokeSource[]>();
const rotorCache = new Map<string, readonly RotorSource[]>();

/** Wind-turbine hubs of a building in view space (render/fx/Rotors.ts spins blades there). */
export function rotorSources(id: BuildingId, variant: number, rot: BuildingRotation): readonly RotorSource[] {
  const key = `${id}:${variant}:${rot}`;
  const hit = rotorCache.get(key);
  if (hit) return hit;
  let out: readonly RotorSource[] = [];
  if (isCustom(id)) {
    const c = CIVIC_ART[id];
    const { w, h } = BUILDINGS[id].size;
    out = c.rotors?.(new Orient(rot, w, h), variant % c.variants) ?? [];
  }
  rotorCache.set(key, out);
  return out;
}

/**
 * Smokestack and cooling-tower tops of a building in view space (tile units from the
 * footprint's view origin, z in px), so render/fx/Smoke.ts can emit plumes from the art.
 */
export function smokeSources(id: BuildingId, variant: number, rot: BuildingRotation): readonly SmokeSource[] {
  const key = `${id}:${variant}:${rot}`;
  const hit = smokeCache.get(key);
  if (hit) return hit;
  const { w, h } = BUILDINGS[id].size;
  const o = new Orient(rot, w, h);
  let out: SmokeSource[];
  if (isCustom(id)) {
    const c = CIVIC_ART[id];
    out = c.smoke?.(o, variant % c.variants) ?? [];
  } else {
    const art = recipe(id, variant);
    const ms = resolveMasses(art, o);
    const slim = art.extras.includes('smokestacks');
    out = stackPositions(art, ms[0].local).map(([lu, lv]) => {
      const [u, v] = o.point(lu, lv);
      return { u, v, z: ms[ms.length - 1].z1 + stackHeight(slim), kind: 'smoke' };
    });
  }
  smokeCache.set(key, out);
  return out;
}

const stackHeight = (slim: boolean) => (slim ? 26 : 30);

const GLASS = '#34506b';
const GLASS_LIT = '#ffe39a';
const FRAME = 'rgba(255, 255, 255, 0.35)';
const LIT_CHANCE = 0.16;

// ---------------------------------------------------------------- painter

/** A mass resolved into local and view boxes and its z range. */
interface MassBox {
  local: Box;
  view: Box;
  z0: number;
  z1: number;
  floors: number;
  facade: Facade;
  wall: string;
  top: boolean;
}

function resolveMasses(art: BuildingArt, o: Orient): MassBox[] {
  let z = 0;
  return art.masses.map((m, k) => {
    const inset = m.inset ?? 0.15;
    const local = m.box ?? { u0: inset, u1: o.w - inset, v0: inset, v1: o.h - inset };
    const z0 = z;
    z += m.floors * art.floorH;
    return {
      local,
      view: o.rect(local),
      z0,
      z1: z,
      floors: m.floors,
      facade: m.facade ?? art.facade,
      wall: m.wall ?? art.wall,
      top: k === art.masses.length - 1,
    };
  });
}

export interface PaintOptions {
  /** Also paint parts that move in the game (turbine blades) as a still frame: thumbnails. */
  stillParts?: boolean;
}

export function paintBuilding(ctx: CanvasRenderingContext2D, id: BuildingId, variant: number, rot: BuildingRotation = 0, opts: PaintOptions = {}) {
  const { w, h } = BUILDINGS[id].size;
  const o = new Orient(rot, w, h);
  const iso = new IsoFrame(ctx, GROUND_PAD + o.vh * HALF_W, GROUND_PAD + buildingHeadroom(id, variant));
  const rng = mulberry32(8000 + variant * 101 + id.length * 7 + id.charCodeAt(0));
  if (isCustom(id)) {
    const c = CIVIC_ART[id];
    c.paint(iso, o, rng, variant % c.variants);
    if (opts.stillParts) {
      for (const r of c.rotors?.(o, variant % c.variants) ?? []) {
        const [x, y] = iso.p(r.u, r.v, r.z);
        paintRotorStill(ctx, x + r.dx, y, 0.35 + variant);
      }
    }
    return;
  }

  const art = recipe(id, variant);
  const ms = resolveMasses(art, o);
  const base = ms[0];
  const top = ms[ms.length - 1];
  const b = base.view;
  const lot: Box = { u0: 0, u1: o.vw, v0: 0, v1: o.vh };
  const ex = new Set(art.extras);

  paintLot(iso, o, art, lot, base.local, rng);
  // Soft contact shadow on the ground to the lower right of the body.
  iso.poly(
    [iso.p(b.u1, b.v0 + 0.05), iso.p(b.u1 + 0.18, b.v0 + 0.2), iso.p(b.u1 + 0.18, b.v1 + 0.18), iso.p(b.u0 + 0.15, b.v1 + 0.18), iso.p(b.u0, b.v1)],
    'rgba(20, 50, 20, 0.22)',
  );

  const props = groundProps(iso, o, art, base.local, rng).sort((p, q) => p.u + p.v - (q.u + q.v));
  for (const p of props) if (!inFront(p, b)) p.draw();

  // Annex (garage) beside the body: drawn before or after it depending on which is nearer.
  const annex = ex.has('garage') ? garageAnnex(iso, o, art, base.local) : null;
  if (annex && !inFront(annex, b)) annex.draw();

  // Smokestacks behind the body are drawn first so the walls cover their base.
  const stacks = stackPositions(art, base.local).map((s) => o.point(s[0], s[1]));
  const stackFront = (s: readonly [number, number]) => s[0] + s[1] > (b.u0 + b.u1 + b.v0 + b.v1) / 2;
  for (const s of stacks) if (!stackFront(s)) paintSmokestack(iso, s, top.z1, ex.has('smokestacks'));

  for (const m of ms) paintMass(iso, o, art, m, rng);
  paintExtras(iso, o, art, ms, rng);

  for (const s of stacks) if (stackFront(s)) paintSmokestack(iso, s, top.z1, ex.has('smokestacks'));
  if (annex && inFront(annex, b)) annex.draw();
  for (const p of props) if (inFront(p, b)) p.draw();
  if (ex.has('fence')) paintFence(iso, lot);
}

/** Walls, plinth, facade on both visible faces, and the roof (or a terrace if a mass sits on it). */
function paintMass(iso: IsoFrame, o: Orient, art: BuildingArt, m: MassBox, rng: Rng) {
  const b = m.view;
  iso.wall('sw', b.v1, b.u0, b.u1, m.z0, m.z1, m.wall);
  iso.wall('se', b.u1, b.v0, b.v1, m.z0, m.z1, shade(m.wall, -0.22));
  if (m.z0 === 0) {
    iso.wall('sw', b.v1, b.u0, b.u1, 0, 2, shade(m.wall, -0.35));
    iso.wall('se', b.u1, b.v0, b.v1, 0, 2, shade(m.wall, -0.45));
  }
  for (const face of ['sw', 'se'] as const) paintFacade(iso, art, m, faceRef(face, b), o.sideOf(face), rng);
  if (m.top) paintRoof(iso, art, b, art.ridge === 'v' ? (o.uAxis === 'u' ? 'v' : 'u') : o.uAxis, m.z1, art.roofColor, m.wall);
  else paintTerrace(iso, b, m.z1, art.roofColor, m.wall);
}

/** Flat roof of a lower mass, with a parapet; the next mass stands on it. */
function paintTerrace(iso: IsoFrame, b: Box, z: number, roofColor: string, wall: string) {
  iso.floor(b.u0, b.u1, b.v0, b.v1, z, shade(wall, -0.1));
  iso.floor(b.u0 + 0.03, b.u1 - 0.03, b.v0 + 0.03, b.v1 - 0.03, z, shade(roofColor, 0.12));
  iso.wall('sw', b.v1, b.u0, b.u1, z, z + 1.5, shade(wall, 0.1));
  iso.wall('se', b.u1, b.v0, b.v1, z, z + 1.5, shade(wall, -0.15));
}

// ---------------------------------------------------------------- lot

function paintLot(iso: IsoFrame, o: Orient, art: BuildingArt, lot: Box, local: Box, rng: Rng) {
  const inner = (d: number, fill: string) => iso.floor(lot.u0 + d, lot.u1 - d, lot.v0 + d, lot.v1 - d, 0, fill);
  if (art.ground === 'garden' || art.ground === 'field') {
    inner(0.03, '#5fb53a');
    inner(0.05, '#6cc444');
    // Mown stripes.
    for (let a = lot.u0 + 0.1; a < lot.u1 - 0.05; a += 0.2) iso.floor(a, a + 0.1, lot.v0 + 0.05, lot.v1 - 0.05, 0, 'rgba(255,255,255,0.05)');
    // Path from the front door to the lot edge (local space: the front edge is at v = h).
    const mid0 = local.u0 + (local.u1 - local.u0) * 0.4;
    const mid1 = local.u0 + (local.u1 - local.u0) * 0.6;
    const path = o.rect({ u0: mid0, u1: mid1, v0: local.v1, v1: o.h - 0.02 });
    iso.floor(path.u0, path.u1, path.v0, path.v1, 0, '#d9cfb8');
    // Flowers along the walls.
    const flowers = ['#f2d33c', '#f3f1e8', '#e8576a', '#c77dde'];
    for (let k = 0; k < 10; k++) {
      const [fu, fv] = o.point(local.u0 + rng() * (local.u1 - local.u0), local.v1 + 0.03 + rng() * 0.05);
      const [fx, fy] = iso.p(fu, fv, 0);
      iso.ctx.fillStyle = flowers[k % flowers.length];
      iso.ctx.fillRect(Math.round(fx), Math.round(fy) - 1, 1.5, 1.5);
    }
    if (art.ground === 'field') paintField(iso, o, local);
    return;
  }
  if (art.ground === 'parking') {
    inner(0.03, '#b9b6ae');
    inner(0.06, '#6f737a');
    return;
  }
  inner(0.03, '#b9b6ae');
  inner(0.06, art.ground === 'plaza' ? '#e0dacd' : '#cfccc3');
  // Paving joints.
  const step = art.ground === 'plaza' ? 0.16 : 0.25;
  const line = 'rgba(0, 0, 0, 0.06)';
  for (let a = lot.u0 + step; a < lot.u1 - 0.05; a += step) iso.floor(a, a + 0.008, lot.v0 + 0.06, lot.v1 - 0.06, 0, line);
  for (let a = lot.v0 + step; a < lot.v1 - 0.05; a += step) iso.floor(lot.u0 + 0.06, lot.u1 - 0.06, a, a + 0.008, 0, line);
}

/** School playing field on the free strip in front of the building. */
function paintField(iso: IsoFrame, o: Orient, local: Box) {
  const f = o.rect({ u0: 0.18, u1: o.w - 0.18, v0: local.v1 + 0.12, v1: o.h - 0.1 });
  if (f.u1 - f.u0 < 0.3 || f.v1 - f.v0 < 0.3) return;
  iso.floor(f.u0, f.u1, f.v0, f.v1, 0, '#c0603c');
  iso.floor(f.u0 + 0.05, f.u1 - 0.05, f.v0 + 0.05, f.v1 - 0.05, 0, '#4fae3a');
  const line = 'rgba(255,255,255,0.85)';
  const g = 0.012;
  iso.floor(f.u0 + 0.05, f.u1 - 0.05, f.v0 + 0.05, f.v0 + 0.05 + g, 0, line);
  iso.floor(f.u0 + 0.05, f.u1 - 0.05, f.v1 - 0.05 - g, f.v1 - 0.05, 0, line);
  iso.floor(f.u0 + 0.05, f.u0 + 0.05 + g, f.v0 + 0.05, f.v1 - 0.05, 0, line);
  iso.floor(f.u1 - 0.05 - g, f.u1 - 0.05, f.v0 + 0.05, f.v1 - 0.05, 0, line);
  const mu = (f.u0 + f.u1) / 2;
  const mv = (f.v0 + f.v1) / 2;
  if (f.u1 - f.u0 >= f.v1 - f.v0) iso.floor(mu - g / 2, mu + g / 2, f.v0 + 0.05, f.v1 - 0.05, 0, line);
  else iso.floor(f.u0 + 0.05, f.u1 - 0.05, mv - g / 2, mv + g / 2, 0, line);
  iso.disc(mu, mv, 0.09, 0, line);
  iso.disc(mu, mv, 0.075, 0, '#4fae3a');
}

/** Ground-level props in local space (trees, cars, crates, tables), mapped into the view. */
function groundProps(iso: IsoFrame, o: Orient, art: BuildingArt, local: Box, rng: Rng): Prop[] {
  const props: Prop[] = [];
  const ex = new Set(art.extras);
  const ctx = iso.ctx;
  /** Local front edge of the lot. */
  const lotV1 = o.h;
  const at = (lu: number, lv: number, draw: (u: number, v: number) => void) => {
    const [u, v] = o.point(lu, lv);
    props.push({ u, v, draw: () => draw(u, v) });
  };

  if (art.trees) {
    // Lot corners and edges that the body doesn't cover.
    const m = 0.1;
    const spots: [number, number][] = [
      [o.w - m, o.h - m],
      [m, o.h - m],
      [o.w - m, m],
      [m, m],
      [o.w / 2, o.h - m],
      [o.w - m, o.h / 2],
    ];
    const free = spots.filter(([u, v]) => u < local.u0 - 0.02 || u > local.u1 + 0.02 || v < local.v0 - 0.02 || v > local.v1 + 0.02);
    const size = o.w > 1 ? 0.95 : 0.7;
    free.slice(0, art.trees).forEach(([lu, lv], k) =>
      at(lu, lv, (u, v) => {
        const [x, y] = iso.p(u, v, 0);
        paintRoundTree(ctx, x, y, size, k + Math.floor(rng() * 4));
      }),
    );
  }
  if (ex.has('parking')) {
    const CAR_COLORS = ['#d64545', '#3d7dd8', '#f0c43a', '#ececec', '#3a3f47', '#4bb36b'];
    for (let k = 0; k < 7; k++) {
      const u = local.u0 + 0.12 + k * ((local.u1 - local.u0 - 0.2) / 7);
      const line = o.rect({ u0: u, u1: u + 0.012, v0: local.v1 + 0.12, v1: lotV1 - 0.15 });
      iso.floor(line.u0, line.u1, line.v0, line.v1, 0.1, 'rgba(255,255,255,0.75)');
      if (rng() < 0.65) {
        const c = CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
        const cv = local.v1 + 0.25 + rng() * 0.2;
        const car = o.rect({ u0: u + 0.05, u1: u + 0.18, v0: cv, v1: cv + 0.32 });
        props.push({ u: car.u0, v: car.v0, draw: () => paintParkedCar(iso, car.u0, car.v0, car.u1 - car.u0 > car.v1 - car.v0, c) });
      }
    }
  }
  if (ex.has('patrolcars')) {
    for (let k = 0; k < 2; k++) {
      const lu = local.u0 + 0.06 + k * 0.22;
      const car = o.rect({ u0: lu, u1: lu + 0.15, v0: local.v1 + 0.04, v1: local.v1 + 0.34 });
      if (car.u1 > o.vw || car.v1 > o.vh) continue;
      props.push({
        u: car.u0,
        v: car.v0,
        draw: () => {
          paintParkedCar(iso, car.u0, car.v0, car.u1 - car.u0 > car.v1 - car.v0, '#f4f6f8');
          const [x, y] = iso.p((car.u0 + car.u1) / 2, (car.v0 + car.v1) / 2, 5);
          ctx.fillStyle = '#2456d8';
          ctx.fillRect(x - 2, y - 1.5, 2, 1.5);
          ctx.fillStyle = '#e8343a';
          ctx.fillRect(x, y - 1.5, 2, 1.5);
        },
      });
    }
  }
  if (ex.has('crates')) {
    const colors = ['#a87a45', '#7a8a4a', '#3d6e9e'];
    for (let k = 0; k < 3; k++) {
      const cu = Math.min(local.u1 + 0.02 + (k % 2) * 0.1, o.w - 0.12);
      const cv = local.v1 - 0.35 + k * 0.12;
      const r = o.rect({ u0: cu, u1: cu + 0.09, v0: cv, v1: cv + 0.09 });
      const c = colors[k % colors.length];
      props.push({ u: r.u0, v: r.v0, draw: () => iso.solid(r, 0, 3.5, c) });
    }
  }
  if (ex.has('tables')) {
    const umbrellas = [art.awning ?? '#e9554a', '#f2c84b'];
    for (const [k, tu] of [local.u0 + 0.12, local.u0 + 0.42].entries()) {
      const tv = Math.min(local.v1 + 0.2 + k * 0.04, o.h - 0.06);
      const r = o.rect({ u0: tu, u1: tu + 0.04, v0: tv, v1: tv + 0.04 });
      props.push({
        u: r.u0,
        v: r.v0,
        draw: () => {
          iso.box(r.u0, r.u1, r.v0, r.v1, 0, 5, '#7a7f86', '#5c6168', '#7a7f86');
          const [x, y] = iso.p((r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2, 7);
          ctx.fillStyle = umbrellas[k];
          ctx.beginPath();
          ctx.ellipse(x, y, 6, 2.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          ctx.beginPath();
          ctx.ellipse(x, y + 1, 6, 1.5, 0, 0, Math.PI);
          ctx.fill();
        },
      });
    }
  }
  if (ex.has('planters')) {
    for (const lu of [local.u0 + 0.04, local.u1 - 0.12]) {
      const r = o.rect({ u0: lu, u1: lu + 0.08, v0: local.v1 + 0.03, v1: local.v1 + 0.11 });
      props.push({
        u: r.u0,
        v: r.v0,
        draw: () => {
          iso.solid(r, 0, 2.5, '#8a6a4a');
          const [x, y] = iso.p((r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2, 3);
          ctx.fillStyle = '#3f9a45';
          ctx.beginPath();
          ctx.arc(x, y - 1.5, 2.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#e8576a';
          ctx.fillRect(x - 1.5, y - 3, 1.2, 1.2);
          ctx.fillStyle = '#f2d33c';
          ctx.fillRect(x + 0.6, y - 2.2, 1.2, 1.2);
        },
      });
    }
  }
  if (ex.has('tanks')) {
    const lu = Math.min(local.u1 + 0.02, o.w - 0.32);
    const lv = Math.min(local.v1 + 0.08, o.h - 0.32);
    const cool = ['#dfe3e7', '#cfd5da'];
    [
      [lu + 0.12, lv + 0.12],
      [lu + 0.12 - 0.2, lv + 0.2],
    ].forEach(([tu, tv], k) => {
      if (tu < 0.12) return;
      at(tu, tv, (u, v) => iso.round(u, v, 0, 14, () => 0.1, cool[k], shade(cool[k], 0.1)));
    });
  }
  if (ex.has('silo')) {
    const lu = Math.min(local.u1 + 0.02, o.w - 0.2);
    const lv = Math.max(local.v0 + 0.15, Math.min(local.v1 - 0.15, o.h - 0.2));
    at(lu + 0.08, lv, (u, v) => {
      iso.round(u, v, 0, 40, () => 0.13, '#c9ccd0', null);
      iso.round(u, v, 40, 46, (t) => 0.13 * (1 - t * 0.85), '#b8bcc1', '#d8dbde');
      for (let z = 8; z < 40; z += 8) {
        const [x, y] = iso.p(u, v, z);
        const { rx, ry } = IsoFrame.ellipse(0.13);
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI);
        ctx.stroke();
      }
    });
  }
  return props;
}

/** A single-storey garage on the body's local right side, door facing the street. */
function garageAnnex(iso: IsoFrame, o: Orient, art: BuildingArt, local: Box): Prop {
  const g = o.rect({ u0: local.u1, u1: Math.min(o.w - 0.05, local.u1 + 0.28), v0: local.v1 - 0.38, v1: local.v1 });
  const front = o.faceOf('front');
  return {
    u: g.u0,
    v: g.v0,
    draw: () => {
      const H = 7;
      iso.solid(g, 0, H, shade(art.wall, -0.05));
      iso.floor(g.u0, g.u1, g.v0, g.v1, H, shade(art.roofColor, -0.1));
      if (front) {
        const f = faceRef(front, g);
        const m = (f.a1 - f.a0) * 0.14;
        wallOn(iso, f, f.a0 + m, f.a1 - m, 0, 5.5, '#e9e6df');
        for (let z = 1; z < 5.5; z += 1.2) wallOn(iso, f, f.a0 + m, f.a1 - m, z, z + 0.3, 'rgba(0,0,0,0.12)');
        // Driveway.
        const edge = f.face === 'sw' ? o.vh : o.vw;
        floorOut(iso, f, f.a0 + m, f.a1 - m, 0, edge - f.at - 0.03, 0.05, 'rgba(120,120,120,0.35)');
      }
    },
  };
}

/** Picket fence along the two lot edges nearest the camera. */
function paintFence(iso: IsoFrame, lot: Box) {
  for (let a = lot.u0 + 0.06; a < lot.u1 - 0.04; a += 0.09) iso.wall('sw', lot.v1 - 0.04, a, a + 0.03, 0, 4, '#fbf7ee');
  iso.wall('sw', lot.v1 - 0.04, lot.u0 + 0.06, lot.u1 - 0.06, 2.5, 3.3, '#fbf7ee');
  for (let a = lot.v0 + 0.06; a < lot.v1 - 0.04; a += 0.09) iso.wall('se', lot.u1 - 0.04, a, a + 0.03, 0, 4, '#e3ddcf');
  iso.wall('se', lot.u1 - 0.04, lot.v0 + 0.06, lot.v1 - 0.06, 2.5, 3.3, '#e3ddcf');
}

// ---------------------------------------------------------------- facades

function glazing(iso: IsoFrame, f: FaceRef, a0: number, a1: number, z0: number, z1: number, lit: boolean, glass = GLASS) {
  wallOn(iso, f, a0, a1, z0, z1, lit ? GLASS_LIT : f.face === 'sw' ? glass : shade(glass, -0.25));
  wallOn(iso, f, a0, a1, z1 - 0.8, z1, FRAME);
  wallOn(iso, f, a0 - 0.008, a1 + 0.008, z0 - 0.6, z0, 'rgba(255,255,255,0.4)');
}

const lit = (rng: Rng, k = 1) => rng() < LIT_CHANCE * k;

/** Windows and doors on one camera-facing wall of a mass. Front-only details go on the front side only. */
function paintFacade(iso: IsoFrame, art: BuildingArt, m: MassBox, f: FaceRef, side: Side, rng: Rng) {
  const fh = art.floorH;
  const { a0, a1 } = f;
  const len = a1 - a0;
  const isFront = side === 'front';
  const ground = m.z0 === 0;
  const H = m.z1;
  const glass = art.glass ?? GLASS;
  const dark = f.face === 'se';
  const facade = m.facade;
  const cols = Math.max(2, Math.round(len * (facade === 'brick' ? 4 : 3.4)));
  const step = len / cols;

  if (facade === 'curtain') {
    wallOn(iso, f, a0 + 0.01, a1 - 0.01, m.z0 + (ground ? 2 : 0), H, dark ? shade(m.wall, -0.3) : shade(m.wall, -0.05));
    for (let k = 1; k < m.floors; k++) wallOn(iso, f, a0, a1, m.z0 + k * fh, m.z0 + k * fh + 0.7, 'rgba(255,255,255,0.28)');
    for (let c = 1; c < cols; c++) {
      const a = a0 + c * step;
      if (art.fins) {
        wallOn(iso, f, a - 0.012, a + 0.012, m.z0, H, dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.4)');
        wallOn(iso, f, a + 0.006, a + 0.012, m.z0, H, 'rgba(0,0,0,0.18)');
      } else {
        wallOn(iso, f, a, a + 0.012, m.z0, H, 'rgba(20,40,60,0.35)');
      }
    }
    if (!dark) {
      // Diagonal reflection streak on the lit side.
      const h = H - m.z0;
      iso.poly(
        [
          pOn(iso, f, a0 + len * 0.15, 0, m.z0 + h * 0.9),
          pOn(iso, f, a0 + len * 0.3, 0, m.z0 + h * 0.9),
          pOn(iso, f, a0 + len * 0.55, 0, m.z0 + h * 0.25),
          pOn(iso, f, a0 + len * 0.4, 0, m.z0 + h * 0.25),
        ],
        'rgba(255,255,255,0.14)',
      );
    }
    for (let k = 0; k < m.floors; k++) {
      if (rng() < 0.3) {
        const c = Math.floor(rng() * cols);
        const z = m.z0 + k * fh;
        wallOn(iso, f, a0 + c * step + 0.02, a0 + (c + 1) * step - 0.02, z + 1.5, z + fh - 1, 'rgba(255, 228, 150, 0.55)');
      }
    }
    if (ground && isFront) entrance(iso, f, fh);
    return;
  }

  if (facade === 'grid') {
    wallOn(iso, f, a0, a1, m.z0, H, dark ? shade(glass, -0.35) : glass);
    for (let k = 0; k < m.floors; k++) {
      const z = m.z0 + k * fh;
      for (let c = 0; c < cols; c++) if (lit(rng, 1.2)) wallOn(iso, f, a0 + c * step, a0 + (c + 1) * step, z + 1.4, z + fh, GLASS_LIT);
      wallOn(iso, f, a0, a1, z, z + 1.4, dark ? shade(m.wall, -0.22) : m.wall);
    }
    for (let c = 0; c <= cols; c++) {
      const a = a0 + c * step;
      wallOn(iso, f, Math.max(a0, a - 0.025), Math.min(a1, a + 0.025), m.z0, H, dark ? shade(m.wall, -0.18) : shade(m.wall, 0.06));
    }
    if (ground && isFront) entrance(iso, f, fh);
    return;
  }

  if (facade === 'bands' || facade === 'ribbon') {
    const ribbon = facade === 'ribbon';
    const band = ribbon ? (dark ? '#22343f' : '#2f4a58') : dark ? '#2e475e' : '#3f5f7d';
    for (let k = 0; k < m.floors; k++) {
      const z = m.z0 + k * fh;
      const z0 = z + (ribbon ? 2.6 : 2);
      const z1 = z + fh - (ribbon ? 1.4 : 1.5);
      wallOn(iso, f, a0 + 0.03, a1 - 0.03, z0, z1, band);
      for (let c = 1; c < cols; c++) wallOn(iso, f, a0 + c * step, a0 + c * step + 0.012, z0, z1, ribbon ? 'rgba(255,255,255,0.6)' : 'rgba(230,236,242,0.5)');
      if (lit(rng, 1.8)) {
        const c = Math.floor(rng() * cols);
        wallOn(iso, f, a0 + c * step + 0.02, a0 + (c + 1) * step - 0.02, z0 + 0.5, z1 - 0.5, 'rgba(255, 228, 150, 0.7)');
      }
      if (ribbon) wallOn(iso, f, a0 + 0.02, a1 - 0.02, z1, z1 + 0.6, 'rgba(255,255,255,0.5)');
    }
    if (ground && isFront) entrance(iso, f, fh);
    return;
  }

  if (facade === 'lobby') {
    // Double-height glass with mullions, a trim band on top, and the main door at the front.
    wallOn(iso, f, a0 + 0.02, a1 - 0.02, m.z0 + 1.5, H - 1.5, dark ? '#3d5368' : '#56738c');
    wallOn(iso, f, a0 + 0.02, a1 - 0.02, m.z0 + 1.5, H - 1.5, 'rgba(255, 236, 190, 0.18)');
    for (let c = 1; c < cols * 2; c++) wallOn(iso, f, a0 + (c * step) / 2, a0 + (c * step) / 2 + 0.01, m.z0 + 1.5, H - 1.5, 'rgba(255,255,255,0.45)');
    wallOn(iso, f, a0, a1, H - 1.5, H, art.trim ?? shade(m.wall, -0.15));
    if (isFront) {
      const mid = (a0 + a1) / 2;
      wallOn(iso, f, mid - 0.1, mid + 0.1, m.z0, m.z0 + 8, '#2a3440');
      wallOn(iso, f, mid - 0.002, mid + 0.002, m.z0, m.z0 + 8, 'rgba(255,255,255,0.4)');
    }
    return;
  }

  if (facade === 'industrial') {
    for (let a = a0 + 0.03; a < a1 - 0.01; a += 0.035) wallOn(iso, f, a, a + 0.008, m.z0, H, 'rgba(0,0,0,0.07)');
    for (let c = 0; c < cols; c++) {
      const s0 = a0 + c * step + step * 0.25;
      glazing(iso, f, s0, s0 + step * 0.5, H - 6, H - 2.5, false, '#5d7f99');
    }
    return;
  }

  if (facade === 'townhouse' && isFront) {
    const unitColors = art.units ?? [m.wall];
    const units = 3;
    const uw = len / units;
    const doorColors = ['#c0392b', '#2e6fb5', '#2f8f4e', '#e0a12d'];
    for (let k = 0; k < units; k++) {
      const s0 = a0 + k * uw;
      const unitWall = unitColors[k % unitColors.length];
      wallOn(iso, f, s0, s0 + uw, 2, H, dark ? shade(unitWall, -0.2) : unitWall);
      wallOn(iso, f, s0 + uw - 0.01, s0 + uw, 2, H, 'rgba(0,0,0,0.25)');
      wallOn(iso, f, s0 + uw * 0.15, s0 + uw * 0.45, 2, 9, doorColors[k % doorColors.length]);
      wallOn(iso, f, s0 + uw * 0.12, s0 + uw * 0.48, 9, 10, '#f4f1ea');
      glazing(iso, f, s0 + uw * 0.55, s0 + uw * 0.85, 4, 8, false);
      for (let fl = 1; fl < m.floors; fl++) {
        glazing(iso, f, s0 + uw * 0.18, s0 + uw * 0.45, fl * fh + 2, fl * fh + fh - 2, lit(rng));
        glazing(iso, f, s0 + uw * 0.55, s0 + uw * 0.82, fl * fh + 2, fl * fh + fh - 2, lit(rng));
      }
      wallOn(iso, f, s0, s0 + uw, H - 1.5, H, shade(unitWall, -0.3));
    }
    return;
  }

  if (facade === 'siding') {
    for (let z = m.z0 + 2.5; z < H - 0.5; z += 1.6) wallOn(iso, f, a0, a1, z, z + 0.4, 'rgba(0,0,0,0.07)');
  }
  if (facade === 'brick') {
    for (let k = 0; k < m.floors; k++) wallOn(iso, f, a0, a1, m.z0 + k * fh, m.z0 + k * fh + 0.6, 'rgba(0,0,0,0.12)');
    // Brick texture: faint staggered courses.
    for (let z = m.z0 + 3; z < H - 1; z += 2.2) wallOn(iso, f, a0, a1, z, z + 0.3, 'rgba(255,255,255,0.05)');
  }

  const shop = facade === 'shopfront';
  const lintel = facade === 'brick' ? (art.trim ?? '#e8dcc8') : null;
  const shutters = facade === 'siding';
  for (let k = 0; k < m.floors; k++) {
    const z0 = m.z0 + k * fh;
    if (shop && k === 0 && ground) {
      if (isFront) {
        // Big shop window, a kick plate, and the door.
        wallOn(iso, f, a0 + 0.04, a1 - 0.04, 1, 2.2, shade(m.wall, -0.4));
        glazing(iso, f, a0 + 0.06, a1 - len * 0.32, 2.2, fh - 2.5, false, '#4a6f8a');
        wallOn(iso, f, a0 + 0.08, a1 - len * 0.34, 3, 5, 'rgba(255, 240, 200, 0.35)');
        wallOn(iso, f, a1 - len * 0.26, a1 - len * 0.1, 1.5, fh - 2.5, '#5b3a26');
        wallOn(iso, f, a1 - len * 0.24, a1 - len * 0.12, 3, fh - 4, 'rgba(160, 200, 230, 0.6)');
      } else {
        glazing(iso, f, a0 + 0.08, a1 - 0.08, 2.2, fh - 2.5, false, '#4a6f8a');
      }
      continue;
    }
    const door = isFront && k === 0 && ground;
    if (door && m.floors <= 4) {
      const mid = a0 + len * 0.5;
      wallOn(iso, f, mid - 0.08, mid + 0.08, 1.5, Math.min(fh, 10), '#efe9dc');
      wallOn(iso, f, mid - 0.065, mid + 0.065, 1.5, Math.min(fh - 1, 9), '#6b4428');
      for (let c = 0; c < cols; c++) {
        const s0 = a0 + c * step + step * 0.22;
        if (Math.abs(s0 + step * 0.28 - mid) < step * 0.6) continue;
        glazing(iso, f, s0, s0 + step * 0.56, z0 + 3, z0 + fh - 2.5, lit(rng), glass);
      }
      continue;
    }
    if (door) {
      entrance(iso, f, fh);
      continue;
    }
    for (let c = 0; c < cols; c++) {
      const s0 = a0 + c * step + step * 0.22;
      const s1 = s0 + step * 0.56;
      glazing(iso, f, s0, s1, z0 + 2.5, z0 + fh - 2, lit(rng), glass);
      if (lintel) wallOn(iso, f, s0 - 0.01, s1 + 0.01, z0 + fh - 2, z0 + fh - 1.2, lintel);
      if (shutters) {
        wallOn(iso, f, s0 - 0.04, s0 - 0.005, z0 + 2.5, z0 + fh - 2, '#3f6b4f');
        wallOn(iso, f, s1 + 0.005, s1 + 0.04, z0 + 2.5, z0 + fh - 2, '#3f6b4f');
      }
    }
  }
  // Cornice.
  if (m.top && art.roof === 'flat') wallOn(iso, f, a0, a1, H - 1.4, H, art.trim ?? shade(m.wall, -0.12));
}

/** Ground-floor entrance of a tall building: a glazed lobby with a dark door in the middle. */
function entrance(iso: IsoFrame, f: FaceRef, fh: number) {
  const mid = (f.a0 + f.a1) / 2;
  const half = Math.min(0.22, (f.a1 - f.a0) * 0.2);
  wallOn(iso, f, mid - half, mid + half, 0, fh - 1, '#4c6378');
  wallOn(iso, f, mid - half, mid + half, 0, fh - 1, 'rgba(255, 236, 190, 0.22)');
  wallOn(iso, f, mid - 0.06, mid + 0.06, 0, 7, '#26303a');
  wallOn(iso, f, mid - half, mid + half, fh - 1, fh, 'rgba(255,255,255,0.6)');
}

// ---------------------------------------------------------------- roofs

/**
 * Roofs drawn in view space. Pitched and sawtooth roofs run along `axis`; each case draws its
 * far planes first.
 */
function paintRoof(iso: IsoFrame, art: BuildingArt, b: Box, axis: 'u' | 'v', H: number, roofColor: string, wall: string) {
  const rh = art.roofH ?? 0;
  const o = 0.06; // eave overhang
  if (art.roof === 'flat') {
    iso.floor(b.u0, b.u1, b.v0, b.v1, H, shade(wall, -0.1));
    iso.floor(b.u0 + 0.04, b.u1 - 0.04, b.v0 + 0.04, b.v1 - 0.04, H, roofColor);
    // Membrane seams.
    for (let a = b.u0 + 0.2; a < b.u1 - 0.1; a += 0.2) iso.floor(a, a + 0.006, b.v0 + 0.05, b.v1 - 0.05, H, 'rgba(255,255,255,0.05)');
    iso.wall('sw', b.v1, b.u0, b.u1, H, H + 1.5, shade(wall, 0.1));
    iso.wall('se', b.u1, b.v0, b.v1, H, H + 1.5, shade(wall, -0.15));
    return;
  }
  // Along/across accessors so one routine handles both orientations.
  const [A0, A1, C0, C1] = axis === 'u' ? [b.u0, b.u1, b.v0, b.v1] : [b.v0, b.v1, b.u0, b.u1];
  const P = (a: number, c: number, z: number) => (axis === 'u' ? iso.p(a, c, z) : iso.p(c, a, z));
  // The far slope faces away; the near slope faces SW (lit) for a u ridge, SE (shaded) for a v ridge.
  const nearSlope = axis === 'u' ? roofColor : shade(roofColor, -0.12);
  const farSlope = shade(roofColor, -0.25);
  const endWall = axis === 'u' ? shade(wall, -0.22) : wall;
  const cm = (C0 + C1) / 2;

  if (art.roof === 'gable') {
    iso.poly([P(A0 - o, C0 - o, H), P(A1 + o, C0 - o, H), P(A1 + o, cm, H + rh), P(A0 - o, cm, H + rh)], farSlope);
    iso.poly([P(A1, C0, H), P(A1, C1, H), P(A1, cm, H + rh)], endWall);
    // Gable-end window.
    const [wx, wy] = P(A1, cm, H + rh * 0.35);
    iso.ctx.fillStyle = shade(GLASS, axis === 'u' ? -0.25 : 0);
    iso.ctx.fillRect(wx - 1.2, wy - 1.5, 2.4, 2.4);
    iso.poly([P(A0 - o, C1 + o, H - 1), P(A1 + o, C1 + o, H - 1), P(A1 + o, cm, H + rh), P(A0 - o, cm, H + rh)], nearSlope);
    for (let t = 0.2; t < 1; t += 0.2) {
      const cc = C1 + o - (C1 + o - cm) * t;
      const z = H - 1 + (rh + 1) * t;
      iso.poly([P(A0 - o, cc, z), P(A1 + o, cc, z), P(A1 + o, cc, z + 0.7), P(A0 - o, cc, z + 0.7)], shade(roofColor, axis === 'u' ? -0.15 : -0.27));
    }
    iso.poly([P(A0 - o, cm, H + rh), P(A1 + o, cm, H + rh), P(A1 + o, cm, H + rh + 1), P(A0 - o, cm, H + rh + 1)], shade(roofColor, 0.25));
    return;
  }
  if (art.roof === 'hip') {
    const d = (C1 - C0) / 2;
    // Square plans meet in a point (a pyramid roof).
    const r0 = Math.min(A0 + d, (A0 + A1) / 2);
    const r1 = Math.max(A1 - d, (A0 + A1) / 2);
    iso.poly([P(A0 - o, C0 - o, H), P(A1 + o, C0 - o, H), P(r1, cm, H + rh), P(r0, cm, H + rh)], farSlope);
    iso.poly([P(A1 + o, C0 - o, H), P(A1 + o, C1 + o, H), P(r1, cm, H + rh)], axis === 'u' ? shade(roofColor, -0.18) : roofColor);
    iso.poly([P(A0 - o, C1 + o, H), P(A1 + o, C1 + o, H), P(r1, cm, H + rh), P(r0, cm, H + rh)], nearSlope);
    if (r1 - r0 > 0.01) {
      iso.poly([P(r0, cm, H + rh), P(r1, cm, H + rh), P(r1, cm, H + rh + 1), P(r0, cm, H + rh + 1)], shade(roofColor, 0.25));
    }
    return;
  }
  // Sawtooth: teeth along the axis, glazed faces toward the camera.
  const teeth = Math.max(2, Math.round((A1 - A0) * 3));
  const tw = (A1 - A0) / teeth;
  iso.floor(b.u0, b.u1, b.v0, b.v1, H, shade(roofColor, -0.2));
  for (let k = 0; k < teeth; k++) {
    const a = A0 + k * tw;
    const c = a + tw;
    iso.poly([P(a, C0, H), P(c, C0, H + rh), P(c, C1, H + rh), P(a, C1, H)], roofColor);
    iso.poly([P(c, C0, H), P(c, C0, H + rh), P(c, C1, H + rh), P(c, C1, H)], k === teeth - 1 ? endWall : '#7fa4c2');
    iso.poly([P(a, C1, H), P(c, C1, H), P(c, C1, H + rh)], axis === 'u' ? shade(wall, 0.02) : shade(wall, -0.2));
  }
}

// ---------------------------------------------------------------- extras

/** Local positions of smokestacks (they stand on the ground behind or through the roof). */
function stackPositions(art: BuildingArt, local: Box): [number, number][] {
  const ex = new Set<Extra>(art.extras);
  if (ex.has('smokestacks')) {
    return [
      [local.u1 - 0.3, local.v0 + 0.22],
      [local.u1 - 0.62, local.v0 + 0.22],
    ];
  }
  if (ex.has('smokestack')) return [[local.u1 - 0.35, local.v0 + 0.25]];
  return [];
}

function paintSmokestack(iso: IsoFrame, at: readonly [number, number], H: number, slim: boolean) {
  const top = H + stackHeight(slim);
  const r = slim ? 0.07 : 0.09;
  iso.round(at[0], at[1], 0, top, (t) => r * (1 - t * 0.2), '#a8543f', null);
  for (const z of [top - 6, top - 13]) {
    const [x, y] = iso.p(at[0], at[1], z);
    const { rx } = IsoFrame.ellipse(r * 0.85);
    iso.ctx.fillStyle = 'rgba(245, 245, 245, 0.92)';
    iso.ctx.fillRect(x - rx, y - 2.5, rx * 2, 2.5);
  }
}

/** Where rooftop items go: local positions inside the top mass, mapped to view. */
function roofSpot(o: Orient, top: MassBox, fu: number, fv: number): [number, number] {
  const l = top.local;
  return o.point(l.u0 + (l.u1 - l.u0) * fu, l.v0 + (l.v1 - l.v0) * fv);
}

function paintExtras(iso: IsoFrame, o: Orient, art: BuildingArt, ms: readonly MassBox[], rng: Rng) {
  const fh = art.floorH;
  const ex = new Set(art.extras);
  const ctx = iso.ctx;
  const base = ms[0];
  const top = ms[ms.length - 1];
  const b = base.view;
  const tb = top.view;
  const H = top.z1;
  const front = o.faceOf('front');
  const lf = front ? faceRef(front, b) : null;
  const flat = art.roof === 'flat';

  if (ex.has('chimney')) {
    const [cu, cv] = roofSpot(o, top, 0.75, 0.3);
    iso.box(cu - 0.05, cu + 0.05, cv - 0.05, cv + 0.05, H - 2, H + (art.roofH ?? 0) + 4, '#9b4b3c', '#7a3a2f', '#5a2c24');
  }
  if (ex.has('porch') && lf) {
    const mid = (lf.a0 + lf.a1) / 2;
    floorOut(iso, lf, mid - 0.2, mid + 0.2, 0, 0.14, 1.5, '#cdbfa6');
    boxOut(iso, lf, mid - 0.2, mid + 0.2, 0, 0.14, 8.5, 9.5, '#efe6d6', '#cfc4b0', shade(art.roofColor, 0.05));
    for (const a of [mid - 0.19, mid + 0.17]) wallOn(iso, lf, a, a + 0.02, 1.5, 8.5, '#f6f1e6', 0.13);
  }
  if (ex.has('firedoors') && lf) {
    const edge = lf.face === 'sw' ? o.vh : o.vw;
    floorOut(iso, lf, lf.a0, lf.a1, 0, edge - lf.at - 0.04, 0.1, 'rgba(210, 205, 195, 0.9)');
    const doors = 2;
    const span = (lf.a1 - lf.a0) / doors;
    for (let k = 0; k < doors; k++) {
      const a = lf.a0 + k * span + span * 0.12;
      const a2 = a + span * 0.76;
      wallOn(iso, lf, a - 0.015, a2 + 0.015, 0, 9.5, '#f0ebe0');
      wallOn(iso, lf, a, a2, 0, 8.5, '#c8352b');
      for (let z = 1.2; z < 8.5; z += 1.6) wallOn(iso, lf, a, a2, z, z + 0.35, 'rgba(0,0,0,0.18)');
      wallOn(iso, lf, a + 0.02, a2 - 0.02, 5.5, 7, 'rgba(180, 220, 240, 0.7)');
    }
  }
  if (ex.has('awning') && lf) {
    const c = art.awning ?? '#d94a3d';
    const z = fh - 1.5;
    const stripes = 8;
    const len = lf.a1 - lf.a0;
    for (let k = 0; k < stripes; k++) {
      const a = lf.a0 + (len / stripes) * k;
      const a2 = a + len / stripes;
      iso.poly([pOn(iso, lf, a, 0, z), pOn(iso, lf, a2, 0, z), pOn(iso, lf, a2, 0.16, z - 4), pOn(iso, lf, a, 0.16, z - 4)], k % 2 ? '#f8f4ec' : c);
    }
    wallOn(iso, lf, lf.a0, lf.a1, z - 5.5, z - 4, shade(c, -0.2), 0.16);
  }
  const shopSign = art.sign && base.facade === 'shopfront';
  if (shopSign && lf && art.sign) {
    const sc = art.signColor ?? '#333';
    const mid = (lf.a0 + lf.a1) / 2;
    const size = art.sign.length > 6 ? 4 : 5;
    if (base.floors === 1 && top === base) {
      wallOn(iso, lf, lf.a0 + 0.08, lf.a1 - 0.08, H, H + 7, sc, -0.02);
      wallOn(iso, lf, lf.a0 + 0.08, lf.a1 - 0.08, H + 6.3, H + 7, 'rgba(255,255,255,0.4)', -0.02);
      iso.text(lf.face, lf.at - 0.02, mid, H + 3.6, art.sign, size + 0.5, '#ffffff');
    } else {
      wallOn(iso, lf, lf.a0 + 0.06, lf.a1 - 0.06, fh + 1.2, fh + 6.5, sc);
      iso.text(lf.face, lf.at, mid, fh + 3.9, art.sign, size, '#ffffff');
    }
  }
  if (ex.has('balconies')) {
    // Balconies on every visible side of the residential masses, so the building reads the same from any angle.
    for (const m of ms) {
      if (m.facade === 'shopfront' || m.facade === 'lobby') continue;
      for (const face of ['sw', 'se'] as const) {
        const f = faceRef(face, m.view);
        const len = f.a1 - f.a0;
        const cols = Math.max(2, Math.round(len * 3.4));
        const step = len / cols;
        for (let k = 1; k < m.floors; k++) {
          for (let c = 0; c < cols; c += 2) {
            const a = f.a0 + c * step + step * 0.12;
            const z = m.z0 + k * fh + 0.5;
            floorOut(iso, f, a, a + step * 0.76, 0, 0.08, z, '#d8d4cc');
            wallOn(iso, f, a, a + step * 0.76, z, z + 3, 'rgba(70, 76, 84, 0.75)', 0.08);
          }
        }
      }
    }
  }
  if (ex.has('fireescape')) {
    // Zig-zag stairs on the right side.
    const right = o.faceOf('right') ?? o.faceOf('left');
    if (right) {
      const f = faceRef(right, b);
      const a0 = f.a0 + (f.a1 - f.a0) * 0.3;
      const a1 = f.a0 + (f.a1 - f.a0) * 0.75;
      for (let k = 1; k < base.floors; k++) {
        const z = k * fh;
        floorOut(iso, f, a0, a1, 0, 0.07, z, 'rgba(40, 40, 44, 0.8)');
        wallOn(iso, f, a0, a1, z, z + 2.5, 'rgba(30, 30, 34, 0.55)', 0.07);
        const [s0, s1] = k % 2 ? [a0, a1] : [a1, a0];
        iso.poly([pOn(iso, f, s0, 0.05, z), pOn(iso, f, s0, 0.05, z + 0.8), pOn(iso, f, s1, 0.05, z - fh + 0.8), pOn(iso, f, s1, 0.05, z - fh)], 'rgba(30, 30, 34, 0.7)');
      }
    }
  }
  if (ex.has('terraces')) {
    for (let k = 3; k < top.floors; k += 3) {
      const z = top.z0 + k * fh;
      iso.wall('sw', tb.v1 + 0.06, tb.u0 - 0.02, tb.u1 + 0.02, z, z + 2.5, 'rgba(230, 240, 245, 0.7)');
      iso.wall('se', tb.u1 + 0.06, tb.v0 - 0.02, tb.v1 + 0.02, z, z + 2.5, 'rgba(200, 212, 220, 0.7)');
    }
  }
  if (ex.has('redcross')) {
    for (const face of ['sw', 'se'] as const) {
      const f = faceRef(face, top.view);
      const mid = (f.a0 + f.a1) / 2;
      const z = H - 7;
      wallOn(iso, f, mid - 0.09, mid + 0.09, z - 4.5, z + 4.5, '#ffffff');
      wallOn(iso, f, mid - 0.025, mid + 0.025, z - 3.5, z + 3.5, '#d4343a');
      wallOn(iso, f, mid - 0.07, mid + 0.07, z - 1, z + 1, '#d4343a');
    }
  }
  if (ex.has('canopy') && lf) {
    const mid = (lf.a0 + lf.a1) / 2;
    floorOut(iso, lf, mid - 0.3, mid + 0.3, 0, 0.3, 9, '#2c2f36');
    wallOn(iso, lf, mid - 0.3, mid + 0.3, 7.5, 9, art.trim ?? '#c9a447', 0.3);
    for (const a of [mid - 0.28, mid + 0.26]) wallOn(iso, lf, a, a + 0.02, 0, 7.5, art.trim ?? '#c9a447', 0.28);
  }

  // Rooftop: only on flat roofs.
  if (flat) {
    if (ex.has('solar')) {
      const l = top.local;
      for (let lv = l.v0 + 0.1; lv < l.v1 - 0.18; lv += 0.16) {
        const r = o.rect({ u0: l.u0 + 0.1, u1: l.u1 - 0.1, v0: lv, v1: lv + 0.11 });
        iso.floor(r.u0, r.u1, r.v0, r.v1, H + 1.5, '#2c3e66');
        iso.floor(r.u0 + 0.01, r.u1 - 0.01, r.v0 + 0.01, r.v1 - 0.01, H + 1.6, '#3e5c94');
        for (let a = r.u0 + 0.08; a < r.u1; a += 0.08) iso.floor(a, a + 0.006, r.v0, r.v1, H + 1.7, 'rgba(255,255,255,0.25)');
      }
    }
    if (ex.has('roofgarden')) {
      const d = 0.08;
      iso.floor(tb.u0 + d, tb.u1 - d, tb.v0 + d, tb.v1 - d, H + 0.5, '#6cbf45');
      iso.floor(tb.u0 + d + 0.05, tb.u0 + d + 0.12, tb.v0 + d, tb.v1 - d, H + 0.6, '#d9cfb8');
      for (let k = 0; k < 5; k++) {
        const [x, y] = iso.p(tb.u0 + d + 0.18 + rng() * (tb.u1 - tb.u0 - 0.36), tb.v0 + d + 0.08 + rng() * (tb.v1 - tb.v0 - 0.26), H);
        ctx.fillStyle = '#3f8f2c';
        ctx.beginPath();
        ctx.arc(x, y - 2, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6fc14a';
        ctx.beginPath();
        ctx.arc(x - 0.6, y - 2.8, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (ex.has('pool')) {
      const [pu, pv] = roofSpot(o, top, 0.5, 0.55);
      const hw = Math.min(0.24, (tb.u1 - tb.u0) * 0.3);
      const hv = Math.min(0.16, (tb.v1 - tb.v0) * 0.22);
      iso.floor(pu - hw - 0.04, pu + hw + 0.04, pv - hv - 0.04, pv + hv + 0.04, H + 0.5, '#e9e3d6');
      iso.floor(pu - hw, pu + hw, pv - hv, pv + hv, H + 0.6, '#3fb4e0');
      iso.floor(pu - hw, pu + hw * 0.2, pv - hv, pv - hv * 0.4, H + 0.7, 'rgba(255,255,255,0.3)');
    }
    if (ex.has('acunits')) {
      for (let k = 0; k < 2; k++) {
        const [cu, cv] = roofSpot(o, top, 0.15 + rng() * 0.55, 0.12 + rng() * 0.55);
        iso.box(cu, cu + 0.14, cv, cv + 0.12, H, H + 3.5, '#c9cdd2', '#a2a7ad', '#e2e5e8');
        iso.disc(cu + 0.07, cv + 0.06, 0.035, H + 3.6, '#7d838a');
      }
    }
    if (ex.has('helipad')) {
      const [cu, cv] = roofSpot(o, top, 0.5, 0.5);
      const r = Math.min(tb.u1 - tb.u0, tb.v1 - tb.v0) * 0.36;
      iso.disc(cu, cv, r, H + 0.8, '#3b3f46');
      iso.disc(cu, cv, r * 0.88, H + 0.9, '#f2c43a');
      iso.disc(cu, cv, r * 0.8, H + 1, '#3b3f46');
      const s = r * 0.35;
      const t = r * 0.08;
      iso.floor(cu - s, cu - s + t, cv - s, cv + s, H + 1.1, '#f4f4f0');
      iso.floor(cu + s - t, cu + s, cv - s, cv + s, H + 1.1, '#f4f4f0');
      iso.floor(cu - s, cu + s, cv - t / 2, cv + t / 2, H + 1.1, '#f4f4f0');
    }
    if (ex.has('watertank')) {
      const [tu, tv] = roofSpot(o, top, 0.3, 0.3);
      const [x, y] = iso.p(tu, tv, H);
      ctx.fillStyle = '#5a4a3a';
      for (const dx of [-4, 3]) ctx.fillRect(x + dx, y - 6, 1.5, 6);
      iso.round(tu, tv, H + 6, H + 15, () => 0.12, '#8b6a4a', '#6b5038');
      ctx.fillStyle = '#4a3a2c';
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 15);
      ctx.lineTo(x, y - 20);
      ctx.lineTo(x + 6, y - 15);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (const z of [9, 12]) ctx.fillRect(x - 5.4, y - z, 10.8, 0.6);
    }
    if (ex.has('hosetower')) {
      const [cu, cv] = roofSpot(o, top, 0.12, 0.12);
      iso.box(cu - 0.02, cu + 0.16, cv - 0.02, cv + 0.16, H, H + 16, art.wall, shade(art.wall, -0.25), shade(art.wall, -0.1));
      iso.box(cu - 0.04, cu + 0.18, cv - 0.04, cv + 0.18, H + 16, H + 18, '#5d5f63', '#45474b', '#6d6f73');
    }
    if (ex.has('crown')) {
      const d = 0.1;
      const wall = top.wall;
      iso.box(tb.u0 + d, tb.u1 - d, tb.v0 + d, tb.v1 - d, H, H + 6, shade(wall, -0.15), shade(wall, -0.4), '#4a535c');
      iso.wall('sw', tb.v1 - d, tb.u0 + d, tb.u1 - d, H + 4.5, H + 6, 'rgba(255, 240, 190, 0.9)');
      iso.wall('se', tb.u1 - d, tb.v0 + d, tb.v1 - d, H + 4.5, H + 6, 'rgba(255, 230, 170, 0.7)');
      mast(iso, (tb.u0 + tb.u1) / 2, (tb.v0 + tb.v1) / 2, H + 6, 12);
    }
    if (ex.has('antenna')) {
      const [au, av] = roofSpot(o, top, 0.65, 0.35);
      mast(iso, au, av, H, 20);
      const [bu, bv] = roofSpot(o, top, 0.3, 0.6);
      mast(iso, bu, bv, H, 11);
    }
    if (ex.has('spire')) {
      const cu = (tb.u0 + tb.u1) / 2;
      const cv = (tb.v0 + tb.v1) / 2;
      const s = Math.min(tb.u1 - tb.u0, tb.v1 - tb.v0) * 0.2;
      iso.box(cu - s, cu + s, cv - s, cv + s, H, H + 5, shade(top.wall, -0.1), shade(top.wall, -0.35), shade(top.wall, 0.1));
      const [x, y] = iso.p(cu + s, cv + s, H + 5);
      const [x0] = iso.p(cu - s, cv + s, H + 5);
      const [x1] = iso.p(cu + s, cv - s, H + 5);
      const tipY = y - 34;
      iso.poly([[x0, y - (HALF_H * 2 * s)], [x, y], [x, tipY]], '#dfe6ec');
      iso.poly([[x, y], [x1, y - HALF_H * 2 * s], [x, tipY]], '#9aa6b2');
      ctx.fillStyle = '#ff5a4a';
      ctx.fillRect(x - 1, tipY - 2, 2, 2);
    }
  }

  if (art.sign && !shopSign) {
    // Rooftop sign parallel to the front; it faces whichever camera-facing wall shares its axis.
    const l = top.local;
    const sc = art.signColor ?? '#c33';
    const mid = (l.u0 + l.u1) / 2;
    const half = (l.u1 - l.u0) * 0.38;
    const vv = l.v0 + (l.v1 - l.v0) * 0.55;
    const [pu0, pv0] = o.point(mid - half, vv);
    const [pu1, pv1] = o.point(mid + half, vv);
    const sf: FaceRef =
      Math.abs(pv0 - pv1) < 1e-6
        ? { face: 'sw', at: pv0, a0: Math.min(pu0, pu1), a1: Math.max(pu0, pu1) }
        : { face: 'se', at: pu0, a0: Math.min(pv0, pv1), a1: Math.max(pv0, pv1) };
    const smid = (sf.a0 + sf.a1) / 2;
    const z0 = H + (flat ? 0 : (art.roofH ?? 0) * 0.5);
    for (const a of [sf.a0 + 0.05, sf.a1 - 0.07]) wallOn(iso, sf, a, a + 0.02, z0, z0 + 4, '#4a4f56');
    wallOn(iso, sf, sf.a0, sf.a1, z0 + 4, z0 + 12, sc);
    wallOn(iso, sf, sf.a0, sf.a1, z0 + 11.2, z0 + 12, 'rgba(255,255,255,0.5)');
    iso.text(sf.face, sf.at, smid, z0 + 8, art.sign, art.sign.length > 5 ? 5.5 : 6.5, '#fff7d6');
  }
  const right = o.faceOf('right');
  if (ex.has('loadingdock') && right) {
    const f = faceRef(right, b);
    const doors = Math.max(2, Math.round((f.a1 - f.a0) * 2));
    const step = (f.a1 - f.a0) / doors;
    for (let k = 0; k < doors; k++) {
      const a = f.a0 + k * step + step * 0.18;
      wallOn(iso, f, a, a + step * 0.64, 0, 9, '#4f555c');
      for (let z = 1.5; z < 9; z += 2) wallOn(iso, f, a, a + step * 0.64, z, z + 0.6, 'rgba(255,255,255,0.18)');
      boxOut(iso, f, a - 0.03, a + step * 0.64 + 0.03, 0, 0.04, 9, 10, '#7d8288', '#62676d', '#8c9197');
    }
    floorOut(iso, f, f.a0, f.a1, 0, 0.18, 0.5, 'rgba(242, 196, 58, 0.55)');
  }
  if (ex.has('garagedoor') && lf) {
    const mid = (lf.a0 + lf.a1) / 2;
    wallOn(iso, lf, mid - 0.22, mid + 0.22, 0, 9, '#5d636b');
    for (let z = 1.5; z < 9; z += 1.8) wallOn(iso, lf, mid - 0.22, mid + 0.22, z, z + 0.5, 'rgba(255,255,255,0.18)');
  }
}

/** Thin mast with a red light on top. */
function mast(iso: IsoFrame, u: number, v: number, z: number, h: number) {
  const [x, y] = iso.p(u, v, z);
  iso.ctx.fillStyle = '#5b6169';
  iso.ctx.fillRect(x - 0.5, y - h, 1.2, h);
  iso.ctx.fillRect(x - 2, y - h * 0.6, 4, 0.8);
  iso.ctx.fillStyle = '#ff5a4a';
  iso.ctx.fillRect(x - 1, y - h - 1.5, 2.2, 2);
}

