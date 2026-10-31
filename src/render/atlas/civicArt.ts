import { HALF_W } from '../../shared/constants';
import type { CustomArtId } from './buildingRecipes';
import {
  boxOut,
  faceRef,
  IsoFrame,
  paintRoundTree,
  pOn,
  shade,
  wallOn,
  type Box,
  type FaceRef,
  type Orient,
  type Rng,
} from './isoPaint';
import { INK } from './palette';
import { paintPine } from './treeArt';

/**
 * Buildings with their own painters (docs/specs/city-art.md): parks, the town hall and the
 * two utilities. Everything is laid out in local space (front at +v) and mapped through
 * `Orient`, and standing items are drawn back to front by view depth.
 */

export interface CivicArt {
  variants: number;
  headroom: (variant: number) => number;
  paint: (iso: IsoFrame, o: Orient, rng: Rng, variant: number) => void;
}

/** Something standing on the lot, drawn in depth order (u + v of its base, view space). */
interface Item {
  depth: number;
  draw: () => void;
}

function drawItems(items: Item[]) {
  items.sort((a, b) => a.depth - b.depth);
  for (const it of items) it.draw();
}

/** A local point mapped to view space, plus its depth. */
function at(o: Orient, u: number, v: number): { u: number; v: number; depth: number } {
  const [vu, vv] = o.point(u, v);
  return { u: vu, v: vv, depth: vu + vv };
}

function glazing(iso: IsoFrame, f: FaceRef, a0: number, a1: number, z0: number, z1: number) {
  wallOn(iso, f, a0, a1, z0, z1, f.face === 'sw' ? '#34506b' : shade('#34506b', -0.25));
  wallOn(iso, f, a0, a1, z1 - 0.8, z1, 'rgba(255, 255, 255, 0.35)');
}

/** Vertical pole from the ground at a view point. */
function pole(iso: IsoFrame, u: number, v: number, z0: number, z1: number, w: number, color: string) {
  const [x, y] = iso.p(u, v, z0);
  iso.ctx.fillStyle = color;
  iso.ctx.fillRect(x - w / 2, y - (z1 - z0), w, z1 - z0);
}

function line(iso: IsoFrame, a: readonly [number, number], b: readonly [number, number], color: string, width: number) {
  const c = iso.ctx;
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(a[0], a[1]);
  c.lineTo(b[0], b[1]);
  c.stroke();
}

// ---------------------------------------------------------------- parks

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

function lawn(iso: IsoFrame) {
  iso.floor(0.02, 0.98, 0.02, 0.98, 0, '#d8d0bd');
  iso.floor(0.07, 0.93, 0.07, 0.93, 0, '#7bd552');
  for (let a = 0.12; a < 0.9; a += 0.16) iso.floor(a, a + 0.08, 0.07, 0.93, 0, 'rgba(255,255,255,0.05)');
}

function bench(iso: IsoFrame, o: Orient, u: number, v: number, alongU: boolean): Item {
  const r = o.rect(alongU ? { u0: u, u1: u + 0.14, v0: v, v1: v + 0.05 } : { u0: u, u1: u + 0.05, v0: v, v1: v + 0.14 });
  return { depth: r.u0 + r.v0, draw: () => iso.box(r.u0, r.u1, r.v0, r.v1, 0, 2.5, '#8a5a34', '#6b4426', '#a8744a') };
}

function roundTree(iso: IsoFrame, o: Orient, u: number, v: number, size: number, tone: number): Item {
  const p = at(o, u, v);
  return {
    depth: p.depth,
    draw: () => {
      const [x, y] = iso.p(p.u, p.v, 0);
      paintRoundTree(iso.ctx, x, y, size, tone);
    },
  };
}

function pineTree(iso: IsoFrame, o: Orient, u: number, v: number, size: number, tone: number): Item {
  const p = at(o, u, v);
  return {
    depth: p.depth,
    draw: () => {
      const [x, y] = iso.p(p.u, p.v, 0);
      paintPine(iso.ctx, Math.round(x), Math.round(y), size, tone);
    },
  };
}

/** Flat quad from local corners (u0, v0)–(u1, v1) at height z. */
function localFloor(iso: IsoFrame, o: Orient, b: Box, z: number, fill: string) {
  const r = o.rect(b);
  iso.floor(r.u0, r.u1, r.v0, r.v1, z, fill);
}

function flowerDots(iso: IsoFrame, o: Orient, rng: Rng, b: Box, n: number, colors: readonly string[]) {
  const ctx = iso.ctx;
  for (let k = 0; k < n; k++) {
    const [fu, fv] = o.point(b.u0 + rng() * (b.u1 - b.u0), b.v0 + rng() * (b.v1 - b.v0));
    const [fx, fy] = iso.p(fu, fv, 0);
    ctx.fillStyle = colors[k % colors.length];
    ctx.fillRect(Math.round(fx), Math.round(fy) - 1, 1.6, 1.6);
  }
}

