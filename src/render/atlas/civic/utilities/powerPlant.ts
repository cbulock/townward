import { faceRef, IsoFrame, shade, wallOn, type Box, type Orient, type Rng } from '../../core';
import { at, drawItems, pole, type Item, type SmokeSource } from '../lot';
import { glazing, localFloor } from '../kit';


/** Hyperboloid cooling tower profile: narrowest near the top, flaring out again at the lip. */
function coolingProfile(r0: number) {
  return (t: number) => r0 * (0.62 + 0.38 * ((t - 0.75) / 0.75) ** 2);
}

/** Transformer yard: gravel, a few transformers and two lattice pylons. */
function transformerYard(iso: IsoFrame, o: Orient, b: Box): Item[] {
  localFloor(iso, o, b, 0.1, '#a9a69c');
  localFloor(iso, o, { u0: b.u0 + 0.03, u1: b.u1 - 0.03, v0: b.v0 + 0.03, v1: b.v1 - 0.03 }, 0.15, '#b9b6ad');
  const items: Item[] = [];
  const n = 3;
  for (let k = 0; k < n; k++) {
    const u = b.u0 + 0.1 + k * ((b.u1 - b.u0 - 0.28) / (n - 1));
    const r = o.rect({ u0: u, u1: u + 0.12, v0: b.v0 + 0.12, v1: b.v0 + 0.26 });
    items.push({
      depth: r.u0 + r.v0,
      draw: () => {
        iso.solid(r, 0, 6, '#8d959d');
        for (let a = 0; a < 3; a++) pole(iso, r.u0 + 0.02 + a * 0.04, r.v1 - 0.02, 6, 10, 0.8, '#c9a447');
      },
    });
  }
  for (const u of [b.u0 + 0.1, b.u1 - 0.1]) {
    const p = at(o, u, b.v1 - 0.12);
    items.push({
      depth: p.depth,
      draw: () => {
        const [x, y] = iso.p(p.u, p.v, 0);
        const c = iso.ctx;
        c.strokeStyle = '#6b7079';
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(x - 3, y);
        c.lineTo(x - 0.8, y - 20);
        c.lineTo(x + 0.8, y - 20);
        c.lineTo(x + 3, y);
        c.moveTo(x - 2.4, y - 5);
        c.lineTo(x + 2.4, y - 5);
        c.moveTo(x - 1.6, y - 11);
        c.lineTo(x + 1.6, y - 11);
        c.moveTo(x - 5, y - 16);
        c.lineTo(x + 5, y - 16);
        c.stroke();
      },
    });
  }
  return items;
}

/** Power plant layout shared by the painter and the smoke sources (local space). */
const CHIMNEY = [0.3, 0.3] as const;
const CHIMNEY_H = 64;
const GAS_STACKS: readonly (readonly [number, number])[] = [
  [0.75, 1.15],
  [0.95, 1.15],
];
const GAS_STACK_H = 46;

/** Cooling towers per variant: local u, v, base radius, height. Variant 1 (gas) has none. */
function coolingTowers(variant: number): readonly (readonly [number, number, number, number])[] {
  if (variant === 1) return [];
  return variant === 0
    ? [[1.42, 1.32, 0.42, 48]]
    : [
        [1.45, 0.62, 0.3, 38],
        [1.45, 1.42, 0.3, 38],
      ];
}

export function powerPlantSmoke(o: Orient, variant: number): SmokeSource[] {
  const src = (u: number, v: number, z: number, kind: SmokeSource['kind']): SmokeSource => {
    const [vu, vv] = o.point(u, v);
    return { u: vu, v: vv, z, kind };
  };
  const out = [src(CHIMNEY[0], CHIMNEY[1], CHIMNEY_H, 'smoke')];
  for (const [u, v, , h] of coolingTowers(variant)) out.push(src(u, v, h, 'steam'));
  if (variant === 1) for (const [u, v] of GAS_STACKS) out.push(src(u, v, GAS_STACK_H, 'smoke'));
  return out;
}

