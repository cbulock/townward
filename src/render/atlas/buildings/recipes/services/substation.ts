import { one, variants, type BuildingArt } from '../types';

export const substation: readonly BuildingArt[] = variants(
  {
    floorH: 5,
    masses: [one(1, 0.08)],
    wall: '#5d7180',
    trim: '#c8d7df',
    roof: 'flat',
    roofColor: '#39464f',
    facade: 'bands',
    ground: 'paved',
    extras: ['acunits'],
    sign: 'GRID',
    signColor: '#55b7ff',
  },
  {},
  { wall: '#71818a', roofColor: '#344a58', signColor: '#ffe28a' },
);
