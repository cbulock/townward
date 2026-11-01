import { mulberry32 } from '../../../../shared/rng';
import { Decor, type DecorId } from '../../../../sim/terrain/types';
import type { Rng } from '../../core/iso';
import { TREE_HEADROOM, tileUVToFrame } from '../../geometry';
import { paintFlowerClump, paintGrassTuft, paintMeadowStalks } from './plants';
import { paintBoulder } from './rocks';

/** Looks per decoration kind. */
export const DECOR_VARIANTS = 6;

/** Paint a decoration into an object frame (ground diamond starts at y = TREE_HEADROOM). */
export function paintDecor(ctx: CanvasRenderingContext2D, kind: Exclude<DecorId, 0>, variant: number) {
  const rng = mulberry32(7000 + kind * 41 + variant * 11);
  PAINTERS[kind](ctx, rng);
}

function at(rng: Rng, spread = 0.5) {
  const p = tileUVToFrame(0.5 + (rng() - 0.5) * spread, 0.5 + (rng() - 0.5) * spread, TREE_HEADROOM);
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

function flowers(ctx: CanvasRenderingContext2D, rng: Rng, petal: string, centre: string) {
  const clumps = Array.from({ length: 4 + Math.floor(rng() * 3) }, () => at(rng, 0.7)).sort((a, b) => a.y - b.y);
  for (const c of clumps) paintFlowerClump(ctx, c.x, c.y, petal, centre, rng, 0.8 + rng() * 0.3);
}

const PAINTERS: Readonly<Record<Exclude<DecorId, 0>, (ctx: CanvasRenderingContext2D, rng: Rng) => void>> = {
  [Decor.Rocks]: (ctx, rng) => {
    const count = 2 + Math.floor(rng() * 2);
    const rocks = Array.from({ length: count }, () => ({ ...at(rng, 0.45), r: 2.5 + rng() * 3.5 }));
    rocks.sort((a, b) => a.y - b.y);
    for (const r of rocks) paintBoulder(ctx, r.x, r.y, r.r, rng, rng() < 0.25);
  },
  [Decor.Boulder]: (ctx, rng) => {
    // One big boulder with smaller stones tucked around it, drawn back to front.
    const big = { ...at(rng, 0.15), r: 7 + rng() * 2.5, moss: rng() < 0.6 };
    const small = Array.from({ length: 2 + Math.floor(rng() * 2) }, () => {
      const a = rng() * Math.PI * 2;
      return { x: Math.round(big.x + Math.cos(a) * 10), y: Math.round(big.y + Math.sin(a) * 4.5), r: 2.2 + rng() * 2.4, moss: false };
    });
    const all = [big, ...small].sort((a, b) => a.y - b.y);
    for (const r of all) paintBoulder(ctx, r.x, r.y, r.r, rng, r.moss);
  },
  [Decor.FlowersWhite]: (ctx, rng) => flowers(ctx, rng, '#fbfaf2', '#f2cf3a'),
  [Decor.FlowersYellow]: (ctx, rng) => flowers(ctx, rng, rng() < 0.5 ? '#f6d33c' : '#f39a3a', '#b8641c'),
  [Decor.TallGrass]: (ctx, rng) => {
    const tufts = Array.from({ length: 2 + Math.floor(rng() * 2) }, () => at(rng, 0.55)).sort((a, b) => a.y - b.y);
    for (const t of tufts) {
      paintGrassTuft(ctx, t.x, t.y, rng, 0.85 + rng() * 0.35);
      if (rng() < 0.4) paintMeadowStalks(ctx, t.x + 2, t.y, rng);
    }
  },
};
