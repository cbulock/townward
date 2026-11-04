/**
 * Floor plans for lofted solids: polygons round (0, 0) in local tile units. Shapes that blend
 * into each other up a tower (a square turning round, a circle swelling) must share a vertex
 * count, so every builder takes `n`.
 */

export type Pt = readonly [number, number];
export type Plan = readonly Pt[];

/** Superellipse: p = 2 is an ellipse, larger p squares it off into a rounded rectangle. */
export function superellipse(hw: number, hd: number, p: number, n = 24): Plan {
  const out: Pt[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    out.push([hw * Math.sign(c) * Math.abs(c) ** (2 / p), hd * Math.sign(s) * Math.abs(s) ** (2 / p)]);
  }
  return out;
}

export function circle(r: number, n = 24): Plan {
  return superellipse(r, r, 2, n);
}

export function rect(hw: number, hd: number): Plan {
  return [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];
}

/** A rectangle with its corners cut off at 45° (c = cut length). */
export function chamfered(hw: number, hd: number, c: number): Plan {
  return [
    [-hw + c, -hd],
    [hw - c, -hd],
    [hw, -hd + c],
    [hw, hd - c],
    [hw - c, hd],
    [-hw + c, hd],
    [-hw, hd - c],
    [-hw, -hd + c],
  ];
}

/**
 * A three-winged plan (wings 120° apart, the first pointing at `turn`): a slender core that
 * resists the wind, with each wing able to step back on its own as the tower rises.
 */
export function trefoil(lengths: readonly [number, number, number], halfWidth: number, turn = Math.PI / 2): Plan {
  const out: Pt[] = [];
  const inner = halfWidth / Math.sin(Math.PI / 3);
  for (let k = 0; k < 3; k++) {
    const a = turn + (k * Math.PI * 2) / 3;
    const d: Pt = [Math.cos(a), Math.sin(a)];
    const nrm: Pt = [-d[1], d[0]];
    const L = Math.max(lengths[k], inner + 0.01);
    // The wing's square end has its corners rounded with one extra point each.
    out.push([d[0] * L - nrm[0] * halfWidth, d[1] * L - nrm[1] * halfWidth]);
    out.push([d[0] * (L + halfWidth * 0.35) - nrm[0] * halfWidth * 0.55, d[1] * (L + halfWidth * 0.35) - nrm[1] * halfWidth * 0.55]);
    out.push([d[0] * (L + halfWidth * 0.35) + nrm[0] * halfWidth * 0.55, d[1] * (L + halfWidth * 0.35) + nrm[1] * halfWidth * 0.55]);
    out.push([d[0] * L + nrm[0] * halfWidth, d[1] * L + nrm[1] * halfWidth]);
    const b = a + Math.PI / 3;
    out.push([Math.cos(b) * inner, Math.sin(b) * inner]);
  }
  return out;
}

/**
 * A sail: a curved front (toward +v) closing on a straight back. `belly` pushes the curve out.
 * Used for the sail hotel and for crescent slabs.
 */
export function sail(hw: number, hd: number, belly = 1, n = 16): Plan {
  const out: Pt[] = [[-hw, -hd * 0.25]];
  for (let k = 0; k <= n; k++) {
    const a = Math.PI - (k / n) * Math.PI;
    out.push([Math.cos(a) * hw, -hd * 0.25 + Math.sin(a) * hd * belly]);
  }
  out.push([hw, -hd * 0.25]);
  return out;
}

/** A plan turned by `a` radians. */
export function rotate(plan: Plan, a: number): Plan {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return plan.map(([x, y]) => [x * c - y * s, x * s + y * c]);
}

export function scale(plan: Plan, k: number, kd = k): Plan {
  return plan.map(([x, y]) => [x * k, y * kd]);
}
