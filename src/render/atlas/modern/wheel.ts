import { blobShadow, shade, type IsoFrame, type Orient } from '../core';
import { Z_PER_TILE } from './facets';
import { halo } from './parts';
import type { Pt } from './plans';

/**
 * An observation wheel standing in a vertical plane: twin A-frame legs, a double rim with
 * spokes, glass pods hanging round the outside and LED lights on the rim. The circle is true:
 * its height in px matches its width in tiles (Z_PER_TILE).
 */
export interface WheelSpec {
  /** Hub position in local footprint space. */
  readonly at: Pt;
  /** Local axis the wheel's plane runs along. */
  readonly axis: 'u' | 'v';
  /** Radius in tiles. */
  readonly radius: number;
  readonly hubZ: number;
  readonly pods: number;
  readonly rim: string;
  readonly legs: string;
  readonly podColors: readonly string[];
  /** Turn of the pods round the rim (radians), so copies differ. */
  readonly spin?: number;
  /** Half the gap between the two rims (tiles). */
  readonly depth?: number;
}

export function paintWheel(iso: IsoFrame, o: Orient, w: WheelSpec) {
  const c = iso.ctx;
  const rz = w.radius * Z_PER_TILE;
  const depth = w.depth ?? 0.07;
  // (d along the plane, e across it) in local space → frame px.
  const at = (d: number, e: number, z: number): [number, number] => {
    const local: Pt = w.axis === 'u' ? [w.at[0] + d, w.at[1] + e] : [w.at[0] + e, w.at[1] + d];
    const [u, v] = o.point(local[0], local[1]);
    return iso.p(u, v, z);
  };
  const depthOf = (e: number) => {
    const local: Pt = w.axis === 'u' ? [w.at[0], w.at[1] + e] : [w.at[0] + e, w.at[1]];
    const [u, v] = o.point(local[0], local[1]);
    return u + v;
  };
  const back = depthOf(depth) < depthOf(-depth) ? 1 : -1;
  const rimPt = (a: number, e: number) => at(Math.cos(a) * w.radius, e, w.hubZ + Math.sin(a) * rz);

  const [gx, gy] = at(0, 0, 0);
  blobShadow(c, gx + 6, gy + 2, w.radius * 30, w.radius * 9, 0.8);

  const stroke = (pts: readonly (readonly [number, number])[], color: string, width: number, close = false) => {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0], pts[k][1]);
    if (close) c.closePath();
    c.stroke();
  };

  const legs = (side: number, color: string) => {
    const hub = at(0, side * depth * 1.2, w.hubZ);
    const spread = w.radius * 0.62;
    const footL = at(-spread, side * (depth + w.radius * 0.38), 0);
    const footR = at(spread, side * (depth + w.radius * 0.38), 0);
    stroke([footL, hub, footR], color, 3);
    stroke([footL, hub, footR], 'rgba(255,255,255,0.35)', 0.8);
    stroke([at(-spread * 0.5, side * (depth + w.radius * 0.19), w.hubZ * 0.5), at(spread * 0.5, side * (depth + w.radius * 0.19), w.hubZ * 0.5)], color, 1);
    for (const f of [footL, footR]) {
      c.fillStyle = shade(color, -0.3);
      c.fillRect(f[0] - 1.6, f[1] - 0.8, 3.2, 1.6);
    }
  };

  const STEPS = 64;
  const ring = (e: number) => Array.from({ length: STEPS }, (_, k) => rimPt((k / STEPS) * Math.PI * 2, e));
  const spokes = (e: number, color: string) => {
    const hub = at(0, e, w.hubZ);
    for (let k = 0; k < w.pods; k++) stroke([hub, rimPt((w.spin ?? 0) + (k / w.pods) * Math.PI * 2, e)], color, 0.35);
  };

  legs(back, shade(w.legs, -0.2));
  stroke(ring(back * depth), shade(w.rim, -0.25), 1.8, true);
  spokes(back * depth, shade(w.rim, -0.15));
  spokes(-back * depth, w.rim);
  stroke(ring(-back * depth), shade(w.rim, -0.12), 2.6, true);
  stroke(ring(-back * depth), w.rim, 1.4, true);
  // Inner ring and LED points on the front rim.
  stroke(
    Array.from({ length: STEPS }, (_, k) => at(Math.cos((k / STEPS) * Math.PI * 2) * w.radius * 0.94, -back * depth, w.hubZ + Math.sin((k / STEPS) * Math.PI * 2) * rz * 0.94)),
    shade(w.rim, 0.15),
    0.5,
    true,
  );
  for (let k = 0; k < 32; k++) {
    const [x, y] = rimPt((k / 32) * Math.PI * 2, -back * depth);
    c.fillStyle = k % 2 ? '#fff4c2' : '#ffd1f0';
    c.fillRect(x - 0.35, y - 0.35, 0.7, 0.7);
    if (k % 8 === 0) iso.mark('beacon', 'sw', x, y);
  }

  // Pods hang level below their mount on the outside of the rim.
  for (let k = 0; k < w.pods; k++) {
    const a = (w.spin ?? 0) + (k / w.pods) * Math.PI * 2;
    const [x, y] = at(Math.cos(a) * w.radius * 1.06, 0, w.hubZ + Math.sin(a) * rz * 1.06);
    const col = w.podColors[k % w.podColors.length];
    c.fillStyle = shade(col, -0.35);
    c.beginPath();
    c.roundRect(x - 2.6, y - 0.8, 5.2, 5, 2.2);
    c.fill();
    c.fillStyle = col;
    c.beginPath();
    c.roundRect(x - 2.4, y - 0.7, 4.3, 4.5, 2);
    c.fill();
    c.fillStyle = 'rgba(220, 240, 255, 0.9)';
    c.fillRect(x - 1.8, y + 0.4, 3.2, 1.7);
  }

  legs(-back, w.legs);
  const [hx, hy] = at(0, -back * depth * 1.3, w.hubZ);
  halo(iso, hx, hy, 4, '#ffffff');
  c.fillStyle = shade(w.legs, 0.1);
  c.beginPath();
  c.arc(hx, hy, 2, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.arc(hx - 0.5, hy - 0.5, 0.7, 0, Math.PI * 2);
  c.fill();
}

/** Headroom a wheel needs above its footprint (px). */
export function wheelTop(w: Pick<WheelSpec, 'radius' | 'hubZ'>): number {
  return w.hubZ + w.radius * Z_PER_TILE * 1.1 + 6;
}
