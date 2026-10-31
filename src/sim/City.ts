import { BALANCE } from '../shared/balance';
import type { World } from './World';

/** City-wide state that isn't per-tile: money and the calendar. */
export class City {
  funds: number;
  /** Whole in-game days since founding. */
  day = 0;
  /** Sim seconds on the time-of-day clock (separate from the calendar; see docs/04-ui-ux.md). */
  clock = 0;

  constructor(
    readonly world: World,
    funds: number = BALANCE.startingFunds,
  ) {
    this.funds = funds;
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
