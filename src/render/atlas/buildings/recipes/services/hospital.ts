import { variants, type BuildingArt } from '../types';

// 3×2: a wide clinical podium with a ward tower, a red cross and a rooftop helipad.
export const hospital: readonly BuildingArt[] = variants(
  {
    floorH: 10,
    masses: [
      { floors: 2, box: { u0: 0.12, u1: 2.88, v0: 0.12, v1: 1.55 }, facade: 'lobby' },
      { floors: 4, box: { u0: 0.55, u1: 2.3, v0: 0.22, v1: 1.3 } },
    ],
    wall: '#f3f5f7',
    roof: 'flat',
    roofColor: '#9aa3ab',
    facade: 'ribbon',
    ground: 'plaza',
    extras: ['canopy', 'redcross', 'helipad', 'acunits'],
    sign: 'HOSPITAL',
    signColor: '#d23b3b',
    trees: 2,
  },
  {},
  { wall: '#e6eef2', facade: 'bands', glass: '#7fb6d8', extras: ['canopy', 'redcross', 'helipad', 'solar'] },
  {
    wall: '#efe9e0',
    facade: 'grid',
    masses: [
      { floors: 1, box: { u0: 0.12, u1: 2.88, v0: 0.12, v1: 1.6 }, facade: 'lobby' },
      { floors: 5, box: { u0: 0.8, u1: 2.2, v0: 0.25, v1: 1.25 } },
    ],
    ground: 'parking',
    extras: ['redcross', 'helipad'],
  },
);
