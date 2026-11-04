import { blobShadow, contactShadow, shade, type IsoFrame, type Orient, type Side } from '../core';
import { at, type Item } from '../civic/lot';
import { halo } from './parts';
import type { Pt } from './plans';
import { panel, sideRef, sidePoint, sideText } from './sides';

/** Street-level pieces for modern shops and industry: name bands, parasols, vans and trucks. */

/** The first of `prefer` that faces the camera (signs move round as the view turns). */
export function visibleSide(o: Orient, prefer: readonly Side[] = ['front', 'right', 'left']): Side | null {
  return prefer.find((s) => o.faceOf(s) !== null) ?? null;
}

/** A dark name band with glowing letters across a block's side, `z` its centre height. */
export function nameBand(iso: IsoFrame, o: Orient, p: Pt, hw: number, hd: number, z: number, text: string, glow: string, size = 3.6) {
  const side = visibleSide(o);
  if (!side) return;
  const s = sideRef(o, p, hw, hd, side, 0.012);
  if (!s) return;
  panel(iso, s, 0.08, 0.92, z - size * 0.75, z + size * 0.75, '#22262d');
  const [x, y] = sidePoint(iso, s, 0.5, z);
  halo(iso, x, y, size * 3, glow);
  sideText(iso, s, 0.5, z, text, size, '#ffffff');
  iso.mark('beacon', s.face, x, y);
}

/** A café parasol on a pole. */
export function parasol(iso: IsoFrame, o: Orient, u: number, v: number, color: string): Item {
  const p = at(o, u, v);
  return {
    depth: p.depth,
    draw: () => {
      const c = iso.ctx;
      const [x, y] = iso.p(p.u, p.v);
      blobShadow(c, x + 2, y + 0.5, 3.5, 1.3, 0.8);
      c.fillStyle = '#e9e2d4';
      c.fillRect(x - 1.6, y - 2.4, 3.2, 1);
      c.fillStyle = '#5a5f66';
      c.fillRect(x - 0.25, y - 8, 0.5, 8);
      c.fillStyle = shade(color, -0.25);
      c.beginPath();
      c.ellipse(x, y - 8, 4.2, 1.9, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(x - 4.2, y - 8);
      c.quadraticCurveTo(x, y - 12, x + 4.2, y - 8);
      c.quadraticCurveTo(x, y - 7, x - 4.2, y - 8);
      c.fill();
    },
  };
}

/** A vehicle of two lit boxes (cab and body) heading along local u or v. */
function vehicle(iso: IsoFrame, o: Orient, u: number, v: number, alongU: boolean, len: number, wid: number, cabLen: number, h: number, body: string, cab: string): Item {
  const p = at(o, u, v);
  return {
    depth: p.depth,
    draw: () => {
      const [du, dv] = o.point(alongU ? u + len : u + wid, alongU ? v + wid : v + len);
      const [bu, bv] = o.point(u, v);
      const box = { u0: Math.min(bu, du), u1: Math.max(bu, du), v0: Math.min(bv, dv), v1: Math.max(bv, dv) };
      contactShadow(iso, box, 1.3);
      const along = Math.abs(du - bu) > Math.abs(dv - bv) ? 'u' : 'v';
      const k = cabLen / len;
      const cabBox = along === 'u' ? { ...box, u1: box.u0 + (box.u1 - box.u0) * k } : { ...box, v1: box.v0 + (box.v1 - box.v0) * k };
      const bodyBox = along === 'u' ? { ...box, u0: cabBox.u1 + 0.01 } : { ...box, v0: cabBox.v1 + 0.01 };
      iso.box(box.u0 + 0.01, box.u1 - 0.01, box.v0 + 0.01, box.v1 - 0.01, 0, 0.9, '#1d2024', '#14161a', '#1d2024');
      iso.solid(cabBox, 0.8, h * 0.75, cab);
      iso.solid(bodyBox, 0.8, h, body);
    },
  };
}

export function van(iso: IsoFrame, o: Orient, u: number, v: number, alongU: boolean, color: string): Item {
  return vehicle(iso, o, u, v, alongU, 0.3, 0.15, 0.1, 5, '#f3f4f6', color);
}

export function truck(iso: IsoFrame, o: Orient, u: number, v: number, alongU: boolean, color: string): Item {
  return vehicle(iso, o, u, v, alongU, 0.62, 0.17, 0.14, 7.5, '#eef0f3', color);
}
