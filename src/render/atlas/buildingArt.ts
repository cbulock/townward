import { HALF_H, HALF_W } from '../../shared/constants';
import { mulberry32 } from '../../shared/rng';
import { ART_VARIANTS, BUILDINGS, type BuildingId } from '../../sim/buildings/catalog';
import { GROUND_PAD } from './geometry';
import { hexToRgb, INK } from './palette';
import { paintPine } from './treeArt';

/**
 * Procedural building art (docs/specs/buildings.md).
 *
 * Every building is an iso box (or a few) in its own frame. Tile space (u, v)
 * spans the footprint; z is height in px. The camera sees two walls:
 *   SW face (plane v = v1): lit,  on the left
 *   SE face (plane u = u1): shaded, on the right
 * Each building has a small recipe (BuildingArt) that the shared painter turns
 * into walls, windows, roof and extras. Recipes are written in *local* space with
 * the front at +v; the painter rotates them for each of the 4 view rotations, so
 * front details (doors, shopfronts, signs) appear only when the front faces the camera.
 */

export const BUILDING_VARIANTS = ART_VARIANTS;

type Rng = () => number;
type Face = 'sw' | 'se';
type Roof = 'flat' | 'gable' | 'hip' | 'sawtooth';
type Facade = 'punched' | 'bands' | 'curtain' | 'shopfront' | 'industrial' | 'townhouse' | 'brick';
type Extra =
  | 'chimney'
  | 'porch'
  | 'fence'
  | 'awning'
  | 'tables'
  | 'balconies'
  | 'watertank'
  | 'acunits'
  | 'loadingdock'
  | 'crates'
  | 'smokestack'
  | 'canopy'
  | 'crown'
  | 'terraces'
  | 'parking'
  | 'garagedoor';
type Ground = 'garden' | 'paved' | 'parking';

interface BuildingArt {
  floors: number;
  floorH: number;
  /** Body box in footprint tile units; defaults to the footprint inset by `inset`. */
  inset: number;
  body?: { u0: number; u1: number; v0: number; v1: number };
  walls: readonly string[];
  roof: Roof;
  roofColors: readonly string[];
  /** Extra roof height for pitched roofs (px). */
  roofH?: number;
  facade: Facade;
  ground: Ground;
  extras: readonly Extra[];
  /** Text on a sign (shopfronts, rooftop sign). */
  sign?: string;
  signColors?: readonly string[];
}

const ART: Readonly<Record<Exclude<BuildingId, 'park' | 'town_hall'>, BuildingArt>> = {
  cottage: {
    floors: 1,
    floorH: 11,
    inset: 0.2,
    walls: ['#f3e7cf', '#e8d4b4', '#f5efe4'],
    roof: 'gable',
    roofColors: ['#b8513d', '#5e6f86', '#8a5a3b'],
    roofH: 9,
    facade: 'punched',
    ground: 'garden',
    extras: ['chimney', 'fence'],
  },
  family_house: {
    floors: 2,
    floorH: 9,
    inset: 0.16,
    walls: ['#dfe7ee', '#f0dcc4', '#d8e4cf'],
    roof: 'hip',
    roofColors: ['#4f5d70', '#a2493a', '#6a4b3a'],
    roofH: 8,
    facade: 'punched',
    ground: 'garden',
    extras: ['porch', 'chimney'],
  },
  townhouses: {
    floors: 3,
    floorH: 8,
    inset: 0.1,
    walls: ['#c96f5a', '#d8b48a', '#8fa9b8'],
    roof: 'flat',
    roofColors: ['#6b6e74', '#5d6168', '#74767c'],
    facade: 'townhouse',
    ground: 'paved',
    extras: ['acunits'],
  },
  walkup: {
    floors: 4,
    floorH: 8,
    inset: 0.1,
    walls: ['#b35a45', '#9c5040', '#c0785a'],
    roof: 'flat',
    roofColors: ['#5f6268', '#686b70', '#575a60'],
    facade: 'brick',
    ground: 'paved',
    extras: ['balconies', 'acunits'],
  },
  apartment_block: {
    floors: 8,
    floorH: 8,
    inset: 0.18,
    walls: ['#e9e2d4', '#d9dfe6', '#efe0c8'],
    roof: 'flat',
    roofColors: ['#6a6d73', '#5e6167', '#717379'],
    facade: 'punched',
    ground: 'paved',
    extras: ['balconies', 'watertank', 'acunits'],
  },
  condo_tower: {
    floors: 15,
    floorH: 7,
    inset: 0.32,
    walls: ['#7fa8c9', '#8bb3b0', '#9aa7c4'],
    roof: 'flat',
    roofColors: ['#4a5560', '#4f5a58', '#525a6b'],
    facade: 'curtain',
    ground: 'paved',
    extras: ['terraces', 'crown'],
  },
  corner_shop: {
    floors: 2,
    floorH: 9,
    inset: 0.12,
    walls: ['#e7d9bd', '#d6e0d2', '#ead2c4'],
    roof: 'flat',
    roofColors: ['#6b6e74', '#62656b', '#707278'],
    facade: 'shopfront',
    ground: 'paved',
    extras: ['awning'],
    sign: 'SHOP',
    signColors: ['#2f7d4a', '#b23a3a', '#2f5d9a'],
  },
  cafe: {
    floors: 1,
    floorH: 12,
    inset: 0.22,
    walls: ['#f2e6d0', '#e4efe9', '#f3dfe0'],
    roof: 'flat',
    roofColors: ['#7a5a43', '#5f6c63', '#7a4d4d'],
    facade: 'shopfront',
    ground: 'paved',
    extras: ['awning', 'tables'],
    sign: 'CAFE',
    signColors: ['#7a4a2b', '#2f6d5a', '#8a3b4f'],
  },
  small_office: {
    floors: 5,
    floorH: 8,
    inset: 0.14,
    walls: ['#c9ced6', '#d8d2c6', '#bfc9cf'],
    roof: 'flat',
    roofColors: ['#5d6168', '#62666c', '#585c62'],
    facade: 'bands',
    ground: 'paved',
    extras: ['acunits'],
  },
  supermarket: {
    floors: 1,
    floorH: 16,
    inset: 0.12,
    body: { u0: 0.12, u1: 1.88, v0: 0.12, v1: 1.15 },
    walls: ['#e8e3d8', '#dfe6ea', '#ece2d3'],
    roof: 'flat',
    roofColors: ['#8a8d92', '#80858b', '#8d8a85'],
    facade: 'shopfront',
    ground: 'parking',
    extras: ['parking', 'acunits'],
    sign: 'MARKET',
    signColors: ['#d2462f', '#2b7a3d', '#2c62b0'],
  },
  hotel: {
    floors: 11,
    floorH: 7,
    inset: 0.22,
    walls: ['#e9dcc6', '#d7d2e3', '#e6d0c0'],
    roof: 'flat',
    roofColors: ['#5c5f66', '#55585f', '#615d5a'],
    facade: 'punched',
    ground: 'paved',
    extras: ['canopy', 'balconies'],
    sign: 'HOTEL',
    signColors: ['#d23b3b', '#2d63c8', '#c8902d'],
  },
  office_tower: {
    floors: 18,
    floorH: 7,
    inset: 0.28,
    walls: ['#5f8fb8', '#6e9aa6', '#7d8fb0'],
    roof: 'flat',
    roofColors: ['#3e4a56', '#3f4c50', '#444a5c'],
    facade: 'curtain',
    ground: 'paved',
    extras: ['crown'],
  },
  workshop: {
    floors: 1,
    floorH: 13,
    inset: 0.14,
    walls: ['#b9b3a6', '#a9b4b9', '#c2b49a'],
    roof: 'sawtooth',
    roofColors: ['#7d8288', '#6f757b', '#858179'],
    roofH: 6,
    facade: 'industrial',
    ground: 'paved',
    extras: ['garagedoor', 'crates'],
  },
  warehouse: {
    floors: 2,
    floorH: 10,
    inset: 0.14,
    walls: ['#c7b48f', '#a8b0b8', '#b9a48a'],
    roof: 'flat',
    roofColors: ['#8b8f94', '#7f858b', '#90897f'],
    facade: 'industrial',
    ground: 'paved',
    extras: ['loadingdock', 'crates'],
  },
  factory: {
    floors: 3,
    floorH: 9,
    inset: 0.12,
    body: { u0: 0.12, u1: 1.88, v0: 0.12, v1: 1.6 },
    walls: ['#a9a296', '#9fa7ad', '#b0a28c'],
    roof: 'sawtooth',
    roofColors: ['#7a7f85', '#6d7379', '#82786d'],
    roofH: 8,
    facade: 'industrial',
    ground: 'paved',
    extras: ['smokestack', 'loadingdock'],
  },
};

