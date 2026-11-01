import { BUILDING_IDS, BUILDINGS, buildingDef, type BuildingId } from './buildings/catalog';
import { City } from './City';
import { Simulation } from './core/Simulation';
import { BridgeAxis, RoadType } from './roads';
import { PAVEMENTS, roadSpec } from './roadTypes';
import { GENERATOR_VERSION, generateTerrain } from './terrain/generate';
import { PRESET_IDS, type PresetId, type TerrainSettings } from './terrain/presets';
import { Decor } from './terrain/types';
import type { World } from './World';
import { ZoneType } from './zones';

/**
 * The save format (docs/specs/saving.md, D-034): only what can't be recomputed. Terrain is
 * regenerated from its settings; access, utilities, coverage, commutes, needs and traffic are
 * rebuilt by the Simulation after loading.
 */

export const SAVE_VERSION = 1;

/** `[def, x, y, variant, flags, construction, fullDays, occupants, happiness %, moodDays]`: every building has these. */
type SavedBuildingCore = readonly [
  def: BuildingId,
  x: number,
  y: number,
  variant: number,
  flags: number,
  construction: number,
  fullDays: number,
  occupants: number,
  happiness: number,
  moodDays: number,
];

/** The core fields, plus optional battery charge and power-plant maintenance state. */
export type SavedBuilding =
  | SavedBuildingCore
  | readonly [...SavedBuildingCore, stored: number]
  | readonly [...SavedBuildingCore, stored: number, condition: number, repairDays: number];

const FLAG = { grown: 1, abandoned: 2 } as const;

export interface SavedCity {
  readonly funds: number;
  readonly day: number;
  readonly clock: number;
  readonly taxRate: number;
}

/** Run-length encoded, base64 typed-array layers (one byte per tile). */
export interface SavedLayers {
  readonly road: string;
  readonly bridge: string;
  readonly zone: string;
  /** 1 where the tile has neither tree nor decor (cleared by roads, zoning or buildings). */
  readonly cleared: string;
  /** One-way carriageway directions and footpath styles (docs/specs/transport.md); absent in older saves. */
  readonly lane?: string;
  readonly pave?: string;
}

/**
 * The simulation's day-to-day memory, so a loaded city continues exactly as the running one
 * would have (docs/specs/engine.md, "Determinism"). Optional: saves without it load with
 * fresh random streams and a cold commute model.
 */
export interface SavedSimState {
  /** RandomStream states. */
  readonly growth: number;
  readonly fire: number;
  /** Smoothed commute volume on each road tile, in tile order: float32, base64. */
  readonly volume: string;
  /** Commute minutes per building, in `buildings` order (NaN = none): float64, base64. */
  readonly minutes: string;
}

export interface SaveData {
  readonly v: typeof SAVE_VERSION;
  /** GENERATOR_VERSION of the terrain these layers were drawn on. */
  readonly gen: number;
  readonly name: string;
  readonly terrain: TerrainSettings;
  readonly city: SavedCity;
  readonly layers: SavedLayers;
  readonly buildings: readonly SavedBuilding[];
  /** Tile-indexed building ownership snapshot: `"x,y"` → building array index. */
  readonly buildingTiles?: Readonly<Record<string, number>>;
  readonly sim?: SavedSimState;
}

/** What the city list shows without loading the city. */
export interface SaveSummary {
  readonly name: string;
  readonly population: number;
  readonly funds: number;
  readonly day: number;
  readonly size: number;
  readonly preset: PresetId;
  readonly seed: number;
}

export class SaveError extends Error {}

// ---------------------------------------------------------------- serialize

/** Save a city; pass its Simulation too so a load continues exactly (see SavedSimState). */
export function serialize(city: City, terrain: TerrainSettings, name: string, sim?: Simulation): SaveData {
  const w = city.world;
  const cleared = new Uint8Array(w.width * w.height);
  for (let i = 0; i < cleared.length; i++) cleared[i] = w.tree[i] === 0 && w.decor[i] === Decor.None ? 1 : 0;
  const buildings: SavedBuilding[] = [];
  const buildingIndex = new Map<number, number>();
  for (const b of w.buildings.values()) {
    buildingIndex.set(b.id, buildings.length);
    const core: SavedBuildingCore = [
      b.def,
      b.x,
      b.y,
      b.variant,
      (b.grown ? FLAG.grown : 0) | (b.abandoned ? FLAG.abandoned : 0),
      b.construction,
      b.fullDays,
      b.occupants,
      Math.round(b.happiness * 100),
      b.moodDays,
    ];
    buildings.push(
      b.condition < 1 || b.repairDays > 0
        ? [...core, b.stored, b.condition, b.repairDays]
        : b.stored > 0
          ? [...core, b.stored]
          : core,
    );
  }
  const buildingTiles: Record<string, number> = {};
  for (let i = 0; i < w.building.length; i++) {
    const owner = w.building[i];
    const index = buildingIndex.get(owner);
    if (index !== undefined) {
      const x = i % w.width;
      const y = Math.floor(i / w.width);
      buildingTiles[`${x},${y}`] = index;
    }
  }
  return {
    v: SAVE_VERSION,
    gen: GENERATOR_VERSION,
    name,
    terrain: { ...terrain },
    city: { funds: city.funds, day: city.day, clock: city.clock, taxRate: city.taxRate },
    layers: {
      road: encodeLayer(w.road),
      bridge: encodeLayer(w.bridge),
      zone: encodeLayer(w.zone),
      cleared: encodeLayer(cleared),
      lane: encodeLayer(w.lane),
      pave: encodeLayer(w.pave),
    },
    buildings,
    buildingTiles,
    ...(sim && { sim: saveSimState(sim) }),
  };
}

