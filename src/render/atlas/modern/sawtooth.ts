import type { Box, IsoFrame, Orient } from '../core';
import { drawFacets, facet, type V3 } from './facets';
import { glass, solid } from './skins';

/**
 * A sawtooth roof over a local box: teeth along local u, each a sloping roof with a vertical
 * band of north-light glazing, so a factory or workshop reads by its silhouette.
 */
export function sawtooth(iso: IsoFrame, o: Orient, b: Box, z0: number, rise: number, teeth: number, roof: string, tint: string) {
  const step = (b.u1 - b.u0) / teeth;
  const pt = (u: number, v: number, z: number): V3 => {
    const [a, c] = o.point(u, v);
    return [a, c, z];
  };
  const roofSkin = solid(roof);
  const glassSkin = glass({ tint, frame: '#f2f5f8', floorH: 0, mullion: 0.08, lights: false });
  const order = Array.from({ length: teeth }, (_, k) => k).sort((i, j) => {
    const a = pt(b.u0 + (i + 0.5) * step, (b.v0 + b.v1) / 2, 0);
    const c = pt(b.u0 + (j + 0.5) * step, (b.v0 + b.v1) / 2, 0);
    return a[0] + a[1] - (c[0] + c[1]);
  });
  for (const k of order) {
    const a = b.u0 + k * step;
    const e = a + step;
    const centre = pt(a + step / 2, (b.v0 + b.v1) / 2, z0);
    const slope = facet([pt(a, b.v0, z0), pt(a, b.v1, z0), pt(e, b.v1, z0 + rise), pt(e, b.v0, z0 + rise)], centre);
    const caps = [b.v0, b.v1].map((v) => facet([pt(a, v, z0), pt(e, v, z0), pt(e, v, z0 + rise)], centre));
    const pane = facet([pt(e, b.v0, z0), pt(e, b.v1, z0), pt(e, b.v1, z0 + rise), pt(e, b.v0, z0 + rise)], centre);
    drawFacets(iso, [slope], roofSkin, z0, z0 + rise);
    drawFacets(iso, [pane], glassSkin, z0, z0 + rise);
    drawFacets(iso, caps, roofSkin, z0, z0 + rise);
  }
}
