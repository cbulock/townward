import type { IsoFrame, Orient, Rng } from '../../core';
import { at, drawItems, type Item } from '../lot';
import { fountain, lamp, tree } from '../kit';
import { plaza } from '../../landmarks/plaza';
import { planShadow, prism } from '../../modern/loft';
import { halo, slab } from '../../modern/parts';
import { rect, sail, superellipse, type Pt } from '../../modern/plans';
import { bands, glass } from '../../modern/skins';
import { vault } from '../../modern/vault';

/**
 * 3×2 shopping complex (restyled D-096): two rounded wings in white bands and glass with lit
 * name bands and roof gardens, joined by a glass-vaulted atrium under a sweeping white entrance
 * canopy; a big screen, a fountain plaza, trees and lamps out front.
 */

interface Look {
  readonly names: readonly [string, string];
  readonly glow: string;
  readonly tint: string;
  readonly screen: readonly [string, string];
}

const LOOKS: readonly Look[] = [
  { names: ['GALLERIA', 'MALL'], glow: '#ff7ab6', tint: '#3f6f8f', screen: ['#ff5d8f', '#5a7dff'] },
  { names: ['ARCADE', 'PLAZA'], glow: '#6ff0d8', tint: '#2f6b72', screen: ['#25d0b8', '#ffd166'] },
  { names: ['CENTRAL', 'MARKET'], glow: '#ffd166', tint: '#4a5f8c', screen: ['#ff9f43', '#ee5a6f'] },
  { names: ['HARBOUR', 'SHOPS'], glow: '#8ab8ff', tint: '#365a7c', screen: ['#6c8cff', '#43d6a0'] },
];

const WING_H = 26;

export function paintShoppingComplex(iso: IsoFrame, o: Orient, rng: Rng, variant: number) {
  const look = LOOKS[variant % LOOKS.length];
  const lot = { u0: 0, u1: o.vw, v0: 0, v1: o.vh };
  plaza(iso, o, '#ece7dd', 0.3);
  planShadow(iso, o, [1.5, 0.6], rect(1.4, 0.45), WING_H, lot);

  const items: Item[] = [];
  const wing = (p: Pt, name: string, screen: boolean): Item => ({
    depth: at(o, p[0], p[1]).depth,
    draw: () => {
      const plan = superellipse(0.6, 0.42, 6, 28);
      prism(iso, o, p, plan, 0, WING_H, bands({ wall: '#f7f6f2', tint: look.tint, floorH: 8.6, glazed: 0.62 }), '#7cc46a');
      // Roof garden edging, then the lit name band on the front.
      prism(iso, o, p, superellipse(0.52, 0.34, 6, 28), WING_H, WING_H + 1.2, bands({ wall: '#5aa64a', tint: '#5aa64a', floorH: 2, glazed: 0 }), '#8fd06a');
      const front = o.faceOf('front');
      if (front) {
        const [u, v] = o.point(p[0], p[1] + 0.43);
        const [x, y] = iso.p(u, v, WING_H - 3);
        halo(iso, x, y, 10, look.glow);
        iso.text(front, front === 'sw' ? v : u, front === 'sw' ? u : v, WING_H - 3, name, 4.4, '#ffffff');
        if (screen) {
          const [a0, a1] = front === 'sw' ? [u - 0.36, u - 0.08] : [v - 0.36, v - 0.08];
          const at0 = front === 'sw' ? v + 0.005 : u + 0.005;
          const g = iso.wallGradient(front, at0, a0, a1, 6, 15, look.screen[0], look.screen[1]);
          iso.wall(front, at0, a0 - 0.015, a1 + 0.015, 5.4, 15.6, '#1d2128');
          iso.wall(front, at0 + 0.002, a0, a1, 6, 15, g);
        }
      }
    },
  });
  items.push(wing([0.72, 0.6], look.names[0], false));
  items.push(wing([2.28, 0.6], look.names[1], true));
  items.push({
    depth: at(o, 1.5, 0.6).depth + 0.001,
    draw: () => {
      prism(iso, o, [1.5, 0.6], rect(0.32, 0.38), 0, 18, glass({ tint: '#5f93b8', floorH: 9, mullion: 0.09 }), null);
      vault(iso, o, { u0: 1.18, u1: 1.82, v0: 0.22, v1: 0.98 }, 'v', 18, 9, glass({ tint: '#9cc6e0', frame: '#ffffff', floorH: 0, mullion: 0.1, lights: false }), '#ffffff');
      // The sweeping entrance canopy.
      slab(iso, o, [1.5, 0.98], sail(0.55, 0.32, 1, 18), 10, 1.4, '#f8f9fb');
    },
  });

  for (const [u, v] of [[0.3, 1.6], [2.7, 1.6], [0.95, 1.8], [2.05, 1.8]] as const) items.push(tree(iso, o, u, v, 0.48, (variant + Math.round(u * 3)) % 9));
  for (const [u, v] of [[1.15, 1.45], [1.85, 1.45]] as const) items.push(lamp(iso, o, u, v));
  const f = at(o, 1.5, 1.55);
  items.push({ depth: f.depth, draw: () => fountain(iso, f.u, f.v, 0.2, 8) });
  drawItems(items);
  void rng;
}
