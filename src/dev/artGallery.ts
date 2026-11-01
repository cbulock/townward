import { BUILDING_IDS } from '../sim/buildings/catalog';
import { Decor, DECOR_KINDS, type DecorId } from '../sim/terrain/types';
import { BUILDING_ROTATIONS, buildingFrameSize, buildingVariantCount, paintBuilding } from '../render/atlas/buildings';
import { GROUND_FRAME_W, TREE_FRAME_H } from '../render/atlas/geometry';
import { DECOR_VARIANTS, paintDecor } from '../render/atlas/nature/decor';
import { paintTreeCluster, TREE_VARIANTS } from '../render/atlas/nature/trees';

/**
 * Dev-only gallery of every procedural tile family (D-066), for reviewing art without a city.
 * Open /src/dev/art.html; `?rot=1` shows all four view rotations, `?only=park` filters by id.
 */
const SCALE = 2;
const params = new URLSearchParams(location.search);
const allRotations = params.get('rot') === '1';
const only = params.get('only');

function frame(label: string, w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): HTMLElement {
  const c = document.createElement('canvas');
  c.width = w * SCALE;
  c.height = h * SCALE;
  c.style.width = `${w * SCALE}px`;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.scale(SCALE, SCALE);
    paint(ctx);
  }
  const fig = document.createElement('figure');
  const cap = document.createElement('figcaption');
  cap.textContent = label;
  fig.append(c, cap);
  return fig;
}

function section(title: string, items: HTMLElement[]) {
  const h = document.createElement('h2');
  h.textContent = title;
  const row = document.createElement('div');
  row.className = 'row';
  row.append(...items);
  document.body.append(h, row);
}

if (!only || only === 'trees') {
  for (const d of [1, 2, 3] as const) {
    section(`Forest density ${d}`, Array.from({ length: TREE_VARIANTS }, (_, v) => frame(`${v}`, GROUND_FRAME_W, TREE_FRAME_H, (ctx) => paintTreeCluster(ctx, d, v))));
  }
  const kinds = Array.from({ length: DECOR_KINDS }, (_, k) => (k + 1) as Exclude<DecorId, typeof Decor.None>);
  section('Decor', kinds.flatMap((k) => Array.from({ length: DECOR_VARIANTS }, (_, v) => frame(`${k}.${v}`, GROUND_FRAME_W, TREE_FRAME_H, (ctx) => paintDecor(ctx, k, v)))));
}
for (const id of BUILDING_IDS) {
  if (only && only !== id) continue;
  const items: HTMLElement[] = [];
  for (let v = 0; v < buildingVariantCount(id); v++) {
    const f = buildingFrameSize(id, v);
    for (const r of allRotations ? BUILDING_ROTATIONS : [0 as const]) items.push(frame(`${v}${allRotations ? `/${r}` : ''}`, f.w, f.h, (ctx) => paintBuilding(ctx, id, v, r)));
  }
  section(id, items);
}