export function paintPowerPlant(iso: IsoFrame, o: Orient, rng: Rng, variant: number) {
  iso.floor(0.03, 1.97, 0.03, 1.97, 0, '#a7a49b');
  iso.floor(0.06, 1.94, 0.06, 1.94, 0, '#c6c2b8');
  for (let a = 0.3; a < 1.9; a += 0.3) iso.floor(a, a + 0.01, 0.08, 1.92, 0.05, 'rgba(0,0,0,0.05)');
  const items: Item[] = [];
  const hallWall = ['#9aa1a8', '#a7a092', '#9ea7a0'][variant];

  // Turbine hall: a long box with a stripe of high windows and a stack behind it.
  const hall = o.rect({ u0: 0.12, u1: 0.98, v0: 0.12, v1: 1.0 });
  const hallH = 22;
  items.push({
    depth: hall.u0 + hall.v0 + 0.6,
    draw: () => {
      iso.solid(hall, 0, hallH, hallWall);
      for (const face of ['sw', 'se'] as const) {
        const f = faceRef(face, hall);
        const n = Math.round((f.a1 - f.a0) * 5);
        for (let k = 0; k < n; k++) {
          const a = f.a0 + ((k + 0.25) * (f.a1 - f.a0)) / n;
          glazing(iso, f, a, a + ((f.a1 - f.a0) / n) * 0.5, hallH - 8, hallH - 3);
        }
        for (let a = f.a0 + 0.03; a < f.a1; a += 0.04) wallOn(iso, f, a, a + 0.008, 0, hallH - 9, 'rgba(0,0,0,0.06)');
      }
      iso.floor(hall.u0 + 0.05, hall.u1 - 0.05, hall.v0 + 0.05, hall.v1 - 0.05, hallH, shade(hallWall, -0.15));
      for (let k = 0; k < 3; k++) {
        const [cu, cv] = o.point(0.3 + k * 0.22, 0.55);
        iso.box(cu - 0.05, cu + 0.05, cv - 0.05, cv + 0.05, hallH, hallH + 3, '#c9cdd2', '#a2a7ad', '#e2e5e8');
      }
      const f = o.faceOf('front');
      if (f) {
        const fr = faceRef(f, hall);
        const mid = (fr.a0 + fr.a1) / 2;
        wallOn(iso, fr, mid - 0.18, mid + 0.18, hallH - 15, hallH - 10, '#d6a514');
        iso.text(fr.face, fr.at, mid, hallH - 12.5, 'POWER', 4.5, '#2a2a2a');
      }
    },
  });
  const sp = at(o, CHIMNEY[0], CHIMNEY[1]);
  items.push({
    depth: sp.depth,
    draw: () => {
      const top = CHIMNEY_H;
      iso.round(sp.u, sp.v, 0, top, (t) => 0.1 * (1 - t * 0.3), '#d8d4cc', null);
      for (const z of [top - 6, top - 16, top - 26]) {
        const [x, y] = iso.p(sp.u, sp.v, z);
        const { rx } = IsoFrame.ellipse(0.075);
        iso.ctx.fillStyle = '#d23b2b';
        iso.ctx.fillRect(x - rx, y - 4, rx * 2, 4);
      }
    },
  });

  if (variant === 1) {
    // Gas plant: storage tanks and two slim exhaust stacks.
    for (const [u, v] of [
      [1.42, 0.4],
      [1.42, 0.88],
      [1.62, 1.6],
    ] as const) {
      const p = at(o, u, v);
      items.push({
        depth: p.depth,
        draw: () => {
          iso.round(p.u, p.v, 0, 18, () => 0.2, '#e4e8ec', '#f1f3f5');
          const [x, y] = iso.p(p.u, p.v, 10);
          const { rx } = IsoFrame.ellipse(0.2);
          iso.ctx.fillStyle = 'rgba(214, 165, 20, 0.85)';
          iso.ctx.fillRect(x - rx, y - 2, rx * 2, 2);
        },
      });
    }
    for (const [u, v] of GAS_STACKS) {
      const p = at(o, u, v);
      items.push({ depth: p.depth, draw: () => iso.round(p.u, p.v, 0, GAS_STACK_H, () => 0.055, '#b7bcc2', null) });
    }
    items.push(...transformerYard(iso, o, { u0: 0.12, u1: 0.98, v0: 1.3, v1: 1.88 }));
  } else {
    for (const [u, v, r, h] of coolingTowers(variant)) {
      const p = at(o, u, v);
      items.push({
        depth: p.depth,
        draw: () => {
          iso.round(p.u, p.v, 0, h, coolingProfile(r), '#d6d1c6', null);
          // Faint vertical streaks on the concrete.
          const [x, y] = iso.p(p.u, p.v, 0);
          const { rx } = IsoFrame.ellipse(r * 0.7);
          iso.ctx.fillStyle = 'rgba(0,0,0,0.05)';
          for (let k = -2; k <= 2; k++) iso.ctx.fillRect(x + (k * rx) / 3, y - h * 0.9, 1, h * 0.85);
        },
      });
    }
    items.push(...transformerYard(iso, o, { u0: 0.12, u1: 0.98, v0: 1.24, v1: 1.88 }));
  }
  void rng;
  drawItems(items);
}


