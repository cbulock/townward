import type { Facade } from '../recipes';
import { paintBands } from './bands';
import { paintCurtain } from './curtain';
import { paintGrid } from './grid';
import { paintIndustrial } from './industrial';
import type { FacadeArgs, FacadePainter } from './kit';
import { paintLobby } from './lobby';
import { paintTownhouse } from './townhouse';
import { paintWindows } from './windows';

export { glazing, glassFill, markWindow } from './glazing';
export type { FacadeArgs } from './kit';

/** One painter per facade family (each in its own module). */
const FACADES: Readonly<Record<Facade, FacadePainter>> = {
  punched: paintWindows,
  brick: paintWindows,
  siding: paintWindows,
  shopfront: paintWindows,
  bands: paintBands,
  ribbon: paintBands,
  grid: paintGrid,
  curtain: paintCurtain,
  lobby: paintLobby,
  industrial: paintIndustrial,
  townhouse: paintTownhouse,
};

/** Windows, doors and cladding on one camera-facing wall of a mass. */
export function paintFacade(args: FacadeArgs) {
  FACADES[args.m.facade](args);
}
