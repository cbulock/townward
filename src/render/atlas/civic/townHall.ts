import { boxOut, castShadow, faceRef, IsoFrame, pOn, shade, wallOn, type Orient, type Rng } from '../core';
import { at, drawItems, pole, type Item } from './lot';
import { glazing, tree } from './kit';

/** The town hall: a stone hall on a plaza, a columned portico on the front, and a green dome. */
export function paintTownHall(iso: IsoFrame, o: Orient, rng: Rng, variant: number) {
  const stone = ['#efe7d6', '#e6e2da', '#f1e4d2'][variant % 3];
  const dark = shade(stone, -0.22);
  // Plaza with planters.
  iso.floor(0.03, 1.97, 0.03, 1.97, 0, '#c9c3b5');
  iso.floor(0.08, 1.92, 0.08, 1.92, 0, '#ddd6c6');
  for (let a = 0.2; a < 1.9; a += 0.25) iso.floor(a, a + 0.01, 0.1, 1.9, 0.1, 'rgba(0,0,0,0.06)');
  const b = o.rect({ u0: 0.25, u1: 1.75, v0: 0.25, v1: 1.35 });
  const H = 26;
  const front = o.faceOf('front');
  const ctx = iso.ctx;

  const behind: Item[] = [];
  const ahead: Item[] = [];
  const add = (it: Item & { u: number; v: number }) => (it.u >= b.u1 || it.v >= b.v1 ? ahead : behind).push(it);
  const fp = at(o, 1.85, 1.85);
  add({
    u: fp.u,
    v: fp.v,
    depth: fp.depth,
    draw: () => {
      pole(iso, fp.u, fp.v, 0, 30, 1.2, '#6b7079');
      const [fx, fy] = iso.p(fp.u, fp.v, 30);
      ctx.fillStyle = '#2f7a3d';
      ctx.fillRect(fx + 0.6, fy, 8, 5);
    },
  });
  for (const [u, v] of [
    [0.25, 1.75],
    [1.0, 1.82],
  ] as const) {
    const p = at(o, u, v);
    add({ ...tree(iso, o, u, v, 0.9, Math.floor(rng() * 9)), u: p.u, v: p.v });
  }
  drawItems(behind);

  castShadow(iso, b, H + 20, { u0: 0, u1: 2, v0: 0, v1: 2 });
  iso.solid(b, 0, H, stone);
  // Windows on the camera-facing sides that aren't the portico front.
  for (const face of ['sw', 'se'] as const) {
    if (face === front) continue;
    const f = faceRef(face, b);
    const n = Math.max(3, Math.round((f.a1 - f.a0) * 3.5));
    const step = (f.a1 - f.a0) / n;
    for (let k = 0; k < n; k++) glazing(iso, f, f.a0 + k * step + step * 0.25, f.a0 + k * step + step * 0.75, 8, 18);
    wallOn(iso, f, f.a0, f.a1, H - 2, H, shade(stone, -0.1));
  }
  if (front) {
    const f = faceRef(front, b);
    const mid = (f.a0 + f.a1) / 2;
    for (let k = 0; k < 3; k++) boxOut(iso, f, f.a0 + 0.35, f.a1 - 0.35, 0, 0.08 + k * 0.05, 0, 3 - k, shade(stone, 0.05), dark, shade(stone, 0.1));
    const cols = 6;
    for (let k = 0; k < cols; k++) {
      const a = f.a0 + 0.4 + k * ((f.a1 - f.a0 - 0.8) / (cols - 1));
      wallOn(iso, f, a - 0.025, a + 0.025, 3, H - 6, '#fbf8f1', 0.12);
      wallOn(iso, f, a + 0.01, a + 0.025, 3, H - 6, 'rgba(0,0,0,0.12)', 0.12);
    }
    boxOut(iso, f, f.a0 + 0.3, f.a1 - 0.3, 0, 0.16, H - 6, H - 2, shade(stone, 0.05), dark, stone);
    iso.poly([pOn(iso, f, f.a0 + 0.3, 0.16, H - 2), pOn(iso, f, f.a1 - 0.3, 0.16, H - 2), pOn(iso, f, mid, 0.16, H + 7)], shade(stone, 0.06));
  }
  // Drum, dome and lantern.
  const cu = (b.u0 + b.u1) / 2;
  const cv = (b.v0 + b.v1) / 2;
  iso.round(cu, cv, H, H + 10, () => 0.26, stone, null);
  iso.round(cu, cv, H + 10, H + 22, (t) => 0.27 * Math.sqrt(Math.max(0, 1 - t * t)), '#4f8a7a', '#4f8a7a');
  iso.round(cu, cv, H + 21, H + 25, () => 0.04, '#e9d9a8', '#c9a447');
  const [dx, dy] = iso.p(cu, cv, H);
  ctx.fillStyle = '#c9a447';
  ctx.fillRect(dx - 0.75, dy - 31, 1.5, 6);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(dx - 4, dy - 5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(dx - 4, dy - 5);
  ctx.lineTo(dx - 4, dy - 7);
  ctx.moveTo(dx - 4, dy - 5);
  ctx.lineTo(dx - 2.6, dy - 5);
  ctx.stroke();
  drawItems(ahead);
}

// ---------------------------------------------------------------- power plant

