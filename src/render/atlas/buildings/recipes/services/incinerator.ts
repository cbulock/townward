import { variants, type BuildingArt } from '../types';

// 2×2: a boiler hall with a tall stack (smoke comes from the stack sources).
export const incinerator: readonly BuildingArt[] = variants(
  {
    floorH: 10,
    masses: [
      { floors: 2, box: { u0: 0.12, u1: 1.88, v0: 0.12, v1: 1.35 } },
      { floors: 1, box: { u0: 0.4, u1: 1.4, v0: 0.25, v1: 1.1 } },
    ],
    wall: '#8a8f96',
    trim: '#c9cdd2',
    roof: 'flat',
    roofColor: '#4d5157',
    facade: 'industrial',
    ground: 'paved',
    extras: ['smokestack', 'loadingdock', 'tanks'],
    sign: 'ENERGY',
    signColor: '#ef6c43',
  },
  {},
  { wall: '#b2643f', facade: 'brick', extras: ['smokestacks', 'loadingdock'] },
);
