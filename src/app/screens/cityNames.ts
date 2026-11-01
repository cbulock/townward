import type { CityEntry } from './CityList';

/** "Island", or "Island 2", "Island 3"… if that name is taken, so cities stay easy to tell apart. */
export function uniqueCityName(base: string, entries: readonly CityEntry[] | null): string {
  const taken = new Set((entries ?? []).map((e) => e.meta.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base} ${n}`.toLowerCase())) return `${base} ${n}`;
}
