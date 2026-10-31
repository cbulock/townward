import { HALF_H, HALF_W } from '../../shared/constants';
import { mulberry32 } from '../../shared/rng';
import { BUILDINGS, type BuildingId } from '../../sim/buildings/catalog';
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
 * into walls, windows, roof and extras.
 */

export const BUILDING_VARIANTS = 3;

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

// ---------------------------------------------------------------- painter

export function paintBuilding(ctx: CanvasRenderingContext2D, id: BuildingId, variant: number) {
  const { w, h } = BUILDINGS[id].size;
  const iso = new IsoFrame(ctx, GROUND_PAD + h * HALF_W, GROUND_PAD + buildingHeadroom(id));
  const rng = mulberry32(8000 + variant * 101 + id.length * 7 + id.charCodeAt(0));
  if (id === 'park') return paintPark(iso, rng, variant);
  if (id === 'town_hall') return paintTownHall(iso, rng, variant);

  const art = ART[id];
  const v = variant % BUILDING_VARIANTS;
  const b = art.body ?? { u0: art.inset, u1: w - art.inset, v0: art.inset, v1: h - art.inset };
  const H = art.floors * art.floorH;
  const wall = art.walls[v];
  const lit = wall;
  const dark = shade(wall, -0.22);
  const roofColor = art.roofColors[v];

  paintGround(iso, art.ground, w, h, b);

  // Soft contact shadow on the ground to the lower right.
  iso.poly(
    [iso.p(b.u1, b.v0 + 0.05), iso.p(b.u1 + 0.18, b.v0 + 0.2), iso.p(b.u1 + 0.18, b.v1 + 0.18), iso.p(b.u0 + 0.15, b.v1 + 0.18), iso.p(b.u0, b.v1)],
    'rgba(20, 50, 20, 0.22)',
  );

  if (art.extras.includes('parking')) paintParking(iso, rng, w, h, b);
  if (art.extras.includes('fence')) paintFence(iso, w, h);
  if (art.extras.includes('smokestack')) paintSmokestack(iso, b, H, v);

  // Walls.
  iso.wall('sw', b.v1, b.u0, b.u1, 0, H, lit);
  iso.wall('se', b.u1, b.v0, b.v1, 0, H, dark);
  // Base plinth.
  iso.wall('sw', b.v1, b.u0, b.u1, 0, 2, shade(wall, -0.35));
  iso.wall('se', b.u1, b.v0, b.v1, 0, 2, shade(wall, -0.45));

  paintFacade(iso, art, b, H, v, rng);
  paintRoof(iso, art, b, H, roofColor, wall, rng, v);
  paintExtras(iso, art, b, H, v, rng);
}

function paintGround(iso: IsoFrame, ground: Ground, w: number, h: number, b: { u0: number; u1: number; v0: number; v1: number }) {
  if (ground === 'garden') {
    iso.floor(0.04, w - 0.04, 0.04, h - 0.04, 0, '#6cc444');
    iso.floor(b.u0 + (b.u1 - b.u0) * 0.35, b.u0 + (b.u1 - b.u0) * 0.65, b.v1, h - 0.02, 0, '#d9cfb8'); // path to door
  } else {
    iso.floor(0.03, w - 0.03, 0.03, h - 0.03, 0, '#b9b6ae');
    iso.floor(0.06, w - 0.06, 0.06, h - 0.06, 0, ground === 'parking' ? '#6f737a' : '#cfccc3');
  }
}

