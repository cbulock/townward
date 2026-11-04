import { variants, type BuildingArt } from '../types';

export const policeStation: readonly BuildingArt[] = variants(
  {
    floorH: 10,
    // Pulled back from the street so the patrol cars have a forecourt.
    masses: [{ floors: 2, box: { u0: 0.12, u1: 0.88, v0: 0.12, v1: 0.6 } }],
    wall: '#dfe6ef',
    roof: 'flat',
    roofColor: '#3c5a8c',
    facade: 'bands',
    ground: 'paved',
    extras: ['canopy', 'acunits', 'patrolcars'],
    sign: 'POLICE',
    signColor: '#1f4fa8',
  },
  {},
  { wall: '#c4ccd6', facade: 'grid', masses: [{ floors: 3, box: { u0: 0.14, u1: 0.86, v0: 0.12, v1: 0.6 } }], extras: ['antenna', 'patrolcars'] },
  { wall: '#b8664d', facade: 'brick', trim: '#e8dcc8', extras: ['canopy', 'patrolcars'] },
);
