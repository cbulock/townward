import type { Box, IsoFrame, Orient } from '../core';
import { castShadow, topTone } from '../core';
import { drawFacets, facet, fillShape, type Facet, type Skin, type V3 } from './facets';
import type { Plan, Pt } from './plans';

/**
 * Lofted solids: a stack of floor plans (sections) joined by facets. Plans with the same vertex
 * count blend smoothly, so one call draws a tower that tapers, turns, swells or leans. Plans are
 * in local space round `at`; `Orient` turns them with the view like every other building part.
 */
export interface Section {
  readonly z: number;
  readonly plan: Plan;
  /** Plan centre in local footprint space. */
  readonly at: Pt;
}

/** A section's plan in view space. */
function ring(o: Orient, s: Section): [number, number][] {
  return s.plan.map(([x, y]) => o.point(s.at[0] + x, s.at[1] + y));
}

/**
 * Draw a loft band by band from the bottom, each band's facets back to front, then the roof cap
 * (`roof` null leaves it open, e.g. under a spire that covers it).
 */
export function loft(iso: IsoFrame, o: Orient, sections: readonly Section[], skin: Skin, roof: string | null = skin.base) {
  const z0 = sections[0].z;
  const z1 = sections[sections.length - 1].z;
  const rings = sections.map((s) => ring(o, s));
  for (let k = 0; k + 1 < sections.length; k++) {
    const a = rings[k];
    const b = rings[k + 1];
    const za = sections[k].z;
    const zb = sections[k + 1].z;
    if (zb - za < 0.01) continue;
    const cu = (a.reduce((s, p) => s + p[0], 0) + b.reduce((s, p) => s + p[0], 0)) / (a.length + b.length);
    const cv = (a.reduce((s, p) => s + p[1], 0) + b.reduce((s, p) => s + p[1], 0)) / (a.length + b.length);
    const centre: V3 = [cu, cv, (za + zb) / 2];
    const band: Facet[] = [];
    for (let i = 0; i < a.length; i++) {
      const j = (i + 1) % a.length;
      band.push(facet([[a[i][0], a[i][1], za], [a[j][0], a[j][1], za], [b[j][0], b[j][1], zb], [b[i][0], b[i][1], zb]], centre));
    }
    drawFacets(iso, band, skin, z0, z1);
  }
  if (roof !== null) cap(iso, rings[rings.length - 1], z1, topTone(roof));
}

/** A flat polygon (view-space ring) at height z. */
export function cap(iso: IsoFrame, r: readonly (readonly [number, number])[], z: number, fill: string) {
  fillShape(
    iso,
    r.map(([u, v]) => iso.p(u, v, z)),
    fill,
  );
}

/** A straight prism: one plan from z0 to z1. */
export function prism(iso: IsoFrame, o: Orient, at: Pt, plan: Plan, z0: number, z1: number, skin: Skin, roof: string | null = skin.base) {
  loft(iso, o, [{ z: z0, plan, at }, { z: z1, plan, at }], skin, roof);
}

/** Sections of a plan that changes with height: `planAt(t)` for t from 0 to 1, in `steps` bands. */
export function sweep(z0: number, z1: number, steps: number, at: Pt | ((t: number) => Pt), planAt: (t: number) => Plan): Section[] {
  const out: Section[] = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    out.push({ z: z0 + (z1 - z0) * t, plan: planAt(t), at: typeof at === 'function' ? at(t) : at });
  }
  return out;
}

/** The view-space bounding box of a plan, for shadows and depth sorting. */
export function planBox(o: Orient, at: Pt, plan: Plan): Box {
  const r = plan.map(([x, y]) => o.point(at[0] + x, at[1] + y));
  return {
    u0: Math.min(...r.map((p) => p[0])),
    u1: Math.max(...r.map((p) => p[0])),
    v0: Math.min(...r.map((p) => p[1])),
    v1: Math.max(...r.map((p) => p[1])),
  };
}

/** Soft cast shadow of a plan of height `h`, clipped to the lot. */
export function planShadow(iso: IsoFrame, o: Orient, at: Pt, plan: Plan, h: number, lot: Box, strength = 1) {
  castShadow(iso, planBox(o, at, plan), h, lot, strength);
}
