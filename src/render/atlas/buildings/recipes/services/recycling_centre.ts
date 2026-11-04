import { variants, type BuildingArt } from '../types';

// 2×2: a long sorting shed with sawtooth roof lights, bales and a loading dock.
export const recyclingCentre: readonly BuildingArt[] = variants(
  {
    floorH: 9,
    masses: [{ floors: 1, box: { u0: 0.12, u1: 1.88, v0: 0.12, v1: 1.3 } }],
    wall: '#5f9d6a',
    trim: '#e6efe2',
    roof: 'sawtooth',
    roofColor: '#3f6d48',
    facade: 'industrial',
    ground: 'paved',
    extras: ['loadingdock', 'crates', 'solar'],
    sign: 'RECYCLE',
    signColor: '#3fa34d',
  },
  {},
  { wall: '#4f86a8', roofColor: '#365c73', signColor: '#2d8fd8', extras: ['loadingdock', 'crates', 'tanks'] },
);
