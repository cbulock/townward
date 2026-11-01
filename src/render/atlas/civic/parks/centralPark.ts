import { shade, type IsoFrame, type Orient, type Rng } from '../../core';
import { NATURE } from '../../theme/tokens';
import { at, drawItems, type Item } from '../lot';
import { bench, flowerBed, fountain, lamp, lawn, paintHedges, path, tree } from '../kit';

/** 3×3 central park: a lake with an island, a plaza fountain, crossing walks, beds and a grove. */
export function paintCentralPark(iso: IsoFrame, o: Orient, rng: Rng, variant: number) {
  const w = o.vw;
  const h = o.vh;
  lawn(iso, { u0: 0, u1: w, v0: 0, v1: h });
  path(iso, o, { u0: 0.12, u1: 2.88, v0: 1.42, v1: 1.58 });
  path(iso, o, { u0: 1.42, u1: 1.58, v0: 0.12, v1: 2.88 });
  // Lake: sandy shore, deep centre, light shallows, and a small wooded island.
  const lake = at(o, 2.05, 2.1);
  const [lx, ly] = iso.p(lake.u, lake.v, 0.14);
  iso.disc(lake.u, lake.v, 0.66, 0.1, '#d7c69f');
  const g = iso.ctx.createRadialGradient(lx - 14, ly - 6, 4, lx, ly, 60);
  g.addColorStop(0, NATURE.waterLight);
  g.addColorStop(0.45, NATURE.water);
  g.addColorStop(1, shade(NATURE.water, -0.3));
  iso.disc(lake.u, lake.v, 0.6, 0.14, g);
  for (let k = 0; k < 3; k++) iso.disc(lake.u - 0.25 + k * 0.18, lake.v - 0.2 + k * 0.05, 0.05, 0.18, 'rgba(255,255,255,0.15)');
  const island = at(o, 2.17, 2.18);
  iso.disc(island.u, island.v, 0.13, 0.2, '#d7c69f');
  iso.disc(island.u, island.v, 0.1, 0.25, NATURE.lawn);
  const plaza = at(o, 1.5, 1.5);
  iso.disc(plaza.u, plaza.v, 0.36, 0.12, NATURE.pathEdge);
  iso.disc(plaza.u, plaza.v, 0.33, 0.14, NATURE.path);
  flowerBed(iso, o, rng, { u0: 0.3, u1: 0.95, v0: 0.3, v1: 0.6 }, NATURE.flowers);
  flowerBed(iso, o, rng, { u0: 1.75, u1: 2.6, v0: 0.32, v1: 0.62 }, [NATURE.flowers[2], NATURE.flowers[0], NATURE.flowers[1]]);
  const items: Item[] = [{ depth: plaza.depth, draw: () => fountain(iso, plaza.u, plaza.v, 0.2, 9) }];
  const trees: readonly (readonly [number, number, number, number])[] = [
    [0.35, 0.95, 0.9, 0],
    [0.62, 1.15, 0.8, 3],
    [2.4, 0.95, 0.95, 1],
    [0.36, 2.45, 0.85, 2],
    [0.75, 2.6, 0.8, 7],
    [1.08, 2.25, 0.75, 4],
    [2.17, 2.15, 0.55, 1],
  ];
  for (const [u, v, size, tone] of trees) items.push(tree(iso, o, u, v, size, tone + variant));
  items.push(tree(iso, o, 0.3, 1.9, 0.9, variant, 'conifer'), tree(iso, o, 2.7, 0.3, 0.85, 1, 'poplar'), tree(iso, o, 2.7, 0.62, 0.8, 2, 'poplar'));
  items.push(bench(iso, o, 1.1, 1.25, true), bench(iso, o, 1.7, 1.25, true), lamp(iso, o, 1.32, 1.3), lamp(iso, o, 1.68, 1.7), lamp(iso, o, 1.3, 2.6), lamp(iso, o, 2.6, 1.32));
  drawItems(items);
  paintHedges(iso, { u0: 0, u1: w, v0: 0, v1: h });
}
