import { BALANCE } from '../shared/balance';
import type { World } from './World';

/** City-wide state that isn't per-tile. Grows with budget, population, date in later phases. */
export class City {
  funds: number;

  constructor(
    readonly world: World,
    funds: number = BALANCE.startingFunds,
  ) {
    this.funds = funds;
  }
}
