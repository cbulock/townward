import { RoadType, type BuildableRoad } from '../../../sim/roads';
import { PAVEMENTS, ROAD_SPECS } from '../../../sim/roadTypes';
import { AVENUE, paintAvenue } from './avenue';
import { paintBoulevard } from './boulevard';
import { paintExpressway } from './expressway';
import { HIGHWAY, paintHighway } from './highway';
import { paintPedestrian, PEDESTRIAN } from './pedestrian';
import { paintRamp, RAMP } from './ramp';
import { paintStreet, STREET } from './street';

/**
 * How one road type is drawn (one module per type, D-066). `variant` picks the look within a
 * type: the travel direction for one-way carriageways, the pavement style for paved roads.
 */
export interface RoadArt {
  paint(ctx: CanvasRenderingContext2D, mask: number, variant: number): void;
  /** Half-width of the whole deck out to the bridge parapets (tile units). */
  readonly deckEdge: number;
}

const pave = (variant: number) => PAVEMENTS[variant % PAVEMENTS.length];

export const ROAD_ART: Readonly<Record<BuildableRoad, RoadArt>> = {
  [RoadType.Road]: { paint: (c, m, v) => paintStreet(c, m, pave(v)), deckEdge: STREET.footpath + 0.02 },
  [RoadType.Avenue]: { paint: (c, m, v) => paintAvenue(c, m, pave(v)), deckEdge: AVENUE.footpath + 0.02 },
  [RoadType.Boulevard]: { paint: paintBoulevard, deckEdge: 0.5 },
  [RoadType.Highway]: { paint: (c, m) => paintHighway(c, m), deckEdge: HIGHWAY.road + 0.04 },
  [RoadType.Expressway]: { paint: paintExpressway, deckEdge: 0.5 },
  [RoadType.Ramp]: { paint: (c, m) => paintRamp(c, m), deckEdge: RAMP.barrier + 0.03 },
  [RoadType.Pedestrian]: { paint: (c, m, v) => paintPedestrian(c, m, pave(v)), deckEdge: PEDESTRIAN.edge + 0.02 },
};

/** Looks per road type in the atlas: 4 directions for one-way roads, 4 pavements for paved ones, else 1. */
export function roadVariants(type: BuildableRoad): number {
  const spec = ROAD_SPECS[type];
  return spec.width === 2 ? 4 : spec.pavement ? PAVEMENTS.length : 1;
}

/** Which look a tile uses: its lane direction, or its pavement (the player's pick, else the type's default). */
export function roadVariant(type: BuildableRoad, lane: number, pave: number): number {
  const spec = ROAD_SPECS[type];
  if (spec.width === 2) return Math.max(0, lane - 1);
  if (!spec.pavement) return 0;
  return pave > 0 ? pave - 1 : PAVEMENTS.indexOf(spec.pavement);
}
