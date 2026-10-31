import { mulberry32 } from '../../shared/rng';
import { Decor, type DecorId } from '../../sim/terrain/types';
import { TREE_HEADROOM, tileUVToFrame } from './geometry';
import { INK } from './palette';

export const DECOR_VARIANTS = 4;

type Rng = () => number;

/** Paint a decoration into an object frame (ground diamond starts at y = TREE_HEADROOM). */
export function paintDecor(ctx: CanvasRenderingContext2D, kind: Exclude<DecorId, 0>, variant: number) {
  const rng = mulberry32(7000 + kind * 41 + variant * 11);
  PAINTERS[kind](ctx, rng);
}

function at(rng: Rng, spread = 0.5) {
  const p = tileUVToFrame(0.5 + (rng() - 0.5) * spread, 0.5 + (rng() - 0.5) * spread, TREE_HEADROOM);
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

function boulder(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, moss = false) {
  ctx.fillStyle = 'rgba(20, 60, 20, 0.3)';
  ctx.beginPath();
  ctx.ellipse(x + 1.5, y + 0.5, r * 1.1, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.quadraticCurveTo(x - r, y - r * 1.15, x - r * 0.1, y - r * 1.2);
    ctx.quadraticCurveTo(x + r, y - r * 1.05, x + r, y);
    ctx.quadraticCurveTo(x, y + r * 0.35, x - r, y);
    ctx.closePath();
  };
  body();
  ctx.strokeStyle = '#3c434a';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#9ba2aa';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#6e767f';
  ctx.beginPath();
  ctx.ellipse(x + r * 0.6, y - r * 0.1, r * 0.75, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#cdd2d7';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.4, y - r * 0.8, r * 0.4, r * 0.25, -0.4, 0, Math.PI * 2);
  ctx.fill();
  if (moss) {
    ctx.fillStyle = '#4f9d34';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.05, y - r * 1.1, r * 0.55, r * 0.22, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK.grassLight;
    ctx.fillRect(Math.round(x - r * 0.35), Math.round(y - r * 1.2), 2, 1);
  }
  ctx.restore();
}

function flowers(ctx: CanvasRenderingContext2D, rng: Rng, petal: string, centre: string) {
  for (let i = 0; i < 7; i++) {
    const { x, y } = at(rng, 0.7);
    ctx.fillStyle = INK.grassDark;
    ctx.fillRect(x, y - 1, 1, 2);
    ctx.fillStyle = petal;
    ctx.fillRect(x - 1, y - 2, 3, 1);
    ctx.fillRect(x, y - 3, 1, 3);
    ctx.fillStyle = centre;
    ctx.fillRect(x, y - 2, 1, 1);
  }
}

const PAINTERS: Readonly<Record<Exclude<DecorId, 0>, (ctx: CanvasRenderingContext2D, rng: Rng) => void>> = {
  [Decor.Rocks]: (ctx, rng) => {
    const count = 2 + Math.floor(rng() * 2);
    const rocks = Array.from({ length: count }, () => ({ ...at(rng, 0.45), r: 3 + rng() * 3.5 }));
    rocks.sort((a, b) => a.y - b.y);
    for (const r of rocks) boulder(ctx, r.x, r.y, r.r);
  },
  [Decor.Boulder]: (ctx, rng) => {
    // One big boulder with smaller stones tucked around it, drawn back to front.
    const big = { ...at(rng, 0.15), r: 7 + rng() * 2.5, moss: rng() < 0.6 };
    const small = Array.from({ length: 2 + Math.floor(rng() * 2) }, () => {
      const a = rng() * Math.PI * 2;
      return { x: Math.round(big.x + Math.cos(a) * 9), y: Math.round(big.y + Math.sin(a) * 4), r: 2.5 + rng() * 2.5, moss: false };
    });
    const all = [big, ...small].sort((a, b) => a.y - b.y);
    for (const r of all) boulder(ctx, r.x, r.y, r.r, r.moss);
  },
  [Decor.FlowersWhite]: (ctx, rng) => flowers(ctx, rng, '#fbfbf2', '#f2cf3a'),
  [Decor.FlowersYellow]: (ctx, rng) => flowers(ctx, rng, '#f6d33c', '#d9861c'),
  [Decor.TallGrass]: (ctx, rng) => {
    for (let k = 0; k < 2; k++) {
      const { x, y } = at(rng, 0.5);
      for (let b = -3; b <= 3; b++) {
        const h = 4 + Math.floor(rng() * 3) - Math.abs(b) * 0.5;
        ctx.fillStyle = b % 2 === 0 ? INK.grassDark : '#3d8f27';
        ctx.fillRect(x + b, y - h, 1, h);
        ctx.fillStyle = INK.grassLight;
        ctx.fillRect(x + b, y - h, 1, 1);
      }
    }
  },
};