function paintParking(iso: IsoFrame, rng: Rng, w: number, h: number, b: { u0: number; u1: number; v1: number }) {
  const CAR_COLORS = ['#d64545', '#3d7dd8', '#f0c43a', '#ececec', '#3a3f47', '#4bb36b'];
  for (let k = 0; k < 7; k++) {
    const u = b.u0 + 0.12 + k * ((b.u1 - b.u0 - 0.2) / 7);
    iso.wall('sw', h - 0.18, u, u + 0.012, 0, 0.6, 'rgba(255,255,255,0.8)');
    iso.floor(u, u + 0.012, b.v1 + 0.12, h - 0.15, 0.1, 'rgba(255,255,255,0.75)');
    if (rng() < 0.65) {
      const c = CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
      const cu = u + 0.05;
      const cv = b.v1 + 0.25 + rng() * 0.2;
      iso.box(cu, cu + 0.13, cv, cv + 0.32, 0, 3, c, shade(c, -0.3), shade(c, 0.15));
      iso.floor(cu + 0.02, cu + 0.11, cv + 0.08, cv + 0.2, 4.5, 'rgba(40, 60, 80, 0.85)');
    }
  }
  void w;
}

function paintFence(iso: IsoFrame, w: number, h: number) {
  for (let a = 0.06; a < w - 0.04; a += 0.09) iso.wall('sw', h - 0.04, a, a + 0.03, 0, 4, '#fbf7ee');
  iso.wall('sw', h - 0.04, 0.06, w - 0.06, 2.5, 3.3, '#fbf7ee');
  for (let a = 0.06; a < h - 0.04; a += 0.09) iso.wall('se', w - 0.04, a, a + 0.03, 0, 4, '#e3ddcf');
  iso.wall('se', w - 0.04, 0.06, h - 0.06, 2.5, 3.3, '#e3ddcf');
}

function glazing(iso: IsoFrame, face: Face, at: number, a0: number, a1: number, z0: number, z1: number, lit: boolean) {
  iso.wall(face, at, a0, a1, z0, z1, lit ? GLASS_LIT : face === 'sw' ? GLASS : shade(GLASS, -0.25));
  iso.wall(face, at, a0, a1, z1 - 0.8, z1, FRAME);
}

