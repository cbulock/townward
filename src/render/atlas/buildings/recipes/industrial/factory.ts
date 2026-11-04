import { variants, type BuildingArt } from '../types';

export const factory: readonly BuildingArt[] = variants(
  {
    floorH: 9,
    masses: [{ floors: 3, box: { u0: 0.12, u1: 1.88, v0: 0.12, v1: 1.6 } }],
    wall: '#a9a296',
    roof: 'sawtooth',
    roofColor: '#7a7f85',
    roofH: 8,
    facade: 'industrial',
    ground: 'paved',
    extras: ['smokestack', 'loadingdock'],
  },
  {},
  { wall: '#9fa7ad', roofColor: '#6d7379', extras: ['smokestack', 'silo', 'loadingdock'] },
  { wall: '#b0a28c', roof: 'flat', roofColor: '#82786d', extras: ['smokestacks', 'tanks', 'loadingdock'] },
  { wall: '#8e9c8a', roofColor: '#5f6a5c', extras: ['smokestacks', 'loadingdock'] },
  { wall: '#b8a07e', roof: 'gable', roofH: 12, roofColor: '#6a6f75', extras: ['smokestack', 'tanks'] },
  { wall: '#a4aab2', roof: 'flat', roofColor: '#70757b', extras: ['silo', 'loadingdock', 'acunits'] },
);
