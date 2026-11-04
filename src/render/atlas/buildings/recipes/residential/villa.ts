import { one, variants, type BuildingArt } from '../types';

export const villa: readonly BuildingArt[] = variants(
  {
    floorH: 10,
    masses: [one(2, 0.12)],
    wall: '#efe3cf',
    trim: '#ffffff',
    roof: 'hip',
    roofColor: '#566b58',
    roofH: 10,
    facade: 'punched',
    ground: 'garden',
    extras: ['garage', 'porch', 'pool', 'planters'],
    trees: 3,
  },
  {},
  { wall: '#e5d0ba', roofColor: '#40566d', extras: ['garage', 'porch', 'pool', 'solar'], trees: 2 },
  { wall: '#f2eee4', roof: 'flat', roofColor: '#66777c', facade: 'ribbon', extras: ['garage', 'pool', 'planters'], trees: 3 },
  { wall: '#d9e8dc', roofColor: '#80614d', extras: ['garage', 'porch', 'fence', 'planters'], trees: 4 },
  { wall: '#e7d9c6', roofColor: '#4c4a55', extras: ['garage', 'pool', 'solar'], trees: 2 },
  { wall: '#f4d8c8', roofColor: '#536b87', extras: ['garage', 'porch', 'pool', 'planters'], trees: 3 },
);
