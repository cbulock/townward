import { one, variants, type BuildingArt } from '../types';

export const clinic: readonly BuildingArt[] = variants(
  {
    floorH: 10,
    masses: [one(2, 0.14)],
    wall: '#f2f4f5',
    roof: 'flat',
    roofColor: '#8b9196',
    facade: 'bands',
    ground: 'garden',
    extras: ['canopy', 'redcross'],
    sign: 'CLINIC',
    signColor: '#d4343a',
    trees: 1,
  },
  {},
  { wall: '#e3efe6', facade: 'ribbon', extras: ['canopy', 'redcross', 'solar'], trees: 2 },
  { wall: '#eef0f4', masses: [one(1, 0.1, 'lobby'), one(2, 0.16)], extras: ['redcross', 'helipad'], ground: 'plaza' },
);
