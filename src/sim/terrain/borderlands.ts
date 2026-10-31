import { clamp, createNoise2D, fbm } from '../../shared/noise';
import { subSeed } from '../../shared/rng';
import { World } from '../World';
import { bfsDistance } from './generate';
import { Terrain } from './types';

/**
 * Borderlands (docs/specs/elevation.md): decorative land all round the map. It's render-only,
 * nothing in the sim reads it. Returns an extended world (map size + 2·ring on each axis)
 * whose middle is a copy of the map, so the seam matches exactly. Around it:
 *   - rivers and sea that touch the edge carry on outward (with a gentle wobble);
 *   - land eases down from the edge's height into low rolling ground (kept simple and gentle:
 *     steep slopes stretched the textures and the hill light into smudges);
 *   - forests from noise, sand along the continued water.
 */

const SALT = { wobble: 50, mountains: 51, forest: 52, dry: 53 } as const;

/** Ring width in tiles for a map size: 40 at 128×128, never more than 48. */
export function borderRing(size: number): number {
  return Math.min(48, Math.round((40 * size) / 128));
}

export function generateBorderlands(map: World, ring: number): World {
  const mw = map.width;
  const mh = map.height;
  const n = mw + 2 * ring;
  const ext = new World(n, n, map.seed);
  const wobble = createNoise2D(subSeed(map.seed, SALT.wobble));
  const mountains = createNoise2D(subSeed(map.seed, SALT.mountains));
  const forest = createNoise2D(subSeed(map.seed, SALT.forest));
  const dry = createNoise2D(subSeed(map.seed, SALT.dry));
  const water = new Uint8Array(n * n);
  /** Distance outside the map (0 inside), Chebyshev. */
  const out = new Uint8Array(n * n);
  /** Level of the map edge tile each ring tile continues from. */
  const edgeLevel = new Uint8Array(n * n);

  for (let ey = 0; ey < n; ey++) {
    for (let ex = 0; ex < n; ex++) {
      const i = ey * n + ex;
      const mx = ex - ring;
      const my = ey - ring;
      if (map.inBounds(mx, my)) {
        const j = map.index(mx, my);
        ext.terrain[i] = map.terrain[j];
        ext.elevation[i] = map.elevation[j];
        ext.tree[i] = map.tree[j];
        ext.variant[i] = map.variant[j];
        const t = map.terrain[j];
        water[i] = t === Terrain.DeepWater || t === Terrain.ShallowWater ? 1 : 0;
        continue;
      }
      const dx = mx < 0 ? -mx : mx >= mw ? mx - mw + 1 : 0;
      const dy = my < 0 ? -my : my >= mh ? my - mh + 1 : 0;
      const d = Math.max(dx, dy);
      out[i] = d;
      // Continue from the edge tile straight outward, wobbling along the edge as it gets further away.
      const w = wobble(ex * 0.045, ey * 0.045) * d * 0.4;
      const sx = Math.round(clamp(dx > 0 ? (mx < 0 ? 0 : mw - 1) : mx + w, 0, mw - 1));
      const sy = Math.round(clamp(dy > 0 ? (my < 0 ? 0 : mh - 1) : my + w, 0, mh - 1));
      const j = map.index(sx, sy);
      const t = map.terrain[j];
      water[i] = t === Terrain.DeepWater || t === Terrain.ShallowWater ? 1 : 0;
      edgeLevel[i] = map.elevation[j];
      ext.variant[i] = (ex * 7 + ey * 13) % 4;
    }
  }

  // Heights: the edge's level fades out over a few tiles, plus a low roll (at most 2 levels).
  for (let i = 0; i < n * n; i++) {
    const d = out[i];
    if (d === 0) continue;
    if (water[i]) {
      ext.elevation[i] = 0;
      continue;
    }
    const ex = i % n;
    const ey = (i - ex) / n;
    const fade = Math.max(0, 1 - d / 8);
    const roll = clamp(1 + 1.5 * fbm(mountains, ex * 0.04, ey * 0.04, 3), 0, 2);
    ext.elevation[i] = Math.round(Math.max(edgeLevel[i] * fade, roll));
  }
  smoothRing(ext, out);

  // Terrain and trees for the ring's land.
  const distToWater = bfsDistance(n, (i) => water[i] === 1);
  const distToLand = bfsDistance(n, (i) => water[i] === 0);
  for (let i = 0; i < n * n; i++) {
    const d = out[i];
    if (d === 0) continue;
    const ex = i % n;
    const ey = (i - ex) / n;
    if (water[i]) {
      ext.terrain[i] = distToLand[i] >= 3 ? Terrain.DeepWater : Terrain.ShallowWater;
      continue;
    }
    if (distToWater[i] === 1) {
      ext.terrain[i] = Terrain.Sand;
      continue;
    }
    ext.terrain[i] = fbm(dry, ex * 0.03, ey * 0.03, 3) > 0.3 ? Terrain.DryGrass : Terrain.Grass;
    const f = fbm(forest, ex * 0.04, ey * 0.04, 3) + 0.1;
    ext.tree[i] = f > 0.3 ? 3 : f > 0.18 ? 2 : f > 0.08 ? 1 : 0;
  }
  return ext;
}

/** Lowering-only smoothing of ring tiles (the map copy in the middle never changes). */
function smoothRing(ext: World, out: Uint8Array) {
  const n = ext.width;
  const e = ext.elevation;
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      for (let k = 0; k < n * n; k++) {
        const i = pass === 0 ? k : n * n - 1 - k;
        if (out[i] === 0) continue;
        const x = i % n;
        const y = (i - x) / n;
        let cap = e[i];
        if (x > 0) cap = Math.min(cap, e[i - 1] + 1);
        if (x < n - 1) cap = Math.min(cap, e[i + 1] + 1);
        if (y > 0) cap = Math.min(cap, e[i - n] + 1);
        if (y < n - 1) cap = Math.min(cap, e[i + n] + 1);
        if (cap < e[i]) {
          e[i] = cap;
          changed = true;
        }
      }
    }
  }
}
