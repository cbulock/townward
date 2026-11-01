import { faceRef, IsoFrame, shade, wallOn, type Orient, type Rng } from '../core';
import { at, drawItems, plume, type CivicArt, type Item, type SmokeSource } from '../civic/lot';
import { TONE } from './tones';

/**
 * Gas power plant (2×2), combined-cycle: a turbine hall, two heat-recovery towers with slim
 * stacks, spherical gas tanks and a pipe rack. Its plumes are mostly steam (cleaner than coal).
 */

const HALL_H = 18;
const HRSG_H = 30;
const STACK_H = 52;
/** Local positions of the two stacks (on the heat-recovery towers). */
const STACKS: readonly (readonly [number, number])[] = [
  [1.55, 0.36],
  [1.55, 0.95],
];
const TANKS: readonly (readonly [number, number, number])[] = [
  [0.42, 1.46, 0.22],
  [0.92, 1.52, 0.2],
];

function smoke(o: Orient): SmokeSource[] {
  return STACKS.map(([u, v]) => plume(o, u, v, STACK_H, 'steam'));
}

function paint(iso: IsoFrame, o: Orient, _rng: Rng, variant: number) {
  iso.floor(0.03, 1.97, 0.03, 1.97, 0, TONE.gravelEdge);
  iso.floor(0.06, 1.94, 0.06, 1.94, 0, TONE.concrete);
  const band = variant === 1 ? '#2f9e6b' : TONE.gasBand;
  const items: Item[] = [];

  const hall = o.rect({ u0: 0.14, u1: 1.22, v0: 0.18, v1: 0.92 });
  items.push({
    depth: hall.u0 + hall.v0 + 0.5,
    draw: () => {
      iso.solid(hall, 0, HALL_H, TONE.gasHall);
      for (const face of ['sw', 'se'] as const) {
        const f = faceRef(face, hall);
        wallOn(iso, f, f.a0, f.a1, HALL_H - 5, HALL_H - 3, band);
        for (let a = f.a0 + 0.05; a < f.a1 - 0.05; a += 0.12) wallOn(iso, f, a, a + 0.05, 4, 10, 'rgba(40, 70, 100, 0.35)');
      }
      iso.floor(hall.u0 + 0.04, hall.u1 - 0.04, hall.v0 + 0.04, hall.v1 - 0.04, HALL_H, shade(TONE.gasHall, 0.12));
      const front = o.faceOf('front');
      if (front) {
        const fr = faceRef(front, hall);
        const mid = (fr.a0 + fr.a1) / 2;
        wallOn(iso, fr, mid - 0.12, mid + 0.12, HALL_H - 11, HALL_H - 7, TONE.warning);
        iso.text(fr.face, fr.at, mid, HALL_H - 8.6, 'GAS', 4.2, TONE.ink);
      }
    },
  });

  for (const [u, v] of STACKS) {
    const tower = o.rect({ u0: u - 0.2, u1: u + 0.2, v0: v - 0.2, v1: v + 0.2 });
    const s = at(o, u, v);
    items.push({
      depth: tower.u0 + tower.v0 + 0.3,
      draw: () => {
        iso.solid(tower, 0, HRSG_H, TONE.steel);
        iso.round(s.u, s.v, HRSG_H, STACK_H, () => 0.06, TONE.white, TONE.whiteShade);
        const [x, y] = iso.p(s.u, s.v, STACK_H - 4);
        const { rx } = IsoFrame.ellipse(0.06);
        iso.ctx.fillStyle = band;
        iso.ctx.fillRect(x - rx, y - 2, rx * 2, 2);
      },
    });
  }

  for (const [u, v, r] of TANKS) {
    const t = at(o, u, v);
    items.push({
      depth: t.depth,
      draw: () => {
        iso.round(t.u, t.v, 0, 3, () => r * 0.55, TONE.steelDark, null);
        iso.round(t.u, t.v, 3, 3 + r * 60, (k) => r * Math.sqrt(Math.max(0, 1 - (2 * k - 1) ** 2)) + 0.01, TONE.tank, TONE.tankTop);
      },
    });
  }

  // Pipe rack from the tanks to the hall.
  const rack = o.rect({ u0: 0.3, u1: 1.1, v0: 1.08, v1: 1.14 });
  items.push({ depth: rack.u0 + rack.v0, draw: () => iso.solid(rack, 6, 8, TONE.pipe) });
  drawItems(items);
}

export const gasPlantArt: CivicArt = { variants: 2, headroom: () => STACK_H + 12, paint, smoke };
