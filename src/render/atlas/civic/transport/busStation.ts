import type { Box, IsoFrame, Orient, Rng } from '../../core';
import { at, drawItems, pole, type Item } from '../lot';

/**
 * 3×3 bus station (docs/specs/evolution.md, "Bus stations"): drawn as if the street ran along its
 * front (+v), then turned so it faces the street it was built against (the variant: 0 north-east
 * … 3 north-west). A driveway turns off the street through an IN and an OUT opening, into three
 * bays under a long canopy with buses parked nose-in; a glass terminal hall stands at the back.
 */

const BUS_COLORS = ['#f2a922', '#2f7fd6', '#d93b3b'] as const;

export function paintBusStation(iso: IsoFrame, o: Orient, rng: Rng, variant: number) {
  const side = variant % 4;
  // Canonical (street at +v) → this station's local space, turning about the lot's centre.
  const turn = (u: number, v: number): [number, number] => {
    switch (side) {
      case 0:
        return [3 - u, 3 - v];
      case 1:
        return [v, 3 - u];
      case 3:
        return [3 - v, u];
      default:
        return [u, v];
    }
  };
  const box = (b: Box): Box => {
    const [a0, c0] = turn(b.u0, b.v0);
    const [a1, c1] = turn(b.u1, b.v1);
    return o.rect({ u0: Math.min(a0, a1), u1: Math.max(a0, a1), v0: Math.min(c0, c1), v1: Math.max(c0, c1) });
  };
  const point = (u: number, v: number) => {
    const [a, c] = turn(u, v);
    return at(o, a, c);
  };
  const floor = (b: Box, z: number, fill: string) => {
    const r = box(b);
    iso.floor(r.u0, r.u1, r.v0, r.v1, z, fill);
  };

  // Ground: kerbed lot, then the driveway's asphalt with its IN and OUT openings to the street.
  floor({ u0: 0, u1: 3, v0: 0, v1: 3 }, 0, '#c9c3b5');
  floor({ u0: 0.15, u1: 2.85, v0: 0.95, v1: 3 }, 0.04, '#4a4e55');
  floor({ u0: 1.1, u1: 1.9, v0: 2.55, v1: 3 }, 0.06, '#c9c3b5'); // kerbed island between IN and OUT
  // Bay markings and arrows.
  for (const u of [0.35, 1.2, 2.05, 2.85]) floor({ u0: u - 0.02, u1: u + 0.02, v0: 1.0, v1: 1.95 }, 0.07, '#e9e6dc');
  for (const [u0, dir] of [
    [0.45, -1],
    [2.25, 1],
  ] as const) {
    // IN points into the lot (−v), OUT out to the street (+v).
    const v = 2.75;
    floor({ u0, u1: u0 + 0.3, v0: v - 0.03, v1: v + 0.03 }, 0.07, '#f2f2ee');
    floor({ u0: u0 + 0.11, u1: u0 + 0.19, v0: v + (dir > 0 ? 0 : -0.12), v1: v + (dir > 0 ? 0.12 : 0) }, 0.07, '#f2f2ee');
  }

  const items: Item[] = [];
  // Terminal hall at the back: glass front, pale roof, a BUS sign panel.
  const hall = box({ u0: 0.2, u1: 2.8, v0: 0.12, v1: 0.85 });
  items.push({
    depth: hall.u1 + hall.v1,
    draw: () => {
      iso.solid(hall, 0, 15, '#e7ecf0', '#9aa4ad');
      iso.wall('se', hall.u1, hall.v0 + 0.06, hall.v1 - 0.06, 2, 12, '#3a6b8f');
      iso.wall('sw', hall.v1, hall.u0 + 0.06, hall.u1 - 0.06, 2, 12, '#3a6b8f');
      for (let k = 1; k < 8; k++) {
        const t = k / 8;
        iso.wall('sw', hall.v1, hall.u0 + (hall.u1 - hall.u0) * t - 0.01, hall.u0 + (hall.u1 - hall.u0) * t + 0.01, 2, 12, '#e7ecf0');
        iso.wall('se', hall.u1, hall.v0 + (hall.v1 - hall.v0) * t - 0.01, hall.v0 + (hall.v1 - hall.v0) * t + 0.01, 2, 12, '#e7ecf0');
      }
      iso.solid({ u0: hall.u0 - 0.05, u1: hall.u1 + 0.05, v0: hall.v0 - 0.05, v1: hall.v1 + 0.05 }, 15, 17, '#f4f6f8', '#5d6b78');
      // The sign: a blue panel on top with a white band.
      const sign = { u0: (hall.u0 + hall.u1) / 2 - 0.25, u1: (hall.u0 + hall.u1) / 2 + 0.25, v0: (hall.v0 + hall.v1) / 2 - 0.08, v1: (hall.v0 + hall.v1) / 2 + 0.08 };
      iso.solid(sign, 17, 24, '#1f6fb2', '#2a85cf');
      iso.wall('sw', sign.v1, sign.u0 + 0.05, sign.u1 - 0.05, 19.5, 21.5, '#f4f6f8');
    },
  });

  // Buses parked nose-in to the terminal in the bays (one bay left free now and then).
  const parked = 2 + Math.floor(rng() * 2);
  for (let k = 0; k < 3; k++) {
    if (k >= parked) continue;
    const u = 0.78 + k * 0.85;
    const bus = box({ u0: u - 0.13, u1: u + 0.13, v0: 1.05, v1: 1.8 });
    const color = BUS_COLORS[(k + side) % BUS_COLORS.length];
    items.push({
      depth: bus.u1 + bus.v1,
      draw: () => {
        iso.solid(bus, 1, 9, color, '#f4f4f0');
        iso.wall('se', bus.u1, bus.v0 + 0.04, bus.v1 - 0.04, 5, 8, '#253a4f');
        iso.wall('sw', bus.v1, bus.u0 + 0.03, bus.u1 - 0.03, 5, 8, '#253a4f');
      },
    });
  }

  // A canopy over the boarding end of each bay (by the terminal), so the buses' noses and the
  // driveway stay in view; posts at the bay lines.
  for (const u of [0.35, 1.2, 2.05, 2.85]) {
    const p = point(u, 0.98);
    items.push({ depth: p.depth, draw: () => pole(iso, p.u, p.v, 0, 13, 1.2, '#4b5864') });
  }
  for (let k = 0; k < 3; k++) {
    const u = 0.78 + k * 0.85;
    const roof = box({ u0: u - 0.36, u1: u + 0.36, v0: 0.9, v1: 1.38 });
    items.push({ depth: roof.u1 + roof.v1 + 0.4, draw: () => iso.solid(roof, 13, 14.2, '#2f7fd6', '#5aa2e6') });
  }

  // A bench and a shelter tree by the IN opening.
  const tree = point(0.3, 2.5);
  items.push({
    depth: tree.depth,
    draw: () => {
      iso.disc(tree.u, tree.v, 0.14, 0.1, 'rgba(0,0,0,0.15)');
      pole(iso, tree.u, tree.v, 0, 6, 1.4, '#6b4a2f');
      iso.disc(tree.u, tree.v, 0.16, 10, '#4f9a4a');
    },
  });
  drawItems(items);
}
