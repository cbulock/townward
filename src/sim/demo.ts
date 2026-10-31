import { mulberry32, subSeed } from '../shared/rng';
import { ART_VARIANTS, BUILDINGS, startLevel, zonedBuildings, type BuildingDef, type BuildingId } from './buildings/catalog';
import { BALANCE } from '../shared/balance';
import { Decor } from './terrain/types';
import type { City } from './City';
import { applyPlace, applyRoad, applyZone, planPlace, planRoad, planZone } from './commands';
import { growDay } from './systems/growth';
import { refreshCity } from './core/Simulation';
import { findEntrance } from './systems/access';
import { simulateDay } from './systems/population';
import { rectTiles, roadPath, RoadType, type BuildableRoad } from './roads';
import { needsUtilities, roadIslands } from './systems/utilities';
import { isZoned, ZONE_DENSITY, ZONE_LETTER, ZoneType, type ZonedType } from './zones';

/**
 * The /demo city (docs/specs/demo.md): a planned, fully grown town on any map, the same for
 * the same seed. A street grid with highway avenues, a downtown of offices and towers around
 * the town hall, apartments and shops, then houses on the outskirts, an industrial and
 * utility district, parks, and a service block every few blocks. Then a couple of years of
 * growth are simulated, adding power plants and water towers whenever the city runs short.
 */

/** Street spacing: 5×5 blocks between roads. */
const PITCH = 6;
/** Blocks from the centre to the edge of the planned area. */
const BLOCKS = 5;
/** Simulated days, and growth steps per day (several, so the city matures quickly). */
const DAYS = 640;
const GROWTH_STEPS = 3;
/** Days simulated after the empty lots are built out. */
const SETTLE_DAYS = 40;

type BlockUse = { kind: 'zone'; zone: ZonedType } | { kind: 'park' } | { kind: 'services' } | { kind: 'utilities' } | { kind: 'hall' };

export interface DemoCity {
  /** Tile at the middle of the planned area (for the camera). */
  centre: { x: number; y: number };
}

export function buildDemoCity(city: City, seed: number): DemoCity {
  const w = city.world;
  const rng = mulberry32(subSeed(seed, 0xde70));
  const cx = Math.floor(w.width / 2);
  const cy = Math.floor(w.height / 2);
  const x0 = cx - BLOCKS * PITCH;
  const y0 = cy - BLOCKS * PITCH;
  const span = 2 * BLOCKS * PITCH;

  // Streets: one segment per block edge, so a blocked crossing only loses that segment.
  // The two central avenues are highways.
  const road = (ax: number, ay: number, bx: number, by: number, type: BuildableRoad) =>
    applyRoad(city, planRoad(w, roadPath({ x: ax, y: ay }, { x: bx, y: by }, true), type), type);
  for (let k = 0; k <= 2 * BLOCKS; k++) {
    const line = k * PITCH;
    const type = k === BLOCKS ? RoadType.Highway : RoadType.Road;
    for (let s = 0; s < 2 * BLOCKS; s++) {
      road(x0 + line, y0 + s * PITCH, x0 + line, y0 + (s + 1) * PITCH, type);
      road(x0 + s * PITCH, y0 + line, x0 + (s + 1) * PITCH, y0 + line, type);
    }
  }

  // What each block is for, by ring (distance from the centre in blocks).
  const uses: BlockUse[][] = [];
  for (let by = 0; by < 2 * BLOCKS; by++) {
    const row: BlockUse[] = [];
    for (let bx = 0; bx < 2 * BLOCKS; bx++) row.push(blockUse(bx, by, rng));
    uses.push(row);
  }

  const utilitySlots: UtilitySlot[] = [];
  const place = (id: BuildingId, x: number, y: number) => applyPlace(city, planPlace(w, id, x, y), Math.floor(rng() * ART_VARIANTS)).ok;
  for (let by = 0; by < 2 * BLOCKS; by++) {
    for (let bx = 0; bx < 2 * BLOCKS; bx++) {
      const use = uses[by][bx];
      // Block interior: the 5×5 between the streets.
      const ix = x0 + bx * PITCH + 1;
      const iy = y0 + by * PITCH + 1;
      const zone = (x: number, y: number, x1: number, y1: number, z: ZonedType) =>
        applyZone(city, planZone(w, rectTiles({ x, y }, { x: x1, y: y1 }), z), z);
      if (use.kind === 'zone') zone(ix, iy, ix + 4, iy + 4, use.zone);
      else if (use.kind === 'park') for (let y = iy; y < iy + 5; y++) for (let x = ix; x < ix + 5; x++) place('park', x, y);
      else if (use.kind === 'hall') {
        place('town_hall', ix + 1, iy + 1);
        for (const [x, y] of ringOf(ix, iy)) place('park', x, y);
      } else if (use.kind === 'services') {
        place('police_station', ix, iy);
        place('fire_station', ix + 4, iy);
        place('clinic', ix, iy + 4);
        place('school', ix + 2, iy + 2);
        // The rest of the block: apartments around the services (zoning skips their tiles).
        zone(ix, iy, ix + 4, iy + 4, ZoneType.ResidentialHigh);
      } else {
        // Utility district: power plants and water towers are added as the city needs them.
        for (const [ox, oy] of [
          [0, 0],
          [2, 0],
          [0, 2],
          [2, 2],
        ] as const) {
          utilitySlots.push({ id: 'power_plant', x: ix + ox, y: iy + oy });
        }
        for (let k = 0; k < 5; k++) utilitySlots.push({ id: 'water_tower', x: ix + k, y: iy + 4 });
        for (let k = 0; k < 4; k++) utilitySlots.push({ id: 'water_tower', x: ix + 4, y: iy + k });
      }
    }
  }

  // Start with one plant and one tower in the district; add more wherever the city runs short.
  for (const id of ['power_plant', 'water_tower'] as const) {
    const k = utilitySlots.findIndex((s) => s.id === id && place(s.id, s.x, s.y));
    if (k !== -1) utilitySlots.splice(k, 1);
  }

  const grow = mulberry32(subSeed(seed, 0x6077));
  refreshCity(w);
  for (let day = 0; day < DAYS; day++) {
    for (let k = 0; k < GROWTH_STEPS; k++) growDay(w, grow, city.taxRate);
    refreshCity(w);
    if (day % 5 === 0) serveIslands(city, utilitySlots, rng);
    simulateDay(w);
  }
  serveIslands(city, utilitySlots, rng);

  // A showcase shouldn't have empty blocks: build out every lot growth hasn't reached yet,
  // then simulate a month so people move in and utilities catch up.
  fillLots(city, rng);
  refreshCity(w);
  // The build-out jumps demand: add plants and towers until everyone is supplied.
  for (let k = 0; k < 60 && serveIslands(city, utilitySlots, rng); k++);
  for (let day = 0; day < SETTLE_DAYS; day++) {
    refreshCity(w);
    if (day % 5 === 0) serveIslands(city, utilitySlots, rng);
    simulateDay(w);
  }
  for (let k = 0; k < 60 && serveIslands(city, utilitySlots, rng); k++);
  refreshCity(w);
  city.day = DAYS + SETTLE_DAYS;
  return { centre: { x: x0 + span / 2, y: y0 + span / 2 } };
}

