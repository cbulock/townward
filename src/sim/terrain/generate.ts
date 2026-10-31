import { clamp, createNoise2D, fbm, type Noise2D } from '../../shared/noise';
import { mulberry32, subSeed } from '../../shared/rng';
import { World } from '../World';
import { Decor, GROUND_VARIANTS, Terrain } from './types';
import { PRESETS, presetSettings, type TerrainSettings } from './presets';

export interface TerrainParams {
  seed: number;
  size: number;
}

/** Tuning knobs for river and lake shapes. Distances are in tiles at 128×128 and scale with map size. */
const RIVER = {
  /** Main river half-width: a narrow, lively river (2–3 tiles wide). */
  radius: 1.2,
  tributaryRadius: 0.75,
  tributaryChance: 0.6,
  /** Walk step along the river path. Small enough that stamped discs always overlap. */
  step: 0.35,
  /** Meander wavelength (lower = longer bends) and strength. */
  meanderFreq: 0.032,
  meanderAmp: 1.7,
  /** Max heading off the flow axis (rad). Below 90° so the river never doubles back. */
  maxHeading: 1.3,
  /** Keep the river out of the outer 15% of the map. */
  edgeMargin: 0.15,
} as const;

const LAKES = { min: 1, max: 3, minRadius: 3.5, maxRadius: 9, nearRiverChance: 0.5 } as const;

/**
 * Salts for independent random streams. Changing one feature never reshuffles the others.
 * Features added for the presets (≥ 30) have their own streams, so River Valley at its
 * default sliders stays byte-identical to the approved map (tests/riverValley.test.ts).
 */
const SALT = {
  rng: 10,
  meander: 11,
  width: 12,
  lake: 13,
  beach: 14,
  moisture: 15,
  rocks: 16,
  flowers: 17,
  forest: 18,
  trees: 19,
  variant: 20,
  coast: 30,
  coastShape: 31,
  dry: 32,
  outcrop: 33,
  river3: 34,
} as const;

interface Point {
  x: number;
  y: number;
}

/** River Valley at its default sliders: the approved reference map (seed 42). */
export function generateRiverValley({ seed, size }: TerrainParams): World {
  return generateTerrain(presetSettings('riverValley', seed, size));
}

/**
 * Generate terrain for any preset and slider settings. River Valley is the base:
 * a winding river (with an optional tributary), lakes with sandy rims, forest clumps
 * with meadows between, and decorations. Presets add sea coasts or an island,
 * more lakes, dry grass and dirt, and rock outcrops. See docs/specs/terrain.md.
 */
