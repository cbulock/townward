import { useEffect, useRef, useState } from 'react';
import { HALF_H, HALF_W } from '../../../shared/constants';
import { BUILDINGS, type BuildingId } from '../../../sim/buildings/catalog';
import { RoadType } from '../../../sim/roads';
import { Terrain } from '../../../sim/terrain/types';
import { buildingHeadroom, paintBuilding } from '../../../render/atlas/buildings';
import { GROUND_PAD, TREE_HEADROOM } from '../../../render/atlas/geometry';
import { paintGround } from '../../../render/atlas/nature/ground';
import { paintTreeCluster } from '../../../render/atlas/nature/trees';
import { paintRoad } from '../../../render/atlas/roadArt';

/** The diorama's size in tiles; streets run along x = 4 and y = 4. */
const N = 10;
const ROAD = 4;
/** Room above the back corner for the tallest towers (px). */
const HEADROOM = 230;

interface Plot {
  id: BuildingId;
  x: number;
  y: number;
  variant: number;
}

/** A hand-laid neighbourhood: downtown at the back, shops on the corner, homes and parks in front. */
const PLOTS: readonly Plot[] = [
  { id: 'office_tower', x: 0, y: 0, variant: 2 },
  { id: 'condo_tower', x: 2, y: 0, variant: 4 },
  { id: 'hotel', x: 0, y: 2, variant: 3 },
  { id: 'small_office', x: 2, y: 2, variant: 4 },
  { id: 'creative_office', x: 3, y: 2, variant: 2 },
  { id: 'corner_shop', x: 2, y: 3, variant: 1 },
  { id: 'cafe', x: 3, y: 3, variant: 0 },
  { id: 'luxury_apartments', x: 5, y: 0, variant: 2 },
  { id: 'office_tower', x: 7, y: 0, variant: 5 },
  { id: 'walkup', x: 9, y: 0, variant: 1 },
  { id: 'walkup', x: 9, y: 1, variant: 5 },
  { id: 'apartment_block', x: 5, y: 2, variant: 4 },
  { id: 'park', x: 7, y: 2, variant: 0 },
  { id: 'corner_shop', x: 8, y: 2, variant: 4 },
  { id: 'cafe', x: 9, y: 2, variant: 2 },
  { id: 'townhouses', x: 7, y: 3, variant: 2 },
  { id: 'townhouses', x: 8, y: 3, variant: 0 },
  { id: 'corner_shop', x: 9, y: 3, variant: 3 },
  { id: 'central_park', x: 0, y: 5, variant: 1 },
  { id: 'townhouses', x: 3, y: 5, variant: 3 },
  { id: 'townhouses', x: 3, y: 6, variant: 5 },
  { id: 'walkup', x: 3, y: 7, variant: 3 },
  { id: 'cottage', x: 0, y: 8, variant: 1 },
  { id: 'family_house', x: 1, y: 8, variant: 3 },
  { id: 'cottage', x: 2, y: 8, variant: 5 },
  { id: 'family_house', x: 3, y: 8, variant: 0 },
  { id: 'school', x: 5, y: 5, variant: 0 },
  { id: 'villa', x: 7, y: 5, variant: 0 },
  { id: 'cottage', x: 9, y: 5, variant: 2 },
  { id: 'family_house', x: 9, y: 6, variant: 5 },
  { id: 'family_house', x: 5, y: 7, variant: 1 },
  { id: 'cottage', x: 6, y: 7, variant: 3 },
  { id: 'park', x: 7, y: 7, variant: 4 },
  { id: 'family_house', x: 8, y: 7, variant: 2 },
];

const isRoad = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && (x === ROAD || y === ROAD);

/** Road connection mask (bit d set when the neighbour in direction d — N, E, S, W — is road). */
function mask(x: number, y: number): number {
  const dirs: readonly (readonly [number, number])[] = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  let m = 0;
  dirs.forEach(([dx, dy], d) => {
    if (isRoad(x + dx, y + dy)) m |= 1 << d;
  });
  return m;
}

/** Frame-space top vertex of tile (x, y). */
const origin = (x: number, y: number) => ({ x: N * HALF_W + (x - y) * HALF_W, y: HEADROOM + (x + y) * HALF_H });

/** Paint the whole diorama into a context sized for it (logical px). */
function paintDiorama(ctx: CanvasRenderingContext2D) {
  const at = (x: number, y: number, dx: number, dy: number, paint: () => void) => {
    const p = origin(x, y);
    ctx.save();
    ctx.translate(p.x + dx, p.y + dy);
    paint();
    ctx.restore();
  };
  // Ground, then streets.
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) at(x, y, -HALF_W - GROUND_PAD, -GROUND_PAD, () => paintGround(ctx, Terrain.Grass, (x * 7 + y * 3) % 4));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (isRoad(x, y)) at(x, y, -HALF_W - GROUND_PAD, -GROUND_PAD, () => paintRoad(ctx, RoadType.Road, mask(x, y)));

  // Buildings and trees, back to front by the diagonal of their front tile.
  const taken = new Set<number>();
  const items: { depth: number; draw: () => void }[] = [];
  for (const p of PLOTS) {
    const { w, h } = BUILDINGS[p.id].size;
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) taken.add((p.y + dy) * N + p.x + dx);
    items.push({
      depth: p.x + w - 1 + p.y + h - 1 + 0.5,
      draw: () => at(p.x, p.y, -h * HALF_W - GROUND_PAD, -GROUND_PAD - buildingHeadroom(p.id, p.variant), () => paintBuilding(ctx, p.id, p.variant, 0)),
    });
  }
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (isRoad(x, y) || taken.has(y * N + x)) continue;
      const density = (((x * 5 + y * 3) % 3) + 1) as 1 | 2 | 3;
      items.push({ depth: x + y, draw: () => at(x, y, -HALF_W - GROUND_PAD, -GROUND_PAD - TREE_HEADROOM, () => paintTreeCluster(ctx, density, (x * 3 + y * 7) % 10)) });
    }
  }
  items.sort((a, b) => a.depth - b.depth);
  for (const it of items) it.draw();
}

export const HERO_W = N * 2 * HALF_W;
export const HERO_H = HEADROOM + N * 2 * HALF_H + GROUND_PAD;

/**
 * Where a ground point of the diorama (tile units, may be fractional) and a height above it (px)
 * fall on the picture, as percentages, for labels laid over it.
 */
export function heroAnchor(x: number, y: number, z = 0): { left: string; top: string } {
  const p = origin(x, y);
  return { left: `${(p.x / HERO_W) * 100}%`, top: `${((p.y - z) / HERO_H) * 100}%` };
}

/** The landing page's diorama: a small city drawn with the game's own art, painted once. */
export function HeroCity({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // In state, not classList: a re-render would otherwise reset the class and hide the city.
  const [painted, setPainted] = useState(false);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    // Paint after the first frame so the page appears at once.
    const id = requestAnimationFrame(() => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = HERO_W * dpr;
      canvas.height = HERO_H * dpr;
      ctx.scale(dpr, dpr);
      paintDiorama(ctx);
      setPainted(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);
  return <canvas ref={ref} className={`${className ?? ''} ${painted ? 'is-painted' : ''}`} style={{ aspectRatio: `${HERO_W} / ${HERO_H}` }} aria-hidden="true" />;
}
