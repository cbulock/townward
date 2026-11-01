import { faceRef, floorOut, IsoFrame, shade, wallOn, type Box, type Prop } from '../../core';
import type { Painting } from '../context';
import type { BuildingArt, Extra } from '../recipes';

/** A single-storey garage on the body's local right side, door facing the street. */
export function garageAnnex({ iso, o, art, ms }: Painting): Prop {
  const local = ms[0].local;
  const g = o.rect({ u0: local.u1, u1: Math.min(o.w - 0.05, local.u1 + 0.28), v0: local.v1 - 0.38, v1: local.v1 });
  const front = o.faceOf('front');
  return {
    u: g.u0,
    v: g.v0,
    draw: () => {
      const H = 7;
      iso.solid(g, 0, H, shade(art.wall, -0.05), shade(art.roofColor, -0.05));
      if (front) {
        const f = faceRef(front, g);
        const m = (f.a1 - f.a0) * 0.14;
        // Driveway first so the door sits on it.
        const edge = f.face === 'sw' ? o.vh : o.vw;
        floorOut(iso, f, f.a0 + m, f.a1 - m, 0, edge - f.at - 0.03, 0.05, 'rgba(150,146,138,0.55)');
        wallOn(iso, f, f.a0 + m, f.a1 - m, 0, 5.5, '#ebe7de');
        for (let z = 1; z < 5.5; z += 1.2) wallOn(iso, f, f.a0 + m, f.a1 - m, z, z + 0.3, 'rgba(0,0,0,0.12)');
        wallOn(iso, f, f.a0 + m, f.a1 - m, 4.8, 5.5, 'rgba(0,0,0,0.2)');
      }
    },
  };
}

/** Picket fence along the two lot edges nearest the camera, with a shadow line under the rail. */
export function paintFence(iso: IsoFrame, lot: Box) {
  for (let a = lot.u0 + 0.06; a < lot.u1 - 0.04; a += 0.09) iso.wall('sw', lot.v1 - 0.04, a, a + 0.03, 0, 4, '#fdfaf2');
  iso.wall('sw', lot.v1 - 0.04, lot.u0 + 0.06, lot.u1 - 0.06, 2.5, 3.3, '#fdfaf2');
  iso.wall('sw', lot.v1 - 0.04, lot.u0 + 0.06, lot.u1 - 0.06, 2.1, 2.5, 'rgba(0,0,0,0.1)');
  for (let a = lot.v0 + 0.06; a < lot.v1 - 0.04; a += 0.09) iso.wall('se', lot.u1 - 0.04, a, a + 0.03, 0, 4, '#ddd6c6');
  iso.wall('se', lot.u1 - 0.04, lot.v0 + 0.06, lot.v1 - 0.06, 2.5, 3.3, '#ddd6c6');
}

export const stackHeight = (slim: boolean) => (slim ? 26 : 30);

/** Local positions of smokestacks (they stand on the ground behind or through the roof). */
export function stackPositions(art: BuildingArt, local: Box): [number, number][] {
  const ex = new Set<Extra>(art.extras);
  if (ex.has('smokestacks')) {
    return [
      [local.u1 - 0.3, local.v0 + 0.22],
      [local.u1 - 0.62, local.v0 + 0.22],
    ];
  }
  if (ex.has('smokestack')) return [[local.u1 - 0.35, local.v0 + 0.25]];
  return [];
}

/** Brick stack with a soot-dark lip and two white bands. */
export function paintSmokestack(iso: IsoFrame, at: readonly [number, number], H: number, slim: boolean) {
  const top = H + stackHeight(slim);
  const r = slim ? 0.07 : 0.09;
  iso.round(at[0], at[1], 0, top, (t) => r * (1 - t * 0.2), '#a8543f', null);
  const { rx, ry } = IsoFrame.ellipse(r * 0.82);
  for (const z of [top - 6, top - 13]) {
    const [x, y] = iso.p(at[0], at[1], z);
    const g = iso.ctx.createLinearGradient(x - rx, 0, x + rx, 0);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#b9bec4');
    iso.ctx.fillStyle = g;
    iso.ctx.beginPath();
    iso.ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI);
    iso.ctx.lineTo(x - rx, y - 2.5);
    iso.ctx.ellipse(x, y - 2.5, rx, ry, 0, Math.PI, 0, true);
    iso.ctx.closePath();
    iso.ctx.fill();
  }
  const [x, y] = iso.p(at[0], at[1], top);
  iso.ctx.fillStyle = 'rgba(30, 26, 24, 0.55)';
  iso.ctx.fillRect(x - rx * 1.1, y - 0.2, rx * 2.2, 2);
}
