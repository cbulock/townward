import { one, variants, type BuildingArt } from '../types';

export const cornerShop: readonly BuildingArt[] = variants(
  {
    floorH: 9,
    masses: [one(2, 0.12)],
    wall: '#e7d9bd',
    roof: 'flat',
    roofColor: '#6b6e74',
    facade: 'shopfront',
    ground: 'paved',
    extras: ['awning'],
    sign: 'SHOP',
    signColor: '#2f7d4a',
    awning: '#d94a3d',
  },
  {},
  { wall: '#f3e3cf', sign: 'BAKERY', signColor: '#8a4b2b', awning: '#f0a830', extras: ['awning', 'tables'] },
  { wall: '#b35a45', sign: 'BOOKS', signColor: '#2f5d9a', awning: '#2d6fc4' },
  { wall: '#efe7d8', masses: [one(1, 0.14)], sign: 'DELI', signColor: '#2e6b3e', awning: '#2e8a5a' },
  { wall: '#f4eef6', sign: 'FLORIST', signColor: '#9b2f5f', awning: '#d9578a', extras: ['awning', 'planters'] },
  { wall: '#e9edf0', masses: [one(3, 0.12)], sign: 'PHARMACY', signColor: '#1f8a5a', awning: '#3aa66a', extras: ['awning', 'acunits'] },
);
