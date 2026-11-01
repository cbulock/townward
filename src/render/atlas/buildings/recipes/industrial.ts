import { one, variants, type BuildingArt, type RecipeId } from './types';

/** Workshops, warehouses and factories. */
export const INDUSTRIAL = {
  workshop: variants(
    {
      floorH: 13,
      masses: [one(1, 0.14)],
      wall: '#b9b3a6',
      roof: 'sawtooth',
      roofColor: '#7d8288',
      roofH: 6,
      facade: 'industrial',
      ground: 'paved',
      extras: ['garagedoor', 'crates'],
    },
    {},
    { wall: '#a9b4b9', roof: 'gable', roofH: 6, roofColor: '#6f757b' },
    { wall: '#c2b49a', roof: 'flat', roofColor: '#858179', extras: ['garagedoor', 'crates', 'acunits'] },
    { wall: '#8a9a7a', roofColor: '#5f6a55', extras: ['garagedoor', 'tanks'] },
    { wall: '#b5604a', roof: 'gable', ridge: 'v', roofH: 7, roofColor: '#5a5e64' },
    { wall: '#d0c9b8', roof: 'flat', roofColor: '#7f858b', extras: ['garagedoor', 'silo'] },
  ),
  warehouse: variants(
    {
      floorH: 10,
      masses: [one(2, 0.14)],
      wall: '#c7b48f',
      roof: 'flat',
      roofColor: '#8b8f94',
      facade: 'industrial',
      ground: 'paved',
      extras: ['loadingdock', 'crates'],
    },
    {},
    { wall: '#a8b0b8', roof: 'gable', roofH: 10, roofColor: '#6f777f' },
    { wall: '#b9a48a', roof: 'sawtooth', roofH: 7, roofColor: '#858179' },
    { wall: '#9fb0a0', extras: ['loadingdock', 'silo'] },
    { wall: '#c9c2b2', extras: ['loadingdock', 'tanks', 'solar'] },
    { wall: '#8f9aa6', roof: 'gable', ridge: 'v', roofH: 10, roofColor: '#5e646b', extras: ['loadingdock', 'crates'] },
  ),
  factory: variants(
    {
      floorH: 9,
      masses: [{ floors: 3, box: { u0: 0.12, u1: 1.88, v0: 0.12, v1: 1.6 } }],
      wall: '#a9a296',
      roof: 'sawtooth',
      roofColor: '#7a7f85',
      roofH: 8,
      facade: 'industrial',
      ground: 'paved',
      extras: ['smokestack', 'loadingdock'],
    },
    {},
    { wall: '#9fa7ad', roofColor: '#6d7379', extras: ['smokestack', 'silo', 'loadingdock'] },
    { wall: '#b0a28c', roof: 'flat', roofColor: '#82786d', extras: ['smokestacks', 'tanks', 'loadingdock'] },
    { wall: '#8e9c8a', roofColor: '#5f6a5c', extras: ['smokestacks', 'loadingdock'] },
    { wall: '#b8a07e', roof: 'gable', roofH: 12, roofColor: '#6a6f75', extras: ['smokestack', 'tanks'] },
    { wall: '#a4aab2', roof: 'flat', roofColor: '#70757b', extras: ['silo', 'loadingdock', 'acunits'] },
  ),

} satisfies Partial<Record<RecipeId, readonly BuildingArt[]>>;
