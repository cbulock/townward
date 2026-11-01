import { mulberry32 } from '../../shared/rng';
import { Terrain, type TerrainId } from '../../sim/terrain/types';
import { diamondPath, SEAM_OVERLAP, tileUVToFrame } from './geometry';
import { GROUND_BASE, INK } from './theme/palette';

export const WATER_PHASES = 8;

type Rng = () => number;

/**
 * Paint a full ground tile, clipped to the diamond. Pixel-art style: flat base
 * colour plus crisp 1px marks; no gradients. Variants differ only in where the
 * marks fall, never in base colour, so large areas don't read as a checkerboard.
 * `grow` over-draws the diamond (overlay sources use extra so their edges are fully opaque).
 */
export function paintGround(
  ctx: CanvasRenderingContext2D,
  terrain: TerrainId,
  variant: number,
  phase = 0,
  grow: number = SEAM_OVERLAP,
) {
  const rng = mulberry32(1000 + terrain * 97 + variant * 13);
  diamondPath(ctx, grow);
  ctx.fillStyle = GROUND_BASE[terrain];
  ctx.fill();

  ctx.save();
  diamondPath(ctx, grow);
  ctx.clip();
  DETAIL[terrain](ctx, rng, phase);
  ctx.restore();
}

/** Random point inside the diamond, snapped to the logical pixel grid. */
function pixelIn(rng: Rng, margin = 0.06) {
  const p = tileUVToFrame(margin + rng() * (1 - 2 * margin), margin + rng() * (1 - 2 * margin));
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

function dots(ctx: CanvasRenderingContext2D, rng: Rng, count: number, color: string) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const { x, y } = pixelIn(rng, 0.02);
    ctx.fillRect(x, y, 1, 1);
  }
}

/** Little "v" grass marks, 3px tall. */
function grassMarks(ctx: CanvasRenderingContext2D, rng: Rng, count: number, dark: string, light: string) {
  for (let i = 0; i < count; i++) {
    const { x, y } = pixelIn(rng, 0.1);
    ctx.fillStyle = dark;
    ctx.fillRect(x - 1, y - 1, 1, 1);
    ctx.fillRect(x + 1, y - 1, 1, 1);
    ctx.fillRect(x, y, 1, 1);
    ctx.fillStyle = light;
    ctx.fillRect(x - 1, y - 2, 1, 1);
  }
}

function waterDetail(deep: boolean) {
  return (ctx: CanvasRenderingContext2D, rng: Rng, phase: number) => {
    // Faint darker ripple dashes give the surface some texture.
    ctx.fillStyle = deep ? 'rgba(20, 70, 160, 0.45)' : 'rgba(30, 110, 200, 0.45)';
    for (let i = 0; i < 5; i++) {
      const { x, y } = pixelIn(rng, 0.1);
      ctx.fillRect(x, y, 3 + Math.floor(rng() * 3), 1);
    }
    // Sparkles twinkle with the animation phase, each on its own offset.
    const t = phase / WATER_PHASES;
    for (let i = 0; i < 6; i++) {
      const { x, y } = pixelIn(rng, 0.08);
      const offset = rng();
      const len = 2 + Math.floor(rng() * 3);
      const k = Math.sin(2 * Math.PI * (t + offset));
      if (k < 0.35) continue;
      ctx.fillStyle = INK.sparkle;
      ctx.globalAlpha = k > 0.8 ? 0.95 : 0.55;
      ctx.fillRect(x, y, len, 1);
      ctx.globalAlpha = 1;
    }
  };
}

type DetailPainter = (ctx: CanvasRenderingContext2D, rng: Rng, phase: number) => void;

const DETAIL: Readonly<Record<TerrainId, DetailPainter>> = {
  [Terrain.DeepWater]: waterDetail(true),
  [Terrain.ShallowWater]: waterDetail(false),
  [Terrain.Grass]: (ctx, rng) => {
    dots(ctx, rng, 26, INK.grassLight);
    dots(ctx, rng, 22, INK.grassDark);
    grassMarks(ctx, rng, 4, INK.grassDark, INK.grassLight);
  },
  [Terrain.Sand]: (ctx, rng) => {
    dots(ctx, rng, 30, INK.sandLight);
    dots(ctx, rng, 26, INK.sandDark);
  },
  [Terrain.DryGrass]: (ctx, rng) => {
    dots(ctx, rng, 26, '#c8cf72');
    dots(ctx, rng, 22, '#8c9640');
    grassMarks(ctx, rng, 4, '#8c9640', '#c8cf72');
  },
  [Terrain.Dirt]: (ctx, rng) => {
    dots(ctx, rng, 30, '#c09464');
    dots(ctx, rng, 30, '#87623a');
  },
  [Terrain.Rock]: (ctx, rng) => {
    dots(ctx, rng, 30, '#b6bcc3');
    dots(ctx, rng, 30, '#6f757d');
  },
};