export function generateTerrain(settings: TerrainSettings): World {
  const { seed, size: n } = settings;
  const preset = PRESETS[settings.preset];
  const waterLevel = clamp(settings.water, 0, 1);
  const rivers = Math.round(clamp(settings.rivers, 0, 3));
  const coastSides = Math.round(clamp(settings.coastSides, 0, 4));
  const world = new World(n, n, seed);
  const rng = mulberry32(subSeed(seed, SALT.rng));
  const scale = n / 128;
  const water = new Uint8Array(n * n);
  /** Sea tiles (coast or ocean), for wide beaches. */
  const sea = new Uint8Array(n * n);

  // --- 0. Sea along some edges, or all around an island ---
  if (coastSides > 0) stampSea(sea, n, coastSides, waterLevel, seed);

  // --- 1. Main river along a random axis, tributary from the far side ---
  const alongX = rng() < 0.5;
  const mainLateral = n * (0.3 + rng() * 0.4);
  const mainRadius = clamp(RIVER.radius * Math.sqrt(scale), 1.1, 2.6);
  const mainPath = walkRiver(n, {
    alongX,
    dir: 1,
    lateral: mainLateral,
    meander: createNoise2D(subSeed(seed, SALT.meander)),
  });
  const widthNoise = createNoise2D(subSeed(seed, SALT.width));
  if (rivers >= 1) {
    for (const p of mainPath.points) {
      stamp(water, n, p, mainRadius * (1 + 0.25 * widthNoise(p.x * 0.05, p.y * 0.05)));
    }
  }

  // Rivers: 1 = main (tributary by chance), 2 = main + tributary, 3 = plus a second main river.
  const tributaryRoll = rng() < RIVER.tributaryChance;
  if ((rivers === 1 && tributaryRoll) || rivers >= 2) {
    // Flow in from the side with more room, toward the main river; stop on contact.
    const fromLow = mainLateral > n / 2;
    const trib = walkRiver(n, {
      alongX: !alongX,
      dir: fromLow ? 1 : -1,
      lateral: n * (0.2 + rng() * 0.6),
      meander: createNoise2D(subSeed(seed, SALT.meander + 100)),
      stopAt: water,
    });
    const r = Math.max(0.8, RIVER.tributaryRadius * Math.sqrt(scale));
    for (const p of trib.points) stamp(water, n, p, r);
  }
  if (rivers >= 3) {
    const r3 = mulberry32(subSeed(seed, SALT.river3));
    // Parallel to the main river, on the side with more room.
    const lateral = mainLateral > n / 2 ? n * (0.15 + r3() * 0.15) : n * (0.7 + r3() * 0.15);
    const second = walkRiver(n, { alongX, dir: -1, lateral, meander: createNoise2D(subSeed(seed, SALT.river3 + 1)) });
    for (const p of second.points) stamp(water, n, p, mainRadius * 0.85);
  }

  // --- 2. Lakes: noisy blobs, some hugging the river like oxbows ---
  const lakeNoise = createNoise2D(subSeed(seed, SALT.lake));
  // Water 0.5 is the River Valley baseline; the slider scales lake count and size.
  const lakeMul = preset.lakes * (0.4 + waterLevel * 1.2);
  const lakeSize = 0.6 + waterLevel * 0.8;
  // Lake-heavy presets get at least their multiplier's worth of lakes, whatever the roll.
  const lakeCount = Math.max(
    waterLevel > 0.05 ? Math.round(LAKES.min * Math.max(1, preset.lakes) * scale) : 0,
    Math.round((LAKES.min + rng() * (LAKES.max - LAKES.min)) * scale * lakeMul),
  );
  for (let k = 0; k < lakeCount; k++) {
    const r = (LAKES.minRadius + rng() * (LAKES.maxRadius - LAKES.minRadius)) * Math.sqrt(scale) * lakeSize;
    let c: Point;
    if (rivers >= 1 && rng() < LAKES.nearRiverChance && mainPath.points.length > 0) {
      const p = mainPath.points[Math.floor(rng() * mainPath.points.length)];
      const side = rng() < 0.5 ? -1 : 1;
      const off = r * 0.8 + mainRadius;
      c = alongX ? { x: p.x, y: p.y + side * off } : { x: p.x + side * off, y: p.y };
    } else {
      c = { x: r + 3 + rng() * (n - 2 * r - 6), y: r + 3 + rng() * (n - 2 * r - 6) };
    }
    stampBlob(water, n, c, r, lakeNoise);
  }
  for (let i = 0; i < n * n; i++) if (sea[i]) water[i] = 1;

  // --- 3. Clean up specks and notches so shorelines read cleanly ---
  for (let pass = 0; pass < 3; pass++) smoothWater(water, n);

  // --- 4. Distance fields drive depth, beaches, moisture and forests ---
  const distToWater = bfsDistance(n, (i) => water[i] === 1);
  const distToLand = bfsDistance(n, (i) => water[i] === 0);
  const distToSea = coastSides > 0 ? bfsDistance(n, (i) => sea[i] === 1 && water[i] === 1) : null;

  const beachN = createNoise2D(subSeed(seed, SALT.beach));
  const moistN = createNoise2D(subSeed(seed, SALT.moisture));
  const rocksN = createNoise2D(subSeed(seed, SALT.rocks));
  const flowersN = createNoise2D(subSeed(seed, SALT.flowers));
  const forestN = createNoise2D(subSeed(seed, SALT.forest));
  const dryN = createNoise2D(subSeed(seed, SALT.dry));
  const outcropN = createNoise2D(subSeed(seed, SALT.outcrop));
  const treeRng = mulberry32(subSeed(seed, SALT.trees));
  const variantRng = mulberry32(subSeed(seed, SALT.variant));
  const decorRolls = new Float32Array(n * n);
  const distances = distToWater;
  // Trees 0.5 is the baseline; the slider and the preset shift the forest threshold.
  const forestShift = (settings.trees - 0.5) * 0.6;

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      world.variant[i] = Math.floor(variantRng() * GROUND_VARIANTS);
      const roll = treeRng();
      decorRolls[i] = treeRng();

      if (water[i]) {
        // Only the middle of big water bodies goes deep; rivers stay one bright blue.
        world.terrain[i] = distToLand[i] >= 3 ? Terrain.DeepWater : Terrain.ShallowWater;
        continue;
      }

      const dw = distToWater[i];
      const beach = beachN(x * 0.11, y * 0.11);
      // A thin sand rim along almost every shore; wide beaches along the sea.
      const ds = distToSea ? distToSea[i] : 255;
      const sand = (dw === 1 && beach > -0.75) || (dw === 2 && beach > 0.65) || ds <= 2 + Math.round(beach * 1.5);
      world.terrain[i] = sand ? Terrain.Sand : Terrain.Grass;
      if (sand) continue;

      // Rock outcrops and dry patches (presets only; River Valley has neither).
      if (preset.rocks > 0 && dw > 3 && fbm(outcropN, x * 0.06, y * 0.06, 3) > 0.62 - preset.rocks * 0.22) {
        world.terrain[i] = Terrain.Rock;
        continue;
      }
      if (preset.dryness > 0) {
        const dry = fbm(dryN, x * 0.03, y * 0.03, 3) + preset.dryness * 0.6 - Math.exp(-dw / 4) * 0.5;
        if (dry > 0.74) world.terrain[i] = Terrain.Dirt;
        else if (dry > 0.3) world.terrain[i] = Terrain.DryGrass;
      }

      // Forests: dense clumps from low-frequency noise with open meadows between, a bit denser near water.
      const moisture = clamp(0.5 + 0.5 * fbm(moistN, x * 0.025, y * 0.025, 3) + 0.25 * Math.exp(-dw / 5), 0, 1);
      const riparian = dw >= 2 && dw <= 4 ? 0.1 : 0;
      const f = fbm(forestN, x * 0.04, y * 0.04, 3) + 0.25 * (moisture - 0.5) + riparian + forestShift;
      let d = f > 0.36 ? 3 : f > 0.27 ? 2 : f > 0.2 ? 1 : 0;
      if (world.terrain[i] === Terrain.Dirt) d = 0;
      if (d === 0 && roll < 0.015 * (0.4 + settings.trees * 1.2)) d = 1; // lone trees in open fields
      world.tree[i] = d;
    }
  }

  placeDecor(world, decorRolls, distances, rocksN, flowersN);
  return world;
}

