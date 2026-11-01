import { castShadow, faceRef, flatTone, solidOut, type Box, type IsoFrame, type Orient, type Rng } from '../../core';
import { MATERIAL } from '../../theme/tokens';
import { at, drawItems, type Item } from '../lot';
import { glazing, localFloor, tree } from '../kit';

/** 3×2 shopping complex: two lit halls with shop windows and signs, a plaza with planters and trees. */
export function paintShoppingComplex(iso: IsoFrame, o: Orient, rng: Rng, variant: number) {
  const w = o.vw;
  const h = o.vh;
  iso.floor(0.03, w - 0.03, 0.03, h - 0.03, 0, MATERIAL.kerb);
  iso.floor(0.12, w - 0.12, 0.12, h - 0.12, 0, MATERIAL.pavingLight);
  localFloor(iso, o, { u0: 0.18, u1: 2.82, v0: 1.12, v1: 1.82 }, 0.1, '#d9c7a6');
  const items: Item[] = [];
  const halls: readonly [Box, string, string][] = [
    [{ u0: 0.18, u1: 1.42, v0: 0.18, v1: 1.05 }, '#e7b56e', 'MARKET'],
    [{ u0: 1.58, u1: 2.82, v0: 0.18, v1: 1.05 }, '#79b6c8', 'GALLERIA'],
  ];
  const lot: Box = { u0: 0, u1: w, v0: 0, v1: h };
  for (const [local, color, label] of halls) {
    const b = o.rect(local);
    items.push({
      depth: b.u0 + b.v0,
      draw: () => {
        castShadow(iso, b, 22, lot);
        iso.solid(b, 0, 22, color);
        for (const face of ['sw', 'se'] as const) {
          const f = faceRef(face, b);
          const count = Math.max(3, Math.floor((f.a1 - f.a0) * 4));
          for (let k = 0; k < count; k++) {
            const a = f.a0 + (k + 0.2) * ((f.a1 - f.a0) / count);
            glazing(iso, f, a, a + 0.1, 3, 14);
          }
          iso.wall(face, f.at, f.a0, f.a1, 20.5, 22, flatTone('#ffffff', face));
        }
        const front = o.faceOf('front');
        if (front) {
          const f = faceRef(front, b);
          solidOut(iso, f, f.a0 + 0.1, f.a1 - 0.1, 0, 0.12, 15, 16.2, '#f4efe4');
          iso.text(front, f.at, (f.a0 + f.a1) / 2, 18.4, label, 5, '#fff8df');
        }
      },
    });
  }
  for (const [u, v] of [[0.38, 1.52], [1.08, 1.72], [2.45, 1.5]] as const) {
    items.push(tree(iso, o, u, v, 0.5, (variant + Math.round(u * 3)) % 9));
  }
  for (const [u, v] of [[0.65, 1.28], [1.8, 1.3], [2.35, 1.28]] as const) {
    const p = at(o, u, v);
    items.push({ depth: p.depth, draw: () => iso.solid({ u0: p.u - 0.12, u1: p.u + 0.12, v0: p.v - 0.08, v1: p.v + 0.08 }, 0, 2.5, '#8a6448', '#d97b43') });
  }
  drawItems(items);
  void rng;
}