function saveSimState(sim: Simulation): SavedSimState {
  const w = sim.world;
  const { volume, minutes } = sim.commute.exportState();
  const roadVolume: number[] = [];
  for (let i = 0; i < w.road.length; i++) if (w.road[i] !== RoadType.None) roadVolume.push(volume[i]);
  const perBuilding: number[] = [];
  for (const b of w.buildings.values()) perBuilding.push(minutes.get(b.id) ?? NaN);
  return {
    growth: sim.streams.growth.state,
    fire: sim.streams.fire.state,
    volume: toBase64(new Uint8Array(Float32Array.from(roadVolume).buffer)),
    minutes: toBase64(new Uint8Array(Float64Array.from(perBuilding).buffer)),
  };
}

export function summarize(data: SaveData, population: number): SaveSummary {
  const t = data.terrain;
  return { name: data.name, population, funds: data.city.funds, day: data.city.day, size: t.size, preset: t.preset, seed: t.seed };
}

// ---------------------------------------------------------------- deserialize

/**
 * Rebuild a city from a save. The caller still has to run the systems
 * (`new Simulation(city).worldChanged({ roads: true })` or `refreshCity`).
 * Throws SaveError if the layers don't fit the map; skips buildings that no longer fit.
 */
export function deserialize(data: SaveData): City {
  const world = generateTerrain(data.terrain);
  const n = world.width * world.height;
  const road = decodeLayer(data.layers.road, n);
  const bridge = decodeLayer(data.layers.bridge, n);
  const zone = decodeLayer(data.layers.zone, n);
  const cleared = decodeLayer(data.layers.cleared, n);
  const lane = data.layers.lane ? decodeLayer(data.layers.lane, n) : null;
  const pave = data.layers.pave ? decodeLayer(data.layers.pave, n) : null;
  for (let i = 0; i < n; i++) {
    world.road[i] = ROAD_VALUES.has(road[i]) ? road[i] : RoadType.None;
    world.bridge[i] = world.road[i] !== RoadType.None && BRIDGE_VALUES.has(bridge[i]) ? bridge[i] : BridgeAxis.None;
    world.zone[i] = ZONE_VALUES.has(zone[i]) ? zone[i] : ZoneType.None;
    // Directions only on wide roads; styles only where there's a road.
    world.lane[i] = lane && world.road[i] !== RoadType.None && lane[i] <= 4 && roadSpec(world.road[i])?.width === 2 ? lane[i] : 0;
    world.pave[i] = pave && world.road[i] !== RoadType.None && pave[i] <= PAVEMENTS.length ? pave[i] : 0;
    if (cleared[i] === 1) {
      world.tree[i] = 0;
      world.decor[i] = Decor.None;
    }
  }
  for (const s of data.buildings) addSavedBuilding(world, s);
  validateBuildingTiles(data.buildingTiles, world);

  const city = new City(world, data.city.funds);
  city.day = data.city.day;
  city.clock = data.city.clock;
  city.taxRate = data.city.taxRate;
  return city;
}

/**
 * Load a save into a running Simulation: rebuild the city, bring every system up to date,
 * then put back the saved day-to-day state (random streams, commute) and re-score needs from it.
 */
export function loadSimulation(data: SaveData): Simulation {
  const city = deserialize(data);
  const sim = new Simulation(city);
  sim.worldChanged({ roads: true });
  if (data.sim) restoreSimState(sim, data.sim);
  return sim;
}

function restoreSimState(sim: Simulation, saved: SavedSimState) {
  const w = sim.world;
  sim.streams.growth.state = saved.growth;
  sim.streams.fire.state = saved.fire;
  const roadVolume = floatsFrom(saved.volume, Float32Array);
  const volume = new Float32Array(w.road.length);
  let k = 0;
  for (let i = 0; i < w.road.length && k < roadVolume.length; i++) if (w.road[i] !== RoadType.None) volume[i] = roadVolume[k++];
  const perBuilding = floatsFrom(saved.minutes, Float64Array);
  const minutes = new Map<number, number>();
  let j = 0;
  for (const b of w.buildings.values()) {
    const m = perBuilding[j++];
    if (m !== undefined && !Number.isNaN(m)) minutes.set(b.id, m);
  }
  sim.commute.restoreState({ volume, minutes });
  sim.needs.onWorldChanged();
}