/**
 * Sea along `sides` map edges (picked by the seed), with a wobbly coastline. Four sides
 * make an island instead: open water outside a noisy radius around the centre.
 */
function stampSea(sea: Uint8Array, n: number, sides: number, waterLevel: number, seed: number) {
  const r = mulberry32(subSeed(seed, SALT.coast));
  const shape = createNoise2D(subSeed(seed, SALT.coastShape));
  if (sides >= 4) {
    // Bigger island with less water.
    const radius = 0.64 + (1 - waterLevel) * 0.3;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const dx = (x + 0.5) / n - 0.5;
        const dy = (y + 0.5) / n - 0.5;
        const d = Math.hypot(dx, dy) * 2 + 0.28 * fbm(shape, x * 0.035, y * 0.035, 3);
        if (d > radius) sea[y * n + x] = 1;
      }
    }
    return;
  }
  // Pick `sides` distinct edges: 0 north (y = 0), 1 east, 2 south, 3 west.
  const order = [0, 1, 2, 3];
  for (let k = 3; k > 0; k--) {
    const j = Math.floor(r() * (k + 1));
    [order[k], order[j]] = [order[j], order[k]];
  }
  const depth = n * (0.08 + waterLevel * 0.16);
  for (const side of order.slice(0, sides)) {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const edge = side === 0 ? y : side === 1 ? n - 1 - x : side === 2 ? n - 1 - y : x;
        const along = side % 2 === 0 ? x : y;
        const wobble = fbm(shape, along * 0.03 + side * 17, 0.5 + side, 3) * n * 0.09;
        if (edge < depth + wobble) sea[y * n + x] = 1;
      }
    }
  }
}

/**
 * Decorations go where they look natural:
 *   - rocky meadows: boulder piles and stone clusters grouped by noise
 *   - forest edges: the odd boulder where trees meet open grass
 *   - riverbanks: small stones on the sand
 *   - flower patches in groups, tall grass scattered
 * Runs after trees are placed so it can see forest edges.
 */
function placeDecor(world: World, rolls: Float32Array, distToWater: Uint8Array, rocksN: Noise2D, flowersN: Noise2D) {
  const n = world.width;
  const hasTree = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n && world.tree[y * n + x] > 0;

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const t = world.terrain[i];
      const roll = rolls[i];
      if (world.tree[i] > 0) continue;

      if (t === Terrain.Sand) {
        if (roll < 0.07) world.decor[i] = Decor.Rocks;
        continue;
      }
      if ((t !== Terrain.Grass && t !== Terrain.DryGrass) || distToWater[i] <= 1) continue;

      const rocky = rocksN(x * 0.07, y * 0.07);
      const forestEdge = hasTree(x + 1, y) || hasTree(x - 1, y) || hasTree(x, y + 1) || hasTree(x, y - 1);
      if (rocky > 0.5 && roll < 0.4) world.decor[i] = roll < 0.14 ? Decor.Boulder : Decor.Rocks;
      else if (forestEdge && roll < 0.06) world.decor[i] = roll < 0.03 ? Decor.Boulder : Decor.Rocks;
      else if (flowersN(x * 0.08, y * 0.08) > 0.5 && roll < 0.55) {
        world.decor[i] = flowersN(x * 0.02 + 50, y * 0.02) > 0 ? Decor.FlowersYellow : Decor.FlowersWhite;
      } else if (roll < 0.05) world.decor[i] = Decor.TallGrass;
    }
  }
}

