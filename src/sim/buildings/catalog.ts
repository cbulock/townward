/** Building catalog. See docs/specs/buildings.md. Visuals live in render/atlas/buildingArt.ts. */

export type Zone = 'R' | 'C' | 'I';
/** Low density: houses and shops. High density: apartments and offices. Industry is always low. */
export type Density = 'low' | 'high';
export type BuildingCategory = 'residential' | 'commercial' | 'industrial' | 'civic';
/** City services with a coverage area (docs/specs/core.md). */
export type ServiceKind = 'police' | 'fire' | 'health' | 'education';
export const SERVICE_KINDS: readonly ServiceKind[] = ['police', 'fire', 'health', 'education'];
/** How a power building makes (or stores) its power (docs/specs/energy.md). */
export type EnergySource = 'coal' | 'gas' | 'wind' | 'solar' | 'battery';
export const ENERGY_SOURCES: readonly EnergySource[] = ['coal', 'gas', 'wind', 'solar', 'battery'];

export interface EnergyDef {
  readonly source: EnergySource;
  /** Batteries: how much they hold, and how much they can take in or give out per clock hour. */
  readonly storage?: number;
  readonly rate?: number;
  /** Preview reach from the plant, in tiles. The grid still requires a shared road island. */
  readonly coverage?: number;
  /** Output fraction at which sustained demand begins wearing this plant down. */
  readonly overload?: number;
  /** Cost to restore a failed plant to full condition. */
  readonly repairCost?: number;
}

/** Civic panel tabs. */
export type CivicGroup = 'services' | 'utilities' | 'parks';

export interface BuildingDef {
  name: string;
  category: BuildingCategory;
  zone: Zone | null;
  /** Which zone density grows this building (null for civic buildings). */
  density: Density | null;
  /** Development level 1–3 (civic: 0). */
  level: 0 | 1 | 2 | 3;
  size: { w: number; h: number };
  cost: number;
  /** Residents for housing, jobs for everything else. */
  capacity: number;
  description: string;
  /** Civic buildings: which Civic panel tab lists it. */
  group?: CivicGroup;
  /** Monthly running cost (civic buildings). */
  upkeep?: number;
  /** Services: what it provides and how far (tiles from the footprint centre). */
  service?: ServiceKind;
  radius?: number;
  /** Utilities: power and water supplied to buildings on the same road network (power: peak output). */
  supplies?: { power?: number; water?: number };
  /** Power buildings: what drives their output (sim/systems/energy.ts). */
  energy?: EnergyDef;
  /** Power corridor node: buildings on the same road island within this reach can connect. */
  substation?: { readonly radius: number; readonly capacity: number };
}

