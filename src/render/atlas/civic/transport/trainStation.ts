import type { Box, IsoFrame, Orient, Rng } from '../../core';
import { at, drawItems, pole, type Item } from '../lot';
import { tree } from '../kit';
import { plaza } from '../../landmarks/plaza';
import { prism } from '../../modern/loft';
import { halo } from '../../modern/parts';
import { rect, superellipse, type Pt } from '../../modern/plans';
import { bands, glass, solid } from '../../modern/skins';
import { vault } from '../../modern/vault';

/**
 * 2×2 train station (docs/specs/evolution.md, E7b; restyled D-096): a raised platform along the
 * side the track runs (the variant, set when it's placed: 0 north-east … 3 north-west) under a
 * curved glass vault on white columns; behind it a glass concourse with a white wave roof, and a
 * lit sign pylon on the forecourt.
 */
export function paintTrainStation(iso: IsoFrame, o: Orient, rng: Rng, variant: number) {
  const side = variant % 4;
  // Local boxes (world-aligned: u = x, v = y): the platform strip on the track side, the hall opposite.
  const strips: Readonly<Record<number, { platform: Box; edge: Box; hall: Box }>> = {
    0: { platform: { u0: 0.04, u1: 1.96, v0: 0.04, v1: 0.6 }, edge: { u0: 0.04, u1: 1.96, v0: 0.04, v1: 0.1 }, hall: { u0: 0.3, u1: 1.7, v0: 0.85, v1: 1.6 } },
    1: { platform: { u0: 1.4, u1: 1.96, v0: 0.04, v1: 1.96 }, edge: { u0: 1.9, u1: 1.96, v0: 0.04, v1: 1.96 }, hall: { u0: 0.4, u1: 1.15, v0: 0.3, v1: 1.7 } },
    2: { platform: { u0: 0.04, u1: 1.96, v0: 1.4, v1: 1.96 }, edge: { u0: 0.04, u1: 1.96, v0: 1.9, v1: 1.96 }, hall: { u0: 0.3, u1: 1.7, v0: 0.4, v1: 1.15 } },
    3: { platform: { u0: 0.04, u1: 0.6, v0: 0.04, v1: 1.96 }, edge: { u0: 0.04, u1: 0.1, v0: 0.04, v1: 1.96 }, hall: { u0: 0.85, u1: 1.6, v0: 0.3, v1: 1.7 } },
  };
  const s = strips[side];
  const along = side === 0 || side === 2;
  plaza(iso, o, '#e7e2d8', 0.25);

  const platform = o.rect(s.platform);
  iso.solid(platform, 0, 3, '#b9b3a6', '#e2ddd2');
  const edge = o.rect(s.edge);
  iso.floor(edge.u0, edge.u1, edge.v0, edge.v1, 3.05, '#f2c94c');

  const items: Item[] = [];
  const h = s.hall;
  const hallAt: Pt = [(h.u0 + h.u1) / 2, (h.v0 + h.v1) / 2];
  const hw = (h.u1 - h.u0) / 2;
  const hd = (h.v1 - h.v0) / 2;
  items.push({
    depth: at(o, hallAt[0], hallAt[1]).depth,
    draw: () => {
      prism(iso, o, hallAt, superellipse(hw, hd, 7, 28), 0, 16, bands({ wall: '#f6f7f9', tint: '#3d6b8c', floorH: 16, glazed: 0.78 }), null);
      // A wave roof across the hall, overhanging a little.
      vault(iso, o, { u0: h.u0 - 0.06, u1: h.u1 + 0.06, v0: h.v0 - 0.06, v1: h.v1 + 0.06 }, along ? 'v' : 'u', 16, 6, solid('#f3f5f7'), '#cdd5dc');
    },
  });

  // White columns along the platform, then the glass vault on them.
  for (let k = 0; k < 4; k++) {
    const t = 0.25 + k * 0.5;
    const mid = side === 0 || side === 3 ? 0.32 : 1.68;
    const [u, v] = along ? [t, mid] : [mid, t];
    const p = at(o, u, v);
    items.push({ depth: p.depth, draw: () => pole(iso, p.u, p.v, 3, 13, 1.3, '#eef1f4') });
  }
  const shed: Box = { u0: s.platform.u0 + 0.02, u1: s.platform.u1 - 0.02, v0: s.platform.v0 + 0.02, v1: s.platform.v1 - 0.02 };
  const sc = o.rect(shed);
  items.push({
    depth: sc.u1 + sc.v1 + 0.02,
    draw: () => vault(iso, o, shed, along ? 'u' : 'v', 12.5, 8, glass({ tint: '#8fb9d4', frame: '#ffffff', floorH: 0, mullion: 0.14, lights: false }), '#ffffff'),
  });

  // Benches under the vault.
  for (const t of [0.6, 1.4]) {
    const [u, v] = along ? [t, side === 0 ? 0.45 : 1.55] : [side === 3 ? 0.45 : 1.55, t];
    const p = at(o, u, v);
    items.push({ depth: p.depth, draw: () => iso.box(p.u - 0.07, p.u + 0.07, p.v - 0.03, p.v + 0.03, 3, 5, '#7a5230', '#5c3d23', '#8a6038') });
  }

  // Forecourt: a sign pylon and trees on the street side.
  const street: Pt = along ? [1.82, side === 0 ? 1.82 : 0.18] : [side === 3 ? 1.82 : 0.18, 1.82];
  const pylon = at(o, street[0], street[1]);
  items.push({
    depth: pylon.depth,
    draw: () => {
      prism(iso, o, street, rect(0.05, 0.05), 0, 24, solid('#2c3440'), '#e2483d');
      const [x, y] = iso.p(pylon.u, pylon.v, 21);
      halo(iso, x, y, 6, '#ff6a5a');
      iso.ctx.fillStyle = '#ffffff';
      iso.ctx.font = "bold 3px 'IBM Plex Sans', system-ui, sans-serif";
      iso.ctx.textAlign = 'center';
      iso.ctx.fillText('RAIL', x, y + 1);
      iso.mark('beacon', 'sw', x, y);
    },
  });
  const treeAt: Pt = along ? [0.18, street[1]] : [street[0], 0.18];
  items.push(tree(iso, o, treeAt[0], treeAt[1], 0.42, variant + 2));
  drawItems(items);
  void rng;
}
