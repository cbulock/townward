import { one, variants, type BuildingArt } from '../types';

export const familyHouse: readonly BuildingArt[] = variants(
  {
    floorH: 9,
    masses: [one(2, 0.16)],
    wall: '#dfe7ee',
    roof: 'hip',
    roofColor: '#4f5d70',
    roofH: 8,
    facade: 'punched',
    ground: 'garden',
    extras: ['porch', 'chimney'],
    trees: 1,
  },
  {},
  { wall: '#f0dcc4', roofColor: '#a2493a', roof: 'gable', roofH: 10, facade: 'siding', extras: ['chimney'], trees: 2 },
  { wall: '#d8e4cf', roofColor: '#6a4b3a', masses: [{ floors: 2, box: { u0: 0.1, u1: 0.64, v0: 0.16, v1: 0.82 } }], extras: ['garage', 'porch'] },
  { wall: '#c96f5a', facade: 'brick', roof: 'gable', ridge: 'v', roofColor: '#4a4f57', extras: ['chimney'], trees: 2 },
  {
    wall: '#f4f1ea',
    roof: 'flat',
    roofColor: '#8a8d92',
    facade: 'bands',
    masses: [one(1, 0.14), { floors: 1, box: { u0: 0.14, u1: 0.62, v0: 0.14, v1: 0.86 } }],
    extras: ['solar'],
    trees: 2,
  },
  { wall: '#e7d3a8', roofColor: '#5c6b4a', facade: 'siding', extras: ['porch', 'fence'] },
);
