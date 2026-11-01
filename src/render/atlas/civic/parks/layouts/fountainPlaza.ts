import { NATURE } from '../../../theme/tokens';
import { bench, flowerBed, fountain, lamp, path, tree } from '../../kit';
import type { ParkLayout } from './kit';

/** Crossing paths meeting at a fountain, with flower beds, benches, lamps and trees in the corners. */
export const fountainPlaza: ParkLayout = (iso, o, rng, items) => {
  path(iso, o, { u0: 0.44, u1: 0.56, v0: 0.04, v1: 0.96 });
  path(iso, o, { u0: 0.04, u1: 0.96, v0: 0.44, v1: 0.56 });
  iso.disc(0.5, 0.5, 0.22, 0.1, NATURE.pathEdge);
  iso.disc(0.5, 0.5, 0.2, 0.12, NATURE.path);
  flowerBed(iso, o, rng, { u0: 0.12, u1: 0.34, v0: 0.66, v1: 0.88 }, [NATURE.flowers[2], NATURE.flowers[0], NATURE.flowers[1]]);
  flowerBed(iso, o, rng, { u0: 0.66, u1: 0.88, v0: 0.66, v1: 0.88 }, [NATURE.flowers[3], NATURE.flowers[1], NATURE.flowers[5]]);
  items.push({ depth: 1, draw: () => fountain(iso, 0.5, 0.5, 0.15) });
  items.push(bench(iso, o, 0.2, 0.6, true), bench(iso, o, 0.64, 0.6, true), lamp(iso, o, 0.4, 0.62), lamp(iso, o, 0.62, 0.38));
  items.push(tree(iso, o, 0.22, 0.2, 0.85, 0, 'conifer'), tree(iso, o, 0.8, 0.22, 0.8, 7), tree(iso, o, 0.2, 0.42, 0.55, 2));
};
