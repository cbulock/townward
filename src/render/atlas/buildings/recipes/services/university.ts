import { variants, type BuildingArt } from '../types';

// 3×3: a brick campus hall on a lawn quad, with a clock tower rising from its middle.
export const university: readonly BuildingArt[] = variants(
  {
    floorH: 11,
    masses: [
      { floors: 3, box: { u0: 0.25, u1: 2.75, v0: 0.2, v1: 1.85 } },
      { floors: 3, box: { u0: 1.2, u1: 1.8, v0: 0.7, v1: 1.3 }, facade: 'punched' },
    ],
    wall: '#b86a4b',
    trim: '#f0e4cf',
    roof: 'hip',
    roofColor: '#4f5a63',
    roofH: 10,
    facade: 'brick',
    ground: 'field',
    extras: ['spire', 'fence'],
    sign: 'UNIVERSITY',
    signColor: '#5b4fc4',
    trees: 4,
  },
  {},
  { wall: '#e8dcc2', facade: 'punched', roofColor: '#6d4a3b', signColor: '#2f6d4a', ground: 'garden', trees: 5 },
  {
    wall: '#e9edf1',
    facade: 'curtain',
    glass: '#8cc4e8',
    roof: 'flat',
    roofColor: '#6a7076',
    masses: [
      { floors: 2, box: { u0: 0.25, u1: 2.75, v0: 0.2, v1: 1.85 } },
      { floors: 5, box: { u0: 0.9, u1: 2.1, v0: 0.5, v1: 1.4 } },
    ],
    extras: ['roofgarden', 'solar'],
    ground: 'plaza',
  },
);
