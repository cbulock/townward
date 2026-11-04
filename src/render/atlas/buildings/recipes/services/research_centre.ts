import { variants, type BuildingArt } from '../types';

// 2×2: a glass lab block with a dome observatory crown and rooftop gear.
export const researchCentre: readonly BuildingArt[] = variants(
  {
    floorH: 10,
    masses: [
      { floors: 2, box: { u0: 0.12, u1: 1.88, v0: 0.12, v1: 1.4 }, facade: 'lobby' },
      { floors: 3, box: { u0: 0.4, u1: 1.6, v0: 0.25, v1: 1.15 } },
    ],
    wall: '#e7eef3',
    glass: '#7cc4ee',
    roof: 'flat',
    roofColor: '#5f6b75',
    facade: 'curtain',
    fins: true,
    ground: 'plaza',
    extras: ['antenna', 'solar', 'acunits'],
    sign: 'LABS',
    signColor: '#22b8cf',
    trees: 2,
  },
  {},
  { wall: '#f1ece2', glass: '#9ad0b8', facade: 'ribbon', extras: ['crown', 'solar'], signColor: '#2f9e6b' },
);