export const BUILDINGS = {
  cottage: {
    name: 'Cottage',
    category: 'residential',
    zone: 'R',
    density: 'low',
    level: 1,
    size: { w: 1, h: 1 },
    cost: 120,
    capacity: 3,
    description: 'A small gable-roofed home with a garden.',
  },
  family_house: {
    name: 'Family House',
    category: 'residential',
    zone: 'R',
    density: 'low',
    level: 1,
    size: { w: 1, h: 1 },
    cost: 200,
    capacity: 5,
    description: 'Two storeys, a porch and a hip roof.',
  },
  townhouses: {
    name: 'Townhouses',
    category: 'residential',
    zone: 'R',
    density: 'low',
    level: 2,
    size: { w: 1, h: 1 },
    cost: 450,
    capacity: 12,
    description: 'A narrow row of three homes with bright doors.',
  },
  walkup: {
    name: 'Walk-up Apartments',
    category: 'residential',
    zone: 'R',
    density: 'high',
    level: 2,
    size: { w: 1, h: 1 },
    cost: 700,
    capacity: 24,
    description: 'Four floors of brick apartments with balconies.',
  },
  apartment_block: {
    name: 'Apartment Block',
    category: 'residential',
    zone: 'R',
    density: 'high',
    level: 3,
    size: { w: 2, h: 2 },
    cost: 2400,
    capacity: 120,
    description: 'A mid-rise block with balconies and a rooftop water tank.',
  },
  condo_tower: {
    name: 'Condo Tower',
    category: 'residential',
    zone: 'R',
    density: 'high',
    level: 3,
    size: { w: 2, h: 2 },
    cost: 5200,
    capacity: 260,
    description: 'A glass residential tower with terraces.',
  },
  corner_shop: {
    name: 'Corner Shop',
    category: 'commercial',
    zone: 'C',
    density: 'low',
    level: 1,
    size: { w: 1, h: 1 },
    cost: 260,
    capacity: 6,
    description: 'A neighbourhood shop under a striped awning.',
  },
  cafe: {
    name: 'Café',
    category: 'commercial',
    zone: 'C',
    density: 'low',
    level: 1,
    size: { w: 1, h: 1 },
    cost: 240,
    capacity: 8,
    description: 'Coffee, cake and tables outside.',
  },
  small_office: {
    name: 'Small Office',
    category: 'commercial',
    zone: 'C',
    density: 'high',
    level: 2,
    size: { w: 1, h: 1 },
    cost: 900,
    capacity: 40,
    description: 'Five floors of offices with bands of glass.',
  },
  supermarket: {
    name: 'Supermarket',
    category: 'commercial',
    zone: 'C',
    density: 'low',
    level: 2,
    size: { w: 2, h: 2 },
    cost: 1800,
    capacity: 60,
    description: 'A big store with its own parking lot.',
  },
  hotel: {
    name: 'Hotel',
    category: 'commercial',
    zone: 'C',
    density: 'high',
    level: 3,
    size: { w: 2, h: 2 },
    cost: 4200,
    capacity: 90,
    description: 'A tall hotel with a rooftop sign and an entrance canopy.',
  },
  office_tower: {
    name: 'Office Tower',
    category: 'commercial',
    zone: 'C',
    density: 'high',
    level: 3,
    size: { w: 2, h: 2 },
    cost: 6500,
    capacity: 400,
    description: 'A glass skyscraper with a lit crown.',
  },
  workshop: {
    name: 'Workshop',
    category: 'industrial',
    zone: 'I',
    density: 'low',
    level: 1,
    size: { w: 1, h: 1 },
    cost: 300,
    capacity: 10,
    description: 'A small workshop with a garage door.',
  },
  warehouse: {
    name: 'Warehouse',
    category: 'industrial',
    zone: 'I',
    density: 'low',
    level: 2,
    size: { w: 2, h: 2 },
    cost: 1500,
    capacity: 40,
    description: 'Storage with loading docks and crates.',
  },
  factory: {
    name: 'Factory',
    category: 'industrial',
    zone: 'I',
    density: 'low',
    level: 3,
    size: { w: 2, h: 2 },
    cost: 3200,
    capacity: 120,
    description: 'Sawtooth roofs and a tall smokestack.',
  },
  park: {
    name: 'Park',
    category: 'civic',
    zone: null,
    density: null,
    level: 0,
    size: { w: 1, h: 1 },
    cost: 100,
    capacity: 0,
    description: 'Lawn, trees, a path and a fountain.',
    group: 'parks',
    upkeep: 1,
  },
  central_park: {
    name: 'Central Park',
    category: 'civic',
    zone: null,
    density: null,
    level: 0,
    size: { w: 3, h: 3 },
    cost: 2200,
    capacity: 0,
    description: 'A grand green with a lake, winding paths and mature trees.',
    group: 'parks',
    upkeep: 18,
  },
  botanical_garden: {
    name: 'Botanical Garden',
    category: 'civic',
    zone: null,
    density: null,
    level: 0,
    size: { w: 3, h: 3 },
    cost: 3000,
    capacity: 0,
    description: 'Glasshouses, flower beds and a tranquil garden walk.',
    group: 'parks',
    upkeep: 24,
  },
  shopping_complex: {
    name: 'Shopping Complex',
    category: 'civic',
    zone: null,
    density: null,
    level: 0,
    size: { w: 3, h: 2 },
    cost: 4200,
    capacity: 180,
    description: 'A bright mixed-use mall with a public plaza and rooftop gardens.',
    group: 'parks',
    upkeep: 32,
  },
  riverside_market: {
    name: 'Riverside Market',
    category: 'civic',
    zone: null,
    density: null,
    level: 0,
    size: { w: 2, h: 2 },
    cost: 2600,
    capacity: 90,
    description: 'Colourful market halls wrapped around a lively pedestrian square.',
    group: 'parks',
    upkeep: 20,
  },
  town_hall: {
    name: 'Town Hall',
    category: 'civic',
    zone: null,
    density: null,
    level: 0,
    size: { w: 2, h: 2 },
    cost: 5000,
    capacity: 30,
    description: 'The seat of your city government.',
    group: 'parks',
    upkeep: 50,
  },
  police_station: {
    name: 'Police Station',
    category: 'civic',
    zone: null,
    density: null,
    level: 0,
    size: { w: 1, h: 1 },
    cost: 750,
    capacity: 20,
    description: 'Keeps the streets safe. Buildings nearby fill up and grow.',
    group: 'services',
    upkeep: 60,
    service: 'police',
    radius: 14,
  },
  fire_station: {
    name: 'Fire Station',
    category: 'civic',
    zone: null,
    density: null,
    level: 0,
    size: { w: 1, h: 1 },
    cost: 750,
    capacity: 20,
    description: 'Stops fires before they spread. Buildings outside its reach can burn down.',
    group: 'services',
    upkeep: 60,
    service: 'fire',
    radius: 14,
  },
  clinic: {
    name: 'Clinic',
    category: 'civic',
    zone: null,
    density: null,
    level: 0,
    size: { w: 1, h: 1 },
    cost: 900,
    capacity: 25,
    description: 'Doctors and nurses for the neighbourhood.',
    group: 'services',
    upkeep: 80,
    service: 'health',
    radius: 12,
  },
  school: {
    name: 'School',
    category: 'civic',
    zone: null,
    density: null,
    level: 0,
    size: { w: 2, h: 2 },
    cost: 1500,
    capacity: 30,
    description: 'Classrooms and a playground. Educated cities grow taller.',
    group: 'services',
    upkeep: 80,
    service: 'education',
    radius: 14,
  },
  power_plant: {
    name: 'Coal Power Plant',
    category: 'civic',
    zone: null,
    density: null,
    level: 0,
    size: { w: 2, h: 2 },
    cost: 4000,
    capacity: 40,
    description: 'Powers every building connected to it by road, up to its capacity.',
    group: 'utilities',
    upkeep: 150,
    supplies: { power: 4000 },
    energy: { source: 'coal', coverage: 14, overload: 0.9, repairCost: 900 },
  },
  gas_plant: {
    name: 'Gas Power Plant',
    category: 'civic',
    zone: null,
    density: null,
    level: 0,
    size: { w: 2, h: 2 },
    cost: 6500,
    capacity: 30,
    description: 'Steady power day and night with half the smoke of coal, but costly to run.',
    group: 'utilities',
    upkeep: 260,
    supplies: { power: 5000 },
    energy: { source: 'gas', coverage: 18, overload: 0.95, repairCost: 1200 },
  },
  wind_turbine: {
    name: 'Wind Turbine',
    category: 'civic',
    zone: null,
    density: null,
    level: 0,
    size: { w: 1, h: 1 },
    cost: 900,
    capacity: 2,
    description: 'Clean power that rises and falls with the wind over the days.',
    group: 'utilities',
    upkeep: 15,
    supplies: { power: 450 },
    energy: { source: 'wind', coverage: 10, overload: 0.8, repairCost: 180 },
  },
  solar_farm: {
    name: 'Solar Farm',
    category: 'civic',
    zone: null,
    density: null,
    level: 0,
    size: { w: 2, h: 2 },
    cost: 3200,
    capacity: 3,
    description: 'Clean power while the sun is up, and none at night. Pair it with batteries.',
    group: 'utilities',
    upkeep: 30,
    supplies: { power: 1000 },
    energy: { source: 'solar', coverage: 12, overload: 0.85, repairCost: 450 },
  },
  battery_bank: {
    name: 'Battery Bank',
    category: 'civic',
    zone: null,
    density: null,
    level: 0,
    size: { w: 1, h: 1 },
    cost: 2500,
    capacity: 2,
    description: 'Stores spare power and gives it back when demand peaks or the sun goes down.',
    group: 'utilities',
    upkeep: 25,
    energy: { source: 'battery', storage: 2400, rate: 800 },
  },
  substation: {
    name: 'Power Substation',
    category: 'civic',
    zone: null,
    density: null,
    level: 0,
    size: { w: 1, h: 1 },
    cost: 1400,
    capacity: 0,
    description: 'Connects a road corridor to nearby homes and businesses.',
    group: 'utilities',
    upkeep: 20,
    substation: { radius: 12, capacity: 300 },
  },
  water_tower: {
    name: 'Water Tower',
    category: 'civic',
    zone: null,
    density: null,
    level: 0,
    size: { w: 1, h: 1 },
    cost: 1200,
    capacity: 10,
    description: 'Supplies water to every building connected to it by road, up to its capacity.',
    group: 'utilities',
    upkeep: 80,
    supplies: { water: 2500 },
  },
} as const satisfies Record<string, BuildingDef>;

