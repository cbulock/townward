import { alpha, wallOn, type FaceRef, type IsoFrame, type Rng } from '../../core';
import { GLASS } from '../../theme/tokens';
import type { MassBox } from '../context';
import type { BuildingArt } from '../recipes';
import { glassFill, markWindow } from './glazing';

/** What a facade painter gets: one camera-facing wall of one mass. */
export interface FacadeArgs {
  readonly iso: IsoFrame;
  readonly art: BuildingArt;
  readonly m: MassBox;
  readonly f: FaceRef;
  /** This wall is the building's front (doors, shopfronts and signs go here). */
  readonly isFront: boolean;
  readonly rng: Rng;
}

export type FacadePainter = (args: FacadeArgs) => void;

/** Ground-floor entrance of a tall building: a glazed lobby with a dark door and a light canopy line. */
export function entrance(iso: IsoFrame, f: FaceRef, fh: number) {
  const mid = (f.a0 + f.a1) / 2;
  const half = Math.min(0.22, (f.a1 - f.a0) * 0.2);
  wallOn(iso, f, mid - half, mid + half, 0, fh - 1, glassFill(iso, f, mid - half, mid + half, 0, fh - 1, '#3f566b'));
  wallOn(iso, f, mid - half, mid + half, 0, fh - 1, 'rgba(255, 228, 170, 0.22)');
  wallOn(iso, f, mid - 0.06, mid + 0.06, 0, 7, '#1f2731');
  wallOn(iso, f, mid - 0.003, mid + 0.003, 0, 7, 'rgba(255,255,255,0.35)');
  wallOn(iso, f, mid - half - 0.02, mid + half + 0.02, fh - 1, fh, 'rgba(255,255,255,0.65)');
  wallOn(iso, f, mid - half, mid + half, fh - 2.2, fh - 1, alpha(GLASS.reveal, 0.6));
  markWindow(iso, f, mid - half, mid + half, 1, fh - 2);
}
