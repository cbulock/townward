import { one, variants, type BuildingArt } from '../types';

export const apartmentBlock: readonly BuildingArt[] = variants(
  {
    floorH: 8,
    masses: [one(8, 0.18)],
    wall: '#e9e2d4',
    roof: 'flat',
    roofColor: '#6a6d73',
    facade: 'punched',
    ground: 'paved',
    extras: ['balconies', 'watertank', 'acunits'],
    trees: 2,
  },
  {},
  { wall: '#d9dfe6', facade: 'grid', masses: [one(9, 0.18)], extras: ['roofgarden', 'acunits'], ground: 'plaza' },
  { wall: '#efe0c8', masses: [one(1, 0.12, 'shopfront', '#6d5a4a'), one(7, 0.18)], extras: ['balconies', 'watertank'] },
  { wall: '#c98f6a', facade: 'brick', trim: '#efe3cf', masses: [one(7, 0.16)], extras: ['acunits', 'watertank'] },
  { wall: '#b8c9b0', masses: [one(6, 0.16), one(3, 0.36)], extras: ['balconies', 'roofgarden'], ground: 'garden', trees: 3 },
  { wall: '#f2efe8', facade: 'ribbon', masses: [one(10, 0.22)], extras: ['solar', 'acunits'], ground: 'plaza' },
);
