import type { IsoFrame, Orient, Rng } from '../../core';
import { at, drawItems, type Item } from '../../civic/lot';
import { lamp, lawn, tree } from '../../civic/kit';
import { prism } from '../../modern/loft';
import { paintCoaster, smoothLoop, type TrackPoint } from '../../modern/coaster';
import { rect } from '../../modern/plans';
import { solid } from '../../modern/skins';
import { paintWheel } from '../../modern/wheel';
import { plaza, pool } from '../plaza';
import { castle, CASTLE_TOP, type CastleLook } from './castle';
import { balloons, carousel, DROP_TOWER_H, dropTower, kiosk } from './rides';

/**
 * Theme Park (4×4 landmark): a fairy-tale castle behind a lagoon, a looping coaster on the
 * right, a carousel, a drop tower, a small wheel, kiosks, balloons and a grand entrance arch.
 * Every piece is its own item, drawn back to front.
 */

export const THEME_PARK_TOP = Math.max(CASTLE_TOP, DROP_TOWER_H + 12) + 8;

interface Look {
  readonly castle: CastleLook;
  readonly paving: string;
  readonly accents: readonly string[];
}

const LOOKS: readonly Look[] = [
  { castle: { wall: '#f6ece2', keep: '#f6c6d3', cone: '#3f6fd8', gold: '#f2c14e' }, paving: '#f3e6d2', accents: ['#ff5d7a', '#ffb347', '#4ab2ff', '#7bd389', '#b18cff'] },
  { castle: { wall: '#eef0f7', keep: '#cfd8f6', cone: '#7a4fd0', gold: '#f2c14e' }, paving: '#efe8f3', accents: ['#7a4fd0', '#ff7eb6', '#3fc1c9', '#ffd166', '#ef476f'] },
  { castle: { wall: '#fbf1dc', keep: '#ffd9a8', cone: '#d9485f', gold: '#f2c14e' }, paving: '#f6ead6', accents: ['#d9485f', '#f9a03f', '#2a9d8f', '#ffd166', '#4a7bd8'] },
];

/** The coaster: a lift hill at the back, a big drop, a loop and a camelback round the right side. */
const TRACK: readonly TrackPoint[] = [
  [3.6, 2.5, 4],
  [3.62, 1.7, 12],
  [3.6, 0.85, 44],
  [3.35, 0.35, 50],
  [2.95, 0.35, 8],
  [2.75, 0.75, 6],
  [2.8, 1.15, 18],
  [2.85, 1.0, 34],
  [2.95, 0.85, 20],
  [3.05, 1.3, 6],
  [3.15, 1.9, 26],
  [3.25, 2.5, 30],
  [3.35, 3.0, 8],
];

export function paintThemePark(iso: IsoFrame, o: Orient, rng: Rng, variant: number) {
  const look = LOOKS[variant % LOOKS.length];
  plaza(iso, o, look.paving, 0.4);
  for (const b of [{ u0: 0.15, u1: 0.95, v0: 1.5, v1: 2.4 }, { u0: 2.2, u1: 3.85, v0: 3.35, v1: 3.85 }]) lawn(iso, o.rect(b));
  pool(iso, o, { u0: 1.15, u1: 2.55, v0: 2.05, v1: 2.75 }, '#3fb6dc');

  const items: Item[] = [...castle(iso, o, [1.65, 1.1], look.castle)];
  items.push(dropTower(iso, o, [0.45, 0.45], look.accents[0]));
  items.push(carousel(iso, o, [0.85, 3.05], look.accents));
  const wheelAt = at(o, 3.0, 3.55);
  items.push({
    depth: wheelAt.depth,
    draw: () => paintWheel(iso, o, { at: [3.0, 3.55], axis: 'u', radius: 0.62, hubZ: 28, pods: 10, rim: '#ffffff', legs: '#e6eaf0', podColors: look.accents, depth: 0.05 }),
  });
  const coasterAt = at(o, 3.2, 1.5);
  items.push({
    depth: coasterAt.depth,
    draw: () => paintCoaster(iso, o, { path: smoothLoop(TRACK, 7), rail: look.accents[1], support: '#e8ecf1', train: { at: 6, cars: 5, colors: [look.accents[0], look.accents[2]] } }),
  });
  for (const [u, v, k] of [[1.9, 3.15, 0], [2.6, 3.0, 1], [0.35, 2.6, 2]] as const) items.push(kiosk(iso, o, [u, v], look.accents[k + 1]));
  for (const [u, v] of [[1.35, 3.4], [2.45, 2.05]] as const) items.push(balloons(iso, o, [u, v], look.accents));
  for (const [u, v] of [[0.3, 1.7], [0.7, 2.25], [3.85, 3.85], [2.35, 3.7], [0.25, 3.8], [1.05, 0.25]] as const) items.push(tree(iso, o, u, v, 0.45, (variant * 2 + Math.round(u * 5)) % 9));
  for (const [u, v] of [[1.15, 2.95], [2.55, 2.95], [1.5, 3.7]] as const) items.push(lamp(iso, o, u, v));
  items.push(entrance(iso, o, look));
  drawItems(items);
  void rng;
}

/** The entrance arch on the front edge: two pillars, a curved beam and the park's name. */
function entrance(iso: IsoFrame, o: Orient, look: Look): Item {
  const p = at(o, 2.0, 3.85);
  return {
    depth: p.depth,
    draw: () => {
      for (const s of [-1, 1]) prism(iso, o, [2.0 + s * 0.42, 3.85], rect(0.06, 0.06), 0, 22, solid(look.castle.wall), look.castle.gold);
      prism(iso, o, [2.0, 3.85], rect(0.5, 0.035), 17, 22, solid(look.accents[0]), look.castle.gold);
      const face = o.faceOf('front');
      if (face) {
        const [u, v] = o.point(2.0, 3.89);
        iso.text(face, face === 'sw' ? v : u, face === 'sw' ? u : v, 19.5, 'STARLAND', 3.4, '#ffffff');
      }
    },
  };
}
