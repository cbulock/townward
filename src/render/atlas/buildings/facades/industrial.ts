import { wallOn } from '../../core';
import { glazing } from './glazing';
import type { FacadeArgs } from './kit';

/** Corrugated cladding (ribs with a lit edge and a shaded edge) and a row of high clerestory windows. */
export function paintIndustrial({ iso, m, f, rng }: FacadeArgs) {
  const { a0, a1 } = f;
  const H = m.z1;
  const sw = f.face === 'sw';
  for (let a = a0 + 0.03; a < a1 - 0.01; a += 0.035) {
    wallOn(iso, f, a, a + 0.007, m.z0 + 2, H, sw ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)');
    wallOn(iso, f, a + 0.007, a + 0.014, m.z0 + 2, H, 'rgba(0,0,0,0.08)');
  }
  const cols = Math.max(2, Math.round((a1 - a0) * 3.4));
  const step = (a1 - a0) / cols;
  for (let c = 0; c < cols; c++) {
    const s0 = a0 + c * step + step * 0.2;
    glazing(iso, f, s0, s0 + step * 0.6, H - 6, H - 2.5, rng, { glass: '#4f7391', blinds: 0, sill: false });
  }
}
