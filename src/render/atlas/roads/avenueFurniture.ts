import { shade, type IsoFrame } from '../isoPaint';
import { LAMP, onRoad, pole, POLE, type RoadAxis } from '../streetArt';

/**
 * What stands on an avenue (docs/specs/transport.md): plane trees and double-headed lamps in
 * the median, sometimes a tree on the near footpath. One sprite per straight tile in the
 * objects layer, so it sorts with cars and buildings. Layouts alternate by tile.
 */

/** Straight-avenue layouts: 0 two median trees, 1 median lamp between trees, 2 trees + near footpath tree. */
export const AVENUE_STYLES = 3;

const CROWN = ['#4e9a3a', '#5aa843', '#478f37'] as const;

/** A plane tree: slender trunk, oval crown in three tones (shadow, body, sunlit), soft ground shadow. */
function planeTree(iso: IsoFrame, u: number, v: number, tone: number, scale = 1) {
  const ctx = iso.ctx;
  const [x, y] = iso.p(u, v, 0);
  const s = scale;
  const green = CROWN[tone % CROWN.length];
  ctx.fillStyle = 'rgba(18, 50, 18, 0.26)';
  ctx.beginPath();
  ctx.ellipse(x + 2 * s, y + 0.5, 6.5 * s, 2.6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Trunk with a lit edge.
  ctx.fillStyle = '#6a4b30';
  ctx.fillRect(x - 0.9 * s, y - 11 * s, 1.8 * s, 11 * s);
  ctx.fillStyle = 'rgba(255, 230, 200, 0.25)';
  ctx.fillRect(x - 0.9 * s, y - 11 * s, 0.7 * s, 11 * s);
  // Crown: shadowed rim, body, then the sunlit upper left.
  const cy = y - 18 * s;
  ctx.fillStyle = shade(green, -0.38);
  ctx.beginPath();
  ctx.ellipse(x + 0.6 * s, cy + 0.8 * s, 6.6 * s, 8.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = green;
  ctx.beginPath();
  ctx.ellipse(x, cy, 6 * s, 7.8 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(green, 0.22);
  ctx.beginPath();
  ctx.ellipse(x - 1.8 * s, cy - 2.4 * s, 3.4 * s, 4.2 * s, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(green, 0.45);
  ctx.beginPath();
  ctx.arc(x - 2.6 * s, cy - 4.2 * s, 1.3 * s, 0, Math.PI * 2);
  ctx.fill();
}

/** A median lamp: one pole, two arms reaching over both carriageways. */
function medianLamp(iso: IsoFrame, axis: RoadAxis, s: number, h = 18) {
  const [u, v] = onRoad(axis, s, 0);
  iso.disc(u, v, 0.022, 0, 'rgba(0, 0, 0, 0.22)');
  pole(iso, u, v, 0, h, 1.3);
  const ctx = iso.ctx;
  const top = iso.p(u, v, h);
  for (const side of [-1, 1]) {
    const [hu, hv] = onRoad(axis, s, side * 0.13);
    const head = iso.p(hu, hv, h + 1.5);
    ctx.strokeStyle = POLE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(top[0], top[1]);
    ctx.quadraticCurveTo((top[0] + head[0]) / 2, top[1] - 2.5, head[0], head[1]);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 236, 160, 0.28)';
    ctx.beginPath();
    ctx.ellipse(head[0], head[1] + 1.6, 3.2, 1.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = LAMP;
    ctx.fillRect(head[0] - 1.5, head[1] - 0.2, 3, 1.4);
  }
}

export function paintAvenueFurniture(iso: IsoFrame, axis: RoadAxis, style: number) {
  if (style === 0) {
    planeTree(iso, ...onRoad(axis, 0.24, 0), 0);
    planeTree(iso, ...onRoad(axis, 0.76, 0), 1);
  } else if (style === 1) {
    planeTree(iso, ...onRoad(axis, 0.18, 0), 2, 0.9);
    medianLamp(iso, axis, 0.5);
    planeTree(iso, ...onRoad(axis, 0.82, 0), 0, 0.9);
  } else {
    planeTree(iso, ...onRoad(axis, 0.3, 0), 1);
    planeTree(iso, ...onRoad(axis, 0.78, 0), 2);
    // A smaller tree on the near footpath, by the kerb.
    planeTree(iso, ...onRoad(axis, 0.55, 0.42), 0, 0.75);
  }
}
