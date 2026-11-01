import { mulberry32 } from '../../../../shared/rng';
import { alpha, shade, type Box } from '../../core';
import { paintFlowerClump } from '../../nature/decor/plants';
import { MATERIAL, NATURE } from '../../theme/tokens';
import type { Painting } from '../context';

/** Lot surface: lawn with mown stripes, paving with joints, a plaza, or asphalt parking. */
export function paintLot(p: Painting) {
  const { iso, o, art, lot } = p;
  const base = p.ms[0].local;
  const inner = (d: number, fill: string | CanvasGradient) => iso.floor(lot.u0 + d, lot.u1 - d, lot.v0 + d, lot.v1 - d, 0, fill);
  const [lx, ly] = iso.p(lot.u0, lot.v1);
  const [rx, ry] = iso.p(lot.u1, lot.v0);
  const across = (a: string, b: string) => {
    const g = iso.ctx.createLinearGradient(lx, ly, rx, ry);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    return g;
  };

  if (art.ground === 'garden' || art.ground === 'field') {
    inner(0.02, MATERIAL.kerb);
    inner(0.045, across(shade(NATURE.lawn, 0.06), shade(NATURE.lawn, -0.06)));
    for (let a = lot.u0 + 0.1; a < lot.u1 - 0.05; a += 0.2) iso.floor(a, a + 0.1, lot.v0 + 0.05, lot.v1 - 0.05, 0, 'rgba(255,255,255,0.06)');
    // Path from the front door to the lot edge (local space: the front edge is at v = h).
    const mid0 = base.u0 + (base.u1 - base.u0) * 0.4;
    const mid1 = base.u0 + (base.u1 - base.u0) * 0.6;
    const edge = o.rect({ u0: mid0 - 0.015, u1: mid1 + 0.015, v0: base.v1, v1: o.h - 0.02 });
    const path = o.rect({ u0: mid0, u1: mid1, v0: base.v1, v1: o.h - 0.02 });
    iso.floor(edge.u0, edge.u1, edge.v0, edge.v1, 0, NATURE.pathEdge);
    iso.floor(path.u0, path.u1, path.v0, path.v1, 0, NATURE.path);
    // Flower beds along the front wall.
    const rng = mulberry32(Math.round(base.u1 * 97 + base.v1 * 31 + art.wall.length));
    const beds: [number, number][] = [];
    for (let k = 0; k < 4; k++) {
      const lu = base.u0 + 0.06 + rng() * (base.u1 - base.u0 - 0.12);
      if (lu > mid0 - 0.05 && lu < mid1 + 0.05) continue;
      beds.push(o.point(lu, base.v1 + 0.06));
    }
    beds.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
    for (const [k, [u, v]] of beds.entries()) {
      const [x, y] = iso.p(u, v);
      paintFlowerClump(iso.ctx, x, y, NATURE.flowers[(k + Math.floor(rng() * 6)) % NATURE.flowers.length], '#f7e27a', rng, 0.7);
    }
    if (art.ground === 'field') paintField(p);
    return;
  }
  if (art.ground === 'parking') {
    inner(0.02, MATERIAL.kerb);
    inner(0.05, across(shade(MATERIAL.asphalt, 0.08), shade(MATERIAL.asphalt, -0.06)));
    return;
  }
  const plaza = art.ground === 'plaza';
  inner(0.02, MATERIAL.kerb);
  inner(0.05, across(plaza ? MATERIAL.pavingLight : MATERIAL.paving, shade(plaza ? MATERIAL.pavingLight : MATERIAL.paving, -0.06)));
  // Paving joints.
  const step = plaza ? 0.14 : 0.22;
  const line = 'rgba(0, 0, 0, 0.07)';
  for (let a = lot.u0 + step; a < lot.u1 - 0.05; a += step) iso.floor(a, a + 0.006, lot.v0 + 0.05, lot.v1 - 0.05, 0, line);
  for (let a = lot.v0 + step; a < lot.v1 - 0.05; a += step) iso.floor(lot.u0 + 0.05, lot.u1 - 0.05, a, a + 0.006, 0, line);
  if (plaza) {
    // Inlaid border band round the plaza.
    const d = 0.1;
    const band = alpha('#b9ae97', 0.55);
    iso.floor(lot.u0 + d, lot.u1 - d, lot.v1 - d - 0.025, lot.v1 - d, 0, band);
    iso.floor(lot.u1 - d - 0.025, lot.u1 - d, lot.v0 + d, lot.v1 - d, 0, band);
  }
}

/** School playing field on the free strip in front of the building. */
function paintField({ iso, o, ms }: Painting) {
  const local = ms[0].local;
  const f: Box = o.rect({ u0: 0.18, u1: o.w - 0.18, v0: local.v1 + 0.12, v1: o.h - 0.1 });
  if (f.u1 - f.u0 < 0.3 || f.v1 - f.v0 < 0.3) return;
  iso.floor(f.u0, f.u1, f.v0, f.v1, 0, '#c0603c');
  iso.floor(f.u0 + 0.05, f.u1 - 0.05, f.v0 + 0.05, f.v1 - 0.05, 0, '#55b23f');
  for (let a = f.u0 + 0.05; a < f.u1 - 0.1; a += 0.16) iso.floor(a, a + 0.08, f.v0 + 0.05, f.v1 - 0.05, 0, 'rgba(255,255,255,0.06)');
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
  iso.disc(mu, mv, 0.075, 0, '#55b23f');
}
