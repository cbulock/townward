import { one, variants, type BuildingArt } from '../types';

export const townhouses: readonly BuildingArt[] = variants(
  {
    floorH: 8,
    masses: [one(3, 0.1)],
    wall: '#c96f5a',
    units: ['#c96f5a', '#d8b48a', '#8fa9b8'],
    roof: 'flat',
    roofColor: '#6b6e74',
    facade: 'townhouse',
    ground: 'paved',
    extras: ['acunits'],
  },
  {},
  { wall: '#e2c6a0', units: ['#e2c6a0', '#9fb7a3', '#d99a7a'] },
  { wall: '#7c8fa8', units: ['#7c8fa8', '#e8e1d0', '#b5554a'], roof: 'gable', roofH: 7, roofColor: '#4f5560', extras: [] },
  { wall: '#f1e4c8', units: ['#f1e4c8', '#c9d6df', '#e8c4c4'], masses: [one(2, 0.1)], extras: ['planters'] },
  { wall: '#a4553f', units: ['#a4553f', '#8b4a3a', '#b8664d'], extras: ['acunits', 'solar'] },
  { wall: '#d2e0d6', units: ['#d2e0d6', '#f3d9a8', '#c7c1e0'], roof: 'gable', roofH: 8, roofColor: '#6a3e30', extras: ['chimney'] },
);