/**
 * Build a finished building on every empty zoned lot with road access: 2×2 at the top level
 * where a whole square of the zone is free (towers downtown, factories in industry), otherwise
 * the zone's best 1×1 (houses on the outskirts mix levels 1 and 2).
 */
function fillLots(city: City, rng: () => number) {
  const w = city.world;
  const free = (x: number, y: number, z: number) =>
    w.inBounds(x, y) && w.zone[w.index(x, y)] === z && w.building[w.index(x, y)] === -1;
  const build = (def: BuildingId, x: number, y: number) => {
    const { w: bw, h: bh } = BUILDINGS[def].size;
    for (let ty = y; ty < y + bh; ty++) {
      for (let tx = x; tx < x + bw; tx++) {
        const i = w.index(tx, ty);
        w.tree[i] = 0;
        w.decor[i] = Decor.None;
      }
    }
    w.addBuilding({ def, x, y, variant: Math.floor(rng() * ART_VARIANTS), grown: true }, bw, bh);
  };
  for (let y = 0; y < w.height; y++) {
    for (let x = 0; x < w.width; x++) {
      const z = w.zone[w.index(x, y)];
      if (!isZoned(z) || !free(x, y, z)) continue;
      if (findEntrance(w, x, y, 1, 1, BALANCE.roadAccessRange) === -1) continue;
      const letter = ZONE_LETTER[z];
      const density = ZONE_DENSITY[z];
      const square = free(x + 1, y, z) && free(x, y + 1, z) && free(x + 1, y + 1, z);
      const big = [3, 2].map((level) => zonedBuildings(letter, density, level, 2)).find((ids) => ids.length > 0) ?? [];
      // Most free squares become one big building; some stay small for variety.
      if (square && big.length > 0 && rng() < 0.75) {
        build(big[Math.floor(rng() * big.length)], x, y);
        continue;
      }
      const top = startLevel(letter, density) + (rng() < 0.6 ? 1 : 0);
      const small = zonedBuildings(letter, density, top, 1);
      const ids = small.length > 0 ? small : zonedBuildings(letter, density, startLevel(letter, density), 1);
      if (ids.length > 0) build(ids[Math.floor(rng() * ids.length)], x, y);
    }
  }
}

interface UtilitySlot {
  id: BuildingId;
  x: number;
  y: number;
}

