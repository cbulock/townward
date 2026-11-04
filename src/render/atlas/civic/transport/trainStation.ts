import type { Box, IsoFrame, Orient, Rng } from '../../core';
import { at, drawItems, pole, type Item } from '../lot';

/**
 * 2×2 train station (docs/specs/evolution.md, E7b): a raised platform along the side the track
 * runs (the variant, set when it's placed: 0 north-east … 3 north-west), with a yellow safety
 * edge and a long canopy on posts; behind it a brick station hall with tall windows and a clock
 * tower; a paved forecourt with benches toward the street.
 */
export function paintTrainStation(iso: IsoFrame, o: Orient, rng: Rng, variant: number) {
  const side = variant % 4;
  // Local boxes (world-aligned: u = x, v = y): the platform strip on the track side, the hall opposite.
  const strips: Readonly<Record<number, { platform: Box; edge: Box; hall: Box }>> = {
    0: { platform: { u0: 0.04, u1: 1.96, v0: 0.04, v1: 0.6 }, edge: { u0: 0.04, u1: 1.96, v0: 0.04, v1: 0.1 }, hall: { u0: 0.3, u1: 1.7, v0: 0.85, v1: 1.65 } },
    1: { platform: { u0: 1.4, u1: 1.96, v0: 0.04, v1: 1.96 }, edge: { u0: 1.9, u1: 1.96, v0: 0.04, v1: 1.96 }, hall: { u0: 0.35, u1: 1.15, v0: 0.3, v1: 1.7 } },
    2: { platform: { u0: 0.04, u1: 1.96, v0: 1.4, v1: 1.96 }, edge: { u0: 0.04, u1: 1.96, v0: 1.9, v1: 1.96 }, hall: { u0: 0.3, u1: 1.7, v0: 0.35, v1: 1.15 } },
    3: { platform: { u0: 0.04, u1: 0.6, v0: 0.04, v1: 1.96 }, edge: { u0: 0.04, u1: 0.1, v0: 0.04, v1: 1.96 }, hall: { u0: 0.85, u1: 1.65, v0: 0.3, v1: 1.7 } },
  };
  const s = strips[side];
  const lot = o.rect({ u0: 0, u1: 2, v0: 0, v1: 2 });
  iso.floor(lot.u0, lot.u1, lot.v0, lot.v1, 0, '#cfc8b8'); // forecourt paving
  for (let k = 0; k < 18; k++) {
    const p = at(o, 0.2 + rng() * 1.6, 0.2 + rng() * 1.6);
    iso.floor(p.u - 0.03, p.u + 0.03, p.v - 0.03, p.v + 0.03, 0.02, 'rgba(0,0,0,0.05)');
  }

  const platform = o.rect(s.platform);
  iso.solid(platform, 0, 3, '#b9b3a6', '#e2ddd2');
  const edge = o.rect(s.edge);
  iso.floor(edge.u0, edge.u1, edge.v0, edge.v1, 3.05, '#f2c94c');

  const hall = o.rect(s.hall);
  const items: Item[] = [];
  const hallH = 17;
  items.push({
    depth: hall.u1 + hall.v1,
    draw: () => {
      iso.solid(hall, 0, hallH, '#b8664d', '#8f4c38');
      // Tall arched-window band on both faces the camera sees, and a pale cornice.
      iso.wall('se', hall.u1, hall.v0 + 0.08, hall.v1 - 0.08, 4, 13, '#2f4659');
      iso.wall('sw', hall.v1, hall.u0 + 0.08, hall.u1 - 0.08, 4, 13, '#2f4659');
      for (let k = 1; k < 6; k++) {
        const t = k / 6;
        iso.wall('se', hall.u1, hall.v0 + (hall.v1 - hall.v0) * t - 0.012, hall.v0 + (hall.v1 - hall.v0) * t + 0.012, 4, 13, '#b8664d');
        iso.wall('sw', hall.v1, hall.u0 + (hall.u1 - hall.u0) * t - 0.012, hall.u0 + (hall.u1 - hall.u0) * t + 0.012, 4, 13, '#b8664d');
      }
      iso.solid({ u0: hall.u0 - 0.04, u1: hall.u1 + 0.04, v0: hall.v0 - 0.04, v1: hall.v1 + 0.04 }, hallH, hallH + 2, '#efe3cf', '#3f5560');
    },
  });
  // Clock tower rising from the hall's middle.
  const c = { u: (hall.u0 + hall.u1) / 2, v: (hall.v0 + hall.v1) / 2 };
  items.push({
    depth: hall.u1 + hall.v1 + 0.01,
    draw: () => {
      const tower = { u0: c.u - 0.16, u1: c.u + 0.16, v0: c.v - 0.16, v1: c.v + 0.16 };
      iso.solid(tower, hallH + 2, hallH + 20, '#c47458', '#8f4c38');
      iso.solid({ u0: tower.u0 - 0.03, u1: tower.u1 + 0.03, v0: tower.v0 - 0.03, v1: tower.v1 + 0.03 }, hallH + 20, hallH + 22, '#efe3cf', '#3f5560');
      // Clock faces on the two visible sides.
      iso.wall('se', tower.u1, c.v - 0.09, c.v + 0.09, hallH + 11, hallH + 17, '#f7f3ea');
      iso.wall('sw', tower.v1, c.u - 0.09, c.u + 0.09, hallH + 11, hallH + 17, '#f7f3ea');
      iso.wall('se', tower.u1, c.v - 0.012, c.v + 0.012, hallH + 13, hallH + 16, '#2b2f36');
      iso.wall('sw', tower.v1, c.u - 0.012, c.u + 0.012, hallH + 13.5, hallH + 15, '#2b2f36');
    },
  });

  // The canopy: posts along the platform and a long roof over it.
  const along = side === 0 || side === 2;
  const posts: [number, number][] = [];
  for (let k = 0; k < 4; k++) {
    const t = 0.25 + k * 0.5;
    const mid = side === 0 ? 0.34 : side === 2 ? 1.66 : side === 1 ? 1.66 : 0.34;
    posts.push(along ? [t, mid] : [mid, t]);
  }
  for (const [u, v] of posts) {
    const p = at(o, u, v);
    items.push({ depth: p.depth, draw: () => pole(iso, p.u, p.v, 3, 13, 1.2, '#3d4a55') });
  }
  const canopy = o.rect({ u0: s.platform.u0 + 0.02, u1: s.platform.u1 - 0.02, v0: s.platform.v0 + 0.02, v1: s.platform.v1 - 0.02 });
  items.push({ depth: canopy.u1 + canopy.v1 + 0.02, draw: () => iso.solid(canopy, 13, 14.5, '#2f7d8c', '#3fa0b2') });

  // Benches on the platform.
  for (const t of [0.6, 1.4]) {
    const [u, v] = along ? [t, side === 0 ? 0.45 : 1.55] : [side === 3 ? 0.45 : 1.55, t];
    const p = at(o, u, v);
    items.push({ depth: p.depth, draw: () => iso.box(p.u - 0.07, p.u + 0.07, p.v - 0.03, p.v + 0.03, 3, 5, '#7a5230', '#5c3d23', '#8a6038') });
  }
  drawItems(items);
}
