import { shade, type IsoFrame, type Orient } from '../../core';
import { at, type Item } from '../../civic/lot';
import { loft, prism, sweep } from '../../modern/loft';
import { circle, rect, type Pt } from '../../modern/plans';
import { solid } from '../../modern/skins';

/**
 * The theme park's fairy-tale castle: a pale curtain wall with battlements, a pink keep, and
 * round turrets of different heights under tall blue cones with gold finials and pennants.
 * Returned as depth-sorted items so turrets behind the wall are drawn before it.
 */

export interface CastleLook {
  readonly wall: string;
  readonly keep: string;
  readonly cone: string;
  readonly gold: string;
}

export const CASTLE_TOP = 118;

function turret(iso: IsoFrame, o: Orient, p: Pt, z0: number, z1: number, r: number, look: CastleLook, coneH: number) {
  prism(iso, o, p, circle(r, 16), z0, z1, solid(look.wall), look.wall);
  // A ring of battlements round the top, then the cone and finial.
  prism(iso, o, p, circle(r * 1.18, 16), z1 - 2, z1, solid(shade(look.wall, 0.05)), look.wall);
  loft(iso, o, sweep(z1, z1 + coneH, 6, p, (t) => circle(r * 1.22 * (1 - t) ** 1.15 + 0.004, 16)), solid(look.cone), null);
  const [u, v] = o.point(p[0], p[1]);
  const [x, y] = iso.p(u, v, z1 + coneH);
  const c = iso.ctx;
  c.strokeStyle = look.gold;
  c.lineWidth = 0.6;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x, y - 5);
  c.stroke();
  c.fillStyle = '#ff5d7a';
  c.beginPath();
  c.moveTo(x, y - 5);
  c.lineTo(x + 3.2, y - 4.2);
  c.lineTo(x, y - 3.4);
  c.fill();
  c.fillStyle = look.gold;
  c.beginPath();
  c.arc(x, y, 0.7, 0, Math.PI * 2);
  c.fill();
  // Two slit windows on the camera side.
  c.fillStyle = shade(look.wall, -0.45);
  const [wx, wy] = iso.p(u + r * 0.5, v + r * 0.5, (z0 + z1) / 2);
  c.beginPath();
  c.roundRect(wx - 0.6, wy - 2, 1.2, 3, 0.6);
  c.fill();
}

/** Castle parts as items, centred on local point `p`. */
export function castle(iso: IsoFrame, o: Orient, p: Pt, look: CastleLook): Item[] {
  const items: Item[] = [];
  const add = (lu: number, lv: number, bias: number, draw: () => void) => items.push({ depth: at(o, p[0] + lu, p[1] + lv).depth + bias, draw });
  const hw = 0.72;
  const hd = 0.42;
  for (const [su, sv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    add(su * hw, sv * hd, 0, () => turret(iso, o, [p[0] + su * hw, p[1] + sv * hd], 0, 30, 0.13, look, 20));
  }
  add(0, 0, 0.001, () => {
    prism(iso, o, p, rect(hw, hd), 0, 18, solid(look.wall), shade(look.wall, -0.04));
    // Battlements along every wall top.
    for (let k = -6; k <= 6; k++) {
      for (const s of [-1, 1]) {
        prism(iso, o, [p[0] + (k / 6) * hw * 0.9, p[1] + s * hd], rect(0.035, 0.035), 18, 21, solid(look.wall));
        if (Math.abs(k) <= 3) prism(iso, o, [p[0] + s * hw, p[1] + (k / 3) * hd * 0.85], rect(0.035, 0.035), 18, 21, solid(look.wall));
      }
    }
    gate(iso, o, p, hd, look);
  });
  add(0, 0, 0.002, () => prism(iso, o, [p[0], p[1] - 0.05], rect(0.42, 0.26), 18, 48, solid(look.keep), shade(look.keep, -0.05)));
  for (const [su, sv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    add(su * 0.4, sv * 0.24 - 0.05, 0.003, () => turret(iso, o, [p[0] + su * 0.4, p[1] - 0.05 + sv * 0.24], 18, 60, 0.09, look, 22));
  }
  add(0, -0.05, 0.004, () => turret(iso, o, [p[0], p[1] - 0.05], 48, 82, 0.15, look, 34));
  return items;
}

/** An arched gate in the front wall, if the front faces the camera. */
function gate(iso: IsoFrame, o: Orient, p: Pt, hd: number, look: CastleLook) {
  const face = o.faceOf('front');
  if (!face) return;
  const [u, v] = o.point(p[0], p[1] + hd);
  const [x, y] = iso.p(u, v, 0);
  const c = iso.ctx;
  c.save();
  c.translate(x, y);
  c.transform(1, face === 'sw' ? 0.5 : -0.5, 0, 1, 0, 0);
  c.fillStyle = look.gold;
  c.beginPath();
  c.roundRect(-4.2, -12.5, 8.4, 12.5, [4.2, 4.2, 0, 0]);
  c.fill();
  c.fillStyle = '#4a3550';
  c.beginPath();
  c.roundRect(-3.4, -11.6, 6.8, 11.6, [3.4, 3.4, 0, 0]);
  c.fill();
  c.restore();
}
