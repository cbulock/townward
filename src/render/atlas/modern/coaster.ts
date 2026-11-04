import { shade, type IsoFrame, type Orient } from '../core';

/**
 * A roller coaster: a closed track through 3D space on slim supports, with a train of cars.
 * Segments are drawn back to front so near track crosses over far track.
 */
export type TrackPoint = readonly [number, number, number];

export interface CoasterSpec {
  /** Closed loop of local (u, v, z px) points. */
  readonly path: readonly TrackPoint[];
  readonly rail: string;
  readonly support: string;
  /** The train: first path index and how many segments it covers. */
  readonly train?: { readonly at: number; readonly cars: number; readonly colors: readonly string[] };
}

/** Smooth a coarse loop of control points (Catmull–Rom) into `per` points per span. */
export function smoothLoop(points: readonly TrackPoint[], per = 6): TrackPoint[] {
  const out: TrackPoint[] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), Math.max(0, f(p0[2], p1[2], p2[2], p3[2]))]);
    }
  }
  return out;
}

export function paintCoaster(iso: IsoFrame, o: Orient, s: CoasterSpec) {
  const c = iso.ctx;
  const view = s.path.map(([u, v, z]) => {
    const [a, b] = o.point(u, v);
    return [a, b, z] as const;
  });
  const n = view.length;
  const train = new Set<number>();
  if (s.train) for (let k = 0; k < s.train.cars; k++) train.add((s.train.at + k) % n);
  const order = Array.from({ length: n }, (_, i) => i).sort((i, j) => {
    const a = view[i];
    const b = view[(i + 1) % n];
    const p = view[j];
    const q = view[(j + 1) % n];
    return a[0] + a[1] + b[0] + b[1] - (p[0] + p[1] + q[0] + q[1]);
  });
  c.lineCap = 'round';
  for (const i of order) {
    const a = view[i];
    const b = view[(i + 1) % n];
    const pa = iso.p(a[0], a[1], a[2]);
    const pb = iso.p(b[0], b[1], b[2]);
    if (i % 3 === 0 && a[2] > 4) {
      const g = iso.p(a[0], a[1], 0);
      c.strokeStyle = s.support;
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(g[0], g[1]);
      c.lineTo(pa[0], pa[1]);
      c.stroke();
      c.fillStyle = shade(s.support, -0.3);
      c.fillRect(g[0] - 0.9, g[1] - 0.4, 1.8, 0.8);
    }
    c.strokeStyle = shade(s.rail, -0.35);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(pa[0], pa[1]);
    c.lineTo(pb[0], pb[1]);
    c.stroke();
    c.strokeStyle = s.rail;
    c.lineWidth = 0.9;
    c.beginPath();
    c.moveTo(pa[0], pa[1] - 0.5);
    c.lineTo(pb[0], pb[1] - 0.5);
    c.stroke();
    if (train.has(i) && s.train) {
      const col = s.train.colors[i % s.train.colors.length];
      c.strokeStyle = shade(col, -0.3);
      c.lineWidth = 3.2;
      c.beginPath();
      c.moveTo(pa[0], pa[1] - 1.6);
      c.lineTo(pb[0], pb[1] - 1.6);
      c.stroke();
      c.strokeStyle = col;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(pa[0], pa[1] - 2.2);
      c.lineTo(pb[0], pb[1] - 2.2);
      c.stroke();
    }
  }
}
