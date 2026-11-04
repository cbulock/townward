import { one, variants, type BuildingArt } from '../types';

export const fireStation: readonly BuildingArt[] = variants(
  {
    floorH: 11,
    masses: [one(2, 0.12)],
    wall: '#b9483a',
    trim: '#efe3cf',
    roof: 'flat',
    roofColor: '#5d5f63',
    facade: 'brick',
    ground: 'paved',
    extras: ['firedoors', 'hosetower'],
    sign: 'FIRE',
    signColor: '#d23b2b',
  },
  {},
  { wall: '#ece4d6', facade: 'punched', extras: ['firedoors', 'hosetower', 'acunits'] },
  { wall: '#8f3a30', roof: 'gable', roofH: 8, roofColor: '#4a4d52', extras: ['firedoors'] },
);
