import { BALANCE } from '../shared/balance';

/** Small display helpers shared by screens and HUD. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** "just now", "5 min ago", "3 h ago", "2 days ago", then a date. */
export function timeAgo(at: number, now = Date.now()): string {
  const s = Math.max(0, (now - at) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  if (s < 7 * 86_400) return `${Math.round(s / 86_400)} day${s < 1.5 * 86_400 ? '' : 's'} ago`;
  return new Date(at).toLocaleDateString();
}

/** In-game date of a city day count: "Mar, Y2". Same calendar as City.date. */
export function cityDate(day: number): string {
  const months = Math.floor(day / BALANCE.daysPerMonth);
  return `${MONTHS[months % 12]}, Y${1 + Math.floor(months / 12)}`;
}