function paintFacade(iso: IsoFrame, art: BuildingArt, b: { u0: number; u1: number; v0: number; v1: number }, H: number, v: number, rng: Rng) {
  const fh = art.floorH;
  const faces: [Face, number, number, number][] = [
    ['sw', b.v1, b.u0, b.u1],
    ['se', b.u1, b.v0, b.v1],
  ];
  for (const [face, at, a0, a1] of faces) {
    const len = a1 - a0;
    const cols = Math.max(2, Math.round(len * (art.facade === 'brick' ? 4 : 3.4)));
    const step = len / cols;

    if (art.facade === 'curtain') {
      iso.wall(face, at, a0 + 0.01, a1 - 0.01, 2, H, face === 'sw' ? shade(art.walls[v], -0.05) : shade(art.walls[v], -0.3));
      for (let f = 1; f < art.floors; f++) iso.wall(face, at, a0, a1, f * fh, f * fh + 0.7, 'rgba(255,255,255,0.28)');
      for (let c = 1; c < cols; c++) iso.wall(face, at, a0 + c * step, a0 + c * step + 0.012, 2, H, 'rgba(20,40,60,0.35)');
      // Diagonal reflection streak.
      if (face === 'sw') iso.poly([iso.p(a0 + len * 0.15, at, H * 0.9), iso.p(a0 + len * 0.3, at, H * 0.9), iso.p(a0 + len * 0.55, at, H * 0.25), iso.p(a0 + len * 0.4, at, H * 0.25)], 'rgba(255,255,255,0.14)');
      for (let k = 0; k < art.floors; k++) {
        if (rng() < 0.25) {
          const c = Math.floor(rng() * cols);
          iso.wall(face, at, a0 + c * step + 0.02, a0 + (c + 1) * step - 0.02, k * fh + 1.5, (k + 1) * fh - 1, 'rgba(255, 228, 150, 0.55)');
        }
      }
      continue;
    }

    if (art.facade === 'bands') {
      for (let f = 0; f < art.floors; f++) {
        iso.wall(face, at, a0 + 0.03, a1 - 0.03, f * fh + 2, f * fh + fh - 1.5, face === 'sw' ? '#3f5f7d' : '#2e475e');
        for (let c = 1; c < cols; c++) iso.wall(face, at, a0 + c * step, a0 + c * step + 0.012, f * fh + 2, f * fh + fh - 1.5, 'rgba(230,236,242,0.5)');
        if (rng() < 0.3) {
          const c = Math.floor(rng() * cols);
          iso.wall(face, at, a0 + c * step + 0.02, a0 + (c + 1) * step - 0.02, f * fh + 2.5, f * fh + fh - 2, 'rgba(255, 228, 150, 0.7)');
        }
      }
      continue;
    }

    if (art.facade === 'industrial') {
      for (let c = 0; c < cols; c++) {
        const s0 = a0 + c * step + step * 0.25;
        glazing(iso, face, at, s0, s0 + step * 0.5, H - 6, H - 2.5, false);
      }
      continue;
    }

    if (art.facade === 'townhouse' && face === 'sw') {
      const units = 3;
      const uw = len / units;
      const doorColors = ['#c0392b', '#2e6fb5', '#2f8f4e', '#e0a12d'];
      for (let k = 0; k < units; k++) {
        const s0 = a0 + k * uw;
        iso.wall('sw', at, s0, s0 + uw, 2, H, shade(art.walls[(v + k) % 3], 0.05 * k));
        iso.wall('sw', at, s0 + uw - 0.01, s0 + uw, 2, H, 'rgba(0,0,0,0.25)');
        iso.wall('sw', at, s0 + uw * 0.15, s0 + uw * 0.45, 2, 9, doorColors[(k + v) % doorColors.length]);
        glazing(iso, 'sw', at, s0 + uw * 0.55, s0 + uw * 0.85, 4, 8, false);
        for (let f = 1; f < art.floors; f++) {
          glazing(iso, 'sw', at, s0 + uw * 0.18, s0 + uw * 0.45, f * fh + 2, f * fh + fh - 2, rng() < 0.2);
          glazing(iso, 'sw', at, s0 + uw * 0.55, s0 + uw * 0.82, f * fh + 2, f * fh + fh - 2, rng() < 0.2);
        }
        iso.wall('sw', at, s0, s0 + uw, H - 1.5, H, shade(art.walls[(v + k) % 3], -0.3));
      }
      continue;
    }

    if (art.facade === 'brick') {
      for (let f = 0; f < art.floors; f++) iso.wall(face, at, a0, a1, f * fh, f * fh + 0.6, 'rgba(0,0,0,0.12)');
    }

    const shop = art.facade === 'shopfront';
    for (let f = 0; f < art.floors; f++) {
      const z0 = f * fh;
      if (shop && f === 0) {
        // Big shop window plus a door on the street-facing wall.
        if (face === 'sw') {
          glazing(iso, face, at, a0 + 0.06, a1 - len * 0.32, 2, fh - 2.5, false);
          iso.wall(face, at, a1 - len * 0.26, a1 - len * 0.1, 2, fh - 2.5, '#5b3a26');
        } else {
          glazing(iso, face, at, a0 + 0.08, a1 - 0.08, 2, fh - 2.5, false);
        }
        continue;
      }
      if (!shop && f === 0 && face === 'sw' && art.floors <= 4) {
        // Front door on the ground floor.
        const mid = a0 + len * 0.5;
        iso.wall(face, at, mid - 0.07, mid + 0.07, 1.5, Math.min(fh - 1, 9), '#6b4428');
        for (let c = 0; c < cols; c++) {
          const s0 = a0 + c * step + step * 0.22;
          if (Math.abs(s0 + step * 0.28 - mid) < step * 0.6) continue;
          glazing(iso, face, at, s0, s0 + step * 0.56, z0 + 3, z0 + fh - 2.5, rng() < 0.15);
        }
        continue;
      }
      for (let c = 0; c < cols; c++) {
        const s0 = a0 + c * step + step * 0.22;
        glazing(iso, face, at, s0, s0 + step * 0.56, z0 + 2.5, z0 + fh - 2, rng() < 0.18);
      }
    }
  }
}

