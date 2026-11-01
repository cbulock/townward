import { faceRef, flatTone, floorOut, solidOut, wallOn, type FaceRef, type IsoFrame } from '../../core';
import type { AttachArgs } from './kit';

/** Roller door: dark slats with lit edges. */
function rollerDoor(iso: IsoFrame, f: FaceRef, a0: number, a1: number, h: number, color: string) {
  wallOn(iso, f, a0, a1, 0, h, flatTone(color, f.face));
  for (let z = 1.2; z < h; z += 1.5) {
    wallOn(iso, f, a0, a1, z, z + 0.45, 'rgba(255,255,255,0.16)');
    wallOn(iso, f, a0, a1, z + 0.45, z + 0.7, 'rgba(0,0,0,0.14)');
  }
  wallOn(iso, f, a0, a1, h - 1.2, h, 'rgba(10, 16, 26, 0.3)');
}

/** Fire station bays: red doors with windows, white frames and a pale apron. */
export function paintFireDoors({ p, lf }: AttachArgs) {
  if (!lf) return;
  const { iso, o } = p;
  const edge = lf.face === 'sw' ? o.vh : o.vw;
  floorOut(iso, lf, lf.a0, lf.a1, 0, edge - lf.at - 0.04, 0.1, 'rgba(214, 208, 196, 0.95)');
  const doors = 2;
  const span = (lf.a1 - lf.a0) / doors;
  for (let k = 0; k < doors; k++) {
    const a = lf.a0 + k * span + span * 0.12;
    const a2 = a + span * 0.76;
    wallOn(iso, lf, a - 0.016, a2 + 0.016, 0, 9.6, '#f2ede2');
    rollerDoor(iso, lf, a, a2, 8.5, '#c8352b');
    wallOn(iso, lf, a + 0.02, a2 - 0.02, 5.4, 7, 'rgba(180, 220, 240, 0.75)');
  }
}

/** Workshop garage door on the front. */
export function paintGarageDoor({ p, lf }: AttachArgs) {
  if (!lf) return;
  const mid = (lf.a0 + lf.a1) / 2;
  rollerDoor(p.iso, lf, mid - 0.22, mid + 0.22, 9, '#5d636b');
}

/** Loading docks on the right side: dock doors with bumpers and a yellow safety strip. */
export function paintLoadingDock({ p, base }: AttachArgs) {
  const right = p.o.faceOf('right');
  if (!right) return;
  const { iso } = p;
  const f = faceRef(right, base.view);
  const doors = Math.max(2, Math.round((f.a1 - f.a0) * 2));
  const step = (f.a1 - f.a0) / doors;
  floorOut(iso, f, f.a0, f.a1, 0, 0.18, 0.5, 'rgba(242, 196, 58, 0.55)');
  for (let k = 0; k < doors; k++) {
    const a = f.a0 + k * step + step * 0.18;
    rollerDoor(iso, f, a, a + step * 0.64, 9, '#4f555c');
    solidOut(iso, f, a - 0.03, a + step * 0.64 + 0.03, 0, 0.05, 9, 10, '#8a9097');
    solidOut(iso, f, a - 0.02, a + 0.01, 0, 0.04, 1, 3, '#2a2d31');
    solidOut(iso, f, a + step * 0.64 - 0.01, a + step * 0.64 + 0.02, 0, 0.04, 1, 3, '#2a2d31');
  }
}
