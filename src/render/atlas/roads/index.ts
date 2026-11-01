import { RoadType, type BuildableRoad } from '../../../sim/roads';
import { AVENUE, paintAvenue } from './avenue';
import { HIGHWAY, paintHighway } from './highway';
import { paintStreet, STREET } from './street';

/** How one road type is drawn: its deck for any connection mask, and how wide a bridge deck is. */
export interface RoadArt {
  paint(ctx: CanvasRenderingContext2D, mask: number): void;
  /** Half-width of the whole deck out to the bridge parapets (tile units). */
  readonly deckEdge: number;
}

/** One module per road type (D-066, docs/specs/transport.md). */
export const ROAD_ART: Readonly<Record<BuildableRoad, RoadArt>> = {
  [RoadType.Road]: { paint: paintStreet, deckEdge: STREET.footpath + 0.02 },
  [RoadType.Avenue]: { paint: paintAvenue, deckEdge: AVENUE.footpath + 0.02 },
  [RoadType.Highway]: { paint: paintHighway, deckEdge: HIGHWAY.road + 0.04 },
};
