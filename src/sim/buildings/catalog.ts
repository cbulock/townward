/** Building catalog. See docs/specs/buildings.md. Visuals live in render/atlas/buildingArt.ts. */

export type Zone = 'R' | 'C' | 'I';
export type BuildingCategory = 'residential' | 'commercial' | 'industrial' | 'civic';

export interface BuildingDef {
  name: string;
  category: BuildingCategory;
  zone: Zone | null;
  /** Development level 1–3 (civic: 0). */
  level: 0 | 1 | 2 | 3;
  size: { w: number; h: number };
  cost: number;
  /** Residents for housing, jobs for everything else. */
  capacity: number;
  description: string;
}

export const BUILDINGS = {
  cottage: {
    name: 'Cottage',
    category: 'residential',
    zone: 'R',
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
    level: 0,
    size: { w: 1, h: 1 },
    cost: 100,
    capacity: 0,
    description: 'Lawn, trees, a path and a fountain.',
  },
  town_hall: {
    name: 'Town Hall',
    category: 'civic',
    zone: null,
    level: 0,
    size: { w: 2, h: 2 },
    cost: 5000,
    capacity: 30,
    description: 'The seat of your city government.',
  },
} as const satisfies Record<string, BuildingDef>;

export type BuildingId = keyof typeof BUILDINGS;

/** Colour variants each building is painted in (render/atlas/buildingArt.ts). */
export const ART_VARIANTS = 3;

export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];

/**
 * What the Build tool may place: civic buildings only. Homes, shops and industry come from
 * zoning (docs/decisions.md D-042). The sim itself can still place anything (tests use it).
 */
export const PLACEABLE_IDS: readonly BuildingId[] = BUILDING_IDS.filter((id) => BUILDINGS[id].category === 'civic');

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
  /** Art variant 0–2, fixed when placed. */
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
}

/** What a caller supplies when placing or growing; the runtime fields start empty. */
export interface NewBuilding extends Pick<BuildingInstance, 'def' | 'x' | 'y' | 'variant'> {
  grown?: boolean;
  construction?: number;
  /** Residents or workers carried over from the lots an upgrade replaced. */
  occupants?: number;
}

/** Zoned buildings of a zone, level and square footprint size (1 or 2), in catalog order. */
export function zonedBuildings(zone: Zone, level: number, size: number): BuildingId[] {
  return BUILDING_IDS.filter((id) => {
    const d: BuildingDef = BUILDINGS[id];
    return d.zone === zone && d.level === level && d.size.w === size && d.size.h === size;
  });
}

/** Pick a random zoned building, or null if the catalog has none for that zone/level/size. */
export function chooseBuilding(zone: Zone, level: number, size: number, rng: () => number): BuildingId | null {
  const ids = zonedBuildings(zone, level, size);
  return ids.length === 0 ? null : ids[Math.floor(rng() * ids.length)];
}

/** Top-left (north) tile of a footprint whose "centre" tile is under the cursor. */
export function footprintOrigin(id: BuildingId, cx: number, cy: number): { x: number; y: number } {
  const { w, h } = BUILDINGS[id].size;
  return { x: cx - Math.floor((w - 1) / 2), y: cy - Math.floor((h - 1) / 2) };
}
