import type { CivicArt } from '../lot';
import { batteryBankArt } from './batteryBank';
import { gasPlantArt } from './gasPlant';
import { solarFarmArt } from './solarFarm';
import { windTurbineArt } from './windTurbine';

/**
 * Energy buildings, one painter per file (D-066). The coal plant still lives in civicArt.ts
 * until the art track splits that file.
 */
export const ENERGY_ART = {
  gas_plant: gasPlantArt,
  wind_turbine: windTurbineArt,
  solar_farm: solarFarmArt,
  battery_bank: batteryBankArt,
} as const satisfies Record<string, CivicArt>;

export type EnergyArtId = keyof typeof ENERGY_ART;
