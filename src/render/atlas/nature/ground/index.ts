import { mulberry32 } from '../../../../shared/rng';
import { Terrain, type TerrainId } from '../../../../sim/terrain/types';
import { diamondPath, SEAM_OVERLAP } from '../../geometry';
import { GROUND_BASE } from '../../theme/palette';
import { paintDirt, paintDryGrass, paintGrass, paintRock, paintSand, type SurfacePainter } from './land';
import { paintDeepWater, paintShallowWater } from './water';

export { WATER_PHASES } from './water';

const SURFACE: Readonly<Record<TerrainId, SurfacePainter>> = {
  [Terrain.DeepWater]: paintDeepWater,
  [Terrain.ShallowWater]: paintShallowWater,
  [Terrain.Grass]: paintGrass,
  [Terrain.DryGrass]: paintDryGrass,
  [Terrain.Sand]: paintSand,
  [Terrain.Dirt]: paintDirt,
  [Terrain.Rock]: paintRock,
};

/**
 * Paint a full ground tile, clipped to the diamond: the terrain's flat base colour, then its
 * surface marks (land.ts, water.ts). `grow` over-draws the diamond (overlay sources use extra
 * so their edges are fully opaque).
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
  SURFACE[terrain](ctx, rng, phase);
  ctx.restore();
}