/** Decode base64 bytes as a float array; a corrupt or misaligned blob decodes to nothing. */
function floatsFrom<T extends Float32Array | Float64Array>(text: string, Kind: { new (b: ArrayBuffer): T; readonly BYTES_PER_ELEMENT: number }): T {
  const bytes = fromBase64(text);
  const usable = bytes.length - (bytes.length % Kind.BYTES_PER_ELEMENT);
  return new Kind(bytes.slice(0, usable).buffer);
}

const ROAD_VALUES: ReadonlySet<number> = new Set(Object.values(RoadType));
const BRIDGE_VALUES: ReadonlySet<number> = new Set(Object.values(BridgeAxis));
const ZONE_VALUES: ReadonlySet<number> = new Set(Object.values(ZoneType));

function addSavedBuilding(world: World, s: SavedBuilding) {
  const [def, x, y, variant, flags, construction, fullDays, occupants, happiness, moodDays, stored = 0, condition = 1, repairDays = 0] = s;
  const { w, h } = BUILDINGS[def].size;
  if (!world.inBounds(x, y) || !world.inBounds(x + w - 1, y + h - 1)) return;
  for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) if (world.building[world.index(tx, ty)] !== -1) return;
  const b = world.addBuilding({ def, x, y, variant, grown: (flags & FLAG.grown) !== 0, construction, occupants }, w, h);
  b.fullDays = fullDays;
  b.happiness = Math.min(1, Math.max(0, happiness / 100));
  b.moodDays = moodDays;
  b.abandoned = (flags & FLAG.abandoned) !== 0;
  b.stored = Math.max(0, Math.min(stored, buildingDef(def).energy?.storage ?? 0));
  b.condition = Math.min(1, Math.max(0, condition));
  b.repairDays = Math.max(0, repairDays);
}

function validateBuildingTiles(tiles: Readonly<Record<string, number>> | undefined, world: World) {
  if (!tiles) return;
  for (const [key, owner] of Object.entries(tiles)) {
    const match = /^(\d+),(\d+)$/.exec(key);
    if (!match) throw new SaveError('bad building tile');
    const x = Number(match[1]);
    const y = Number(match[2]);
    if (!Number.isInteger(owner) || owner < 0 || owner >= world.buildings.size || !world.inBounds(x, y)) {
      throw new SaveError('bad building tile');
    }
  }
}

// ---------------------------------------------------------------- parse (untrusted JSON → SaveData)

type Obj = Readonly<Record<string, unknown>>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(o: Obj, key: string, lo = -Infinity, hi = Infinity): number {
  const v = o[key];
  if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) throw new SaveError(`bad ${key}`);
  return v;
}

function str(o: Obj, key: string): string {
  const v = o[key];
  if (typeof v !== 'string') throw new SaveError(`bad ${key}`);
  return v;
}

function obj(o: Obj, key: string): Obj {
  const v = o[key];
  if (!isObj(v)) throw new SaveError(`bad ${key}`);
  return v;
}

