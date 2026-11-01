import { mulberry32 } from '../../../../shared/rng';
import { blobShadow } from '../../core/light';
import type { Rng } from '../../core/iso';
import { NATURE, type Foliage } from '../../theme/tokens';
import { paintBirch, paintBroadleaf, paintPoplar, paintShrub } from './broadleaf';
import { paintConifer } from './conifer';

export type Species = 'broadleaf' | 'conifer' | 'birch' | 'poplar' | 'shrub';

type SpeciesPainter = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, f: Foliage, rng: Rng) => void;

const PAINTERS: Readonly<Record<Species, SpeciesPainter>> = {
  broadleaf: paintBroadleaf,
  conifer: paintConifer,
  birch: paintBirch,
  poplar: paintPoplar,
  shrub: paintShrub,
};

/** Ground shadow size per species (fraction of size 1). */
const SHADOW: Readonly<Record<Species, number>> = { broadleaf: 1, conifer: 0.85, birch: 0.7, poplar: 0.55, shrub: 0.7 };

export interface TreeSpec {
  species: Species;
  size: number;
  foliage: Foliage;
  seed: number;
}

/** Shadows first (so a group of trees never shades a neighbour's crown), then the tree. */
export function paintTreeShadow(ctx: CanvasRenderingContext2D, x: number, y: number, t: TreeSpec) {
  const s = t.size * SHADOW[t.species];
  blobShadow(ctx, x + 3.5 * s, y + 0.5, 10 * s, 4.2 * s);
}

export function paintTreeBody(ctx: CanvasRenderingContext2D, x: number, y: number, t: TreeSpec) {
  PAINTERS[t.species](ctx, x, y, t.size, t.foliage, mulberry32(t.seed));
}

/** A standing tree with its shadow at frame point (x, y): the ground point under the trunk. */
export function paintTree(ctx: CanvasRenderingContext2D, x: number, y: number, t: TreeSpec) {
  paintTreeShadow(ctx, x, y, t);
  paintTreeBody(ctx, x, y, t);
}

/** Pick a foliage family from a tone index (wraps), so callers can vary trees with a number. */
export function greens(tone: number): Foliage {
  return NATURE.greens[((tone % NATURE.greens.length) + NATURE.greens.length) % NATURE.greens.length];
}

export function conifers(tone: number): Foliage {
  return NATURE.conifers[((tone % NATURE.conifers.length) + NATURE.conifers.length) % NATURE.conifers.length];
}

/** Park and street tree: mostly broadleaf greens, with blossom and autumn accents by tone. */
export function ornamentalFoliage(tone: number): Foliage {
  const k = ((tone % 9) + 9) % 9;
  if (k === 7) return NATURE.blossom[0];
  if (k === 8) return NATURE.autumn[1];
  return greens(k);
}

/** A round deciduous tree (the common street, garden and park tree). `size` 1 is about 24 px tall. */
export function paintRoundTree(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, tone: number) {
  paintTree(ctx, x, y, { species: 'broadleaf', size: size * 0.9, foliage: ornamentalFoliage(tone), seed: 900 + tone * 13 + Math.round(size * 10) });
}

/** A single conifer with its shadow. */
export function paintPine(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, tone = 0) {
  paintTree(ctx, x, y, { species: 'conifer', size: size * 0.92, foliage: conifers(tone), seed: 700 + tone * 17 + Math.round(size * 10) });
}
