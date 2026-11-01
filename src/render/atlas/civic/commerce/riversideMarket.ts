import { shade, type Box, type IsoFrame, type Orient, type Rng } from '../../core';
import { MATERIAL, NATURE } from '../../theme/tokens';
import { at, drawItems, type Item } from '../lot';
import { flowerDots, fountain, tree } from '../kit';

/** 2×2 riverside market: four lit stalls with striped canopies round a little fountain. */
export function paintRiversideMarket(iso: IsoFrame, o: Orient, rng: Rng, variant: number) {
  const w = o.vw;
  const h = o.vh;
  iso.floor(0.03, w - 0.03, 0.03, h - 0.03, 0, MATERIAL.kerb);
  iso.floor(0.12, w - 0.12, 0.12, h - 0.12, 0, MATERIAL.pavingLight);
  const items: Item[] = [];
  const stalls: readonly [Box, string][] = [
    [{ u0: 0.18, u1: 0.82, v0: 0.18, v1: 0.8 }, '#e78852'],
    [{ u0: 1.18, u1: 1.82, v0: 0.18, v1: 0.8 }, '#69a9c5'],
    [{ u0: 0.18, u1: 0.82, v0: 1.2, v1: 1.82 }, '#d6b34f'],
    [{ u0: 1.18, u1: 1.82, v0: 1.2, v1: 1.82 }, '#8ab86b'],
  ];
  for (const [local, color] of stalls) {
    const b = o.rect(local);
    items.push({
      depth: b.u0 + b.v0,
      draw: () => {
        iso.solid(b, 0, 9, color);
        // Striped canopy overhanging the front.
        const stripes = 6;
        for (let k = 0; k < stripes; k++) {
          const u0 = b.u0 - 0.03 + ((b.u1 - b.u0 + 0.06) / stripes) * k;
          const u1 = u0 + (b.u1 - b.u0 + 0.06) / stripes;
          iso.floor(u0, u1, b.v0 - 0.03, b.v1 + 0.08, 10.5, k % 2 ? '#fbf6ea' : shade(color, 0.1));
        }
        iso.wall('sw', b.v1 + 0.08, b.u0 - 0.03, b.u1 + 0.03, 9.3, 10.5, shade(color, -0.15));
      },
    });
  }
  const c = at(o, 1, 1);
  items.push({ depth: c.depth, draw: () => fountain(iso, c.u, c.v, 0.16, 6) });
  items.push(tree(iso, o, 1.0, 0.2, 0.5, variant % 9), tree(iso, o, 1.0, 1.85, 0.5, (variant + 3) % 9));
  flowerDots(iso, o, rng, { u0: 0.82, u1: 1.18, v0: 0.4, v1: 0.7 }, 10, NATURE.flowers);
  drawItems(items);
}
