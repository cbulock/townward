import { type IsoFrame } from '../isoPaint';
import { LAMP, onRoad, pole, type RoadAxis } from '../streetArt';
import { gratedTree } from './avenueFurniture';

/** What stands on a pedestrian street: benches, planters with small trees, lamp posts. */
export const PEDESTRIAN_STYLES = 3;

function bench(iso: IsoFrame, axis: RoadAxis, s: number, o: number) {
  const [u0, v0] = onRoad(axis, s - 0.07, o - 0.025);
  const [u1, v1] = onRoad(axis, s + 0.07, o + 0.025);
  const box = { u0: Math.min(u0, u1), u1: Math.max(u0, u1), v0: Math.min(v0, v1), v1: Math.max(v0, v1) };
  iso.box(box.u0, box.u1, box.v0, box.v1, 1.6, 2.6, '#a8784a', '#7f5a36', '#c89262');
  for (const k of [-0.05, 0.05]) {
    const [u, v] = onRoad(axis, s + k, o);
    pole(iso, u, v, 0, 1.6, 0.8);
  }
}

function planter(iso: IsoFrame, axis: RoadAxis, s: number, o: number, tone: number) {
  const [u, v] = onRoad(axis, s, o);
  iso.box(u - 0.06, u + 0.06, v - 0.06, v + 0.06, 0, 3, '#c9c2b5', '#a59d90', '#5f8f45');
  gratedTree(iso, u, v, tone, 0.42);
}

function postLamp(iso: IsoFrame, axis: RoadAxis, s: number, o: number) {
  const [u, v] = onRoad(axis, s, o);
  iso.disc(u, v, 0.02, 0, 'rgba(0, 0, 0, 0.2)');
  pole(iso, u, v, 0, 12, 1.1);
  const [x, y] = iso.p(u, v, 12);
  iso.ctx.fillStyle = 'rgba(255, 236, 160, 0.3)';
  iso.ctx.beginPath();
  iso.ctx.arc(x, y, 3, 0, Math.PI * 2);
  iso.ctx.fill();
  iso.ctx.fillStyle = LAMP;
  iso.ctx.fillRect(x - 1.3, y - 1.3, 2.6, 2.6);
}

export function paintPedestrianFurniture(iso: IsoFrame, axis: RoadAxis, style: number) {
  if (style === 0) {
    planter(iso, axis, 0.3, -0.3, 0);
    bench(iso, axis, 0.65, 0.33);
  } else if (style === 1) {
    postLamp(iso, axis, 0.25, 0.36);
    planter(iso, axis, 0.7, 0.3, 2);
  } else {
    bench(iso, axis, 0.35, -0.33);
    postLamp(iso, axis, 0.7, -0.36);
  }
}
