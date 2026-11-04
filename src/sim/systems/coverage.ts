import { BASIC_SERVICES, BUILDINGS, SERVICE_KINDS, type BuildingDef, type BuildingInstance, type ServiceKind } from '../buildings/catalog';
import type { World } from '../World';
import { isWorking } from './utilities';
import type { SimSystem } from '../core/System';

/**
 * Coverage system: each working service building (police, fire, clinic, school, hospital, university) covers a
 * circle; every building records which services reach it (`services` bitmask).
 * See docs/specs/core.md and D-053.
 */

export function serviceBit(kind: ServiceKind): number {
  return 1 << SERVICE_KINDS.indexOf(kind);
}

/** How many of the four basic services cover a building (0–4); hospital and university don't count. */
export function serviceScore(b: BuildingInstance): number {
  return BASIC_SERVICES.filter((k) => b.services & serviceBit(k)).length;
}


/** Recompute which services cover each building. Call after building or road changes. */
export function updateCoverage(world: World) {
  const buildings = [...world.buildings.values()];

  // Coverage: a circle of `radius` tiles around each working service building's footprint centre.
  const coverage = new Map<ServiceKind, { x: number; y: number; r2: number }[]>(SERVICE_KINDS.map((k) => [k, []]));
  for (const b of buildings) {
    const d: BuildingDef = BUILDINGS[b.def];
    if (!d.service || !d.radius || !isWorking(b)) continue;
    coverage.get(d.service)?.push({ x: b.x + d.size.w / 2, y: b.y + d.size.h / 2, r2: d.radius * d.radius });
  }
  for (const b of buildings) {
    const d: BuildingDef = BUILDINGS[b.def];
    const cx = b.x + d.size.w / 2;
    const cy = b.y + d.size.h / 2;
    let mask = 0;
    SERVICE_KINDS.forEach((k, bit) => {
      if (coverage.get(k)?.some((c) => (c.x - cx) ** 2 + (c.y - cy) ** 2 <= c.r2)) mask |= 1 << bit;
    });
    // A hospital also does a clinic's job (docs/specs/evolution.md).
    if (mask & serviceBit('hospital')) mask |= serviceBit('health');
    b.services = mask;
  }
}

/** Keeps service coverage up to date. */
export class CoverageSystem implements SimSystem {
  readonly name = 'coverage';
  private readonly world: World;
  constructor(world: World) {
    this.world = world;
  }
  onWorldChanged() {
    updateCoverage(this.world);
  }
}
