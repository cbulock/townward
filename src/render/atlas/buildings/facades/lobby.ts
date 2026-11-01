import { shade, wallOn } from '../../core';
import { glassFill, markWindow } from './glazing';
import type { FacadeArgs } from './kit';

/** Double-height glass lobby: warm interior glow behind tall mullions, a trim band, and the main doors. */
export function paintLobby({ iso, art, m, f, isFront }: FacadeArgs) {
  const { a0, a1 } = f;
  const H = m.z1;
  const cols = Math.max(2, Math.round((a1 - a0) * 3.4)) * 2;
  const step = (a1 - a0) / cols;
  wallOn(iso, f, a0 + 0.02, a1 - 0.02, m.z0 + 1.5, H - 1.5, glassFill(iso, f, a0, a1, m.z0 + 1.5, H - 1.5, '#4a6278'));
  // Lit interior: warmer toward the floor.
  wallOn(iso, f, a0 + 0.02, a1 - 0.02, m.z0 + 1.5, H - 1.5, iso.wallGradient(f.face, f.at, a0, a1, m.z0 + 1.5, H - 1.5, 'rgba(255, 236, 190, 0.05)', 'rgba(255, 220, 160, 0.3)'));
  for (let c = 1; c < cols; c++) wallOn(iso, f, a0 + c * step, a0 + c * step + 0.01, m.z0 + 1.5, H - 1.5, 'rgba(255,255,255,0.5)');
  wallOn(iso, f, a0, a1, H - 1.5, H, art.trim ?? shade(m.wall, -0.15));
  for (let c = 0; c < cols; c += 2) markWindow(iso, f, a0 + c * step + 0.02, a0 + (c + 2) * step - 0.02, m.z0 + 2, H - 2);
  if (isFront) {
    const mid = (a0 + a1) / 2;
    wallOn(iso, f, mid - 0.1, mid + 0.1, m.z0, m.z0 + 8, '#1f2731');
    wallOn(iso, f, mid - 0.002, mid + 0.002, m.z0, m.z0 + 8, 'rgba(255,255,255,0.4)');
  }
}