const FLOWERS = ['#f2d33c', '#f3f1e8', '#e8576a', '#c77dde', '#ff9a3c'] as const;

function paintPark(iso: IsoFrame, o: Orient, rng: Rng, variant: number) {
  const lot: Box = { u0: 0, u1: o.vw, v0: 0, v1: o.vh };
  const ctx = iso.ctx;
  lawn(iso);
  const items: Item[] = [];

  switch (variant) {
    case 0: {
      // Fountain plaza with crossing paths.
      iso.floor(0.44, 0.56, 0.04, 0.96, 0.1, '#e2d6b8');
      iso.floor(0.04, 0.96, 0.44, 0.56, 0.1, '#e2d6b8');
      iso.disc(0.5, 0.5, 0.2, 0.1, '#e2d6b8');
      flowerDots(iso, o, rng, { u0: 0.12, u1: 0.37, v0: 0.66, v1: 0.9 }, 12, FLOWERS);
      items.push({
        depth: 1,
        draw: () => {
          iso.round(0.5, 0.5, 0, 2.5, () => 0.15, '#b9b4a8', '#b9b4a8');
          iso.disc(0.5, 0.5, 0.12, 2.5, '#5aa8e0');
          iso.round(0.5, 0.5, 2.5, 7, () => 0.025, '#d0ccc2', '#d0ccc2');
          const [x, y] = iso.p(0.5, 0.5, 7);
          ctx.fillStyle = 'rgba(214, 241, 255, 0.9)';
          ctx.beginPath();
          ctx.ellipse(x, y - 1.5, 3, 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(x - 0.5, y - 5, 1, 4);
        },
      });
      items.push(bench(iso, o, 0.2, 0.62, true), bench(iso, o, 0.64, 0.62, true));
      items.push(pineTree(iso, o, 0.22, 0.2, 0.8, variant), roundTree(iso, o, 0.8, 0.22, 0.75, 1), pineTree(iso, o, 0.8, 0.8, 0.7, 2));
      break;
    }
    case 1: {
      // Playground: safety surface, slide, swings and a sandpit.
      localFloor(iso, o, { u0: 0.14, u1: 0.62, v0: 0.14, v1: 0.6 }, 0.1, '#e07a4c');
      localFloor(iso, o, { u0: 0.62, u1: 0.88, v0: 0.6, v1: 0.86 }, 0.1, '#ead39a');
      localFloor(iso, o, { u0: 0.45, u1: 0.55, v0: 0.6, v1: 0.96 }, 0.1, '#e2d6b8');
      // Slide: tower with a ramp toward local +u.
      const tw = at(o, 0.22, 0.22);
      items.push({
        depth: tw.depth,
        draw: () => {
          const r = o.rect({ u0: 0.18, u1: 0.3, v0: 0.18, v1: 0.3 });
          for (const [u, v] of [
            [r.u0, r.v1],
            [r.u1, r.v1],
            [r.u1, r.v0],
          ] as const)
            pole(iso, u, v, 0, 9, 1, '#3d6fb5');
          iso.floor(r.u0, r.u1, r.v0, r.v1, 9, '#f2c43a');
          iso.box(r.u0, r.u1, r.v0, r.v1, 9, 13, 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)');
          const [a0, b0] = o.point(0.3, 0.2);
          const [a1, b1] = o.point(0.3, 0.28);
          const [a2, b2] = o.point(0.56, 0.28);
          const [a3, b3] = o.point(0.56, 0.2);
          iso.poly([iso.p(a0, b0, 9), iso.p(a1, b1, 9), iso.p(a2, b2, 0.5), iso.p(a3, b3, 0.5)], '#e8483d');
          // Roof.
          const [cx, cy] = iso.p((r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2, 17);
          const [lx, ly] = iso.p(r.u0, r.v1, 13);
          const [rx, ry] = iso.p(r.u1, r.v0, 13);
          const [fx, fy] = iso.p(r.u1, r.v1, 13);
          iso.poly([[cx, cy], [lx, ly], [fx, fy]], '#e8483d');
          iso.poly([[cx, cy], [fx, fy], [rx, ry]], '#b8352f');
        },
      });
      // Swings: an A-frame along local u with two seats.
      const s0 = at(o, 0.36, 0.42);
      items.push({
        depth: s0.depth,
        draw: () => {
          const ends = [o.point(0.36, 0.42), o.point(0.6, 0.42)];
          for (const [u, v] of ends) {
            line(iso, iso.p(u - 0.03, v - 0.03, 0), iso.p(u, v, 12), '#5b6169', 1);
            line(iso, iso.p(u + 0.03, v + 0.03, 0), iso.p(u, v, 12), '#5b6169', 1);
          }
          line(iso, iso.p(ends[0][0], ends[0][1], 12), iso.p(ends[1][0], ends[1][1], 12), '#5b6169', 1.2);
          for (const t of [0.33, 0.66]) {
            const u = ends[0][0] + (ends[1][0] - ends[0][0]) * t;
            const v = ends[0][1] + (ends[1][1] - ends[0][1]) * t;
            line(iso, iso.p(u, v, 12), iso.p(u, v, 3), 'rgba(60,60,60,0.8)', 0.5);
            const [x, y] = iso.p(u, v, 3);
            ctx.fillStyle = t < 0.5 ? '#3aa66a' : '#f2c43a';
            ctx.fillRect(x - 1.5, y - 0.5, 3, 1.2);
          }
        },
      });
      items.push(roundTree(iso, o, 0.82, 0.2, 0.8, 0), roundTree(iso, o, 0.18, 0.82, 0.7, 2), bench(iso, o, 0.66, 0.42, true));
      break;
    }
    case 2: {
      // Duck pond with reeds and lily pads.
      iso.disc(0.5, 0.52, 0.34, 0.1, '#e5d3a0');
      iso.disc(0.5, 0.52, 0.3, 0.15, '#3e8fd0');
      iso.disc(0.47, 0.49, 0.24, 0.2, '#4aa3e2');
      iso.disc(0.42, 0.44, 0.08, 0.25, 'rgba(255,255,255,0.18)');
      for (const [u, v] of [
        [0.6, 0.6],
        [0.56, 0.66],
        [0.38, 0.62],
      ] as const)
        iso.disc(u, v, 0.03, 0.3, '#4f9a3a');
      for (const [u, v] of [
        [0.45, 0.5],
        [0.55, 0.42],
      ] as const) {
        const [x, y] = iso.p(u, v, 0.3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 1.5, y - 1.5, 3, 1.8);
        ctx.fillRect(x + 0.5, y - 2.6, 1.3, 1.3);
        ctx.fillStyle = '#f29a2e';
        ctx.fillRect(x + 1.8, y - 2.2, 0.8, 0.6);
      }
      for (let k = 0; k < 9; k++) {
        const ang = 2.2 + k * 0.18;
        const [x, y] = iso.p(0.5 + Math.cos(ang) * 0.3, 0.52 + Math.sin(ang) * 0.3, 0);
        ctx.fillStyle = k % 2 ? '#5a9a3a' : '#3f7a2c';
        ctx.fillRect(x, y - 4, 0.8, 4);
      }
      items.push(roundTree(iso, o, 0.15, 0.16, 0.8, 1), roundTree(iso, o, 0.86, 0.14, 0.7, 3), pineTree(iso, o, 0.86, 0.86, 0.65, 1));
      items.push(bench(iso, o, 0.12, 0.8, true));
      break;
    }
    case 3: {
      // Basketball court with a chain-link fence.
      const court: Box = { u0: 0.14, u1: 0.86, v0: 0.2, v1: 0.8 };
      localFloor(iso, o, court, 0.1, '#3f7fc0');
      localFloor(iso, o, { u0: 0.2, u1: 0.8, v0: 0.26, v1: 0.74 }, 0.15, '#d27a3c');
      const white = 'rgba(255,255,255,0.9)';
      localFloor(iso, o, { u0: 0.495, u1: 0.505, v0: 0.26, v1: 0.74 }, 0.2, white);
      const c = at(o, 0.5, 0.5);
      iso.disc(c.u, c.v, 0.08, 0.2, white);
      iso.disc(c.u, c.v, 0.07, 0.25, '#d27a3c');
      for (const u of [0.2, 0.68]) localFloor(iso, o, { u0: u, u1: u + 0.12, v0: 0.42, v1: 0.58 }, 0.2, 'rgba(255,255,255,0.35)');
      for (const u of [0.18, 0.82]) {
        const p = at(o, u, 0.5);
        items.push({
          depth: p.depth,
          draw: () => {
            pole(iso, p.u, p.v, 0, 12, 1.2, '#4a4f56');
            const [x, y] = iso.p(p.u, p.v, 12);
            ctx.fillStyle = '#f4f4f0';
            ctx.fillRect(x - 3, y - 4, 6, 4);
            ctx.strokeStyle = '#e8483d';
            ctx.lineWidth = 0.6;
            ctx.strokeRect(x - 1.2, y - 2.6, 2.4, 1.6);
          },
        });
      }
      items.push(roundTree(iso, o, 0.1, 0.1, 0.6, 2));
      items.push({
        depth: 3,
        draw: () => {
          const r = o.rect(court);
          iso.wall('sw', r.v1, r.u0, r.u1, 0, 7, 'rgba(180, 190, 200, 0.28)');
          iso.wall('se', r.u1, r.v0, r.v1, 0, 7, 'rgba(160, 170, 180, 0.28)');
          for (let a = r.u0; a <= r.u1 + 1e-6; a += (r.u1 - r.u0) / 4) iso.wall('sw', r.v1, a - 0.006, a + 0.006, 0, 7, '#6b7179');
          for (let a = r.v0; a <= r.v1 + 1e-6; a += (r.v1 - r.v0) / 4) iso.wall('se', r.u1, a - 0.006, a + 0.006, 0, 7, '#5b6169');
        },
      });
      break;
    }
    case 4: {
      // Flower garden round a gazebo.
      iso.disc(0.5, 0.5, 0.33, 0.1, '#e2d6b8');
      iso.disc(0.5, 0.5, 0.25, 0.12, '#7bd552');
      iso.disc(0.5, 0.5, 0.15, 0.14, '#e2d6b8');
      const beds = ['#e8576a', '#f2d33c', '#c77dde', '#ff9a3c'];
      for (let k = 0; k < 4; k++) {
        const ang = (k / 4) * Math.PI * 2 + Math.PI / 4;
        const u = 0.5 + Math.cos(ang) * 0.38;
        const v = 0.5 + Math.sin(ang) * 0.38;
        iso.disc(u, v, 0.09, 0.1, '#4f9a3a');
        flowerDots(iso, o, rng, { u0: u - 0.07, u1: u + 0.07, v0: v - 0.07, v1: v + 0.07 }, 8, [beds[k], '#ffffff']);
      }
      flowerDots(iso, o, rng, { u0: 0.3, u1: 0.7, v0: 0.3, v1: 0.7 }, 10, FLOWERS);
      items.push({
        depth: 1,
        draw: () => {
          iso.round(0.5, 0.5, 0, 1.5, () => 0.12, '#efe9dc', '#f6f2ea');
          for (let k = 0; k < 6; k++) {
            const ang = (k / 6) * Math.PI * 2;
            if (Math.sin(ang + Math.PI / 4) < -0.3) continue;
            pole(iso, 0.5 + Math.cos(ang) * 0.1, 0.5 + Math.sin(ang) * 0.1, 1.5, 10, 1, '#fbf8f1');
          }
          const [x, y] = iso.p(0.5, 0.5, 10);
          const { rx, ry } = IsoFrame.ellipse(0.13);
          ctx.fillStyle = '#4f8a7a';
          ctx.beginPath();
          ctx.moveTo(x, y - 9);
          ctx.lineTo(x + rx, y);
          ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI, false);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#6fb39f';
          ctx.beginPath();
          ctx.moveTo(x, y - 9);
          ctx.lineTo(x - rx, y);
          ctx.lineTo(x - rx * 0.2, y + ry);
          ctx.closePath();
          ctx.fill();
        },
      });
      items.push(pineTree(iso, o, 0.14, 0.14, 0.6, 0), roundTree(iso, o, 0.86, 0.86, 0.6, 1));
      break;
    }
    default: {
      // Picnic grove: shady trees, tables and a winding path.
      for (let t = 0; t < 1; t += 0.05) {
        const u = 0.08 + t * 0.84;
        const v = 0.5 + Math.sin(t * Math.PI * 2) * 0.12;
        iso.disc(u, v, 0.06, 0.1, '#e2d6b8');
      }
      flowerDots(iso, o, rng, { u0: 0.1, u1: 0.9, v0: 0.1, v1: 0.9 }, 10, ['#f3f1e8', '#f2d33c']);
      for (const [u, v] of [
        [0.3, 0.3],
        [0.66, 0.7],
      ] as const) {
        const p = at(o, u, v);
        items.push({
          depth: p.depth,
          draw: () => {
            const r: Box = { u0: p.u - 0.07, u1: p.u + 0.07, v0: p.v - 0.05, v1: p.v + 0.05 };
            iso.box(r.u0, r.u1, r.v0 - 0.05, r.v0 - 0.02, 0, 2, '#8a5a34', '#6b4426', '#a8744a');
            iso.box(r.u0, r.u1, r.v1 + 0.02, r.v1 + 0.05, 0, 2, '#8a5a34', '#6b4426', '#a8744a');
            iso.box(r.u0, r.u1, r.v0, r.v1, 0, 4, '#8a5a34', '#6b4426', '#e8483d');
            iso.floor(r.u0 + 0.02, r.u0 + 0.05, r.v0, r.v1, 4.1, '#ffffff');
            iso.floor(r.u0 + 0.08, r.u0 + 0.11, r.v0, r.v1, 4.1, '#ffffff');
          },
        });
      }
      items.push(
        roundTree(iso, o, 0.16, 0.18, 0.85, 0),
        roundTree(iso, o, 0.84, 0.22, 0.8, 1),
        roundTree(iso, o, 0.2, 0.84, 0.75, 3),
        roundTree(iso, o, 0.84, 0.84, 0.7, 2),
        roundTree(iso, o, 0.52, 0.12, 0.7, 2),
      );
    }
  }
  drawItems(items);
  paintHedges(iso, lot);
}

// ---------------------------------------------------------------- town hall

function paintTownHall(iso: IsoFrame, o: Orient, rng: Rng, variant: number) {
  const stone = ['#efe7d6', '#e6e2da', '#f1e4d2'][variant % 3];
  const dark = shade(stone, -0.22);
  // Plaza with planters.
  iso.floor(0.03, 1.97, 0.03, 1.97, 0, '#c9c3b5');
  iso.floor(0.08, 1.92, 0.08, 1.92, 0, '#ddd6c6');
  for (let a = 0.2; a < 1.9; a += 0.25) iso.floor(a, a + 0.01, 0.1, 1.9, 0.1, 'rgba(0,0,0,0.06)');
  const b = o.rect({ u0: 0.25, u1: 1.75, v0: 0.25, v1: 1.35 });
  const H = 26;
  const front = o.faceOf('front');
  const ctx = iso.ctx;

  const behind: Item[] = [];
  const ahead: Item[] = [];
  const add = (it: Item & { u: number; v: number }) => (it.u >= b.u1 || it.v >= b.v1 ? ahead : behind).push(it);
  const fp = at(o, 1.85, 1.85);
  add({
    u: fp.u,
    v: fp.v,
    depth: fp.depth,
    draw: () => {
      pole(iso, fp.u, fp.v, 0, 30, 1.2, '#6b7079');
      const [fx, fy] = iso.p(fp.u, fp.v, 30);
      ctx.fillStyle = INK.grassDark;
      ctx.fillRect(fx + 0.6, fy, 8, 5);
    },
  });
  for (const [u, v] of [
    [0.25, 1.75],
    [1.0, 1.82],
  ] as const) {
    const p = at(o, u, v);
    add({ u: p.u, v: p.v, depth: p.depth, draw: () => paintRoundTree(ctx, ...iso.p(p.u, p.v, 0), 0.9, Math.floor(rng() * 4)) });
  }
  drawItems(behind);

  iso.box(b.u0, b.u1, b.v0, b.v1, 0, H, stone, dark, shade(stone, -0.08));
  // Windows on the camera-facing sides that aren't the portico front.
  for (const face of ['sw', 'se'] as const) {
    if (face === front) continue;
    const f = faceRef(face, b);
    const n = Math.max(3, Math.round((f.a1 - f.a0) * 3.5));
    const step = (f.a1 - f.a0) / n;
    for (let k = 0; k < n; k++) glazing(iso, f, f.a0 + k * step + step * 0.25, f.a0 + k * step + step * 0.75, 8, 18);
    wallOn(iso, f, f.a0, f.a1, H - 2, H, shade(stone, -0.1));
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
  // Drum, dome and lantern.
  const cu = (b.u0 + b.u1) / 2;
  const cv = (b.v0 + b.v1) / 2;
  iso.round(cu, cv, H, H + 10, () => 0.26, stone, null);
  iso.round(cu, cv, H + 10, H + 22, (t) => 0.27 * Math.sqrt(Math.max(0, 1 - t * t)), '#4f8a7a', '#4f8a7a');
  iso.round(cu, cv, H + 21, H + 25, () => 0.04, '#e9d9a8', '#c9a447');
  const [dx, dy] = iso.p(cu, cv, H);
  ctx.fillStyle = '#c9a447';
  ctx.fillRect(dx - 0.75, dy - 31, 1.5, 6);
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
  drawItems(ahead);
}

// ---------------------------------------------------------------- power plant

/** Hyperboloid cooling tower profile: narrowest near the top, flaring out again at the lip. */
function coolingProfile(r0: number) {
  return (t: number) => r0 * (0.62 + 0.38 * ((t - 0.75) / 0.75) ** 2);
}

function steam(iso: IsoFrame, u: number, v: number, z: number, size: number) {
  const [x, y] = iso.p(u, v, z);
  const c = iso.ctx;
  const puffs: readonly (readonly [number, number, number, number])[] = [
    [0, -4, 7, 0.75],
    [-4, -10, 6, 0.6],
    [3, -13, 7, 0.5],
    [-1, -19, 5, 0.35],
  ];
  for (const [dx, dy, r, a] of puffs) {
    c.fillStyle = `rgba(250, 252, 255, ${a})`;
    c.beginPath();
    c.arc(x + dx * size, y + dy * size, r * size, 0, Math.PI * 2);
    c.fill();
  }
}

/** Transformer yard: gravel, a few transformers and two lattice pylons. */
function transformerYard(iso: IsoFrame, o: Orient, b: Box): Item[] {
  localFloor(iso, o, b, 0.1, '#a9a69c');
  localFloor(iso, o, { u0: b.u0 + 0.03, u1: b.u1 - 0.03, v0: b.v0 + 0.03, v1: b.v1 - 0.03 }, 0.15, '#b9b6ad');
  const items: Item[] = [];
  const n = 3;
  for (let k = 0; k < n; k++) {
    const u = b.u0 + 0.1 + k * ((b.u1 - b.u0 - 0.28) / (n - 1));
    const r = o.rect({ u0: u, u1: u + 0.12, v0: b.v0 + 0.12, v1: b.v0 + 0.26 });
    items.push({
      depth: r.u0 + r.v0,
      draw: () => {
        iso.solid(r, 0, 6, '#8d959d');
        for (let a = 0; a < 3; a++) pole(iso, r.u0 + 0.02 + a * 0.04, r.v1 - 0.02, 6, 10, 0.8, '#c9a447');
      },
    });
  }
  for (const u of [b.u0 + 0.1, b.u1 - 0.1]) {
    const p = at(o, u, b.v1 - 0.12);
    items.push({
      depth: p.depth,
      draw: () => {
        const [x, y] = iso.p(p.u, p.v, 0);
        const c = iso.ctx;
        c.strokeStyle = '#6b7079';
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(x - 3, y);
        c.lineTo(x - 0.8, y - 20);
        c.lineTo(x + 0.8, y - 20);
        c.lineTo(x + 3, y);
        c.moveTo(x - 2.4, y - 5);
        c.lineTo(x + 2.4, y - 5);
        c.moveTo(x - 1.6, y - 11);
        c.lineTo(x + 1.6, y - 11);
        c.moveTo(x - 5, y - 16);
        c.lineTo(x + 5, y - 16);
        c.stroke();
      },
    });
  }
  return items;
}

function paintPowerPlant(iso: IsoFrame, o: Orient, rng: Rng, variant: number) {
  iso.floor(0.03, 1.97, 0.03, 1.97, 0, '#a7a49b');
  iso.floor(0.06, 1.94, 0.06, 1.94, 0, '#c6c2b8');
  for (let a = 0.3; a < 1.9; a += 0.3) iso.floor(a, a + 0.01, 0.08, 1.92, 0.05, 'rgba(0,0,0,0.05)');
  const items: Item[] = [];
  const hallWall = ['#9aa1a8', '#a7a092', '#9ea7a0'][variant];

  // Turbine hall: a long box with a stripe of high windows and a stack behind it.
  const hall = o.rect({ u0: 0.12, u1: 0.98, v0: 0.12, v1: 1.0 });
  const hallH = 22;
  items.push({
    depth: hall.u0 + hall.v0 + 0.6,
    draw: () => {
      iso.solid(hall, 0, hallH, hallWall);
      for (const face of ['sw', 'se'] as const) {
        const f = faceRef(face, hall);
        const n = Math.round((f.a1 - f.a0) * 5);
        for (let k = 0; k < n; k++) {
          const a = f.a0 + ((k + 0.25) * (f.a1 - f.a0)) / n;
          glazing(iso, f, a, a + ((f.a1 - f.a0) / n) * 0.5, hallH - 8, hallH - 3);
        }
        for (let a = f.a0 + 0.03; a < f.a1; a += 0.04) wallOn(iso, f, a, a + 0.008, 0, hallH - 9, 'rgba(0,0,0,0.06)');
      }
      iso.floor(hall.u0 + 0.05, hall.u1 - 0.05, hall.v0 + 0.05, hall.v1 - 0.05, hallH, shade(hallWall, -0.15));
      for (let k = 0; k < 3; k++) {
        const [cu, cv] = o.point(0.3 + k * 0.22, 0.55);
        iso.box(cu - 0.05, cu + 0.05, cv - 0.05, cv + 0.05, hallH, hallH + 3, '#c9cdd2', '#a2a7ad', '#e2e5e8');
      }
      const f = o.faceOf('front');
      if (f) {
        const fr = faceRef(f, hall);
        const mid = (fr.a0 + fr.a1) / 2;
        wallOn(iso, fr, mid - 0.18, mid + 0.18, hallH - 15, hallH - 10, '#d6a514');
        iso.text(fr.face, fr.at, mid, hallH - 12.5, 'POWER', 4.5, '#2a2a2a');
      }
    },
  });
  const sp = at(o, 0.3, 0.3);
  items.push({
    depth: sp.depth,
    draw: () => {
      const top = 64;
      iso.round(sp.u, sp.v, 0, top, (t) => 0.1 * (1 - t * 0.3), '#d8d4cc', null);
      for (const z of [top - 6, top - 16, top - 26]) {
        const [x, y] = iso.p(sp.u, sp.v, z);
        const { rx } = IsoFrame.ellipse(0.075);
        iso.ctx.fillStyle = '#d23b2b';
        iso.ctx.fillRect(x - rx, y - 4, rx * 2, 4);
      }
      iso.ctx.fillStyle = 'rgba(120, 120, 120, 0.35)';
      const [x, y] = iso.p(sp.u, sp.v, top);
      iso.ctx.beginPath();
      iso.ctx.arc(x + 3, y - 5, 4, 0, Math.PI * 2);
      iso.ctx.arc(x + 7, y - 9, 3, 0, Math.PI * 2);
      iso.ctx.fill();
    },
  });

  if (variant === 1) {
    // Gas plant: storage tanks and two slim exhaust stacks.
    for (const [u, v] of [
      [1.42, 0.4],
      [1.42, 0.88],
      [1.62, 1.6],
    ] as const) {
      const p = at(o, u, v);
      items.push({
        depth: p.depth,
        draw: () => {
          iso.round(p.u, p.v, 0, 18, () => 0.2, '#e4e8ec', '#f1f3f5');
          const [x, y] = iso.p(p.u, p.v, 10);
          const { rx } = IsoFrame.ellipse(0.2);
          iso.ctx.fillStyle = 'rgba(214, 165, 20, 0.85)';
          iso.ctx.fillRect(x - rx, y - 2, rx * 2, 2);
        },
      });
    }
    for (const u of [0.75, 0.95]) {
      const p = at(o, u, 1.15);
      items.push({ depth: p.depth, draw: () => iso.round(p.u, p.v, 0, 46, () => 0.055, '#b7bcc2', null) });
    }
    items.push(...transformerYard(iso, o, { u0: 0.12, u1: 0.98, v0: 1.3, v1: 1.88 }));
  } else {
    const towers: readonly (readonly [number, number, number, number])[] =
      variant === 0
        ? [[1.42, 1.32, 0.42, 48]]
        : [
            [1.45, 0.62, 0.3, 38],
            [1.45, 1.42, 0.3, 38],
          ];
    for (const [u, v, r, h] of towers) {
      const p = at(o, u, v);
      items.push({
        depth: p.depth,
        draw: () => {
          iso.round(p.u, p.v, 0, h, coolingProfile(r), '#d6d1c6', null);
          // Faint vertical streaks on the concrete.
          const [x, y] = iso.p(p.u, p.v, 0);
          const { rx } = IsoFrame.ellipse(r * 0.7);
          iso.ctx.fillStyle = 'rgba(0,0,0,0.05)';
          for (let k = -2; k <= 2; k++) iso.ctx.fillRect(x + (k * rx) / 3, y - h * 0.9, 1, h * 0.85);
          steam(iso, p.u, p.v, h + 2, r * 2.2);
        },
      });
    }
    items.push(...transformerYard(iso, o, { u0: 0.12, u1: 0.98, v0: 1.24, v1: 1.88 }));
  }
  void rng;
  drawItems(items);
}

// ---------------------------------------------------------------- water tower

function paintWaterTower(iso: IsoFrame, o: Orient, rng: Rng, variant: number) {
  iso.floor(0.03, 0.97, 0.03, 0.97, 0, '#b9b6ae');
  iso.floor(0.06, 0.94, 0.06, 0.94, 0, '#8fbf6a');
  iso.disc(0.5, 0.5, 0.3, 0.05, '#c9c5bb');
  const ctx = iso.ctx;
  const c = at(o, 0.5, 0.5);
  // Pump house at the local back-right.
  const ph = o.rect({ u0: 0.66, u1: 0.9, v0: 0.12, v1: 0.34 });
  const pumpHouse = () => {
    iso.solid(ph, 0, 7, '#d7d2c6');
    iso.floor(ph.u0 - 0.02, ph.u1 + 0.02, ph.v0 - 0.02, ph.v1 + 0.02, 7, '#5a6e7d');
  };

  if (variant === 2) {
    // Ground reservoir: a wide low tank with a shallow dome, pipes and the pump house.
    const items: Item[] = [
      { depth: ph.u0 + ph.v0, draw: pumpHouse },
      {
        depth: c.depth,
        draw: () => {
          iso.round(c.u, c.v, 0, 14, () => 0.34, '#cdd7de', null);
          iso.round(c.u, c.v, 14, 18, (t) => 0.34 * Math.sqrt(1 - t * t * 0.9), '#b9c6cf', '#c9d4dc');
          const [x, y] = iso.p(c.u, c.v, 7);
          const { rx } = IsoFrame.ellipse(0.34);
          ctx.fillStyle = 'rgba(58, 155, 240, 0.85)';
          ctx.fillRect(x - rx, y - 1, rx * 2, 2.2);
          for (let z = 3; z < 14; z += 3.5) {
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            ctx.fillRect(x - rx, y - z + 4, rx * 2, 0.5);
          }
        },
      },
    ];
    drawItems(items);
    return;
  }

  const legTop = variant === 0 ? 30 : 26;
  const legR = 0.2;
  const legs: [number, number][] = [
    [0.5 - legR, 0.5 - legR],
    [0.5 + legR, 0.5 - legR],
    [0.5 - legR, 0.5 + legR],
    [0.5 + legR, 0.5 + legR],
  ];
  const back = legs.filter(([u, v]) => u + v <= 1);
  const front = legs.filter(([u, v]) => u + v > 1);
  pumpHouse();
  const drawLegs = (set: [number, number][]) => {
    for (const [u, v] of set) {
      const b = iso.p(u, v, 0);
      const t = iso.p(u + (0.5 - u) * 0.35, v + (0.5 - v) * 0.35, legTop);
      line(iso, b, t, '#6d7a86', 1.6);
    }
  };
  drawLegs(back);
  // Cross braces between neighbouring legs.
  for (let k = 0; k < 4; k++) {
    const [a, b] = [legs[k], legs[(k + 1) % 4 === 2 ? 3 : (k + 1) % 4]];
    for (const z of [9, 19]) {
      const s = z / legTop;
      const pa = iso.p(a[0] + (0.5 - a[0]) * 0.35 * s, a[1] + (0.5 - a[1]) * 0.35 * s, z);
      const pb = iso.p(b[0] + (0.5 - b[0]) * 0.35 * s, b[1] + (0.5 - b[1]) * 0.35 * s, z);
      line(iso, pa, pb, 'rgba(90, 104, 116, 0.8)', 0.6);
    }
  }
  // Riser pipe down the middle.
  pole(iso, 0.5, 0.5, 0, legTop, 2, '#8796a3');
  drawLegs(front);

  const [x, y] = iso.p(0.5, 0.5, legTop);
  if (variant === 0) {
    // Globe tank.
    const R = 11;
    const cy = y - R + 2;
    const g = ctx.createRadialGradient(x - R * 0.4, cy - R * 0.4, R * 0.15, x, cy, R);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.55, '#d9e6ef');
    g.addColorStop(1, '#8fa6b8');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(58, 155, 240, 0.9)';
    ctx.beginPath();
    ctx.ellipse(x, cy + 1, R * 0.98, 2.4, 0, 0, Math.PI);
    ctx.ellipse(x, cy + 3.4, R * 0.92, 2.4, 0, Math.PI, 0, true);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 3.6px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('H2O', x - 1, cy - 2.5);
    pole(iso, 0.5, 0.5, legTop + R * 2 - 2, legTop + R * 2 + 3, 0.8, '#5b6169');
    ctx.fillStyle = '#ff5a4a';
    ctx.fillRect(x - 0.8, y - R * 2 - 4.5, 1.8, 1.6);
  } else {
    // Classic tank: cylinder with a cone roof and a balcony ring.
    const r = 0.21;
    iso.disc(0.5, 0.5, r + 0.04, legTop, '#5d6a76');
    iso.round(0.5, 0.5, legTop, legTop + 15, () => r, '#a8cde6', null);
    const { rx, ry } = IsoFrame.ellipse(r);
    const [tx, ty] = iso.p(0.5, 0.5, legTop + 15);
    ctx.fillStyle = '#5d7d96';
    ctx.beginPath();
    ctx.moveTo(tx, ty - 7);
    ctx.lineTo(tx + rx, ty);
    ctx.ellipse(tx, ty, rx, ry, 0, 0, Math.PI, false);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7fa0b8';
    ctx.beginPath();
    ctx.moveTo(tx, ty - 7);
    ctx.lineTo(tx - rx, ty);
    ctx.lineTo(tx - rx * 0.2, ty + ry);
    ctx.closePath();
    ctx.fill();
    // Town stripe.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(tx - rx, ty + 5, rx * 2, 2);
    ctx.fillStyle = '#2f7fd6';
    ctx.font = 'bold 4px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WATER', tx - 1, ty + 11.5);
  }
  void rng;
}

export const CIVIC_ART: Readonly<Record<CustomArtId, CivicArt>> = {
  park: { variants: 6, headroom: () => 34, paint: paintPark },
  town_hall: { variants: 3, headroom: () => 72, paint: paintTownHall },
  power_plant: { variants: 3, headroom: (v) => (v === 0 ? 92 : 90), paint: paintPowerPlant },
  water_tower: { variants: 3, headroom: (v) => (v === 0 ? 62 : v === 1 ? 56 : 30), paint: paintWaterTower },
};

/** Exported for tests: the frame width used by civic art (2× tile half-width per footprint tile). */
export const CIVIC_HALF_W = HALF_W;
