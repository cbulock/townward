import { one, variants, type BuildingArt } from '../types';

export const warehouse: readonly BuildingArt[] = variants(
  {
    floorH: 10,
    masses: [one(2, 0.14)],
    wall: '#c7b48f',
    roof: 'flat',
    roofColor: '#8b8f94',
    facade: 'industrial',
    ground: 'paved',
    extras: ['loadingdock', 'crates'],
  },
  {},
  { wall: '#a8b0b8', roof: 'gable', roofH: 10, roofColor: '#6f777f' },
  { wall: '#b9a48a', roof: 'sawtooth', roofH: 7, roofColor: '#858179' },
  { wall: '#9fb0a0', extras: ['loadingdock', 'silo'] },
  { wall: '#c9c2b2', extras: ['loadingdock', 'tanks', 'solar'] },
  { wall: '#8f9aa6', roof: 'gable', ridge: 'v', roofH: 10, roofColor: '#5e646b', extras: ['loadingdock', 'crates'] },
);
