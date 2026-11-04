import { variants, type BuildingArt } from '../types';

export const supermarket: readonly BuildingArt[] = variants(
  {
    floorH: 16,
    masses: [{ floors: 1, box: { u0: 0.12, u1: 1.88, v0: 0.12, v1: 1.15 } }],
    wall: '#e8e3d8',
    roof: 'flat',
    roofColor: '#8a8d92',
    facade: 'shopfront',
    ground: 'parking',
    extras: ['parking', 'acunits'],
    sign: 'MARKET',
    signColor: '#d2462f',
  },
  {},
  { wall: '#dfe6ea', sign: 'GROCER', signColor: '#2b7a3d', extras: ['parking', 'solar'] },
  { wall: '#ece2d3', sign: 'FRESH', signColor: '#2c62b0' },
  { wall: '#f0ebe0', sign: 'FOODS', signColor: '#e08a1e', extras: ['parking', 'acunits', 'planters'] },
  { wall: '#c9d4dc', sign: 'MEGA', signColor: '#7a3fb0', extras: ['parking', 'solar'] },
  { wall: '#f2e6d6', sign: 'SAVE+', signColor: '#c2272d' },
);
