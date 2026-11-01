import { BALANCE } from '../shared/balance';
import { RoadType, type BuildableRoad } from './roads';

/**
 * Every road type, described once (docs/specs/transport.md, D-069). Systems read these
 * numbers instead of checking for a particular type, so a new road is a new entry here plus
 * its art module (render/atlas/roads/).
 */
export interface RoadSpec {
  readonly name: string;
  /** Commuters per day a tile carries before it jams (sim/systems/commute.ts). */
  readonly capacity: number;
  /** Free-flow minutes to cross a tile. */
  readonly minutes: number;
  /** Visible cars' speed multiplier. */
  readonly carSpeed: number;
  /** Lane centres for one direction, inner lane first (tile units from the centre line; drive on the right). */
  readonly lanes: readonly number[];
  /** Where pedestrians walk (tile units from the centre line), or null with no footpaths. */
  readonly footpath: number | null;
  /** Price per tile on land, and as a bridge over water. */
  readonly cost: number;
  readonly bridgeCost: number;
  /** Monthly upkeep per tile. */
  readonly upkeep: number;
  /** Loud enough to bother nearby homes (sim/systems/needs.ts). */
  readonly noisy: boolean;
  /** Bigger roads replace smaller ones when dragged over them (paying the difference); never the reverse. */
  readonly rank: number;
}

export const ROAD_SPECS: Readonly<Record<BuildableRoad, RoadSpec>> = {
  [RoadType.Road]: {
    name: 'Street',
    capacity: 500,
    minutes: 1,
    carSpeed: 1,
    lanes: [0.13],
    footpath: 0.37,
    cost: BALANCE.roadCost,
    bridgeCost: BALANCE.bridgeCost,
    upkeep: BALANCE.roadUpkeep,
    noisy: false,
    rank: 1,
  },
  [RoadType.Avenue]: {
    name: 'Avenue',
    capacity: 1100,
    minutes: 0.8,
    carSpeed: 1.3,
    lanes: [0.12, 0.25],
    footpath: 0.41,
    cost: BALANCE.avenueCost,
    bridgeCost: BALANCE.avenueBridgeCost,
    upkeep: BALANCE.avenueUpkeep,
    noisy: false,
    rank: 2,
  },
  [RoadType.Highway]: {
    name: 'Highway',
    capacity: 1500,
    minutes: 0.45,
    carSpeed: 1.9,
    lanes: [0.12, 0.32],
    footpath: null,
    cost: BALANCE.highwayCost,
    bridgeCost: BALANCE.highwayBridgeCost,
    upkeep: BALANCE.highwayUpkeep,
    noisy: true,
    rank: 3,
  },
};

/** Every road type you can build, smallest first. */
export const BUILDABLE_ROADS: readonly BuildableRoad[] = [RoadType.Road, RoadType.Avenue, RoadType.Highway];

export function isBuildableRoad(v: number): v is BuildableRoad {
  return (BUILDABLE_ROADS as readonly number[]).includes(v);
}

/** The spec of the road on a tile, or null if there is none. */
export function roadSpec(type: number): RoadSpec | null {
  return isBuildableRoad(type) ? ROAD_SPECS[type] : null;
}