function paintRoof(
  iso: IsoFrame,
  art: BuildingArt,
  b: { u0: number; u1: number; v0: number; v1: number },
  H: number,
  roofColor: string,
  wall: string,
  rng: Rng,
  v: number,
) {
  const { u0, u1, v0, v1 } = b;
  const rh = art.roofH ?? 0;
  const o = 0.06; // eave overhang
  if (art.roof === 'flat') {
    iso.floor(u0, u1, v0, v1, H, shade(wall, -0.1));
    iso.floor(u0 + 0.04, u1 - 0.04, v0 + 0.04, v1 - 0.04, H, roofColor);
    // Parapet lip.
    iso.wall('sw', v1, u0, u1, H, H + 1.5, shade(wall, 0.1));
    iso.wall('se', u1, v0, v1, H, H + 1.5, shade(wall, -0.15));
    return;
  }
  if (art.roof === 'gable') {
    const vm = (v0 + v1) / 2;
    const back = shade(roofColor, -0.25);
    iso.poly([iso.p(u0 - o, v0 - o, H), iso.p(u1 + o, v0 - o, H), iso.p(u1 + o, vm, H + rh), iso.p(u0 - o, vm, H + rh)], back);
    // Gable end (triangle of wall on the SE side).
    iso.poly([iso.p(u1, v0, H), iso.p(u1, v1, H), iso.p(u1, vm, H + rh)], shade(wall, -0.22));
    iso.poly([iso.p(u0 - o, v1 + o, H - 1), iso.p(u1 + o, v1 + o, H - 1), iso.p(u1 + o, vm, H + rh), iso.p(u0 - o, vm, H + rh)], roofColor);
    // Shingle lines.
    for (let t = 0.25; t < 1; t += 0.25) {
      const vv = v1 + o - (v1 + o - vm) * t;
      iso.poly([iso.p(u0 - o, vv, H - 1 + (rh + 1) * t), iso.p(u1 + o, vv, H - 1 + (rh + 1) * t), iso.p(u1 + o, vv, H + (rh + 1) * t), iso.p(u0 - o, vv, H + (rh + 1) * t)], shade(roofColor, -0.15));
    }
    iso.poly([iso.p(u0 - o, vm, H + rh), iso.p(u1 + o, vm, H + rh), iso.p(u1 + o, vm, H + rh + 1), iso.p(u0 - o, vm, H + rh + 1)], shade(roofColor, 0.25));
    return;
  }
  if (art.roof === 'hip') {
    const vm = (v0 + v1) / 2;
    const d = (v1 - v0) / 2;
    const r0 = u0 + d;
    const r1 = u1 - d;
    iso.poly([iso.p(u0 - o, v0 - o, H), iso.p(u1 + o, v0 - o, H), iso.p(r1, vm, H + rh), iso.p(r0, vm, H + rh)], shade(roofColor, -0.25));
    iso.poly([iso.p(u1 + o, v0 - o, H), iso.p(u1 + o, v1 + o, H), iso.p(r1, vm, H + rh)], shade(roofColor, -0.18));
    iso.poly([iso.p(u0 - o, v1 + o, H), iso.p(u1 + o, v1 + o, H), iso.p(r1, vm, H + rh), iso.p(r0, vm, H + rh)], roofColor);
    iso.poly([iso.p(r0, vm, H + rh), iso.p(r1, vm, H + rh), iso.p(r1, vm, H + rh + 1), iso.p(r0, vm, H + rh + 1)], shade(roofColor, 0.25));
    return;
  }
  // Sawtooth: teeth along u, each with a sloped roof and a glazed vertical face.
  const teeth = Math.max(2, Math.round((u1 - u0) * 3));
  const tw = (u1 - u0) / teeth;
  iso.floor(u0, u1, v0, v1, H, shade(roofColor, -0.2));
  for (let k = 0; k < teeth; k++) {
    const a = u0 + k * tw;
    const c = a + tw;
    iso.poly([iso.p(a, v0, H), iso.p(c, v0, H + rh), iso.p(c, v1, H + rh), iso.p(a, v1, H)], roofColor);
    iso.poly([iso.p(c, v0, H), iso.p(c, v0, H + rh), iso.p(c, v1, H + rh), iso.p(c, v1, H)], k === teeth - 1 ? shade(wall, -0.22) : '#7fa4c2');
    iso.poly([iso.p(a, v1, H), iso.p(c, v1, H), iso.p(c, v1, H + rh)], shade(wall, 0.02));
  }
  void rng;
  void v;
}