const isBuildingId = (v: unknown): v is BuildingId => typeof v === 'string' && (BUILDING_IDS as readonly string[]).includes(v);
const isPresetId = (v: unknown): v is PresetId => typeof v === 'string' && (PRESET_IDS as readonly string[]).includes(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Check untrusted JSON (from the server or IndexedDB) and return it as SaveData.
 * Throws SaveError for anything that isn't a save this version can load. Buildings of
 * unknown types are dropped rather than failing the whole city.
 */
export function parseSave(json: unknown): SaveData {
  if (!isObj(json)) throw new SaveError('not a save');
  const v = num(json, 'v');
  if (v !== SAVE_VERSION) throw new SaveError(`unsupported save version ${v}`);
  const t = obj(json, 'terrain');
  const preset = t.preset;
  if (!isPresetId(preset)) throw new SaveError('bad preset');
  const terrain: TerrainSettings = {
    preset,
    seed: num(t, 'seed'),
    size: num(t, 'size', 16, 1024),
    water: num(t, 'water', 0, 1),
    trees: num(t, 'trees', 0, 1),
    rivers: num(t, 'rivers', 0, 3),
    coastSides: num(t, 'coastSides', 0, 4),
  };
  const c = obj(json, 'city');
  const l = obj(json, 'layers');
  if (!Array.isArray(json.buildings)) throw new SaveError('bad buildings');
  const list: readonly unknown[] = json.buildings;
  const buildings: SavedBuilding[] = [];
  for (const item of list) {
    if (!Array.isArray(item)) continue;
    const fields: readonly unknown[] = item;
    if (fields.length !== 10 && fields.length !== 11 && fields.length !== 13) continue;
    const [def, ...rest] = fields;
    if (!isBuildingId(def)) continue;
    if (!rest.every(isFiniteNumber)) continue;
    const [x, y, variant, flags, construction, fullDays, occupants, happiness, moodDays, stored, condition, repairDays] = rest;
    if (![x, y, variant, flags, construction, fullDays, occupants, happiness, moodDays].every(isInt)) continue;
    if (stored !== undefined && !isInt(stored)) continue;
    if (condition !== undefined && (condition < 0 || condition > 1)) continue;
    if (repairDays !== undefined && !isInt(repairDays)) continue;
    const core: SavedBuildingCore = [def, x, y, variant, flags, construction, fullDays, occupants, happiness, moodDays];
    buildings.push(
      condition === undefined || repairDays === undefined
        ? stored === undefined
          ? core
          : [...core, stored]
        : [...core, stored ?? 0, condition, repairDays],
    );
  }
  const buildingTiles = parseBuildingTiles(json.buildingTiles);
  return {
    v: SAVE_VERSION,
    gen: num(json, 'gen'),
    name: str(json, 'name').slice(0, 64),
    terrain,
    city: { funds: num(c, 'funds'), day: num(c, 'day', 0), clock: num(c, 'clock', 0), taxRate: num(c, 'taxRate', 0, 100) },
    layers: {
      road: str(l, 'road'),
      bridge: str(l, 'bridge'),
      zone: str(l, 'zone'),
      cleared: str(l, 'cleared'),
      ...(typeof l.lane === 'string' && { lane: l.lane }),
      ...(typeof l.pave === 'string' && { pave: l.pave }),
    },
    buildings,
    ...(buildingTiles && { buildingTiles }),
    ...parseSimState(json.sim),
  };
}

function parseBuildingTiles(v: unknown): Readonly<Record<string, number>> | undefined {
  if (v === undefined) return undefined;
  if (!isObj(v)) throw new SaveError('bad buildingTiles');
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(v)) {
    if (!/^\d+,\d+$/.test(key) || !isInt(value) || value < 0) throw new SaveError('bad building tile');
    result[key] = value;
  }
  return result;
}

/** The optional sim block; anything malformed is dropped (the city still loads, just cold). */
function parseSimState(v: unknown): { sim?: SavedSimState } {
  if (!isObj(v)) return {};
  const { growth, fire, volume, minutes } = v;
  if (!isInt(growth) || !isInt(fire) || typeof volume !== 'string' || typeof minutes !== 'string') return {};
  return { sim: { growth, fire, volume, minutes } };
}

// ---------------------------------------------------------------- layer encoding

/** Run-length encode bytes as `(value, varint run)` pairs, then base64. */
export function encodeLayer(layer: Uint8Array): string {
  const out: number[] = [];
  let i = 0;
  while (i < layer.length) {
    const value = layer[i];
    let run = 1;
    while (i + run < layer.length && layer[i + run] === value) run++;
    out.push(value);
    for (let r = run; ; r >>>= 7) {
      if (r < 0x80) {
        out.push(r);
        break;
      }
      out.push((r & 0x7f) | 0x80);
    }
    i += run;
  }
  return toBase64(Uint8Array.from(out));
}

/** Inverse of encodeLayer. Throws SaveError unless it decodes to exactly `length` bytes. */
export function decodeLayer(text: string, length: number): Uint8Array {
  const bytes = fromBase64(text);
  const layer = new Uint8Array(length);
  let o = 0;
  let i = 0;
  while (i < bytes.length) {
    const value = bytes[i++];
    let run = 0;
    for (let shift = 0; ; shift += 7) {
      if (i >= bytes.length || shift > 28) throw new SaveError('corrupt layer');
      const b = bytes[i++];
      run |= (b & 0x7f) << shift;
      if (b < 0x80) break;
    }
    if (o + run > length) throw new SaveError('layer larger than the map');
    layer.fill(value, o, o + run);
    o += run;
  }
  if (o !== length) throw new SaveError('layer smaller than the map');
  return layer;
}

// Our own base64 keeps the sim free of DOM and Node globals (btoa / Buffer).
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX = new Int16Array(128).fill(-1);
for (let i = 0; i < B64.length; i++) B64_INDEX[B64.charCodeAt(i)] = i;

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    s += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    s += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return s;
}

function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let acc = 0;
  let o = 0;
  for (let i = 0; i < clean.length; i++) {
    const c = clean.charCodeAt(i);
    const v = c < 128 ? B64_INDEX[c] : -1;
    if (v < 0) throw new SaveError('corrupt layer');
    acc = ((acc << 6) | v) & 0xffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}
