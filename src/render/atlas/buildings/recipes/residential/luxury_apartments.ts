import { one, variants, type BuildingArt } from '../types';

export const luxuryApartments: readonly BuildingArt[] = variants(
  {
    floorH: 9,
    masses: [one(10, 0.2), { floors: 3, box: { u0: 0.42, u1: 1.58, v0: 0.42, v1: 1.58 } }],
    wall: '#d9e3eb',
    trim: '#ffffff',
    roof: 'flat',
    roofColor: '#3e5666',
    facade: 'ribbon',
    ground: 'plaza',
    extras: ['terraces', 'roofgarden', 'pool', 'crown'],
    trees: 2,
  },
  {},
  { wall: '#e7d6c3', facade: 'punched', extras: ['balconies', 'roofgarden', 'pool'] },
  { wall: '#b7d5d4', facade: 'curtain', fins: true, extras: ['terraces', 'crown'] },
  { wall: '#e8e9e4', facade: 'grid', extras: ['terraces', 'roofgarden', 'solar'] },
  { wall: '#9eabc2', facade: 'ribbon', extras: ['balconies', 'pool', 'antenna'] },
  { wall: '#d3c4b5', facade: 'punched', extras: ['terraces', 'roofgarden', 'planters'] },
);