// ---------------------------------------------------------------- frames

/** Extra space above the footprint for walls, roof and rooftop extras. */
export function buildingHeadroom(id: BuildingId): number {
  if (id === 'park') return 34;
  if (id === 'town_hall') return 72;
  const a = ART[id];
  const tall = a.extras.includes('smokestack') ? 34 : 0;
  return a.floors * a.floorH + (a.roofH ?? 0) + 26 + tall;
}

export function buildingFrameSize(id: BuildingId): { w: number; h: number } {
  const { w, h } = BUILDINGS[id].size;
  return { w: (w + h) * HALF_W + GROUND_PAD * 2, h: (w + h) * HALF_H + GROUND_PAD * 2 + buildingHeadroom(id) };
}

// ---------------------------------------------------------------- iso helpers

/** Projection for one building frame (also used for vehicles). */
export class IsoFrame {
  constructor(
    readonly ctx: CanvasRenderingContext2D,
    private readonly ox: number,
    private readonly oy: number,
  ) {}

  p(u: number, v: number, z = 0): [number, number] {
    return [this.ox + (u - v) * HALF_W, this.oy + (u + v) * HALF_H - z];
  }

  poly(points: readonly [number, number][], fill: string) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(points[0][0], points[0][1]);
    for (let k = 1; k < points.length; k++) c.lineTo(points[k][0], points[k][1]);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
  }

  /** Flat quad on the ground (or at height z). */
  floor(u0: number, u1: number, v0: number, v1: number, z: number, fill: string) {
    this.poly([this.p(u0, v0, z), this.p(u1, v0, z), this.p(u1, v1, z), this.p(u0, v1, z)], fill);
  }

  /**
   * Rectangle on a wall. `a` runs along the wall (u on SW, v on SE), z is height.
   * `at` is the wall's plane coordinate (v1 for SW, u1 for SE).
   */
  wall(face: Face, at: number, a0: number, a1: number, z0: number, z1: number, fill: string) {
    const q = (a: number, z: number) => (face === 'sw' ? this.p(a, at, z) : this.p(at, a, z));
    this.poly([q(a0, z0), q(a1, z0), q(a1, z1), q(a0, z1)], fill);
  }

  /** Axis box: back faces are hidden, so only the two visible walls and the top are drawn. */
  box(u0: number, u1: number, v0: number, v1: number, z0: number, z1: number, lit: string, shaded: string, top: string) {
    this.wall('sw', v1, u0, u1, z0, z1, lit);
    this.wall('se', u1, v0, v1, z0, z1, shaded);
    this.floor(u0, u1, v0, v1, z1, top);
  }

  /** Text lying on a wall plane (sheared to follow it). */
  text(face: Face, at: number, a: number, z: number, str: string, size: number, color: string) {
    const c = this.ctx;
    const [x, y] = face === 'sw' ? this.p(a, at, z) : this.p(at, a, z);
    c.save();
    c.translate(x, y);
    c.transform(1, face === 'sw' ? 0.5 : -0.5, 0, 1, 0, 0);
    c.font = `bold ${size}px Inter, system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = color;
    c.fillText(str, 0, 0);
    c.restore();
  }
}

/** Lighten (f > 0) or darken (f < 0) a hex colour. */
export function shade(hex: string, f: number): string {
  const [r, g, b] = hexToRgb(hex);
  const k = (c: number) => Math.round(Math.max(0, Math.min(255, f >= 0 ? c + (255 - c) * f : c * (1 + f))));
  return `rgb(${k(r)}, ${k(g)}, ${k(b)})`;
}

const GLASS = '#34506b';
const GLASS_LIT = '#ffe39a';
const FRAME = 'rgba(255, 255, 255, 0.35)';

// ---------------------------------------------------------------- orientation

/** Quarter turns of the view; matches render/view/ViewTransform's Rotation. */
export type BuildingRotation = 0 | 1 | 2 | 3;
export const BUILDING_ROTATIONS: readonly BuildingRotation[] = [0, 1, 2, 3];

type Side = 'front' | 'right' | 'back' | 'left';
const SIDES: readonly Side[] = ['front', 'right', 'back', 'left'];
/** Outward normal of each side in local building space (the front faces +v). */
const SIDE_DIR: Readonly<Record<Side, readonly [number, number]>> = {
  front: [0, 1],
  right: [1, 0],
  back: [0, -1],
  left: [-1, 0],
};

interface Box {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

/**
 * Local building space (footprint w × h, front = +v) → view space after `r` quarter
 * turns, using the same mapping as ViewTransform so art and map rotate together.
 */
class Orient {
  constructor(
    readonly r: BuildingRotation,
    readonly w: number,
    readonly h: number,
  ) {}

  get vw(): number {
    return this.r % 2 === 0 ? this.w : this.h;
  }

  get vh(): number {
    return this.r % 2 === 0 ? this.h : this.w;
  }

  point(u: number, v: number): [number, number] {
    switch (this.r) {
      case 0:
        return [u, v];
      case 1:
        return [this.h - v, u];
      case 2:
        return [this.w - u, this.h - v];
      case 3:
        return [v, this.w - u];
    }
  }

  rect(b: Box): Box {
    const [a0, c0] = this.point(b.u0, b.v0);
    const [a1, c1] = this.point(b.u1, b.v1);
    return { u0: Math.min(a0, a1), u1: Math.max(a0, a1), v0: Math.min(c0, c1), v1: Math.max(c0, c1) };
  }

  private dir(dx: number, dy: number): [number, number] {
    switch (this.r) {
      case 0:
        return [dx, dy];
      case 1:
        return [-dy, dx];
      case 2:
        return [-dx, -dy];
      case 3:
        return [dy, -dx];
    }
  }

  /** The camera-facing wall that shows a local side, or null if that side faces away. */
  faceOf(side: Side): Face | null {
    const [dx, dy] = this.dir(SIDE_DIR[side][0], SIDE_DIR[side][1]);
    if (dx === 0 && dy === 1) return 'sw';
    if (dx === 1 && dy === 0) return 'se';
    return null;
  }

  /** Which local side a camera-facing wall shows. */
  sideOf(face: Face): Side {
    for (const s of SIDES) if (this.faceOf(s) === face) return s;
    return 'front';
  }

  /** Axis a local-u feature (ridge, sawtooth) runs along in the view. */
  get uAxis(): 'u' | 'v' {
    return this.r % 2 === 0 ? 'u' : 'v';
  }
}

/** A camera-facing wall of a box: its plane coordinate and the range along it (view space). */
interface FaceRef {
  face: Face;
  at: number;
  a0: number;
  a1: number;
}

function faceRef(face: Face, b: Box): FaceRef {
  return face === 'sw' ? { face, at: b.v1, a0: b.u0, a1: b.u1 } : { face, at: b.u1, a0: b.v0, a1: b.v1 };
}

/** View-space (u, v) of a point `a` along a face, `d` out from it. */
function onFace(f: FaceRef, a: number, d: number): [number, number] {
  return f.face === 'sw' ? [a, f.at + d] : [f.at + d, a];
}

function wallOn(iso: IsoFrame, f: FaceRef, a0: number, a1: number, z0: number, z1: number, fill: string, out = 0) {
  iso.wall(f.face, f.at + out, a0, a1, z0, z1, fill);
}

function floorOut(iso: IsoFrame, f: FaceRef, a0: number, a1: number, d0: number, d1: number, z: number, fill: string) {
  if (f.face === 'sw') iso.floor(a0, a1, f.at + d0, f.at + d1, z, fill);
  else iso.floor(f.at + d0, f.at + d1, a0, a1, z, fill);
}

function boxOut(iso: IsoFrame, f: FaceRef, a0: number, a1: number, d0: number, d1: number, z0: number, z1: number, lit: string, dark: string, top: string) {
  if (f.face === 'sw') iso.box(a0, a1, f.at + d0, f.at + d1, z0, z1, lit, dark, top);
  else iso.box(f.at + d0, f.at + d1, a0, a1, z0, z1, lit, dark, top);
}

function pOn(iso: IsoFrame, f: FaceRef, a: number, d: number, z: number): [number, number] {
  const [u, v] = onFace(f, a, d);
  return iso.p(u, v, z);
}

/**
 * Something standing on the ground (parked car, crate, café table). Drawn before the
 * building if it's behind it in the view, after if it's in front, so overlaps are right.
 */
interface Prop {
  u: number;
  v: number;
  draw: () => void;
}

function inFront(p: Prop, b: Box): boolean {
  return p.u >= b.u1 || p.v >= b.v1;
}

// ---------------------------------------------------------------- painter

export function paintBuilding(ctx: CanvasRenderingContext2D, id: BuildingId, variant: number, rot: BuildingRotation = 0) {
  const { w, h } = BUILDINGS[id].size;
  const o = new Orient(rot, w, h);
  const iso = new IsoFrame(ctx, GROUND_PAD + o.vh * HALF_W, GROUND_PAD + buildingHeadroom(id));
  const rng = mulberry32(8000 + variant * 101 + id.length * 7 + id.charCodeAt(0));
  if (id === 'park') return paintPark(iso, o, rng, variant);
  if (id === 'town_hall') return paintTownHall(iso, o, variant);

  const art = ART[id];
  const v = variant % BUILDING_VARIANTS;
  const local: Box = art.body ?? { u0: art.inset, u1: w - art.inset, v0: art.inset, v1: h - art.inset };
  const b = o.rect(local);
  const lot: Box = { u0: 0, u1: o.vw, v0: 0, v1: o.vh };
  const H = art.floors * art.floorH;
  const wall = art.walls[v];
  const roofColor = art.roofColors[v];
  const front = o.faceOf('front');

  paintGround(iso, o, art.ground, lot, local);
  // Soft contact shadow on the ground to the lower right of the body.
  iso.poly(
    [iso.p(b.u1, b.v0 + 0.05), iso.p(b.u1 + 0.18, b.v0 + 0.2), iso.p(b.u1 + 0.18, b.v1 + 0.18), iso.p(b.u0 + 0.15, b.v1 + 0.18), iso.p(b.u0, b.v1)],
    'rgba(20, 50, 20, 0.22)',
  );

  const props = groundProps(iso, o, art, local, v, rng);
  for (const p of props) if (!inFront(p, b)) p.draw();

  // A smokestack behind the body is drawn first so the walls cover its base.
  const stack = art.extras.includes('smokestack') ? o.point(local.u1 - 0.35, local.v0 + 0.25) : null;
  const stackInFront = stack !== null && stack[0] + stack[1] > (b.u0 + b.u1 + b.v0 + b.v1) / 2;
  if (stack && !stackInFront) paintSmokestack(iso, stack, H, v);

  // Walls and base plinth.
  iso.wall('sw', b.v1, b.u0, b.u1, 0, H, wall);
  iso.wall('se', b.u1, b.v0, b.v1, 0, H, shade(wall, -0.22));
  iso.wall('sw', b.v1, b.u0, b.u1, 0, 2, shade(wall, -0.35));
  iso.wall('se', b.u1, b.v0, b.v1, 0, 2, shade(wall, -0.45));

  for (const face of ['sw', 'se'] as const) paintFacade(iso, art, faceRef(face, b), o.sideOf(face), H, v, rng);
  paintRoof(iso, art, b, o.uAxis, H, roofColor, wall);
  paintExtras(iso, o, art, local, b, front, H, v, rng);
  if (stack && stackInFront) paintSmokestack(iso, stack, H, v);

  for (const p of props) if (inFront(p, b)) p.draw();
  if (art.extras.includes('fence')) paintFence(iso, lot);
}

function paintGround(iso: IsoFrame, o: Orient, ground: Ground, lot: Box, local: Box) {
  if (ground === 'garden') {
    iso.floor(lot.u0 + 0.04, lot.u1 - 0.04, lot.v0 + 0.04, lot.v1 - 0.04, 0, '#6cc444');
    // Path from the front door to the lot edge.
    const mid0 = local.u0 + (local.u1 - local.u0) * 0.35;
    const mid1 = local.u0 + (local.u1 - local.u0) * 0.65;
    // Local space: the lot's front edge is always at v = h.
    const path = o.rect({ u0: mid0, u1: mid1, v0: local.v1, v1: o.h - 0.02 });
    iso.floor(path.u0, path.u1, path.v0, path.v1, 0, '#d9cfb8');
  } else {
    iso.floor(lot.u0 + 0.03, lot.u1 - 0.03, lot.v0 + 0.03, lot.v1 - 0.03, 0, '#b9b6ae');
    iso.floor(lot.u0 + 0.06, lot.u1 - 0.06, lot.v0 + 0.06, lot.v1 - 0.06, 0, ground === 'parking' ? '#6f737a' : '#cfccc3');
  }
}

/** Ground-level props in local space (parking, crates, tables), mapped into the view. */
function groundProps(iso: IsoFrame, o: Orient, art: BuildingArt, local: Box, v: number, rng: Rng): Prop[] {
  const props: Prop[] = [];
  const ex = new Set(art.extras);
  /** Local front edge of the lot. */
  const lotV1 = o.h;

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
        props.push({
          u: car.u0,
          v: car.v0,
          draw: () => {
            iso.box(car.u0, car.u1, car.v0, car.v1, 0, 3, c, shade(c, -0.3), shade(c, 0.15));
            const g = 0.02;
            iso.floor(car.u0 + g, car.u1 - g, car.v0 + g * 3, car.v1 - g * 3, 4.5, 'rgba(40, 60, 80, 0.85)');
          },
        });
      }
    }
  }
  if (ex.has('crates')) {
    const colors = ['#a87a45', '#7a8a4a', '#3d6e9e'];
    for (let k = 0; k < 3; k++) {
      const cu = local.u1 + 0.05 + (k % 2) * 0.12;
      const cv = local.v1 - 0.35 + k * 0.12;
      const r = o.rect({ u0: cu, u1: cu + 0.1, v0: cv, v1: cv + 0.1 });
      const c = colors[(k + v) % colors.length];
      props.push({ u: r.u0, v: r.v0, draw: () => iso.box(r.u0, r.u1, r.v0, r.v1, 0, 3.5, c, shade(c, -0.3), shade(c, 0.15)) });
    }
  }
  if (ex.has('tables')) {
    for (const [tu, tv] of [
      [local.u0 + 0.12, local.v1 + 0.2],
      [local.u0 + 0.42, local.v1 + 0.24],
    ] as const) {
      const r = o.rect({ u0: tu, u1: tu + 0.04, v0: tv, v1: tv + 0.04 });
      props.push({
        u: r.u0,
        v: r.v0,
        draw: () => {
          iso.box(r.u0, r.u1, r.v0, r.v1, 0, 5, '#7a7f86', '#5c6168', '#7a7f86');
          const [x, y] = iso.p((r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2, 7);
          const ctx = iso.ctx;
          ctx.fillStyle = v === 0 ? '#e9554a' : '#f2c84b';
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
  return props;
}

/** Picket fence along the two lot edges nearest the camera. */
function paintFence(iso: IsoFrame, lot: Box) {
  for (let a = lot.u0 + 0.06; a < lot.u1 - 0.04; a += 0.09) iso.wall('sw', lot.v1 - 0.04, a, a + 0.03, 0, 4, '#fbf7ee');
  iso.wall('sw', lot.v1 - 0.04, lot.u0 + 0.06, lot.u1 - 0.06, 2.5, 3.3, '#fbf7ee');
  for (let a = lot.v0 + 0.06; a < lot.v1 - 0.04; a += 0.09) iso.wall('se', lot.u1 - 0.04, a, a + 0.03, 0, 4, '#e3ddcf');
  iso.wall('se', lot.u1 - 0.04, lot.v0 + 0.06, lot.v1 - 0.06, 2.5, 3.3, '#e3ddcf');
}

function glazing(iso: IsoFrame, f: FaceRef, a0: number, a1: number, z0: number, z1: number, lit: boolean) {
  wallOn(iso, f, a0, a1, z0, z1, lit ? GLASS_LIT : f.face === 'sw' ? GLASS : shade(GLASS, -0.25));
  wallOn(iso, f, a0, a1, z1 - 0.8, z1, FRAME);
}

/** Windows and doors on one camera-facing wall. Front-only details go on the front side only. */
function paintFacade(iso: IsoFrame, art: BuildingArt, f: FaceRef, side: Side, H: number, v: number, rng: Rng) {
  const fh = art.floorH;
  const { a0, a1 } = f;
  const len = a1 - a0;
  const isFront = side === 'front';
  const cols = Math.max(2, Math.round(len * (art.facade === 'brick' ? 4 : 3.4)));
  const step = len / cols;

  if (art.facade === 'curtain') {
    wallOn(iso, f, a0 + 0.01, a1 - 0.01, 2, H, f.face === 'sw' ? shade(art.walls[v], -0.05) : shade(art.walls[v], -0.3));
    for (let k = 1; k < art.floors; k++) wallOn(iso, f, a0, a1, k * fh, k * fh + 0.7, 'rgba(255,255,255,0.28)');
    for (let c = 1; c < cols; c++) wallOn(iso, f, a0 + c * step, a0 + c * step + 0.012, 2, H, 'rgba(20,40,60,0.35)');
    if (f.face === 'sw') {
      // Diagonal reflection streak on the lit side.
      iso.poly([pOn(iso, f, a0 + len * 0.15, 0, H * 0.9), pOn(iso, f, a0 + len * 0.3, 0, H * 0.9), pOn(iso, f, a0 + len * 0.55, 0, H * 0.25), pOn(iso, f, a0 + len * 0.4, 0, H * 0.25)], 'rgba(255,255,255,0.14)');
    }
    for (let k = 0; k < art.floors; k++) {
      if (rng() < 0.25) {
        const c = Math.floor(rng() * cols);
        wallOn(iso, f, a0 + c * step + 0.02, a0 + (c + 1) * step - 0.02, k * fh + 1.5, (k + 1) * fh - 1, 'rgba(255, 228, 150, 0.55)');
      }
    }
    return;
  }

  if (art.facade === 'bands') {
    for (let k = 0; k < art.floors; k++) {
      wallOn(iso, f, a0 + 0.03, a1 - 0.03, k * fh + 2, k * fh + fh - 1.5, f.face === 'sw' ? '#3f5f7d' : '#2e475e');
      for (let c = 1; c < cols; c++) wallOn(iso, f, a0 + c * step, a0 + c * step + 0.012, k * fh + 2, k * fh + fh - 1.5, 'rgba(230,236,242,0.5)');
      if (rng() < 0.3) {
        const c = Math.floor(rng() * cols);
        wallOn(iso, f, a0 + c * step + 0.02, a0 + (c + 1) * step - 0.02, k * fh + 2.5, k * fh + fh - 2, 'rgba(255, 228, 150, 0.7)');
      }
    }
    return;
  }

  if (art.facade === 'industrial') {
    for (let c = 0; c < cols; c++) {
      const s0 = a0 + c * step + step * 0.25;
      glazing(iso, f, s0, s0 + step * 0.5, H - 6, H - 2.5, false);
    }
    return;
  }

  if (art.facade === 'townhouse' && isFront) {
    const units = 3;
    const uw = len / units;
    const doorColors = ['#c0392b', '#2e6fb5', '#2f8f4e', '#e0a12d'];
    for (let k = 0; k < units; k++) {
      const s0 = a0 + k * uw;
      const unitWall = art.walls[(v + k) % 3];
      wallOn(iso, f, s0, s0 + uw, 2, H, f.face === 'sw' ? shade(unitWall, 0.05 * k) : shade(unitWall, -0.2 + 0.05 * k));
      wallOn(iso, f, s0 + uw - 0.01, s0 + uw, 2, H, 'rgba(0,0,0,0.25)');
      wallOn(iso, f, s0 + uw * 0.15, s0 + uw * 0.45, 2, 9, doorColors[(k + v) % doorColors.length]);
      glazing(iso, f, s0 + uw * 0.55, s0 + uw * 0.85, 4, 8, false);
      for (let fl = 1; fl < art.floors; fl++) {
        glazing(iso, f, s0 + uw * 0.18, s0 + uw * 0.45, fl * fh + 2, fl * fh + fh - 2, rng() < 0.2);
        glazing(iso, f, s0 + uw * 0.55, s0 + uw * 0.82, fl * fh + 2, fl * fh + fh - 2, rng() < 0.2);
      }
      wallOn(iso, f, s0, s0 + uw, H - 1.5, H, shade(unitWall, -0.3));
    }
    return;
  }

  if (art.facade === 'brick') {
    for (let k = 0; k < art.floors; k++) wallOn(iso, f, a0, a1, k * fh, k * fh + 0.6, 'rgba(0,0,0,0.12)');
  }

  const shop = art.facade === 'shopfront';
  for (let k = 0; k < art.floors; k++) {
    const z0 = k * fh;
    if (shop && k === 0) {
      if (isFront) {
        // Big shop window plus a door.
        glazing(iso, f, a0 + 0.06, a1 - len * 0.32, 2, fh - 2.5, false);
        wallOn(iso, f, a1 - len * 0.26, a1 - len * 0.1, 2, fh - 2.5, '#5b3a26');
      } else {
        glazing(iso, f, a0 + 0.08, a1 - 0.08, 2, fh - 2.5, false);
      }
      continue;
    }
    if (isFront && k === 0 && art.floors <= 4) {
      const mid = a0 + len * 0.5;
      wallOn(iso, f, mid - 0.07, mid + 0.07, 1.5, Math.min(fh - 1, 9), '#6b4428');
      for (let c = 0; c < cols; c++) {
        const s0 = a0 + c * step + step * 0.22;
        if (Math.abs(s0 + step * 0.28 - mid) < step * 0.6) continue;
        glazing(iso, f, s0, s0 + step * 0.56, z0 + 3, z0 + fh - 2.5, rng() < 0.15);
      }
      continue;
    }
    for (let c = 0; c < cols; c++) {
      const s0 = a0 + c * step + step * 0.22;
      glazing(iso, f, s0, s0 + step * 0.56, z0 + 2.5, z0 + fh - 2, rng() < 0.18);
    }
  }
}

/**
 * Roofs drawn in view space. Pitched and sawtooth roofs run along `axis`
 * (the local u axis after rotation); each case draws its far planes first.
 */
function paintRoof(iso: IsoFrame, art: BuildingArt, b: Box, axis: 'u' | 'v', H: number, roofColor: string, wall: string) {
  const rh = art.roofH ?? 0;
  const o = 0.06; // eave overhang
  if (art.roof === 'flat') {
    iso.floor(b.u0, b.u1, b.v0, b.v1, H, shade(wall, -0.1));
    iso.floor(b.u0 + 0.04, b.u1 - 0.04, b.v0 + 0.04, b.v1 - 0.04, H, roofColor);
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
    iso.poly([P(A0 - o, C1 + o, H - 1), P(A1 + o, C1 + o, H - 1), P(A1 + o, cm, H + rh), P(A0 - o, cm, H + rh)], nearSlope);
    for (let t = 0.25; t < 1; t += 0.25) {
      const cc = C1 + o - (C1 + o - cm) * t;
      const z = H - 1 + (rh + 1) * t;
      iso.poly([P(A0 - o, cc, z), P(A1 + o, cc, z), P(A1 + o, cc, z + 1), P(A0 - o, cc, z + 1)], shade(roofColor, axis === 'u' ? -0.15 : -0.27));
    }
    iso.poly([P(A0 - o, cm, H + rh), P(A1 + o, cm, H + rh), P(A1 + o, cm, H + rh + 1), P(A0 - o, cm, H + rh + 1)], shade(roofColor, 0.25));
    return;
  }
  if (art.roof === 'hip') {
    const d = (C1 - C0) / 2;
    const r0 = A0 + d;
    const r1 = A1 - d;
    iso.poly([P(A0 - o, C0 - o, H), P(A1 + o, C0 - o, H), P(r1, cm, H + rh), P(r0, cm, H + rh)], farSlope);
    iso.poly([P(A1 + o, C0 - o, H), P(A1 + o, C1 + o, H), P(r1, cm, H + rh)], axis === 'u' ? shade(roofColor, -0.18) : roofColor);
    iso.poly([P(A0 - o, C1 + o, H), P(A1 + o, C1 + o, H), P(r1, cm, H + rh), P(r0, cm, H + rh)], nearSlope);
    iso.poly([P(r0, cm, H + rh), P(r1, cm, H + rh), P(r1, cm, H + rh + 1), P(r0, cm, H + rh + 1)], shade(roofColor, 0.25));
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

function paintSmokestack(iso: IsoFrame, at: readonly [number, number], H: number, v: number) {
  const top = H + 30;
  const [cx, cyBase] = iso.p(at[0], at[1], 0);
  const ctx = iso.ctx;
  const r = 4.5;
  ctx.fillStyle = '#8a4a3a';
  ctx.fillRect(cx - r, cyBase - top, r * 2, top);
  ctx.fillStyle = '#6e3a2e';
  ctx.fillRect(cx, cyBase - top, r, top);
  for (const z of [top - 6, top - 14]) {
    ctx.fillStyle = v === 1 ? '#e8e8e8' : '#f0f0f0';
    ctx.fillRect(cx - r, cyBase - z, r * 2, 3);
  }
  ctx.fillStyle = '#3a3a3a';
  ctx.beginPath();
  ctx.ellipse(cx, cyBase - top, r, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function paintExtras(iso: IsoFrame, o: Orient, art: BuildingArt, local: Box, b: Box, front: Face | null, H: number, v: number, rng: Rng) {
  const fh = art.floorH;
  const ex = new Set(art.extras);
  const lf = front ? faceRef(front, b) : null;

  if (ex.has('chimney')) {
    const [cu, cv] = o.point(local.u0 + (local.u1 - local.u0) * 0.72, local.v0 + (local.v1 - local.v0) * 0.3);
    iso.box(cu - 0.05, cu + 0.05, cv - 0.05, cv + 0.05, H - 2, H + (art.roofH ?? 0) + 4, '#9b4b3c', '#7a3a2f', '#5a2c24');
  }
  if (ex.has('porch') && lf) {
    const mid = (lf.a0 + lf.a1) / 2;
    floorOut(iso, lf, mid - 0.2, mid + 0.2, 0, 0.14, 1.5, '#cdbfa6');
    boxOut(iso, lf, mid - 0.2, mid + 0.2, 0, 0.14, 8.5, 9.5, '#efe6d6', '#cfc4b0', '#a7493a');
    for (const a of [mid - 0.19, mid + 0.17]) wallOn(iso, lf, a, a + 0.02, 1.5, 8.5, '#f6f1e6', 0.13);
  }
  if (ex.has('awning') && lf) {
    const colors = ['#d94a3d', '#2e8a5a', '#2d6fc4'];
    const c = colors[v % colors.length];
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
  if (art.sign && art.facade === 'shopfront' && lf) {
    const sc = art.signColors?.[v] ?? '#333';
    const mid = (lf.a0 + lf.a1) / 2;
    if (art.floors === 1) {
      wallOn(iso, lf, lf.a0 + 0.1, lf.a1 - 0.1, H, H + 7, sc, -0.02);
      iso.text(lf.face, lf.at - 0.02, mid, H + 3.6, art.sign, 5.5, '#ffffff');
    } else {
      wallOn(iso, lf, lf.a0 + 0.06, lf.a1 - 0.06, fh + 1.5, fh + 6.5, sc);
      iso.text(lf.face, lf.at, mid, fh + 4.1, art.sign, 4.5, '#ffffff');
    }
  }
  if (ex.has('balconies')) {
    // Balconies on every visible side, so the building reads the same from any angle.
    for (const face of ['sw', 'se'] as const) {
      const f = faceRef(face, b);
      const len = f.a1 - f.a0;
      const cols = Math.max(2, Math.round(len * 3.4));
      const step = len / cols;
      for (let k = 1; k < art.floors; k++) {
        for (let c = 0; c < cols; c += 2) {
          const a = f.a0 + c * step + step * 0.12;
          const z = k * fh + 0.5;
          floorOut(iso, f, a, a + step * 0.76, 0, 0.08, z, '#d8d4cc');
          wallOn(iso, f, a, a + step * 0.76, z, z + 3, 'rgba(70, 76, 84, 0.75)', 0.08);
        }
      }
    }
  }
  if (ex.has('terraces')) {
    for (let k = 3; k < art.floors; k += 3) {
      iso.wall('sw', b.v1 + 0.06, b.u0 - 0.02, b.u1 + 0.02, k * fh, k * fh + 2.5, 'rgba(230, 240, 245, 0.7)');
      iso.wall('se', b.u1 + 0.06, b.v0 - 0.02, b.v1 + 0.02, k * fh, k * fh + 2.5, 'rgba(200, 212, 220, 0.7)');
    }
  }
  if (ex.has('canopy') && lf) {
    const mid = (lf.a0 + lf.a1) / 2;
    floorOut(iso, lf, mid - 0.3, mid + 0.3, 0, 0.3, 9, '#2c2f36');
    wallOn(iso, lf, mid - 0.3, mid + 0.3, 7.5, 9, '#c9a447', 0.3);
    for (const a of [mid - 0.28, mid + 0.26]) wallOn(iso, lf, a, a + 0.02, 0, 7.5, '#c9a447', 0.28);
  }
  if (ex.has('acunits')) {
    for (let k = 0; k < 2; k++) {
      const lu = local.u0 + 0.15 + rng() * Math.max(0.05, local.u1 - local.u0 - 0.4);
      const lv = local.v0 + 0.12 + rng() * Math.max(0.05, local.v1 - local.v0 - 0.35);
      const r = o.rect({ u0: lu, u1: lu + 0.14, v0: lv, v1: lv + 0.12 });
      iso.box(r.u0, r.u1, r.v0, r.v1, H, H + 3.5, '#c9cdd2', '#a2a7ad', '#e2e5e8');
    }
  }
  if (ex.has('watertank')) {
    const [tu, tv] = o.point(local.u0 + (local.u1 - local.u0) * 0.3, local.v0 + (local.v1 - local.v0) * 0.3);
    const [x, y] = iso.p(tu, tv, H);
    const ctx = iso.ctx;
    ctx.fillStyle = '#5a4a3a';
    for (const dx of [-4, 3]) ctx.fillRect(x + dx, y - 6, 1.5, 6);
    ctx.fillStyle = '#8b6a4a';
    ctx.fillRect(x - 6, y - 16, 12, 10);
    ctx.fillStyle = '#6b5038';
    ctx.fillRect(x, y - 16, 6, 10);
    ctx.fillStyle = '#4a3a2c';
    ctx.beginPath();
    ctx.moveTo(x - 7, y - 16);
    ctx.lineTo(x, y - 21);
    ctx.lineTo(x + 7, y - 16);
    ctx.closePath();
    ctx.fill();
  }
  if (ex.has('crown')) {
    const d = 0.12;
    iso.box(b.u0 + d, b.u1 - d, b.v0 + d, b.v1 - d, H, H + 5, shade(art.walls[v], -0.15), shade(art.walls[v], -0.4), '#4a535c');
    iso.wall('sw', b.v1 - d, b.u0 + d, b.u1 - d, H + 3.5, H + 5, 'rgba(255, 240, 190, 0.9)');
    iso.wall('se', b.u1 - d, b.v0 + d, b.v1 - d, H + 3.5, H + 5, 'rgba(255, 230, 170, 0.7)');
    const [x, y] = iso.p((b.u0 + b.u1) / 2, (b.v0 + b.v1) / 2, H + 5);
    iso.ctx.fillStyle = '#5b6169';
    iso.ctx.fillRect(x - 0.5, y - 12, 1.5, 12);
    iso.ctx.fillStyle = '#ff5a4a';
    iso.ctx.fillRect(x - 1, y - 13, 2.5, 2);
  }
  if (art.sign && art.facade !== 'shopfront') {
    // Rooftop sign parallel to the front; it faces whichever camera-facing wall shares its axis.
    const sc = art.signColors?.[v] ?? '#c33';
    const mid = (local.u0 + local.u1) / 2;
    const half = (local.u1 - local.u0) * 0.38;
    const vv = local.v0 + (local.v1 - local.v0) * 0.55;
    const [pu0, pv0] = o.point(mid - half, vv);
    const [pu1, pv1] = o.point(mid + half, vv);
    const sf: FaceRef =
      Math.abs(pv0 - pv1) < 1e-6
        ? { face: 'sw', at: pv0, a0: Math.min(pu0, pu1), a1: Math.max(pu0, pu1) }
        : { face: 'se', at: pu0, a0: Math.min(pv0, pv1), a1: Math.max(pv0, pv1) };
    const smid = (sf.a0 + sf.a1) / 2;
    for (const a of [sf.a0 + 0.05, sf.a1 - 0.07]) wallOn(iso, sf, a, a + 0.02, H, H + 4, '#4a4f56');
    wallOn(iso, sf, sf.a0, sf.a1, H + 4, H + 12, sc);
    wallOn(iso, sf, sf.a0, sf.a1, H + 11.2, H + 12, 'rgba(255,255,255,0.5)');
    iso.text(sf.face, sf.at, smid, H + 8, art.sign, 6.5, '#fff7d6');
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
    }
    floorOut(iso, f, f.a0, f.a1, 0, 0.18, 0.5, 'rgba(242, 196, 58, 0.55)');
  }
  if (ex.has('garagedoor') && lf) {
    const mid = (lf.a0 + lf.a1) / 2;
    wallOn(iso, lf, mid - 0.22, mid + 0.22, 0, 9, '#5d636b');
    for (let z = 1.5; z < 9; z += 1.8) wallOn(iso, lf, mid - 0.22, mid + 0.22, z, z + 0.5, 'rgba(255,255,255,0.18)');
  }
}

// ---------------------------------------------------------------- civic

/** Hedge with a gap in the middle of each camera-facing lot edge (the park entrances). */
function paintHedges(iso: IsoFrame, lot: Box) {
  const e = 0.07;
  const span = (a0: number, a1: number): [number, number][] => [
    [a0 + e, a0 + (a1 - a0) * 0.42],
    [a0 + (a1 - a0) * 0.58, a1 - e],
  ];
  for (const [s0, s1] of span(lot.u0, lot.u1)) {
    iso.wall('sw', lot.v1 - e, s0, s1, 0, 3.5, '#3f8f2c');
    iso.floor(s0, s1, lot.v1 - e - 0.03, lot.v1 - e, 3.5, '#5cb53c');
  }
  for (const [s0, s1] of span(lot.v0, lot.v1)) {
    iso.wall('se', lot.u1 - e, s0, s1, 0, 3.5, '#2f7322');
    iso.floor(lot.u1 - e - 0.03, lot.u1 - e, s0, s1, 3.5, '#5cb53c');
  }
}

function paintPark(iso: IsoFrame, o: Orient, rng: Rng, variant: number) {
  const lot: Box = { u0: 0, u1: o.vw, v0: 0, v1: o.vh };
  // Paved edge, then a clipped hedge, so the park reads as a park against plain grass.
  iso.floor(0.02, 0.98, 0.02, 0.98, 0, '#d8d0bd');
  iso.floor(0.07, 0.93, 0.07, 0.93, 0, '#7bd552');
  iso.floor(0.44, 0.56, 0.04, 0.96, 0.1, '#e2d6b8');
  iso.floor(0.04, 0.96, 0.44, 0.56, 0.1, '#e2d6b8');
  const ctx = iso.ctx;
  // Flower bed in the local front-left corner.
  const flowers = ['#f2d33c', '#f3f1e8', '#e8576a'];
  for (let k = 0; k < 10; k++) {
    const [fu, fv] = o.point(0.12 + rng() * 0.25, 0.68 + rng() * 0.25);
    const [fx, fy] = iso.p(fu, fv, 0);
    ctx.fillStyle = flowers[(k + variant) % flowers.length];
    ctx.fillRect(Math.round(fx), Math.round(fy) - 1, 2, 2);
  }
  // Everything that stands up, drawn back to front.
  const items: { depth: number; draw: () => void }[] = [];
  const [cx, cy] = iso.p(0.5, 0.5, 0);
  items.push({
    depth: 1,
    draw: () => {
      ctx.fillStyle = '#b9b4a8';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 9, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5aa8e0';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 0.5, 7, 3.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d6f1ff';
      ctx.fillRect(cx - 0.75, cy - 7, 1.5, 6);
      ctx.beginPath();
      ctx.ellipse(cx, cy - 7, 2.5, 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
    },
  });
  for (const bench of [
    { u0: 0.2, u1: 0.34, v0: 0.6, v1: 0.66 },
    { u0: 0.62, u1: 0.76, v0: 0.6, v1: 0.66 },
  ]) {
    const r = o.rect(bench);
    items.push({ depth: r.u0 + r.v0, draw: () => iso.box(r.u0, r.u1, r.v0, r.v1, 0, 2.5, '#8a5a34', '#6b4426', '#a8744a') });
  }
  [
    [0.22, 0.2],
    [0.78, 0.22],
    [0.8, 0.78],
  ].forEach(([u, v], k) => {
    const [tu, tv] = o.point(u, v);
    const [tx, ty] = iso.p(tu, tv, 0);
    items.push({ depth: tu + tv, draw: () => paintPine(ctx, Math.round(tx), Math.round(ty), 0.8, variant + k) });
  });
  items.sort((a, b) => a.depth - b.depth);
  for (const it of items) it.draw();
  paintHedges(iso, lot);
}

function paintTownHall(iso: IsoFrame, o: Orient, variant: number) {
  const stone = ['#efe7d6', '#e6e2da', '#f1e4d2'][variant % 3];
  const dark = shade(stone, -0.22);
  // Plaza.
  iso.floor(0.03, 1.97, 0.03, 1.97, 0, '#c9c3b5');
  iso.floor(0.08, 1.92, 0.08, 1.92, 0, '#ddd6c6');
  for (let a = 0.2; a < 1.9; a += 0.25) iso.floor(a, a + 0.01, 0.1, 1.9, 0.1, 'rgba(0,0,0,0.06)');
  const b = o.rect({ u0: 0.25, u1: 1.75, v0: 0.25, v1: 1.35 });
  const H = 26;
  const front = o.faceOf('front');

  const [fu, fv] = o.point(1.85, 1.85);
  const flagInFront = fu >= b.u1 || fv >= b.v1;
  const flag = () => {
    const [fx, fy] = iso.p(fu, fv, 0);
    iso.ctx.fillStyle = '#6b7079';
    iso.ctx.fillRect(fx, fy - 30, 1.2, 30);
    iso.ctx.fillStyle = INK.grassDark;
    iso.ctx.fillRect(fx + 1.2, fy - 30, 8, 5);
  };
  if (!flagInFront) flag();

  iso.box(b.u0, b.u1, b.v0, b.v1, 0, H, stone, dark, shade(stone, -0.08));
  // Windows on the camera-facing sides that aren't the portico front.
  for (const face of ['sw', 'se'] as const) {
    if (face === front) continue;
    const f = faceRef(face, b);
    const n = Math.max(3, Math.round((f.a1 - f.a0) * 3.5));
    const step = (f.a1 - f.a0) / n;
    for (let k = 0; k < n; k++) glazing(iso, f, f.a0 + k * step + step * 0.25, f.a0 + k * step + step * 0.75, 8, 18, false);
  }
  if (front) {
    const f = faceRef(front, b);
    const mid = (f.a0 + f.a1) / 2;
    for (let k = 0; k < 3; k++) boxOut(iso, f, f.a0 + 0.35, f.a1 - 0.35, 0, 0.08 + k * 0.05, 0, 3 - k, shade(stone, 0.05), dark, shade(stone, 0.1));
    const cols = 6;
    for (let k = 0; k < cols; k++) {
      const a = f.a0 + 0.4 + k * ((f.a1 - f.a0 - 0.8) / (cols - 1));
      wallOn(iso, f, a - 0.025, a + 0.025, 3, H - 6, '#fbf8f1', 0.12);
      wallOn(iso, f, a + 0.01, a + 0.025, 3, H - 6, 'rgba(0,0,0,0.12)', 0.12);
    }
    boxOut(iso, f, f.a0 + 0.3, f.a1 - 0.3, 0, 0.16, H - 6, H - 2, shade(stone, 0.05), dark, stone);
    iso.poly([pOn(iso, f, f.a0 + 0.3, 0.16, H - 2), pOn(iso, f, f.a1 - 0.3, 0.16, H - 2), pOn(iso, f, mid, 0.16, H + 7)], shade(stone, 0.06));
  }
  // Dome with clock.
  const [dx, dy] = iso.p((b.u0 + b.u1) / 2, (b.v0 + b.v1) / 2, H);
  const ctx = iso.ctx;
  ctx.fillStyle = dark;
  ctx.fillRect(dx - 11, dy - 10, 22, 10);
  ctx.fillStyle = stone;
  ctx.fillRect(dx - 11, dy - 10, 11, 10);
  ctx.fillStyle = '#4f8a7a';
  ctx.beginPath();
  ctx.ellipse(dx, dy - 10, 11, 12, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6fb39f';
  ctx.beginPath();
  ctx.ellipse(dx - 3, dy - 15, 4, 5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c9a447';
  ctx.fillRect(dx - 0.75, dy - 28, 1.5, 7);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(dx - 4, dy - 5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(dx - 4, dy - 5);
  ctx.lineTo(dx - 4, dy - 7);
  ctx.moveTo(dx - 4, dy - 5);
  ctx.lineTo(dx - 2.6, dy - 5);
  ctx.stroke();
  if (flagInFront) flag();
}
