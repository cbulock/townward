import { flatTone, litWall, shade, solidOut, wallOn } from '../../core';
import { glazing } from './glazing';
import type { FacadeArgs } from './kit';

const DOORS = ['#a8322a', '#2a5f9e', '#2b7a46', '#c98a22', '#3a3f47'] as const;

/**
 * A terrace of three narrow houses on the front: each unit its own colour, with a front door
 * under a fanlight, a front step, tall windows and a cornice. Other walls are plain windows.
 */
export function paintTownhouse(args: FacadeArgs) {
  const { iso, art, m, f, isFront, rng } = args;
  const fh = art.floorH;
  const { a0, a1 } = f;
  const len = a1 - a0;
  const H = m.z1;
  if (!isFront) {
    const cols = Math.max(2, Math.round(len * 3.6));
    const step = len / cols;
    for (let k = 0; k < m.floors; k++) {
      for (let c = 0; c < cols; c++) glazing(iso, f, a0 + c * step + step * 0.25, a0 + c * step + step * 0.75, m.z0 + k * fh + 2.5, m.z0 + (k + 1) * fh - 2, rng);
    }
    return;
  }
  const unitColors = art.units ?? [m.wall];
  const units = 3;
  const uw = len / units;
  for (let k = 0; k < units; k++) {
    const s0 = a0 + k * uw;
    const unitWall = unitColors[k % unitColors.length];
    litWall(iso, f.face, f.at, s0, s0 + uw, 2, H, unitWall);
    // Party wall line between units.
    wallOn(iso, f, s0 + uw - 0.008, s0 + uw, 2, H, 'rgba(0,0,0,0.22)');
    const door = DOORS[(k + Math.floor(rng() * 2)) % DOORS.length];
    wallOn(iso, f, s0 + uw * 0.13, s0 + uw * 0.47, 2, 9.6, '#f2eee4');
    wallOn(iso, f, s0 + uw * 0.16, s0 + uw * 0.44, 2, 8.6, flatTone(door, f.face));
    wallOn(iso, f, s0 + uw * 0.16, s0 + uw * 0.44, 7.2, 8.6, 'rgba(255, 236, 190, 0.55)');
    solidOut(iso, f, s0 + uw * 0.1, s0 + uw * 0.5, 0, 0.06, 0, 2, '#d9d3c6');
    glazing(iso, f, s0 + uw * 0.56, s0 + uw * 0.86, 3.5, 8.5, rng);
    for (let fl = 1; fl < m.floors; fl++) {
      glazing(iso, f, s0 + uw * 0.16, s0 + uw * 0.44, fl * fh + 2, fl * fh + fh - 2, rng);
      glazing(iso, f, s0 + uw * 0.56, s0 + uw * 0.84, fl * fh + 2, fl * fh + fh - 2, rng);
    }
    wallOn(iso, f, s0, s0 + uw, H - 1.6, H, flatTone(shade(unitWall, -0.28), f.face));
    wallOn(iso, f, s0, s0 + uw, H - 2.2, H - 1.6, 'rgba(0,0,0,0.12)');
  }
}
