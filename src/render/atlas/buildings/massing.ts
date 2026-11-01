import { faceRef, faceTone, litWall, occlusion, rimLight, shade, topTone, type Box, type IsoFrame } from '../core';
import type { MassBox, Painting } from './context';
import { paintFacade } from './facades';
import { paintRoof } from './roofs';

/**
 * One mass: graded walls (warm sun on the left face, cool shade on the right), a darker plinth,
 * the facade on both visible walls, occlusion at the foot, a rim of light on the near edges,
 * then its roof, or a terrace if another mass stands on it.
 */
export function paintMass(p: Painting, m: MassBox) {
  const { iso, o, art } = p;
  const b = m.view;
  litWall(iso, 'sw', b.v1, b.u0, b.u1, m.z0, m.z1, m.wall);
  litWall(iso, 'se', b.u1, b.v0, b.v1, m.z0, m.z1, m.wall);
  if (m.z0 === 0) {
    iso.wall('sw', b.v1, b.u0, b.u1, 0, 2, faceTone(shade(m.wall, -0.3), 'sw', 0.2));
    iso.wall('se', b.u1, b.v0, b.v1, 0, 2, faceTone(shade(m.wall, -0.3), 'se', 0.2));
  }
  for (const face of ['sw', 'se'] as const) {
    paintFacade({ iso, art, m, f: faceRef(face, b), isFront: o.sideOf(face) === 'front', rng: p.rng });
  }
  const ao = m.z0 === 0 ? 1 : 0.75;
  occlusion(iso, 'sw', b.v1, b.u0, b.u1, m.z0, 7, ao);
  occlusion(iso, 'se', b.u1, b.v0, b.v1, m.z0, 7, ao);
  rimLight(iso, b, m.z0, m.z1);
  if (m.top) {
    const axis = art.ridge === 'v' ? (o.uAxis === 'u' ? 'v' : 'u') : o.uAxis;
    paintRoof({ iso, art, b, axis, H: m.z1, roofColor: art.roofColor, wall: m.wall });
  } else {
    paintTerrace(iso, b, m.z1, art.roofColor, m.wall);
  }
}

/** Flat roof of a lower mass, with a parapet; the next mass stands on it. */
function paintTerrace(iso: IsoFrame, b: Box, z: number, roofColor: string, wall: string) {
  iso.floor(b.u0, b.u1, b.v0, b.v1, z, topTone(shade(wall, -0.06)));
  iso.floor(b.u0 + 0.03, b.u1 - 0.03, b.v0 + 0.03, b.v1 - 0.03, z, topTone(shade(roofColor, 0.08)));
  iso.wall('sw', b.v1, b.u0, b.u1, z, z + 1.5, faceTone(shade(wall, 0.08), 'sw', 1));
  iso.wall('se', b.u1, b.v0, b.v1, z, z + 1.5, faceTone(shade(wall, 0.08), 'se', 1));
  iso.floor(b.u0, b.u1, b.v1 - 0.03, b.v1, z + 1.5, topTone(wall));
  iso.floor(b.u1 - 0.03, b.u1, b.v0, b.v1, z + 1.5, topTone(wall));
}
