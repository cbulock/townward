import { flatTone, shade, wallOn, type FaceRef, type IsoFrame } from '../../core';
import { glassFill, glazing, markWindow } from './glazing';
import { entrance, type FacadeArgs } from './kit';

/** Brick: mortar courses, a soft speckle of darker bricks, and a string course at every floor. */
function brickTexture(iso: IsoFrame, f: FaceRef, z0: number, z1: number, floors: number, fh: number, wall: string) {
  for (let z = z0 + 2.6; z < z1 - 1; z += 1.5) iso.wall(f.face, f.at, f.a0, f.a1, z, z + 0.28, 'rgba(255,255,255,0.07)');
  const dark = shade(flatTone(wall, f.face), -0.12);
  const n = Math.round((f.a1 - f.a0) * 30);
  for (let k = 0; k < n; k++) {
    const a = f.a0 + ((k * 0.618) % 1) * (f.a1 - f.a0);
    const z = z0 + 3 + ((k * 0.377) % 1) * (z1 - z0 - 4);
    iso.wall(f.face, f.at, a, a + 0.03, z, z + 1.2, dark);
  }
  for (let k = 1; k < floors; k++) iso.wall(f.face, f.at, f.a0, f.a1, z0 + k * fh, z0 + k * fh + 0.7, 'rgba(0,0,0,0.12)');
}

/** Timber siding: lap boards, each with a lit lower lip and a shadow line. */
function sidingTexture(iso: IsoFrame, f: FaceRef, z0: number, z1: number) {
  for (let z = z0 + 2.5; z < z1 - 0.5; z += 1.6) {
    iso.wall(f.face, f.at, f.a0, f.a1, z, z + 0.35, 'rgba(0,0,0,0.1)');
    iso.wall(f.face, f.at, f.a0, f.a1, z + 0.35, z + 0.6, 'rgba(255,255,255,0.08)');
  }
}

/** Shop ground floor on the front: kick plate, a big display window with a lit interior, and a door. */
function shopfront(iso: IsoFrame, f: FaceRef, fh: number, wall: string) {
  const { a0, a1 } = f;
  const len = a1 - a0;
  wallOn(iso, f, a0 + 0.04, a1 - 0.04, 0.6, 2.2, flatTone(shade(wall, -0.45), f.face));
  const w1 = a1 - len * 0.32;
  wallOn(iso, f, a0 + 0.06, w1, 2.2, fh - 2.5, glassFill(iso, f, a0, w1, 2.2, fh - 2.5, '#3f6280'));
  // Interior: warm shelves glimpsed through the glass.
  wallOn(iso, f, a0 + 0.08, w1 - 0.02, 2.6, 5, 'rgba(255, 228, 176, 0.45)');
  for (let a = a0 + 0.12; a < w1 - 0.06; a += 0.09) wallOn(iso, f, a, a + 0.04, 3, 4.6, 'rgba(120, 70, 40, 0.35)');
  wallOn(iso, f, a0 + 0.06, w1, fh - 3.3, fh - 2.5, 'rgba(10, 16, 26, 0.35)');
  markWindow(iso, f, a0 + 0.06, w1, 2.2, fh - 2.5);
  const d0 = a1 - len * 0.26;
  const d1 = a1 - len * 0.1;
  wallOn(iso, f, d0 - 0.01, d1 + 0.01, 1, fh - 2, '#efe8da');
  wallOn(iso, f, d0, d1, 1, fh - 2.5, '#4f3322');
  wallOn(iso, f, d0 + 0.02, d1 - 0.02, 3, fh - 4, 'rgba(170, 205, 230, 0.65)');
}

/** Punched windows in a plain, brick or sided wall, with shopfronts, front doors, lintels and shutters. */
export function paintWindows({ iso, art, m, f, isFront, rng }: FacadeArgs) {
  const fh = art.floorH;
  const { a0, a1 } = f;
  const len = a1 - a0;
  const ground = m.z0 === 0;
  const H = m.z1;
  const facade = m.facade;
  const cols = Math.max(2, Math.round(len * (facade === 'brick' ? 4 : 3.4)));
  const step = len / cols;
  if (facade === 'brick') brickTexture(iso, f, m.z0, H, m.floors, fh, m.wall);
  if (facade === 'siding') sidingTexture(iso, f, m.z0, H);

  const shop = facade === 'shopfront';
  const lintel = facade === 'brick' ? (art.trim ?? '#e8dcc8') : facade === 'punched' ? art.trim : undefined;
  const shutters = facade === 'siding';
  const shutterColor = flatTone(['#3f6b4f', '#2f5577', '#7a3a32'][Math.floor(rng() * 3)], f.face);
  for (let k = 0; k < m.floors; k++) {
    const z0 = m.z0 + k * fh;
    if (shop && k === 0 && ground) {
      if (isFront) shopfront(iso, f, fh, m.wall);
      else glazing(iso, f, a0 + 0.08, a1 - 0.08, 2.2, fh - 2.5, rng, { glass: '#3f6280', blinds: 0 });
      continue;
    }
    const door = isFront && k === 0 && ground;
    if (door && m.floors <= 4) {
      const mid = a0 + len * 0.5;
      const top = Math.min(fh, 10);
      wallOn(iso, f, mid - 0.085, mid + 0.085, 1.5, top, '#f1ebdf');
      wallOn(iso, f, mid - 0.065, mid + 0.065, 1.5, top - 1, flatTone('#6b4428', f.face));
      wallOn(iso, f, mid - 0.065, mid + 0.065, top - 2.6, top - 1, 'rgba(255, 236, 190, 0.5)');
      wallOn(iso, f, mid + 0.035, mid + 0.045, 4.6, 5.4, '#d9b64a');
      for (let c = 0; c < cols; c++) {
        const s0 = a0 + c * step + step * 0.22;
        if (Math.abs(s0 + step * 0.28 - mid) < step * 0.6) continue;
        glazing(iso, f, s0, s0 + step * 0.56, z0 + 3, z0 + fh - 2.5, rng, { glass: art.glass });
      }
      continue;
    }
    if (door) {
      entrance(iso, f, fh);
      continue;
    }
    for (let c = 0; c < cols; c++) {
      const s0 = a0 + c * step + step * 0.22;
      const s1 = s0 + step * 0.56;
      glazing(iso, f, s0, s1, z0 + 2.5, z0 + fh - 2, rng, { glass: art.glass });
      if (lintel) wallOn(iso, f, s0 - 0.012, s1 + 0.012, z0 + fh - 2, z0 + fh - 1.2, flatTone(lintel, f.face));
      if (shutters) {
        wallOn(iso, f, s0 - 0.042, s0 - 0.006, z0 + 2.5, z0 + fh - 2, shutterColor);
        wallOn(iso, f, s1 + 0.006, s1 + 0.042, z0 + 2.5, z0 + fh - 2, shutterColor);
      }
    }
  }
  // Cornice: a projecting band with the shadow it casts on the wall below.
  if (m.top && art.roof === 'flat') {
    wallOn(iso, f, a0, a1, H - 1.4, H, flatTone(art.trim ?? shade(m.wall, -0.12), f.face));
    wallOn(iso, f, a0, a1, H - 2.4, H - 1.4, 'rgba(0,0,0,0.12)');
  }
}
