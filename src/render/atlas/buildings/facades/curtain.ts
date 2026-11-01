import { flatTone, mix, pOn, shade, wallOn } from '../../core';
import { GLASS } from '../../theme/tokens';
import { markWindow } from './glazing';
import { entrance, type FacadeArgs } from './kit';

/**
 * Curtain wall: a skin of glass tinted by the wall colour that reflects the sky at the top,
 * slim spandrel lines at each floor, mullions (or deep fins), and broad reflection streaks.
 */
export function paintCurtain({ iso, art, m, f, isFront, rng }: FacadeArgs) {
  const fh = art.floorH;
  const { a0, a1 } = f;
  const len = a1 - a0;
  const ground = m.z0 === 0;
  const H = m.z1;
  const sw = f.face === 'sw';
  const cols = Math.max(2, Math.round(len * 3.4));
  const step = len / cols;
  const z0 = m.z0 + (ground ? 2 : 0);

  const top = mix(GLASS.reflect, m.wall, sw ? 0.4 : 0.7);
  const bottom = flatTone(shade(m.wall, -0.32), f.face);
  wallOn(iso, f, a0 + 0.01, a1 - 0.01, z0, H, iso.wallGradient(f.face, f.at, a0, a1, z0, H, top, bottom));
  // Spandrels: a slim opaque band at every floor.
  for (let k = 1; k < m.floors; k++) {
    const z = m.z0 + k * fh;
    wallOn(iso, f, a0, a1, z - 0.4, z + 0.8, sw ? 'rgba(255,255,255,0.24)' : 'rgba(210,225,240,0.12)');
    wallOn(iso, f, a0, a1, z + 0.8, z + 1.2, 'rgba(10, 20, 35, 0.18)');
  }
  for (let c = 1; c < cols; c++) {
    const a = a0 + c * step;
    if (art.fins) {
      wallOn(iso, f, a - 0.014, a + 0.014, m.z0, H, sw ? 'rgba(255,255,255,0.42)' : 'rgba(220,230,240,0.18)');
      wallOn(iso, f, a + 0.006, a + 0.014, m.z0, H, 'rgba(0,0,0,0.2)');
    } else {
      wallOn(iso, f, a, a + 0.01, m.z0, H, 'rgba(18, 34, 52, 0.4)');
    }
  }
  if (sw) {
    // Sky reflections: two diagonal streaks across the lit glass.
    const h = H - m.z0;
    for (const [s, w, o] of [
      [0.12, 0.16, 0.18],
      [0.5, 0.07, 0.12],
    ] as const) {
      iso.poly(
        [
          pOn(iso, f, a0 + len * s, 0, m.z0 + h * 0.95),
          pOn(iso, f, a0 + len * (s + w), 0, m.z0 + h * 0.95),
          pOn(iso, f, a0 + len * (s + w + 0.25), 0, m.z0 + h * 0.2),
          pOn(iso, f, a0 + len * (s + 0.25), 0, m.z0 + h * 0.2),
        ],
        `rgba(255,255,255,${o})`,
      );
    }
  }
  // Every pane can light at night; a few interior hints by day (pale ceiling panels).
  for (let k = 0; k < m.floors; k++) {
    const z = m.z0 + k * fh;
    for (let c = 0; c < cols; c++) {
      const s0 = a0 + c * step + 0.02;
      const s1 = a0 + (c + 1) * step - 0.02;
      if (z + 1.5 >= z0) markWindow(iso, f, s0, s1, z + 1.5, z + fh - 1);
      if (rng() < 0.08) wallOn(iso, f, s0, s1, z + fh - 2.2, z + fh - 1.2, 'rgba(240, 236, 226, 0.4)');
    }
  }
  if (ground && isFront) entrance(iso, f, fh);
}
