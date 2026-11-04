import { alpha } from '../../core/color';
import { GROUND, type GroundTone } from '../../theme/tokens';
import { arc, pointIn } from './marks';
import type { SurfacePainter } from './land';

/** Animation frames of the water surface (the renderer cycles them). */
export const WATER_PHASES = 8;

/**
 * Open water: a smooth surface with a couple of faint swells, and soft sun glints that brighten
 * and fade with the phase, each on its own offset so the sea shimmers instead of blinking.
 */
function water(tone: GroundTone, glints: number): SurfacePainter {
  return (ctx, rng, phase) => {
    for (let i = 0; i < 2; i++) {
      const p = pointIn(rng, 0.18);
      arc(ctx, p.x, p.y, 9 + rng() * 5, 1.2, 0.9, alpha(tone.dark, 0.6));
    }
    const t = phase / WATER_PHASES;
    for (let i = 0; i < glints; i++) {
      // Every rng() call comes before the skip, so a glint sits in the same place in every phase.
      const p = pointIn(rng, 0.12);
      const offset = rng();
      const len = 3 + rng() * 3;
      const k = Math.sin(2 * Math.PI * (t + offset));
      if (k < 0.2) continue;
      const glow = (k - 0.2) / 0.8;
      arc(ctx, p.x, p.y, len * (0.8 + glow * 0.2), 0.7, 0.8, alpha(GROUND.glint, 0.25 + glow * 0.6));
    }
    // A pale wash under the glints keeps shallows visibly lighter than the deep.
    if (tone === GROUND.shallow) {
      const p = pointIn(rng, 0.2);
      arc(ctx, p.x, p.y, 10, 1.4, 1.1, alpha(tone.light, 0.25));
    }
  };
}

export const paintDeepWater: SurfacePainter = water(GROUND.deep, 4);
export const paintShallowWater: SurfacePainter = water(GROUND.shallow, 5);
