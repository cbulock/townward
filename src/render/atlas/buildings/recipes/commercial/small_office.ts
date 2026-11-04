import { one, variants, type BuildingArt } from '../types';

export const smallOffice: readonly BuildingArt[] = variants(
  {
    floorH: 8,
    masses: [one(5, 0.14)],
    wall: '#c9ced6',
    roof: 'flat',
    roofColor: '#5d6168',
    facade: 'bands',
    ground: 'paved',
    extras: ['acunits'],
  },
  {},
  { wall: '#d8d2c6', facade: 'grid', masses: [one(6, 0.14)] },
  { wall: '#bfc9cf', facade: 'ribbon', masses: [one(4, 0.12)], extras: ['acunits', 'antenna'] },
  { wall: '#a85a43', facade: 'brick', trim: '#efe3cf', extras: ['watertank'] },
  { wall: '#6f97b5', facade: 'curtain', fins: true, masses: [one(6, 0.16)], roofColor: '#3e4a56' },
  { wall: '#e2ddd2', facade: 'punched', masses: [one(1, 0.12, 'lobby'), one(5, 0.16)], extras: ['solar'] },
);