interface WalkOptions {
  alongX: boolean;
  /** +1 walks from the low edge to the high edge, −1 the reverse. */
  dir: 1 | -1;
  /** Starting position across the flow axis. */
  lateral: number;
  meander: Noise2D;
  /** If set, stop shortly after entering water already present in this mask. */
  stopAt?: Uint8Array;
}

/**
 * Walk a meandering path across the map. Heading eases toward a noise-driven
 * target angle, so bends are smooth and the river never doubles back.
 */
function walkRiver(n: number, o: WalkOptions): { points: Point[] } {
  const points: Point[] = [];
  let a = o.dir === 1 ? -2 : n + 2;
  let b = o.lateral;
  let heading = 0;
  let t = 0;
  const margin = n * RIVER.edgeMargin;
  const maxSteps = (n * 4) / RIVER.step;

  for (let s = 0; s < maxSteps; s++) {
    let target = RIVER.meanderAmp * o.meander(t * RIVER.meanderFreq, 0.5) + 0.3 * o.meander(t * 0.11, 7.3);
    if (b < margin) target += 0.6;
    else if (b > n - margin) target -= 0.6;
    heading += (clamp(target, -RIVER.maxHeading, RIVER.maxHeading) - heading) * 0.1;

    a += o.dir * Math.cos(heading) * RIVER.step;
    b += Math.sin(heading) * RIVER.step;
    t += RIVER.step;

    const p = o.alongX ? { x: a, y: b } : { x: b, y: a };
    points.push(p);

    if (o.dir === 1 ? a > n + 2 : a < -2) break;
    if (o.stopAt && t > 6) {
      const tx = Math.floor(p.x);
      const ty = Math.floor(p.y);
      if (tx >= 0 && ty >= 0 && tx < n && ty < n && o.stopAt[ty * n + tx]) break;
    }
  }
  return { points };
}

/** Mark every tile whose centre lies within `r` of `p`. */
function stamp(mask: Uint8Array, n: number, p: Point, r: number) {
  const x0 = Math.max(0, Math.floor(p.x - r - 1));
  const x1 = Math.min(n - 1, Math.ceil(p.x + r + 1));
  const y0 = Math.max(0, Math.floor(p.y - r - 1));
  const y1 = Math.min(n - 1, Math.ceil(p.y + r + 1));
  const r2 = r * r;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - p.x;
      const dy = y + 0.5 - p.y;
      if (dx * dx + dy * dy <= r2) mask[y * n + x] = 1;
    }
  }
}

/** Organic blob: radial distance perturbed by noise. */
function stampBlob(mask: Uint8Array, n: number, c: Point, r: number, noise: Noise2D) {
  const reach = r * 1.5;
  const x0 = Math.max(0, Math.floor(c.x - reach));
  const x1 = Math.min(n - 1, Math.ceil(c.x + reach));
  const y0 = Math.max(0, Math.floor(c.y - reach));
  const y1 = Math.min(n - 1, Math.ceil(c.y + reach));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y) / r;
      if (d + 0.35 * noise(x * 0.18, y * 0.18) < 1) mask[y * n + x] = 1;
    }
  }
}

/**
 * One cellular pass: drop isolated water, fill land notches/specks.
 * Off-map neighbours count as the tile's own type so rivers keep reaching the edge.
 */
function smoothWater(mask: Uint8Array, n: number) {
  const src = mask.slice();
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const self = src[i];
      let same = 0;
      for (const [dx, dy] of NEIGHBORS_4) {
        const nx = x + dx;
        const ny = y + dy;
        const v = nx < 0 || ny < 0 || nx >= n || ny >= n ? self : src[ny * n + nx];
        if (v === self) same++;
      }
      if (same <= 1) mask[i] = self ? 0 : 1;
    }
  }
}

const NEIGHBORS_4: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Multi-source BFS (4-neighbour) distance to the nearest source tile, capped at 255. */
export function bfsDistance(n: number, isSource: (i: number) => boolean): Uint8Array {
  const dist = new Uint8Array(n * n).fill(255);
  const queue = new Int32Array(n * n);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < n * n; i++) {
    if (isSource(i)) {
      dist[i] = 0;
      queue[tail++] = i;
    }
  }
  const visit = (j: number, d: number) => {
    if (dist[j] > d) {
      dist[j] = d;
      queue[tail++] = j;
    }
  };
  while (head < tail) {
    const i = queue[head++];
    const d = dist[i] + 1;
    if (d >= 255) continue;
    const x = i % n;
    const y = (i - x) / n;
    if (x > 0) visit(i - 1, d);
    if (x < n - 1) visit(i + 1, d);
    if (y > 0) visit(i - n, d);
    if (y < n - 1) visit(i + n, d);
  }
  return dist;
}
