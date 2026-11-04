import { alpha, type Box, type IsoFrame, type Orient } from '../core';
import { drawFacets, facet, type Facet, type Skin, type V3 } from './facets';

/**
 * A barrel vault: an arched roof over a local box, its arch running across `axis` (the vault's
 * length runs along it). Glass vaults make station sheds, mall atriums and glasshouses; ribs
 * mark the structure.
 */
export function vault(iso: IsoFrame, o: Orient, b: Box, axis: 'u' | 'v', z0: number, rise: number, skin: Skin, rib?: string, segments = 10) {
  const [a0, a1, c0, c1] = axis === 'u' ? [b.u0, b.u1, b.v0, b.v1] : [b.v0, b.v1, b.u0, b.u1];
  // Local point (along a, across c, height) → view space.
  const pt = (a: number, c: number, z: number): V3 => {
    const [u, v] = axis === 'u' ? o.point(a, c) : o.point(c, a);
    return [u, v, z];
  };
  const arch = (k: number) => {
    const s = k / segments;
    return { c: c0 + (c1 - c0) * s, z: z0 + rise * Math.sin(Math.PI * s) };
  };
  const centre = pt((a0 + a1) / 2, (c0 + c1) / 2, z0);
  const facets: Facet[] = [];
  for (let k = 0; k < segments; k++) {
    const p = arch(k);
    const q = arch(k + 1);
    facets.push(facet([pt(a0, p.c, p.z), pt(a1, p.c, p.z), pt(a1, q.c, q.z), pt(a0, q.c, q.z)], centre));
  }
  for (const a of [a0, a1]) facets.push(facet(Array.from({ length: segments + 1 }, (_, k) => pt(a, arch(k).c, arch(k).z)), centre));
  drawFacets(iso, facets, skin, z0, z0 + rise);
  if (!rib) return;
  const c = iso.ctx;
  c.strokeStyle = alpha(rib, 0.8);
  c.lineWidth = 0.5;
  const ribs = Math.max(2, Math.round((a1 - a0) / 0.22));
  for (let r = 0; r <= ribs; r++) {
    const a = a0 + ((a1 - a0) * r) / ribs;
    c.beginPath();
    for (let k = 0; k <= segments; k++) {
      const p = arch(k);
      const [x, y] = iso.p(...pt(a, p.c, p.z));
      if (k === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
}
