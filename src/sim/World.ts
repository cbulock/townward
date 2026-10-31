import type { BuildingInstance, NewBuilding } from './buildings/catalog';

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
  readonly decor: Uint8Array;
  readonly road: Uint8Array;
  /** Bridge axis for road tiles over water (see sim/roads.ts BridgeAxis). */
  readonly bridge: Uint8Array;
  readonly zone: Uint8Array;
  /** Building instance id covering each tile, −1 if none. */
  readonly building: Int32Array;
  readonly buildings = new Map<number, BuildingInstance>();
  private nextBuildingId = 1;

  constructor(width: number, height: number, seed: number) {
    this.width = width;
    this.height = height;
    this.seed = seed;
    const n = width * height;
    this.terrain = new Uint8Array(n);
    this.elevation = new Uint8Array(n);
    this.variant = new Uint8Array(n);
    this.tree = new Uint8Array(n);
    this.decor = new Uint8Array(n);
    this.road = new Uint8Array(n);
    this.bridge = new Uint8Array(n);
    this.zone = new Uint8Array(n);
    this.building = new Int32Array(n).fill(-1);
  }

  /** Register a building and stamp its id over its footprint. Caller has validated the footprint. */
  addBuilding(b: NewBuilding, w: number, h: number): BuildingInstance {
    const instance: BuildingInstance = { ...b, id: this.nextBuildingId++, occupants: 0, entrance: -1 };
    this.buildings.set(instance.id, instance);
    for (let y = b.y; y < b.y + h; y++) for (let x = b.x; x < b.x + w; x++) this.building[this.index(x, y)] = instance.id;
    return instance;
  }

  removeBuilding(id: number, w: number, h: number) {
    const b = this.buildings.get(id);
    if (!b) return;
    for (let y = b.y; y < b.y + h; y++) for (let x = b.x; x < b.x + w; x++) this.building[this.index(x, y)] = -1;
    this.buildings.delete(id);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  index(x: number, y: number): number {
    return y * this.width + x;
  }
}
