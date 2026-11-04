import { one, variants, type BuildingArt } from '../types';

export const walkup: readonly BuildingArt[] = variants(
  {
    floorH: 8,
    masses: [one(4, 0.1)],
    wall: '#b35a45',
    trim: '#e8dcc8',
    roof: 'flat',
    roofColor: '#5f6268',
    facade: 'brick',
    ground: 'paved',
    extras: ['balconies', 'acunits'],
  },
  {},
  { wall: '#9c5040', extras: ['fireescape', 'watertank'] },
  { wall: '#c0785a', masses: [one(5, 0.1)], extras: ['balconies'] },
  { wall: '#e3d7c0', trim: '#8a6e5a', facade: 'punched', extras: ['balconies', 'acunits'] },
  {
    wall: '#7d8a96',
    facade: 'punched',
    masses: [one(1, 0.1, 'shopfront', '#5a636c'), one(3, 0.1)],
    sign: 'GROCER',
    signColor: '#2e6b3e',
    extras: ['awning', 'acunits'],
    awning: '#2e8a5a',
  },
  { wall: '#a8653f', extras: ['fireescape', 'roofgarden'] },
);
