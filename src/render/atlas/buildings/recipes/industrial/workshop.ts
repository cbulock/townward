import { one, variants, type BuildingArt } from '../types';

export const workshop: readonly BuildingArt[] = variants(
  {
    floorH: 13,
    masses: [one(1, 0.14)],
    wall: '#b9b3a6',
    roof: 'sawtooth',
    roofColor: '#7d8288',
    roofH: 6,
    facade: 'industrial',
    ground: 'paved',
    extras: ['garagedoor', 'crates'],
  },
  {},
  { wall: '#a9b4b9', roof: 'gable', roofH: 6, roofColor: '#6f757b' },
  { wall: '#c2b49a', roof: 'flat', roofColor: '#858179', extras: ['garagedoor', 'crates', 'acunits'] },
  { wall: '#8a9a7a', roofColor: '#5f6a55', extras: ['garagedoor', 'tanks'] },
  { wall: '#b5604a', roof: 'gable', ridge: 'v', roofH: 7, roofColor: '#5a5e64' },
  { wall: '#d0c9b8', roof: 'flat', roofColor: '#7f858b', extras: ['garagedoor', 'silo'] },
);