/**
 * Every road island with buildings short of power or water gets one more plant or tower:
 * in a free utility-district slot on that island if there is one, otherwise on the first
 * free land next to its roads (islands cut off by the river need their own).
 */
function serveIslands(city: City, slots: UtilitySlot[], rng: () => number): boolean {
  const w = city.world;
  const islands = roadIslands(w);
  const lacking = new Map<number, { power: boolean; water: boolean }>();
  for (const b of w.buildings.values()) {
    const d: BuildingDef = BUILDINGS[b.def];
    if (b.entrance === -1 || !needsUtilities(d) || b.construction > 0 || (b.powered && b.watered)) continue;
    const island = islands[b.entrance];
    const l = lacking.get(island) ?? { power: false, water: false };
    lacking.set(island, { power: l.power || !b.powered, water: l.water || !b.watered });
  }
  if (lacking.size === 0) return false;
  const supply = (id: BuildingId, island: number) => {
    const { w: bw, h: bh } = BUILDINGS[id].size;
    for (let k = 0; k < slots.length; k++) {
      const s = slots[k];
      if (s.id !== id) continue;
      const entrance = findEntrance(w, s.x, s.y, bw, bh, 3);
      if (entrance === -1 || islands[entrance] !== island) continue;
      const plan = planPlace(w, id, s.x, s.y);
      slots.splice(k, 1);
      if (plan.ok && applyPlace(city, plan, Math.floor(rng() * ART_VARIANTS)).ok) return;
      k--;
    }
    placeOnIsland(city, id, island, islands, rng);
  };
  for (const [island, need] of lacking) {
    if (need.power) supply('power_plant', island);
    if (need.water) supply('water_tower', island);
  }
  refreshCity(w);
  return true;
}

/** Place `id` on the first free spot whose entrance road is on `island`. */
function placeOnIsland(city: City, id: BuildingId, island: number, islands: Int32Array, rng: () => number) {
  const w = city.world;
  const { w: bw, h: bh } = BUILDINGS[id].size;
  for (let y = 0; y < w.height; y++) {
    for (let x = 0; x < w.width; x++) {
      const entrance = findEntrance(w, x, y, bw, bh, 1);
      if (entrance === -1 || islands[entrance] !== island) continue;
      const plan = planPlace(w, id, x, y);
      if (plan.ok && applyPlace(city, plan, Math.floor(rng() * ART_VARIANTS)).ok) return;
    }
  }
}

/** Block use by ring: downtown, then apartments and shops, then houses; one corner is industry. */
function blockUse(bx: number, by: number, rng: () => number): BlockUse {
  const c = BLOCKS - 0.5;
  const ring = Math.max(Math.abs(bx - c), Math.abs(by - c)) - 0.5;
  if (ring === 0 && bx === BLOCKS - 1 && by === BLOCKS - 1) return { kind: 'hall' };
  // Industry and utilities in the far corner.
  if (bx >= 2 * BLOCKS - 2 && by >= 2 * BLOCKS - 2) return bx === 2 * BLOCKS - 1 && by === 2 * BLOCKS - 1 ? { kind: 'utilities' } : { kind: 'zone', zone: ZoneType.Industrial };
  if (bx >= 2 * BLOCKS - 3 && by >= 2 * BLOCKS - 3) return bx === 2 * BLOCKS - 3 && by === 2 * BLOCKS - 3 ? { kind: 'utilities' } : { kind: 'zone', zone: ZoneType.Industrial };
  // A service block every three blocks keeps everything covered.
  if (bx % 3 === 1 && by % 3 === 1) return { kind: 'services' };
  const roll = rng();
  if (roll < 0.07 && ring > 0) return { kind: 'park' };
  if (ring <= 1) return { kind: 'zone', zone: roll < 0.55 ? ZoneType.CommercialHigh : ZoneType.ResidentialHigh };
  if (ring <= 2) return { kind: 'zone', zone: roll < 0.65 ? ZoneType.ResidentialHigh : roll < 0.85 ? ZoneType.Commercial : ZoneType.CommercialHigh };
  if (ring <= 3) return { kind: 'zone', zone: roll < 0.55 ? ZoneType.Residential : roll < 0.8 ? ZoneType.ResidentialHigh : ZoneType.Commercial };
  return { kind: 'zone', zone: roll < 0.82 ? ZoneType.Residential : ZoneType.Commercial };
}

/** The 5×5 block's outer ring of tiles (around a 2×2 town hall at its middle-left). */
function ringOf(ix: number, iy: number): [number, number][] {
  const out: [number, number][] = [];
  for (let y = iy; y < iy + 5; y++) {
    for (let x = ix; x < ix + 5; x++) {
      const inHall = x >= ix + 1 && x <= ix + 2 && y >= iy + 1 && y <= iy + 2;
      if (!inHall) out.push([x, y]);
    }
  }
  return out;
}