export type BuildingId = keyof typeof BUILDINGS;

/** Colour variants each building is painted in (render/atlas/buildingArt.ts). */
export const ART_VARIANTS = 6;

export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];

/**
 * What the Build tool may place: civic buildings only. Homes, shops and industry come from
 * zoning (docs/decisions.md D-042). The sim itself can still place anything (tests use it).
 */
export const PLACEABLE_IDS: readonly BuildingId[] = BUILDING_IDS.filter((id) => BUILDINGS[id].category === 'civic');

/** Monthly upkeep of a building (0 for zoned buildings). */
export function upkeepOf(id: BuildingId): number {
  const d: BuildingDef = BUILDINGS[id];
  return d.upkeep ?? 0;
}

export function isPlaceable(id: BuildingId): boolean {
  return PLACEABLE_IDS.includes(id);
}

export const CATEGORY_ORDER: readonly BuildingCategory[] = ['residential', 'commercial', 'industrial', 'civic'];

export function buildingDef(id: BuildingId): BuildingDef {
  return BUILDINGS[id];
}

export interface BuildingInstance {
  id: number;
  def: BuildingId;
  /** Footprint's top (north) tile. */
  x: number;
  y: number;
  /** Art variant 0–5, fixed when placed (the renderer wraps it to each building's variant count). */
  variant: number;
  /** Residents (housing) or workers (everything else). Updated by sim/population.ts. */
  occupants: number;
  /** Tile index of the road the building uses (within roadAccessRange), or −1 if it has no road access. */
  entrance: number;
  /** Grew on a zone (vs placed with the Build tool). Only grown buildings level up. */
  grown: boolean;
  /** Days of construction left; 0 once finished. Sites have no residents or jobs. */
  construction: number;
  /** Consecutive days at or above BALANCE.upgradeOccupancy. */
  fullDays: number;
  /** Utilities reach it (set by sim/services.ts; civic buildings are always served). */
  powered: boolean;
  watered: boolean;
  /** Bitmask of services covering it (bit = index in SERVICE_KINDS). */
  services: number;
  /** 0..1 from its needs (sim/systems/needs.ts); new buildings start neutral. */
  happiness: number;
  /** Consecutive days below the abandonment line (or, once abandoned, above the recovery line). */
  moodDays: number;
  /** Run-down and empty after a long unhappy spell (docs/specs/needs.md). */
  abandoned: boolean;
  /** Battery banks: power held right now (sim/systems/energy.ts); 0 for everything else. */
  stored: number;
  /** 0..1 health of a generating plant; non-generators remain at 1. */
  condition: number;
  /** In-game days remaining before a failed generator can run again. */
  repairDays: number;
}

