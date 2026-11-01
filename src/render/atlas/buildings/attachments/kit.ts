import { faceRef, type FaceRef } from '../../core';
import type { MassBox, Painting } from '../context';

/** What an attachment painter gets: the building, its base and top masses and the front wall (if visible). */
export interface AttachArgs {
  readonly p: Painting;
  readonly base: MassBox;
  readonly top: MassBox;
  /** The base mass's front wall, or null when the front faces away from the camera. */
  readonly lf: FaceRef | null;
}

export type AttachPainter = (args: AttachArgs) => void;

export function attachArgs(p: Painting): AttachArgs {
  const base = p.ms[0];
  const front = p.o.faceOf('front');
  return { p, base, top: p.ms[p.ms.length - 1], lf: front ? faceRef(front, base.view) : null };
}
