import { one, variants, type BuildingArt } from '../types';

export const cafe: readonly BuildingArt[] = variants(
  {
    floorH: 12,
    masses: [one(1, 0.22)],
    wall: '#f2e6d0',
    roof: 'flat',
    roofColor: '#7a5a43',
    facade: 'shopfront',
    ground: 'paved',
    extras: ['awning', 'tables'],
    sign: 'CAFE',
    signColor: '#7a4a2b',
    awning: '#d94a3d',
  },
  {},
  { wall: '#e4efe9', sign: 'DINER', signColor: '#c23b3b', awning: '#2f8fbf' },
  { wall: '#f3dfe0', sign: 'PIZZA', signColor: '#2f7d3a', awning: '#2e8a5a', extras: ['awning', 'tables', 'planters'] },
  { wall: '#efe2c4', sign: 'NOODLES', signColor: '#b8352f', awning: '#c23b3b', roof: 'gable', roofH: 7, roofColor: '#3a3a40' },
  { wall: '#4a505a', sign: 'BAR', signColor: '#6a4fa0', awning: '#6a4fa0', masses: [one(1, 0.18)] },
  { wall: '#fdf3e7', sign: 'GELATO', signColor: '#d9578a', awning: '#f2a3c0', extras: ['awning', 'tables'] },
);
