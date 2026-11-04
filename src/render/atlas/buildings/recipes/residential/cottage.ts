import { one, variants, type BuildingArt } from '../types';

export const cottage: readonly BuildingArt[] = variants(
  {
    floorH: 11,
    masses: [one(1, 0.2)],
    wall: '#f3e7cf',
    roof: 'gable',
    roofColor: '#b8513d',
    roofH: 9,
    facade: 'punched',
    ground: 'garden',
    extras: ['chimney', 'fence'],
    trees: 1,
  },
  {},
  { wall: '#dfe9f0', roofColor: '#5e6f86', ridge: 'v', facade: 'siding', extras: ['chimney'], trees: 2 },
  { wall: '#f5efe4', roofColor: '#8a5a3b', roof: 'hip', roofH: 8, extras: ['fence'] },
  { wall: '#f2d7c9', roofColor: '#4f6b4a', facade: 'siding', trees: 2 },
  { wall: '#e9e4d8', roofColor: '#a2493a', masses: [{ floors: 1, box: { u0: 0.12, u1: 0.66, v0: 0.2, v1: 0.8 } }], extras: ['garage', 'chimney'] },
  { wall: '#fbe6b8', roofColor: '#3e5874', ridge: 'v', roofH: 11, extras: ['porch'], trees: 2 },
);
