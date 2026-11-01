import { alpha, blobShadow, IsoFrame, mix, shade, topTone, type Box, type FaceRef, type Orient, type Rng } from '../core';
import { glazing as facadeGlazing } from '../buildings/facades';
import { paintFlowerClump } from '../nature/decor/plants';
import { conifers, ornamentalFoliage, paintTree, type Species } from '../nature/trees';
import { MATERIAL, NATURE } from '../theme/tokens';
import { at, type Item } from './lot';

/**
 * Pieces shared by parks and civic buildings: lawns, hedges, paths, benches, lamps, flower beds,
 * fountains and trees as depth-sorted items. Everything is laid out in local space and mapped
 * through `Orient`.
 */

/** Plain office glazing for civic halls (no blinds, recorded for night lights). */
export function glazing(iso: IsoFrame, f: FaceRef, a0: number, a1: number, z0: number, z1: number) {
  facadeGlazing(iso, f, a0, a1, z0, z1, null, { blinds: 0 });
}

export function line(iso: IsoFrame, a: readonly [number, number], b: readonly [number, number], color: string, width: number) {
  const c = iso.ctx;
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(a[0], a[1]);
  c.lineTo(b[0], b[1]);
  c.stroke();
}

/** Flat quad from local corners at height z. */
export function localFloor(iso: IsoFrame, o: Orient, b: Box, z: number, fill: string | CanvasGradient) {
  const r = o.rect(b);
  iso.floor(r.u0, r.u1, r.v0, r.v1, z, fill);
}

/** A lawn over a view box: kerb edging, a soft sunlit gradient and mown stripes. */
export function lawn(iso: IsoFrame, b: Box, edge: string = NATURE.pathEdge) {
  iso.floor(b.u0 + 0.02, b.u1 - 0.02, b.v0 + 0.02, b.v1 - 0.02, 0, edge);
  const [lx, ly] = iso.p(b.u0, b.v1);
  const [rx, ry] = iso.p(b.u1, b.v0);
  const g = iso.ctx.createLinearGradient(lx, ly, rx, ry);
  g.addColorStop(0, NATURE.lawnLight);
  g.addColorStop(1, shade(NATURE.lawn, -0.06));
  iso.floor(b.u0 + 0.06, b.u1 - 0.06, b.v0 + 0.06, b.v1 - 0.06, 0, g);
  for (let a = b.u0 + 0.1; a < b.u1 - 0.08; a += 0.16) iso.floor(a, a + 0.08, b.v0 + 0.06, b.v1 - 0.06, 0, 'rgba(255,255,255,0.05)');
}

/** A gravel path strip (local box) with darker edging. */
export function path(iso: IsoFrame, o: Orient, b: Box, z = 0.1) {
  localFloor(iso, o, { u0: b.u0 - 0.015, u1: b.u1 + 0.015, v0: b.v0 - 0.015, v1: b.v1 + 0.015 }, z, NATURE.pathEdge);
  localFloor(iso, o, b, z + 0.02, NATURE.path);
}

/**
 * Clipped hedge round the two camera-facing lot edges with a gap (the entrance) in each: a lit
 * box with a leafy top. The far edges stay open so the park reads from outside.
 */
export function paintHedges(iso: IsoFrame, lot: Box) {
  const e = 0.07;
  const h = NATURE.hedge;
  const span = (a0: number, a1: number): [number, number][] => [
    [a0 + e, a0 + (a1 - a0) * 0.42],
    [a0 + (a1 - a0) * 0.58, a1 - e],
  ];
  const leafTop = (u0: number, u1: number, v0: number, v1: number) => {
    iso.floor(u0, u1, v0, v1, 4, topTone(h.mid));
    const n = Math.round((u1 - u0 + v1 - v0) * 14);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const [x, y] = iso.p(u0 + (u1 - u0) * t, v0 + (v1 - v0) * t, 4.3);
      iso.ctx.fillStyle = alpha(h.light, 0.7);
      iso.ctx.beginPath();
      iso.ctx.arc(x - 0.4, y - 0.2, 0.9, 0, Math.PI * 2);
      iso.ctx.fill();
    }
  };
  for (const [s0, s1] of span(lot.u0, lot.u1)) {
    iso.solid({ u0: s0, u1: s1, v0: lot.v1 - e - 0.035, v1: lot.v1 - e }, 0, 4, h.mid, topTone(h.mid));
    leafTop(s0, s1, lot.v1 - e - 0.035, lot.v1 - e);
  }
  for (const [s0, s1] of span(lot.v0, lot.v1)) {
    iso.solid({ u0: lot.u1 - e - 0.035, u1: lot.u1 - e, v0: s0, v1: s1 }, 0, 4, h.mid, topTone(h.mid));
    leafTop(lot.u1 - e - 0.035, lot.u1 - e, s0, s1);
  }
}

