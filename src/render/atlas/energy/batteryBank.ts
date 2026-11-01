import { faceRef, wallOn, type IsoFrame, type Orient, type Rng } from '../isoPaint';
import { drawItems, type CivicArt, type Item } from '../lot';
import { TONE } from './tones';

/** Battery bank (1×1): white storage containers on a concrete pad, with charge lights and roof vents. */

const H = 9;

function paint(iso: IsoFrame, o: Orient, _rng: Rng, variant: number) {
  iso.floor(0.04, 0.96, 0.04, 0.96, 0, TONE.concrete);
  iso.floor(0.07, 0.93, 0.07, 0.93, 0.05, TONE.concreteTop);
  const units = variant === 1 ? 3 : 2;
  const items: Item[] = [];
  for (let k = 0; k < units; k++) {
    const span = 0.76 / units;
    const v0 = 0.12 + k * span;
    const box = o.rect({ u0: 0.14, u1: 0.86, v0: v0 + 0.03, v1: v0 + span - 0.03 });
    items.push({
      depth: box.u0 + box.v0,
      draw: () => {
        iso.box(box.u0, box.u1, box.v0, box.v1, 0, H, TONE.battery, TONE.batteryShade, TONE.batteryTop);
        for (const face of ['sw', 'se'] as const) {
          const f = faceRef(face, box);
          for (let a = f.a0 + 0.08; a < f.a1 - 0.08; a += 0.14) wallOn(iso, f, a, a + 0.07, 2, 6.5, 'rgba(0, 0, 0, 0.07)');
          wallOn(iso, f, f.a0 + 0.04, f.a1 - 0.04, H - 2, H - 1.3, TONE.charge);
        }
        const cu = (box.u0 + box.u1) / 2;
        const cv = (box.v0 + box.v1) / 2;
        iso.floor(cu - 0.06, cu + 0.06, cv - 0.06, cv + 0.06, H + 0.1, TONE.vent);
      },
    });
  }
  drawItems(items);
}

export const batteryBankArt: CivicArt = { variants: 2, headroom: () => 16, paint };
