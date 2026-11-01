import { blobShadow, type Box } from '../../../core';
import { MATERIAL, NATURE } from '../../../theme/tokens';
import { at } from '../../lot';
import { flowerDots, tree } from '../../kit';
import type { ParkLayout } from './kit';

/** Picnic grove: shady mixed trees, checked-cloth tables and a winding path. */
export const picnicGrove: ParkLayout = (iso, o, rng, items) => {
  for (let t = 0; t < 1; t += 0.04) {
    const u = 0.08 + t * 0.84;
    const v = 0.5 + Math.sin(t * Math.PI * 2) * 0.12;
    iso.disc(u, v, 0.065, 0.08, NATURE.pathEdge);
  }
  for (let t = 0; t < 1; t += 0.04) {
    const u = 0.08 + t * 0.84;
    const v = 0.5 + Math.sin(t * Math.PI * 2) * 0.12;
    iso.disc(u, v, 0.055, 0.1, NATURE.path);
  }
  flowerDots(iso, o, rng, { u0: 0.1, u1: 0.9, v0: 0.1, v1: 0.9 }, 14, [NATURE.flowers[1], NATURE.flowers[0], NATURE.flowers[3]]);
  for (const [u, v] of [
    [0.3, 0.3],
    [0.66, 0.72],
  ] as const) {
    const p = at(o, u, v);
    items.push({
      depth: p.depth,
      draw: () => {
        const r: Box = { u0: p.u - 0.07, u1: p.u + 0.07, v0: p.v - 0.05, v1: p.v + 0.05 };
        const [x, y] = iso.p(p.u, p.v);
        blobShadow(iso.ctx, x + 3, y + 0.5, 9, 3.2);
        iso.solid({ u0: r.u0, u1: r.u1, v0: r.v0 - 0.05, v1: r.v0 - 0.02 }, 0, 2, MATERIAL.wood);
        iso.solid({ u0: r.u0, u1: r.u1, v0: r.v1 + 0.02, v1: r.v1 + 0.05 }, 0, 2, MATERIAL.wood);
        iso.solid(r, 0, 4, MATERIAL.wood, '#e8483d');
        for (let k = 0; k < 4; k++) iso.floor(r.u0 + 0.01 + k * 0.035, r.u0 + 0.025 + k * 0.035, r.v0, r.v1, 4.05, '#ffffff');
      },
    });
  }
  items.push(
    tree(iso, o, 0.16, 0.18, 0.9, 0),
    tree(iso, o, 0.84, 0.22, 0.85, 8),
    tree(iso, o, 0.2, 0.84, 0.8, 3, 'conifer'),
    tree(iso, o, 0.84, 0.84, 0.75, 2),
    tree(iso, o, 0.52, 0.12, 0.7, 1, 'birch'),
  );
};