/** Park bench: two dark legs, a slatted seat and back, and a little shadow. */
export function bench(iso: IsoFrame, o: Orient, u: number, v: number, alongU: boolean): Item {
  const r = o.rect(alongU ? { u0: u, u1: u + 0.14, v0: v, v1: v + 0.05 } : { u0: u, u1: u + 0.05, v0: v, v1: v + 0.14 });
  return {
    depth: r.u0 + r.v0,
    draw: () => {
      const [x, y] = iso.p((r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2);
      blobShadow(iso.ctx, x + 2, y + 0.5, 5, 1.8);
      iso.box(r.u0, r.u0 + 0.015, r.v0, r.v1, 0, 1.6, '#3a3d42', '#2a2d31', '#3a3d42');
      iso.box(r.u1 - 0.015, r.u1, r.v0, r.v1, 0, 1.6, '#3a3d42', '#2a2d31', '#3a3d42');
      iso.solid(r, 1.6, 2.4, MATERIAL.woodLight);
      iso.solid({ u0: r.u0, u1: r.u1, v0: r.v0, v1: r.v0 + 0.012 }, 2.4, 4.2, MATERIAL.wood);
    },
  };
}

/** Park lamp: slim post with a lantern that glows at night. */
export function lamp(iso: IsoFrame, o: Orient, u: number, v: number): Item {
  const p = at(o, u, v);
  return {
    depth: p.depth,
    draw: () => {
      const [x, y] = iso.p(p.u, p.v);
      blobShadow(iso.ctx, x + 1.5, y + 0.3, 2, 0.8);
      const c = iso.ctx;
      c.fillStyle = '#2f3338';
      c.fillRect(x - 0.45, y - 10, 0.9, 10);
      c.fillStyle = '#3a3e44';
      c.fillRect(x - 1.3, y - 12.4, 2.6, 0.7);
      c.fillStyle = '#fff3cf';
      c.fillRect(x - 0.9, y - 11.8, 1.8, 1.9);
      iso.mark('window', 'sw', x, y - 10.9, 3, 3);
    },
  };
}

/** A tree item for parks: broadleaf by default, with tone choosing greens, blossom or autumn. */
export function tree(iso: IsoFrame, o: Orient, u: number, v: number, size: number, tone: number, species: Species = 'broadleaf'): Item {
  const p = at(o, u, v);
  return {
    depth: p.depth,
    draw: () => {
      const [x, y] = iso.p(p.u, p.v, 0);
      const foliage = species === 'conifer' ? conifers(tone) : ornamentalFoliage(tone);
      paintTree(iso.ctx, x, y, { species, size: species === 'broadleaf' ? size * 0.9 : size, foliage, seed: 600 + tone * 31 + Math.round(u * 100 + v * 10) });
    },
  };
}

/** A raised flower bed (local box): soil mound edged in stone, packed with clumps. */
export function flowerBed(iso: IsoFrame, o: Orient, rng: Rng, b: Box, colors: readonly string[]) {
  const r = o.rect(b);
  iso.solid(r, 0, 1, '#b9ad94');
  iso.floor(r.u0 + 0.015, r.u1 - 0.015, r.v0 + 0.015, r.v1 - 0.015, 1, '#6b4f36');
  const pts: [number, number][] = [];
  const n = Math.max(3, Math.round((b.u1 - b.u0) * (b.v1 - b.v0) * 160));
  for (let k = 0; k < n; k++) pts.push(o.point(b.u0 + 0.03 + rng() * (b.u1 - b.u0 - 0.06), b.v0 + 0.03 + rng() * (b.v1 - b.v0 - 0.06)));
  pts.sort((a, c) => a[0] + a[1] - (c[0] + c[1]));
  for (const [k, [u, v]] of pts.entries()) {
    const [x, y] = iso.p(u, v, 1);
    paintFlowerClump(iso.ctx, x, y, colors[k % colors.length], '#fff1a8', rng, 0.6);
  }
}

/** Scattered flowers on the lawn (local box). */
export function flowerDots(iso: IsoFrame, o: Orient, rng: Rng, b: Box, n: number, colors: readonly string[]) {
  const ctx = iso.ctx;
  for (let k = 0; k < n; k++) {
    const [fu, fv] = o.point(b.u0 + rng() * (b.u1 - b.u0), b.v0 + rng() * (b.v1 - b.v0));
    const [fx, fy] = iso.p(fu, fv, 0);
    ctx.fillStyle = shade(colors[k % colors.length], -0.3);
    ctx.fillRect(Math.round(fx) + 0.4, Math.round(fy) - 0.6, 1.6, 1.6);
    ctx.fillStyle = colors[k % colors.length];
    ctx.fillRect(Math.round(fx), Math.round(fy) - 1, 1.6, 1.6);
  }
}

/**
 * Round fountain at a view point: a stone basin with a lit rim, water with depth, a pedestal
 * and a little spray painted still. The jet is recorded so render/ambient animates it.
 */
export function fountain(iso: IsoFrame, u: number, v: number, r: number, height = 7) {
  const c = iso.ctx;
  const [bx, by] = iso.p(u, v);
  blobShadow(c, bx + 4, by + 1, IsoFrame.ellipse(r).rx * 1.15, IsoFrame.ellipse(r).ry * 1.2, 0.7);
  iso.round(u, v, 0, 2.6, () => r, '#cfc8b8', '#e9e3d6');
  const inner = IsoFrame.ellipse(r * 0.84);
  const [wx, wy] = iso.p(u, v, 2.4);
  const g = c.createLinearGradient(wx - inner.rx, wy - inner.ry, wx + inner.rx, wy + inner.ry);
  g.addColorStop(0, NATURE.waterLight);
  g.addColorStop(1, shade(NATURE.water, -0.15));
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(wx, wy, inner.rx, inner.ry, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.beginPath();
  c.ellipse(wx - inner.rx * 0.3, wy - inner.ry * 0.25, inner.rx * 0.35, inner.ry * 0.25, 0, 0, Math.PI * 2);
  c.fill();
  iso.round(u, v, 2.4, height, (t) => r * (0.22 - t * 0.1), '#ddd6c6', mix('#ddd6c6', '#ffffff', 0.4));
  const [tx, ty] = iso.p(u, v, height);
  c.fillStyle = 'rgba(225, 245, 255, 0.85)';
  c.beginPath();
  c.ellipse(tx, ty - 1.2, 2.2, 1.6, 0, 0, Math.PI * 2);
  c.fill();
  iso.mark('fountain', 'sw', tx, ty);
}
