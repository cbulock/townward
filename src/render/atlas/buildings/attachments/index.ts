import type { Painting } from '../context';
import type { Extra } from '../recipes';
import { paintBalconies, paintFireEscape, paintTerraces } from './balconies';
import { paintFireDoors, paintGarageDoor, paintLoadingDock } from './doors';
import { paintCanopy, paintChimney, paintPorch } from './entrances';
import { attachArgs, type AttachPainter } from './kit';
import { paintAwning, paintRedCross, paintRoofSign, paintShopSign } from './signage';

/** Wall and front extras, in drawing order. */
const ON_WALLS: readonly (readonly [Extra, AttachPainter])[] = [
  ['chimney', paintChimney],
  ['porch', paintPorch],
  ['firedoors', paintFireDoors],
  ['awning', paintAwning],
  ['balconies', paintBalconies],
  ['fireescape', paintFireEscape],
  ['terraces', paintTerraces],
  ['redcross', paintRedCross],
  ['canopy', paintCanopy],
  ['loadingdock', paintLoadingDock],
  ['garagedoor', paintGarageDoor],
];

/** Everything fixed to the walls and the front, then the shop sign. */
export function paintAttachments(p: Painting) {
  const args = attachArgs(p);
  const ex = new Set(p.art.extras);
  for (const [extra, paint] of ON_WALLS) if (ex.has(extra)) paint(args);
  paintShopSign(args);
}

/** The rooftop sign goes up after the rooftop equipment. */
export function paintSigns(p: Painting) {
  paintRoofSign(attachArgs(p));
}
