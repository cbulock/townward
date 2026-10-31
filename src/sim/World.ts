import { mulberry32, subSeed } from '../shared/rng';
import { GROUND_VARIANTS, Terrain } from './terrain/types';

/**
 * The whole map state as struct-of-arrays layers. Tile index is `y * width + x`.
 * See docs/02-architecture.md, "Data Model".
 */
export class World {
  readonly width: number;
  readonly height: number;
  readonly seed: number;

  readonly terrain: Uint8Array;
  readonly elevation: Uint8Array;
  readonly variant: Uint8Array;
  readonly tree: Uint8Array;
  readonly road: Uint8Array;
  readonly zone: Uint8Array;
  readonly building: Int32Array;

  constructor(width: number, height: number, seed: number) {
    this.width = width;
    this.height = height;
    this.seed = seed;
    const n = width * height;
    this.terrain = new Uint8Array(n);
    this.elevation = new Uint8Array(n);
    this.variant = new Uint8Array(n);
    this.tree = new Uint8Array(n);
    this.road = new Uint8Array(n);
    this.zone = new Uint8Array(n);
    this.building = new Int32Array(n).fill(-1);
  }

  /** Phase 1 placeholder map: all grass with seeded visual variants. Replaced by the terrain generator in Phase 2. */
  static flat(size: number, seed: number): World {
    const world = new World(size, size, seed);
    world.terrain.fill(Terrain.Grass);
    const rng = mulberry32(subSeed(seed, 1));
    for (let i = 0; i < world.variant.length; i++) {
      world.variant[i] = Math.floor(rng() * GROUND_VARIANTS);
    }
    return world;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  index(x: number, y: number): number {
    return y * this.width + x;
  }
}
