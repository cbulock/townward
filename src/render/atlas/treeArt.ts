import { mulberry32 } from '../../shared/rng';
import { TREE_HEADROOM, tileUVToFrame } from './geometry';
import { INK } from './palette';

export const TREE_VARIANTS = 6;

interface TreeSpec {
  x: number;
  y: number;
  size: number;
  /** Index into PINE_SHADES. */
  shade: number;
}

/** Slots in tile space for 1–3 trees. Sorted back to front before drawing. */
const SLOTS: Readonly<Record<1 | 2 | 3, readonly (readonly [number, number])[]>> = {
  1: [[0.5, 0.5]],
  2: [
    [0.3, 0.36],
    [0.7, 0.64],
  ],
  3: [
    [0.26, 0.28],
    [0.74, 0.34],
    [0.48, 0.74],
  ],
};

/** A few green families so forests aren't uniform. */
const PINE_SHADES = [
  { dark: '#1f6b2e', body: '#2e8c3a', light: '#4cb34a' },
  { dark: '#226f2c', body: '#34953b', light: '#58bf4f' },
  { dark: '#1c6234', body: '#2a8443', light: '#45aa55' },
] as const;

/**
 * A tile's worth of chunky pixel-art pines painted into one frame (the ground
 * diamond starts at y = TREE_HEADROOM). One sprite per forested tile keeps
 * sprite counts low.
 */
export function paintTreeCluster(ctx: CanvasRenderingContext2D, density: 1 | 2 | 3, variant: number) {
  const rng = mulberry32(5000 + density * 31 + variant * 7);
  const trees: TreeSpec[] = SLOTS[density].map(([u, v]) => {
    const p = tileUVToFrame(u + (rng() - 0.5) * 0.12, v + (rng() - 0.5) * 0.12, TREE_HEADROOM);
    return {
      x: Math.round(p.x),
      y: Math.round(p.y),
      size: (density === 1 ? 1.05 : 0.95) * (0.88 + rng() * 0.24),
      shade: Math.floor(rng() * PINE_SHADES.length),
    };
  });
  trees.sort((a, b) => a.y - b.y);

  for (const t of trees) shadow(ctx, t);
  for (const t of trees) pine(ctx, t);
}

/** A single pine with its shadow, for other art (parks, gardens). */
export function paintPine(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, shade = 0) {
  const t: TreeSpec = { x, y, size, shade: shade % PINE_SHADES.length };
  shadow(ctx, t);
  pine(ctx, t);
}

function shadow(ctx: CanvasRenderingContext2D, t: TreeSpec) {
  ctx.fillStyle = 'rgba(20, 70, 20, 0.35)';
  ctx.beginPath();
  ctx.ellipse(t.x + 2, t.y + 1, 10 * t.size, 4.2 * t.size, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** One rounded tier: a soft triangle with a scalloped, bulging bottom. */
function tierPath(ctx: CanvasRenderingContext2D, cx: number, bottom: number, half: number, height: number) {
  const top = bottom - height;
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.quadraticCurveTo(cx + half * 0.55, top + height * 0.35, cx + half, bottom - height * 0.12);
  ctx.quadraticCurveTo(cx + half * 0.9, bottom + height * 0.12, cx + half * 0.45, bottom + height * 0.06);
  ctx.quadraticCurveTo(cx, bottom + height * 0.18, cx - half * 0.45, bottom + height * 0.06);
  ctx.quadraticCurveTo(cx - half * 0.9, bottom + height * 0.12, cx - half, bottom - height * 0.12);
  ctx.quadraticCurveTo(cx - half * 0.55, top + height * 0.35, cx, top);
  ctx.closePath();
}

function pine(ctx: CanvasRenderingContext2D, t: TreeSpec) {
  const s = t.size;
  const c = PINE_SHADES[t.shade];
  const x = t.x;

  // Trunk with outline.
  ctx.fillStyle = INK.outline;
  ctx.fillRect(x - 2, t.y - 5 * s, 4, 5 * s + 1);
  ctx.fillStyle = '#7b4a22';
  ctx.fillRect(x - 1, t.y - 5 * s, 2, 5 * s);

  // Chunky, rounded tiers: wide and short, like a pixel-art pine.
  const tiers = [
    { bottom: t.y - 4 * s, half: 11 * s, height: 10 * s },
    { bottom: t.y - 9.5 * s, half: 9 * s, height: 9 * s },
    { bottom: t.y - 14.5 * s, half: 6.5 * s, height: 8.5 * s },
  ];

  // Outline pass: all tiers stroked thick in dark ink, so overlapping tiers share one silhouette.
  ctx.strokeStyle = INK.outline;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  for (const tr of tiers) {
    tierPath(ctx, x, tr.bottom, tr.half, tr.height);
    ctx.stroke();
  }

  for (const tr of tiers) {
    // Body.
    tierPath(ctx, x, tr.bottom, tr.half, tr.height);
    ctx.fillStyle = c.body;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // Shaded right side and underside.
    ctx.fillStyle = c.dark;
    ctx.beginPath();
    ctx.ellipse(x + tr.half * 0.75, tr.bottom, tr.half * 0.85, tr.height * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    // Lit upper-left.
    ctx.fillStyle = c.light;
    ctx.beginPath();
    ctx.ellipse(x - tr.half * 0.35, tr.bottom - tr.height * 0.45, tr.half * 0.38, tr.height * 0.3, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
