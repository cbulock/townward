import { IsoFrame, type Orient, type Rng } from '../../core';
import { at, drawItems, pole, type Item } from '../lot';
import { line } from '../kit';


export function paintWaterTower(iso: IsoFrame, o: Orient, rng: Rng, variant: number) {
  iso.floor(0.03, 0.97, 0.03, 0.97, 0, '#b9b6ae');
  iso.floor(0.06, 0.94, 0.06, 0.94, 0, '#8fbf6a');
  iso.disc(0.5, 0.5, 0.3, 0.05, '#c9c5bb');
  const ctx = iso.ctx;
  const c = at(o, 0.5, 0.5);
  // Pump house at the local back-right.
  const ph = o.rect({ u0: 0.66, u1: 0.9, v0: 0.12, v1: 0.34 });
  const pumpHouse = () => {
    iso.solid(ph, 0, 7, '#d7d2c6');
    iso.floor(ph.u0 - 0.02, ph.u1 + 0.02, ph.v0 - 0.02, ph.v1 + 0.02, 7, '#5a6e7d');
  };

  if (variant === 2) {
    // Ground reservoir: a wide low tank with a shallow dome, pipes and the pump house.
    const items: Item[] = [
      { depth: ph.u0 + ph.v0, draw: pumpHouse },
      {
        depth: c.depth,
        draw: () => {
          iso.round(c.u, c.v, 0, 14, () => 0.34, '#cdd7de', null);
          iso.round(c.u, c.v, 14, 18, (t) => 0.34 * Math.sqrt(1 - t * t * 0.9), '#b9c6cf', '#c9d4dc');
          const [x, y] = iso.p(c.u, c.v, 7);
          const { rx } = IsoFrame.ellipse(0.34);
          ctx.fillStyle = 'rgba(58, 155, 240, 0.85)';
          ctx.fillRect(x - rx, y - 1, rx * 2, 2.2);
          for (let z = 3; z < 14; z += 3.5) {
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            ctx.fillRect(x - rx, y - z + 4, rx * 2, 0.5);
          }
        },
      },
    ];
    drawItems(items);
    return;
  }

  const legTop = variant === 0 ? 30 : 26;
  const legR = 0.2;
  const legs: [number, number][] = [
    [0.5 - legR, 0.5 - legR],
    [0.5 + legR, 0.5 - legR],
    [0.5 - legR, 0.5 + legR],
    [0.5 + legR, 0.5 + legR],
  ];
  const back = legs.filter(([u, v]) => u + v <= 1);
  const front = legs.filter(([u, v]) => u + v > 1);
  pumpHouse();
  const drawLegs = (set: [number, number][]) => {
    for (const [u, v] of set) {
      const b = iso.p(u, v, 0);
      const t = iso.p(u + (0.5 - u) * 0.35, v + (0.5 - v) * 0.35, legTop);
      line(iso, b, t, '#6d7a86', 1.6);
    }
  };
  drawLegs(back);
  // Cross braces between neighbouring legs.
  for (let k = 0; k < 4; k++) {
    const [a, b] = [legs[k], legs[(k + 1) % 4 === 2 ? 3 : (k + 1) % 4]];
    for (const z of [9, 19]) {
      const s = z / legTop;
      const pa = iso.p(a[0] + (0.5 - a[0]) * 0.35 * s, a[1] + (0.5 - a[1]) * 0.35 * s, z);
      const pb = iso.p(b[0] + (0.5 - b[0]) * 0.35 * s, b[1] + (0.5 - b[1]) * 0.35 * s, z);
      line(iso, pa, pb, 'rgba(90, 104, 116, 0.8)', 0.6);
    }
  }
  // Riser pipe down the middle.
  pole(iso, 0.5, 0.5, 0, legTop, 2, '#8796a3');
  drawLegs(front);

  const [x, y] = iso.p(0.5, 0.5, legTop);
  if (variant === 0) {
    // Globe tank.
    const R = 11;
    const cy = y - R + 2;
    const g = ctx.createRadialGradient(x - R * 0.4, cy - R * 0.4, R * 0.15, x, cy, R);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.55, '#d9e6ef');
    g.addColorStop(1, '#8fa6b8');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(58, 155, 240, 0.9)';
    ctx.beginPath();
    ctx.ellipse(x, cy + 1, R * 0.98, 2.4, 0, 0, Math.PI);
    ctx.ellipse(x, cy + 3.4, R * 0.92, 2.4, 0, Math.PI, 0, true);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 3.6px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('H2O', x - 1, cy - 2.5);
    pole(iso, 0.5, 0.5, legTop + R * 2 - 2, legTop + R * 2 + 3, 0.8, '#5b6169');
    ctx.fillStyle = '#ff5a4a';
    ctx.fillRect(x - 0.8, y - R * 2 - 4.5, 1.8, 1.6);
  } else {
    // Classic tank: cylinder with a cone roof and a balcony ring.
    const r = 0.21;
    iso.disc(0.5, 0.5, r + 0.04, legTop, '#5d6a76');
    iso.round(0.5, 0.5, legTop, legTop + 15, () => r, '#a8cde6', null);
    const { rx, ry } = IsoFrame.ellipse(r);
    const [tx, ty] = iso.p(0.5, 0.5, legTop + 15);
    ctx.fillStyle = '#5d7d96';
    ctx.beginPath();
    ctx.moveTo(tx, ty - 7);
    ctx.lineTo(tx + rx, ty);
    ctx.ellipse(tx, ty, rx, ry, 0, 0, Math.PI, false);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7fa0b8';
    ctx.beginPath();
    ctx.moveTo(tx, ty - 7);
    ctx.lineTo(tx - rx, ty);
    ctx.lineTo(tx - rx * 0.2, ty + ry);
    ctx.closePath();
    ctx.fill();
    // Town stripe.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(tx - rx, ty + 5, rx * 2, 2);
    ctx.fillStyle = '#2f7fd6';
    ctx.font = 'bold 4px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WATER', tx - 1, ty + 11.5);
  }
  void rng;
}
