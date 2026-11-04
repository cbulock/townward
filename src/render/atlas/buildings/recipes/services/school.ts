import { variants, type BuildingArt } from '../types';

export const school: readonly BuildingArt[] = variants(
  {
    floorH: 10,
    masses: [{ floors: 2, box: { u0: 0.16, u1: 1.84, v0: 0.16, v1: 1.2 } }],
    wall: '#c8794f',
    trim: '#f0e4cf',
    roof: 'hip',
    roofColor: '#6d4a3b',
    roofH: 9,
    facade: 'brick',
    ground: 'field',
    extras: ['fence'],
    sign: 'SCHOOL',
    signColor: '#2f6d4a',
  },
  {},
  { wall: '#ead9b8', facade: 'punched', roof: 'gable', roofH: 10, roofColor: '#7a4a3a', signColor: '#2d5f8a' },
  { wall: '#e6ebef', facade: 'ribbon', roof: 'flat', roofColor: '#6a7076', extras: ['fence', 'solar'], signColor: '#c8602d' },
);
