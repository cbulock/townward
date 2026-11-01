import { alpha, faceRef, mix, shade, wallOn, type Box, type IsoFrame, type Orient, type Rng } from '../../core';
import { greens, paintTree } from '../../nature/trees';
import { GLASS, NATURE } from '../../theme/tokens';
import { at, drawItems, type Item } from '../lot';
import { flowerBed, fountain, lamp, lawn, paintHedges, path, tree } from '../kit';

/**
 * A glasshouse: a glazed box with a curved roof feel (bright ridge), white glazing bars, and
 * palms and ferns seen through the glass.
 */
function glasshouse(iso: IsoFrame, b: Box, h: number) {
  const ctx = iso.ctx;
  const glassLit = mix(GLASS.reflect, '#9fd3bf', 0.5);
  const glassShade = mix('#7fb3a3', '#4c7f78', 0.4);
  // Plants inside first, then translucent glass over them.
  const [px, py] = iso.p((b.u0 + b.u1) / 2, (b.v0 + b.v1) / 2);
  for (let k = 0; k < 3; k++) paintTree(ctx, px - 8 + k * 8, py + 2 - (k % 2) * 3, { species: k === 1 ? 'poplar' : 'broadleaf', size: 0.55, foliage: greens(k + 1), seed: 90 + k });
  iso.wall('sw', b.v1, b.u0, b.u1, 0, h, alpha(glassLit, 0.62));
  iso.wall('se', b.u1, b.v0, b.v1, 0, h, alpha(glassShade, 0.7));
  iso.floor(b.u0, b.u1, b.v0, b.v1, h, alpha(mix(glassLit, '#ffffff', 0.35), 0.8));
  for (const face of ['sw', 'se'] as const) {
    const f = faceRef(face, b);
    for (let a = f.a0 + 0.1; a < f.a1 - 0.04; a += 0.12) wallOn(iso, f, a, a + 0.012, 0, h, 'rgba(250, 255, 252, 0.85)');
    for (const z of [h * 0.35, h * 0.7]) wallOn(iso, f, f.a0, f.a1, z, z + 0.5, 'rgba(250, 255, 252, 0.7)');
    wallOn(iso, f, f.a0, f.a1, 0, 1.4, shade('#cfc8b8', face === 'sw' ? 0 : -0.25));
  }
  iso.floor(b.u0, b.u1, (b.v0 + b.v1) / 2 - 0.02, (b.v0 + b.v1) / 2 + 0.02, h + 0.1, '#ffffff');
  iso.floor((b.u0 + b.u1) / 2 - 0.02, (b.u0 + b.u1) / 2 + 0.02, b.v0, b.v1, h + 0.1, '#ffffff');
}

/** 3×3 botanical garden: two glasshouses, formal beds on a cross axis and a fountain. */
export function paintBotanicalGarden(iso: IsoFrame, o: Orient, rng: Rng, variant: number) {
  const w = o.vw;
  const h = o.vh;
  lawn(iso, { u0: 0, u1: w, v0: 0, v1: h });
  path(iso, o, { u0: 1.41, u1: 1.59, v0: 0.12, v1: 2.88 });
  path(iso, o, { u0: 0.12, u1: 2.88, v0: 1.41, v1: 1.59 });
  const items: Item[] = [];
  const glasshouses: readonly Box[] = [
    { u0: 0.32, u1: 1.18, v0: 0.38, v1: 1.12 },
    { u0: 1.82, u1: 2.68, v0: 1.82, v1: 2.62 },
  ];
  for (const [k, b0] of glasshouses.entries()) {
    const b = o.rect(b0);
    items.push({ depth: b.u0 + b.v0, draw: () => glasshouse(iso, b, k === 0 ? 15 : 12) });
  }
  const beds = [NATURE.flowers[2], NATURE.flowers[3], NATURE.flowers[0], NATURE.flowers[4]];
  for (const [k, [u, v]] of [
    [0.25, 1.7],
    [0.85, 1.7],
    [1.75, 0.3],
    [1.75, 0.85],
  ].entries()) {
    flowerBed(iso, o, rng, { u0: u, u1: u + 0.5, v0: v, v1: v + 0.45 }, [beds[(k + variant) % 4], NATURE.flowers[1]]);
  }
  for (const [u, v, size, tone] of [
    [0.35, 2.55, 0.75, 0],
    [2.6, 0.4, 0.75, 7],
    [2.55, 1.3, 0.6, 8],
  ] as const)
    items.push(tree(iso, o, u, v, size, tone));
  items.push(tree(iso, o, 1.2, 2.6, 0.85, 1, 'conifer'), lamp(iso, o, 1.3, 1.3), lamp(iso, o, 1.7, 1.7));
  const centre = at(o, 1.5, 1.5);
  items.push({ depth: centre.depth, draw: () => fountain(iso, centre.u, centre.v, 0.22, 7) });
  drawItems(items);
  paintHedges(iso, { u0: 0, u1: w, v0: 0, v1: h });
}
