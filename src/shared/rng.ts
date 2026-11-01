/** Seeded PRNG (mulberry32). Returns floats in [0, 1). Deterministic per seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derive an independent sub-seed so each noise field / system gets its own stream. */
export function subSeed(seed: number, salt: number): number {
  let h = (seed ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * A mulberry32 stream whose state can be saved and restored, so a loaded city continues
 * with exactly the random numbers the running one would have drawn (docs/specs/engine.md).
 * `next` is bound, so it can be passed wherever a `() => number` is expected.
 */
export class RandomStream {
  private a: number;

  constructor(seed: number) {
    this.a = seed >>> 0;
  }

  readonly next = (): number => {
    this.a = (this.a + 0x6d2b79f5) >>> 0;
    let t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  get state(): number {
    return this.a;
  }

  set state(value: number) {
    this.a = value >>> 0;
  }
}