/** What a caller supplies when placing or growing; the runtime fields start empty. */
export interface NewBuilding extends Pick<BuildingInstance, 'def' | 'x' | 'y' | 'variant'> {
  grown?: boolean;
  construction?: number;
  /** Residents or workers carried over from the lots an upgrade replaced. */
  occupants?: number;
}

/** Zoned buildings of a zone, density, level and square footprint size (1 or 2), in catalog order. */
export function zonedBuildings(zone: Zone, density: Density, level: number, size: number): BuildingId[] {
  return BUILDING_IDS.filter((id) => {
    const d: BuildingDef = BUILDINGS[id];
    return d.zone === zone && d.density === density && d.level === level && d.size.w === size && d.size.h === size;
  });
}

/** The level new lots of this zone and density start at: its lowest 1×1 building. */
export function startLevel(zone: Zone, density: Density): number {
  let level = Infinity;
  for (const id of BUILDING_IDS) {
    const d: BuildingDef = BUILDINGS[id];
    if (d.zone === zone && d.density === density && d.size.w === 1) level = Math.min(level, d.level);
  }
  return level;
}

/** Pick a random zoned building, or null if the catalog has none for that zone/density/level/size. */
export function chooseBuilding(zone: Zone, density: Density, level: number, size: number, rng: () => number): BuildingId | null {
  const ids = zonedBuildings(zone, density, level, size);
  return ids.length === 0 ? null : ids[Math.floor(rng() * ids.length)];
}

/** Top-left (north) tile of a footprint whose "centre" tile is under the cursor. */
export function footprintOrigin(id: BuildingId, cx: number, cy: number): { x: number; y: number } {
  const { w, h } = BUILDINGS[id].size;
  return { x: cx - Math.floor((w - 1) / 2), y: cy - Math.floor((h - 1) / 2) };
}
