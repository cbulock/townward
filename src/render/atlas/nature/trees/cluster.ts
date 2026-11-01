import { mulberry32 } from '../../../../shared/rng';
import type { Rng } from '../../core/iso';
import { TREE_HEADROOM, tileUVToFrame } from '../../geometry';
import { NATURE } from '../../theme/tokens';
import { conifers, greens, paintTreeBody, paintTreeShadow, type Species, type TreeSpec } from './species';

/** Forest tile looks per density. Woods differ in species mix, so a forest isn't one tree repeated. */
export const TREE_VARIANTS = 10;

/** Slots in tile space for each density; trees get jittered and sorted back to front. */
const SLOTS: Readonly<Record<1 | 2 | 3, readonly (readonly [number, number])[]>> = {
  1: [[0.52, 0.5]],
  2: [
    [0.3, 0.36],
    [0.7, 0.62],
  ],
  3: [
    [0.24, 0.28],
    [0.72, 0.3],
    [0.32, 0.72],
    [0.74, 0.74],
  ],
};

/** The kind of wood a variant is: which species grow there and how often they turn. */
interface Wood {
  readonly species: readonly Species[];
  /** Chance a broadleaf shows autumn colour. */
  readonly autumn: number;
}

const WOODS: readonly Wood[] = [
  { species: ['broadleaf', 'broadleaf', 'conifer'], autumn: 0 },
  { species: ['conifer', 'conifer', 'broadleaf'], autumn: 0 },
  { species: ['broadleaf', 'broadleaf', 'broadleaf', 'shrub'], autumn: 0.08 },
  { species: ['conifer'], autumn: 0 },
  { species: ['conifer', 'conifer', 'birch'], autumn: 0 },
  { species: ['broadleaf', 'birch', 'shrub'], autumn: 0.1 },
  { species: ['broadleaf', 'poplar', 'broadleaf'], autumn: 0 },
  { species: ['conifer', 'broadleaf'], autumn: 0.15 },
  { species: ['broadleaf', 'broadleaf', 'shrub'], autumn: 0.3 },
  { species: ['birch', 'birch', 'conifer'], autumn: 0.05 },
];

function pickSpec(rng: Rng, wood: Wood, density: number, k: number): TreeSpec {
  // Shrubs only fill gaps; a slot's own tree is always a real tree.
  const roll = wood.species[Math.floor(rng() * wood.species.length)];
  const species: Species = roll === 'shrub' ? 'broadleaf' : roll;
  const autumn = species !== 'conifer' && rng() < wood.autumn;
  const foliage = species === 'conifer' ? conifers(Math.floor(rng() * 3)) : autumn ? NATURE.autumn[Math.floor(rng() * NATURE.autumn.length)] : greens(Math.floor(rng() * 5));
  const base = density === 1 ? 1.08 : density === 2 ? 1 : 0.88;
  return { species, size: base * (0.84 + rng() * 0.3), foliage, seed: 31 + density * 101 + k * 7 + Math.floor(rng() * 1000) };
}

/**
 * A tile's worth of trees painted into one frame (the ground diamond starts at y = TREE_HEADROOM).
 * One sprite per forested tile keeps sprite counts low; the frame sways as a whole (render/ambient).
 */
export function paintTreeCluster(ctx: CanvasRenderingContext2D, density: 1 | 2 | 3, variant: number) {
  const rng = mulberry32(5000 + density * 31 + variant * 7);
  const wood = WOODS[variant % WOODS.length];
  const trees = SLOTS[density].map(([u, v], k) => {
    const p = tileUVToFrame(u + (rng() - 0.5) * 0.12, v + (rng() - 0.5) * 0.12, TREE_HEADROOM);
    return { x: Math.round(p.x), y: Math.round(p.y), spec: pickSpec(rng, wood, density, k) };
  });
  // An understorey shrub in the gap of sparse tiles.
  if (density < 3 && rng() < 0.6) {
    const p = tileUVToFrame(density === 1 ? 0.28 : 0.72, density === 1 ? 0.74 : 0.3, TREE_HEADROOM);
    trees.push({ x: Math.round(p.x), y: Math.round(p.y), spec: { species: 'shrub', size: 0.75, foliage: greens(Math.floor(rng() * 5)), seed: 77 + variant } });
  }
  trees.sort((a, b) => a.y - b.y);
  for (const t of trees) paintTreeShadow(ctx, t.x, t.y, t.spec);
  for (const t of trees) paintTreeBody(ctx, t.x, t.y, t.spec);
}
