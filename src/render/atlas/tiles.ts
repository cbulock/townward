import type { Texture } from 'pixi.js';
import { HALF_H, HALF_W, TILE_H, TILE_W } from '../../shared/constants';
import { mulberry32 } from '../../shared/rng';
import { GROUND_VARIANTS } from '../../sim/terrain/types';
import { AtlasBuilder } from './AtlasBuilder';

/**
 * Ground frames have a 1px margin around the 64×32 diamond so the diamond can
 * be over-drawn slightly, hiding hairline seams between neighbouring tiles.
 */
export const GROUND_PAD = 1;
const GROUND_FRAME_W = TILE_W + GROUND_PAD * 2;
const GROUND_FRAME_H = TILE_H + GROUND_PAD * 2;

/** Over-draw so adjacent diamonds overlap by ~1px instead of leaving gaps. */
const SEAM_OVERLAP = 0.75;

function diamondPath(ctx: CanvasRenderingContext2D, grow = 0) {
  const cx = GROUND_PAD + HALF_W;
  const cy = GROUND_PAD + HALF_H;
  const gx = grow * 2; // keep 2:1 ratio when growing
  ctx.beginPath();
  ctx.moveTo(cx, cy - HALF_H - grow);
  ctx.lineTo(cx + HALF_W + gx, cy);
  ctx.lineTo(cx, cy + HALF_H + grow);
  ctx.lineTo(cx - HALF_W - gx, cy);
  ctx.closePath();
}

// Kept within a hair of each other: variety comes from the speckle pattern, not the base hue,
// otherwise the ground reads as a checkerboard.
const GRASS_BASES = ['#5fae4b', '#60af4c', '#5ead4a', '#61b04c'];

function paintGrass(variant: number, grid: boolean) {
  return (ctx: CanvasRenderingContext2D) => {
    const rng = mulberry32(1000 + variant);

    diamondPath(ctx, SEAM_OVERLAP);
    ctx.fillStyle = GRASS_BASES[variant % GRASS_BASES.length];
    ctx.fill();

    // Texture: speckles and small tufts, clipped to the diamond.
    ctx.save();
    diamondPath(ctx, SEAM_OVERLAP);
    ctx.clip();
    for (let i = 0; i < 46; i++) {
      const x = GROUND_PAD + rng() * TILE_W;
      const y = GROUND_PAD + rng() * TILE_H;
      const light = rng() < 0.5;
      ctx.fillStyle = light ? 'rgba(170, 225, 120, 0.35)' : 'rgba(30, 80, 30, 0.22)';
      ctx.fillRect(x, y, 1 + rng(), 1);
    }
    for (let i = 0; i < 5; i++) {
      const x = GROUND_PAD + 10 + rng() * (TILE_W - 20);
      const y = GROUND_PAD + 6 + rng() * (TILE_H - 12);
      ctx.strokeStyle = 'rgba(40, 105, 40, 0.45)';
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 1, y - 2.5);
      ctx.moveTo(x, y);
      ctx.lineTo(x + 1.2, y - 2);
      ctx.stroke();
    }
    ctx.restore();

    if (grid) {
      diamondPath(ctx, -0.25);
      ctx.strokeStyle = 'rgba(15, 45, 15, 0.22)';
      ctx.lineWidth = 0.75;
      ctx.stroke();
    }
  };
}

function paintHover(ctx: CanvasRenderingContext2D) {
  diamondPath(ctx, -1);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(79, 209, 197, 0.95)'; // --accent
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export interface TileTextures {
  grass: Texture[];
  grassGrid: Texture[];
  hover: Texture;
}

/** Paint every tile frame procedurally and pack them into one atlas. */
export function buildTileTextures(): TileTextures {
  const b = new AtlasBuilder(2);
  for (let v = 0; v < GROUND_VARIANTS; v++) {
    b.add(`grass_${v}`, GROUND_FRAME_W, GROUND_FRAME_H, paintGrass(v, false));
    b.add(`grass_grid_${v}`, GROUND_FRAME_W, GROUND_FRAME_H, paintGrass(v, true));
  }
  b.add('hover', GROUND_FRAME_W, GROUND_FRAME_H, paintHover);
  const t = b.build();

  const range = (prefix: string) =>
    Array.from({ length: GROUND_VARIANTS }, (_, v) => t.get(`${prefix}_${v}`)!);
  return {
    grass: range('grass'),
    grassGrid: range('grass_grid'),
    hover: t.get('hover')!,
  };
}
