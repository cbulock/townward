import { one, variants, type BuildingArt } from '../types';

export const techCampus: readonly BuildingArt[] = variants(
  {
    floorH: 11,
    masses: [one(4, 0.12), { floors: 8, box: { u0: 0.52, u1: 1.65, v0: 0.38, v1: 1.65 } }],
    wall: '#b7d3dd',
    trim: '#f4fbff',
    roof: 'flat',
    roofColor: '#3d5969',
    facade: 'curtain',
    ground: 'plaza',
    extras: ['solar', 'roofgarden', 'antenna', 'planters'],
    sign: 'NEXUS',
    signColor: '#2b8aa0',
  },
  {},
  { wall: '#d6c7df', facade: 'grid', sign: 'ORBIT', signColor: '#8150a0', extras: ['solar', 'antenna'] },
  { wall: '#c6dfd1', facade: 'ribbon', sign: 'LUMEN', signColor: '#2c7d57', extras: ['roofgarden', 'planters'] },
  { wall: '#e5d9c2', facade: 'punched', sign: 'FORGE', signColor: '#b65b2d', extras: ['solar', 'roofgarden'] },
  { wall: '#a8bfd0', facade: 'curtain', fins: true, sign: 'VECTOR', signColor: '#286a99', extras: ['antenna'] },
  { wall: '#e8e9ec', facade: 'bands', sign: 'PULSE', signColor: '#b33e62', extras: ['solar', 'planters'] },
);
