import type { IsoFrame, Orient, Rng } from '../core';
import { at, drawItems, pole, type CivicArt, type Item } from '../civic/lot';
import { TONE } from './tones';

/** Solar farm (2×2): rows of tilted panels on gravel, an inverter cabin and corner posts. */

const ROWS = 4;
const LOW_Z = 2;
const HIGH_Z = 7;
/** Panel cells along each row, for the grid lines. */
const CELLS = 9;

function paint(iso: IsoFrame, o: Orient, _rng: Rng, variant: number) {
  iso.floor(0.03, 1.97, 0.03, 1.97, 0, TONE.gravelEdge);
  iso.floor(0.06, 1.94, 0.06, 1.94, 0, TONE.gravel);
  const items: Item[] = [];
  const u0 = 0.14;
  const u1 = variant === 2 ? 1.5 : 1.86;

  for (let r = 0; r < ROWS; r++) {
    const v0 = 0.16 + r * 0.42;
    const v1 = v0 + 0.26;
    const p = at(o, (u0 + u1) / 2, v1);
    items.push({
      depth: p.depth,
      draw: () => {
        // Panels lean back: the front edge (v1) low, the back edge (v0) high.
        const corner = (u: number, v: number, z: number) => {
          const q = at(o, u, v);
          return iso.p(q.u, q.v, z);
        };
        for (const u of [u0 + 0.04, (u0 + u1) / 2, u1 - 0.04]) {
          const q = at(o, u, v1 - 0.03);
          pole(iso, q.u, q.v, 0, LOW_Z + 0.5, 0.7, TONE.steelDark);
        }
        const quad = [corner(u0, v0, HIGH_Z), corner(u1, v0, HIGH_Z), corner(u1, v1, LOW_Z), corner(u0, v1, LOW_Z)] as const;
        iso.poly(quad, TONE.panelFrame);
        const inset = [corner(u0 + 0.02, v0 + 0.02, HIGH_Z), corner(u1 - 0.02, v0 + 0.02, HIGH_Z), corner(u1 - 0.02, v1 - 0.02, LOW_Z), corner(u0 + 0.02, v1 - 0.02, LOW_Z)] as const;
        iso.poly(inset, TONE.panel);
        const ctx = iso.ctx;
        ctx.strokeStyle = TONE.panelGrid;
        ctx.lineWidth = 0.35;
        ctx.beginPath();
        for (let k = 1; k < CELLS; k++) {
          const u = u0 + ((u1 - u0) * k) / CELLS;
          const a = corner(u, v0 + 0.02, HIGH_Z);
          const b = corner(u, v1 - 0.02, LOW_Z);
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
        }
        const m0 = corner(u0 + 0.02, (v0 + v1) / 2, (LOW_Z + HIGH_Z) / 2);
        const m1 = corner(u1 - 0.02, (v0 + v1) / 2, (LOW_Z + HIGH_Z) / 2);
        ctx.moveTo(m0[0], m0[1]);
        ctx.lineTo(m1[0], m1[1]);
        ctx.stroke();
        // A soft glint along the high edge sells the glass.
        iso.poly([corner(u0 + 0.02, v0 + 0.02, HIGH_Z), corner(u1 - 0.02, v0 + 0.02, HIGH_Z), corner(u1 - 0.02, v0 + 0.07, HIGH_Z - 1.2), corner(u0 + 0.02, v0 + 0.07, HIGH_Z - 1.2)], TONE.panelGlint);
      },
    });
  }

  // Inverter cabin in the free corner (or a wider plot on variant 2).
  const cabin = o.rect(variant === 2 ? { u0: 1.6, u1: 1.88, v0: 0.2, v1: 0.55 } : { u0: 1.62, u1: 1.86, v0: 1.74, v1: 1.92 });
  items.push({ depth: cabin.u0 + cabin.v0, draw: () => iso.solid(cabin, 0, 7, TONE.concrete) });
  for (const [u, v] of [
    [0.06, 0.06],
    [1.94, 0.06],
    [0.06, 1.94],
    [1.94, 1.94],
  ] as const) {
    const q = at(o, u, v);
    items.push({ depth: q.depth, draw: () => pole(iso, q.u, q.v, 0, 5, 0.8, TONE.steelDark) });
  }
  drawItems(items);
}

export const solarFarmArt: CivicArt = { variants: 3, headroom: () => 18, paint };
