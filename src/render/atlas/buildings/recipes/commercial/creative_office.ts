import { one, variants, type BuildingArt } from '../types';

export const creativeOffice: readonly BuildingArt[] = variants(
  {
    floorH: 9,
    masses: [one(6, 0.12)],
    wall: '#d5dce2',
    roof: 'flat',
    roofColor: '#4b5964',
    facade: 'ribbon',
    ground: 'plaza',
    extras: ['roofgarden', 'acunits'],
    sign: 'STUDIO',
    signColor: '#b45b34',
  },
  {},
  { wall: '#e6d9c7', facade: 'punched', sign: 'DESIGN', signColor: '#7b4d91', extras: ['roofgarden', 'planters'] },
  { wall: '#b8d2cf', facade: 'curtain', fins: true, sign: 'LAB', signColor: '#1e7180', extras: ['solar'] },
  { wall: '#c9b9d1', facade: 'grid', sign: 'MEDIA', signColor: '#a33b62', extras: ['antenna'] },
  { wall: '#e9e4d7', facade: 'bands', sign: 'WORKS', signColor: '#2f6d4a', extras: ['roofgarden', 'acunits'] },
  { wall: '#aab8c5', facade: 'ribbon', sign: 'CO-LAB', signColor: '#d17b2f', extras: ['solar', 'planters'] },
);