function paintSmokestack(iso: IsoFrame, b: { u0: number; u1: number; v0: number }, H: number, v: number) {
  const su = b.u1 - 0.35;
  const sv = b.v0 + 0.25;
  const top = H + 30;
  const [cx, cyBase] = iso.p(su, sv, 0);
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

function paintExtras(iso: IsoFrame, art: BuildingArt, b: { u0: number; u1: number; v0: number; v1: number }, H: number, v: number, rng: Rng) {
  const { u0, u1, v0, v1 } = b;
  const fh = art.floorH;
  const ex = new Set(art.extras);

  if (ex.has('chimney')) {
    const cu = u0 + (u1 - u0) * 0.72;
    const cv = v0 + (v1 - v0) * 0.3;
    const top = H + (art.roofH ?? 0) + 4;
    iso.box(cu, cu + 0.1, cv, cv + 0.1, H - 2, top, '#9b4b3c', '#7a3a2f', '#5a2c24');
  }
  if (ex.has('porch')) {
    const mid = (u0 + u1) / 2;
    iso.floor(mid - 0.2, mid + 0.2, v1, v1 + 0.14, 1.5, '#cdbfa6');
    iso.box(mid - 0.2, mid + 0.2, v1, v1 + 0.14, 8.5, 9.5, '#efe6d6', '#cfc4b0', '#a7493a');
    for (const a of [mid - 0.19, mid + 0.17]) iso.wall('sw', v1 + 0.13, a, a + 0.02, 1.5, 8.5, '#f6f1e6');
  }
  if (ex.has('awning')) {
    const colors = ['#d94a3d', '#2e8a5a', '#2d6fc4'];
    const c = colors[v % colors.length];
    const z = fh - 1.5;
    const stripes = 8;
    const len = u1 - u0;
    for (let k = 0; k < stripes; k++) {
      const a = u0 + (len / stripes) * k;
      const a2 = a + len / stripes;
      iso.poly([iso.p(a, v1, z), iso.p(a2, v1, z), iso.p(a2, v1 + 0.16, z - 4), iso.p(a, v1 + 0.16, z - 4)], k % 2 ? '#f8f4ec' : c);
    }
    iso.wall('sw', v1 + 0.16, u0, u1, z - 5.5, z - 4, shade(c, -0.2));
  }
  if (art.sign && art.facade === 'shopfront') {
    const sc = art.signColors?.[v] ?? '#333';
    const z = art.floors === 1 ? fh + 1 : fh + 1.5;
    if (art.floors === 1) {
      // Sign board on top of the parapet.
      iso.wall('sw', v1 - 0.02, u0 + 0.1, u1 - 0.1, H, H + 7, sc);
      iso.text('sw', v1 - 0.02, (u0 + u1) / 2, H + 3.6, art.sign, 5.5, '#ffffff');
    } else {
      iso.wall('sw', v1, u0 + 0.06, u1 - 0.06, z, z + 5, sc);
      iso.text('sw', v1, (u0 + u1) / 2, z + 2.6, art.sign, 4.5, '#ffffff');
    }
  }
  if (ex.has('tables')) {
    for (const [tu, tv] of [
      [u0 + 0.12, v1 + 0.2],
      [u0 + 0.42, v1 + 0.24],
    ] as const) {
      iso.box(tu, tu + 0.04, tv, tv + 0.04, 0, 5, '#7a7f86', '#5c6168', '#7a7f86');
      const [x, y] = iso.p(tu + 0.02, tv + 0.02, 7);
      const ctx = iso.ctx;
      ctx.fillStyle = v === 0 ? '#e9554a' : '#f2c84b';
      ctx.beginPath();
      ctx.ellipse(x, y, 6, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.ellipse(x, y + 1, 6, 1.5, 0, 0, Math.PI);
      ctx.fill();
    }
  }
  if (ex.has('balconies')) {
    const len = u1 - u0;
    const cols = Math.max(2, Math.round(len * 3.4));
    const step = len / cols;
    for (let f = 1; f < art.floors; f++) {
      for (let c = 0; c < cols; c += 2) {
        const a = u0 + c * step + step * 0.12;
        const z = f * fh + 0.5;
        iso.floor(a, a + step * 0.76, v1, v1 + 0.08, z, '#d8d4cc');
        iso.wall('sw', v1 + 0.08, a, a + step * 0.76, z, z + 3, 'rgba(70, 76, 84, 0.75)');
      }
    }
  }
  if (ex.has('terraces')) {
    for (let f = 3; f < art.floors; f += 3) {
      iso.wall('sw', v1 + 0.06, u0 - 0.02, u1 + 0.02, f * fh, f * fh + 2.5, 'rgba(230, 240, 245, 0.7)');
      iso.wall('se', u1 + 0.06, v0 - 0.02, v1 + 0.02, f * fh, f * fh + 2.5, 'rgba(200, 212, 220, 0.7)');
    }
  }
  if (ex.has('canopy')) {
    const mid = (u0 + u1) / 2;
    iso.floor(mid - 0.3, mid + 0.3, v1, v1 + 0.3, 9, '#2c2f36');
    iso.wall('sw', v1 + 0.3, mid - 0.3, mid + 0.3, 7.5, 9, '#c9a447');
    for (const a of [mid - 0.28, mid + 0.26]) iso.wall('sw', v1 + 0.28, a, a + 0.02, 0, 7.5, '#c9a447');
  }
  if (ex.has('acunits')) {
    for (let k = 0; k < 2; k++) {
      const au = u0 + 0.15 + rng() * Math.max(0.05, u1 - u0 - 0.4);
      const av = v0 + 0.12 + rng() * Math.max(0.05, v1 - v0 - 0.35);
      iso.box(au, au + 0.14, av, av + 0.12, H, H + 3.5, '#c9cdd2', '#a2a7ad', '#e2e5e8');
    }
  }
  if (ex.has('watertank')) {
    const tu = u0 + (u1 - u0) * 0.3;
    const tv = v0 + (v1 - v0) * 0.3;
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
    iso.box(u0 + d, u1 - d, v0 + d, v1 - d, H, H + 5, shade(art.walls[v], -0.15), shade(art.walls[v], -0.4), '#4a535c');
    iso.wall('sw', v1 - d, u0 + d, u1 - d, H + 3.5, H + 5, 'rgba(255, 240, 190, 0.9)');
    iso.wall('se', u1 - d, v0 + d, v1 - d, H + 3.5, H + 5, 'rgba(255, 230, 170, 0.7)');
    const [x, y] = iso.p((u0 + u1) / 2, (v0 + v1) / 2, H + 5);
    iso.ctx.fillStyle = '#5b6169';
    iso.ctx.fillRect(x - 0.5, y - 12, 1.5, 12);
    iso.ctx.fillStyle = '#ff5a4a';
    iso.ctx.fillRect(x - 1, y - 13, 2.5, 2);
  }
  if (art.sign && art.facade !== 'shopfront') {
    // Rooftop sign on a frame (hotel).
    const sc = art.signColors?.[v] ?? '#c33';
    const mid = (u0 + u1) / 2;
    const half = (u1 - u0) * 0.38;
    const vv = v0 + (v1 - v0) * 0.55;
    for (const a of [mid - half + 0.05, mid + half - 0.07]) iso.wall('sw', vv, a, a + 0.02, H, H + 4, '#4a4f56');
    iso.wall('sw', vv, mid - half, mid + half, H + 4, H + 12, sc);
    iso.wall('sw', vv, mid - half, mid + half, H + 11.2, H + 12, 'rgba(255,255,255,0.5)');
    iso.text('sw', vv, mid, H + 8, art.sign, 6.5, '#fff7d6');
  }
  if (ex.has('loadingdock')) {
    const doors = Math.max(2, Math.round((v1 - v0) * 2));
    const step = (v1 - v0) / doors;
    for (let k = 0; k < doors; k++) {
      const a = v0 + k * step + step * 0.18;
      iso.wall('se', u1, a, a + step * 0.64, 0, 9, '#4f555c');
      for (let z = 1.5; z < 9; z += 2) iso.wall('se', u1, a, a + step * 0.64, z, z + 0.6, 'rgba(255,255,255,0.18)');
    }
    iso.floor(u1, u1 + 0.18, v0, v1, 0.5, 'rgba(242, 196, 58, 0.55)');
  }
  if (ex.has('garagedoor')) {
    const mid = (u0 + u1) / 2;
    iso.wall('sw', v1, mid - 0.22, mid + 0.22, 0, 9, '#5d636b');
    for (let z = 1.5; z < 9; z += 1.8) iso.wall('sw', v1, mid - 0.22, mid + 0.22, z, z + 0.5, 'rgba(255,255,255,0.18)');
  }
  if (ex.has('crates')) {
    const colors = ['#a87a45', '#7a8a4a', '#3d6e9e'];
    for (let k = 0; k < 3; k++) {
      const cu = u1 + 0.05 + (k % 2) * 0.12;
      const cv = v1 - 0.35 + k * 0.12;
      const c = colors[(k + v) % colors.length];
      iso.box(cu, cu + 0.1, cv, cv + 0.1, 0, 3.5, c, shade(c, -0.3), shade(c, 0.15));
    }
  }
}

// ---------------------------------------------------------------- civic

function paintPark(iso: IsoFrame, rng: Rng, variant: number) {
  // Paved edge, then a clipped hedge, so the park reads as a park against plain grass.
  iso.floor(0.02, 0.98, 0.02, 0.98, 0, '#d8d0bd');
  iso.floor(0.07, 0.93, 0.07, 0.93, 0, '#7bd552');
  iso.wall('sw', 0.93, 0.07, 0.42, 0, 3.5, '#3f8f2c');
  iso.wall('sw', 0.93, 0.58, 0.93, 0, 3.5, '#3f8f2c');
  iso.wall('se', 0.93, 0.07, 0.42, 0, 3.5, '#2f7322');
  iso.wall('se', 0.93, 0.58, 0.93, 0, 3.5, '#2f7322');
  iso.floor(0.07, 0.42, 0.9, 0.93, 3.5, '#5cb53c');
  iso.floor(0.58, 0.93, 0.9, 0.93, 3.5, '#5cb53c');
  iso.floor(0.9, 0.93, 0.07, 0.42, 3.5, '#5cb53c');
  iso.floor(0.9, 0.93, 0.58, 0.93, 3.5, '#5cb53c');
  // Crossing paths.
  iso.floor(0.44, 0.56, 0.04, 0.96, 0.1, '#e2d6b8');
  iso.floor(0.04, 0.96, 0.44, 0.56, 0.1, '#e2d6b8');
  // Fountain in the middle.
  const [x, y] = iso.p(0.5, 0.5, 0);
  const ctx = iso.ctx;
  ctx.fillStyle = '#b9b4a8';
  ctx.beginPath();
  ctx.ellipse(x, y, 9, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5aa8e0';
  ctx.beginPath();
  ctx.ellipse(x, y - 0.5, 7, 3.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d6f1ff';
  ctx.fillRect(x - 0.75, y - 7, 1.5, 6);
  ctx.beginPath();
  ctx.ellipse(x, y - 7, 2.5, 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Benches.
  iso.box(0.2, 0.34, 0.6, 0.66, 0, 2.5, '#8a5a34', '#6b4426', '#a8744a');
  iso.box(0.62, 0.76, 0.6, 0.66, 0, 2.5, '#8a5a34', '#6b4426', '#a8744a');
  // Flower beds.
  const flowers = ['#f2d33c', '#f3f1e8', '#e8576a'];
  for (let k = 0; k < 10; k++) {
    const [fx, fy] = iso.p(0.12 + rng() * 0.25, 0.68 + rng() * 0.25, 0);
    ctx.fillStyle = flowers[(k + variant) % flowers.length];
    ctx.fillRect(Math.round(fx), Math.round(fy) - 1, 2, 2);
  }
  // Trees in the back corners.
  for (const [u, v] of [
    [0.22, 0.2],
    [0.78, 0.22],
    [0.8, 0.78],
  ] as const) {
    const [tx, ty] = iso.p(u, v, 0);
    paintPine(ctx, Math.round(tx), Math.round(ty), 0.8, variant + Math.floor(u * 3));
  }
}

function paintTownHall(iso: IsoFrame, rng: Rng, variant: number) {
  const stone = ['#efe7d6', '#e6e2da', '#f1e4d2'][variant % 3];
  const dark = shade(stone, -0.22);
  // Plaza.
  iso.floor(0.03, 1.97, 0.03, 1.97, 0, '#c9c3b5');
  iso.floor(0.08, 1.92, 0.08, 1.92, 0, '#ddd6c6');
  for (let a = 0.2; a < 1.9; a += 0.25) iso.floor(a, a + 0.01, 0.1, 1.9, 0.1, 'rgba(0,0,0,0.06)');
  // Main hall.
  const u0 = 0.25, u1 = 1.75, v0 = 0.25, v1 = 1.35;
  const H = 26;
  iso.box(u0, u1, v0, v1, 0, H, stone, dark, shade(stone, -0.08));
  // Steps.
  for (let k = 0; k < 3; k++) iso.box(u0 + 0.35, u1 - 0.35, v1, v1 + 0.08 + k * 0.05, 0, 3 - k, shade(stone, 0.05), dark, shade(stone, 0.1));
  // Columns and portico on the front.
  const cols = 6;
  for (let k = 0; k < cols; k++) {
    const a = u0 + 0.4 + k * ((u1 - u0 - 0.8) / (cols - 1));
    iso.wall('sw', v1 + 0.12, a - 0.025, a + 0.025, 3, H - 6, '#fbf8f1');
    iso.wall('sw', v1 + 0.12, a + 0.01, a + 0.025, 3, H - 6, 'rgba(0,0,0,0.12)');
  }
  iso.box(u0 + 0.3, u1 - 0.3, v1, v1 + 0.16, H - 6, H - 2, shade(stone, 0.05), dark, stone);
  // Pediment.
  const mid = (u0 + u1) / 2;
  iso.poly([iso.p(u0 + 0.3, v1 + 0.16, H - 2), iso.p(u1 - 0.3, v1 + 0.16, H - 2), iso.p(mid, v1 + 0.16, H + 7)], shade(stone, 0.06));
  // Side windows.
  for (let k = 0; k < 4; k++) {
    const a = v0 + 0.15 + k * 0.25;
    iso.wall('se', u1, a, a + 0.12, 8, 18, GLASS);
  }
  // Dome with clock.
  const [dx, dy] = iso.p(mid, (v0 + v1) / 2, H);
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
  // Flag.
  const [fx, fy] = iso.p(1.85, 1.85, 0);
  ctx.fillStyle = '#6b7079';
  ctx.fillRect(fx, fy - 30, 1.2, 30);
  ctx.fillStyle = INK.grassDark;
  ctx.fillRect(fx + 1.2, fy - 30, 8, 5);
  void rng;
}
