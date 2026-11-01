import { BALANCE } from '../shared/balance';
import { SIM_TICK_HZ } from '../shared/constants';
import type { World } from './World';

/** City-wide state that isn't per-tile: money and the calendar. */
export class City {
  funds: number;
  /** Whole in-game days since founding. */
  day = 0;
  /** Tax rate in percent (0 … BALANCE.maxTaxRate). */
  taxRate: number = BALANCE.baseTaxRate;
  /**
   * Fixed sim ticks since founding (SIM_TICK_HZ per sim second). The time of day comes from
   * this integer, never from frame time, so every machine plays a city the same way (D-068).
   */
  ticks = 0;

  readonly world: World;

  constructor(world: World, funds: number = BALANCE.startingFunds) {
    this.world = world;
    this.funds = funds;
  }

  /** Sim seconds on the time-of-day clock (separate from the calendar; see docs/04-ui-ux.md). */
  get clock(): number {
    return this.ticks / SIM_TICK_HZ;
  }

  set clock(seconds: number) {
    this.ticks = Math.round(seconds * SIM_TICK_HZ);
  }

  /** Hour of day, 0 ≤ hour < 24. The clock starts at 07:00. */
  get hour(): number {
    return (BALANCE.clockStartHour + (this.clock / BALANCE.secondsPerClockDay) * 24) % 24;
  }

  /** 0-based month and day-of-month, plus year (starting at 1). */
  get date(): { year: number; month: number; dayOfMonth: number } {
    const months = Math.floor(this.day / BALANCE.daysPerMonth);
    return { year: 1 + Math.floor(months / 12), month: months % 12, dayOfMonth: 1 + (this.day % BALANCE.daysPerMonth) };
  }
}
