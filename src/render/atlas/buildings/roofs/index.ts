import type { Roof } from '../recipes';
import { paintFlatRoof } from './flat';
import { paintGableRoof } from './gable';
import { paintHipRoof } from './hip';
import type { RoofArgs, RoofPainter } from './kit';
import { paintSawtoothRoof } from './sawtooth';

export type { RoofArgs } from './kit';

const ROOFS: Readonly<Record<Roof, RoofPainter>> = {
  flat: paintFlatRoof,
  gable: paintGableRoof,
  hip: paintHipRoof,
  sawtooth: paintSawtoothRoof,
};

/** The top mass's roof, in view space; pitched and sawtooth roofs run along `axis`. */
export function paintRoof(args: RoofArgs) {
  ROOFS[args.art.roof](args);
}
