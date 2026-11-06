export const HUD_STATS = [
  ['happiness', 'Happiness'],
  ['demand', 'Zoning demand'],
  ['date', 'Date'],
  ['clock', 'Clock'],
  ['jobs', 'Jobs'],
  ['air', 'Air quality'],
  ['power', 'Power'],
  ['water', 'Water'],
  ['balance', 'Monthly balance'],
  ['stage', 'City stage'],
] as const;
export type HudStatId = (typeof HUD_STATS)[number][0];
export const HUD_ITEMS = [
  ['funds', 'Treasury'],
  ['population', 'Population'],
  ['speed', 'Pause / speed'],
  ['alerts', 'Alerts'],
  ...HUD_STATS,
] as const;
export type HudItemId = (typeof HUD_ITEMS)[number][0];
export type HudRow = 'first' | 'second';
export interface HudPreferences {
  readonly first: readonly HudItemId[];
  readonly second: readonly HudItemId[];
}
export const DEFAULT_HUD_STATS: readonly HudStatId[] = ['happiness', 'demand', 'date'];
export const DEFAULT_HUD_PREFERENCES: HudPreferences = {
  first: ['funds', 'population', 'speed', 'alerts'],
  second: DEFAULT_HUD_STATS,
};
const KEY = 'openpolis.phone-hud.v1';
type HudStorage = Pick<Storage, 'getItem' | 'setItem'>;
export function isHudStatId(id: HudItemId): id is HudStatId {
  return HUD_STATS.some(([key]) => key === id);
}
function validItems(value: unknown): value is HudItemId[] {
  return (
    Array.isArray(value) &&
    value.every((id) => HUD_ITEMS.some(([known]) => known === id)) &&
    new Set(value).size === value.length
  );
}
export function parseHudPreferences(raw: string | null): HudPreferences {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object' || !('version' in value))
      return DEFAULT_HUD_PREFERENCES;
    if (
      value.version === 1 &&
      'stats' in value &&
      validItems(value.stats) &&
      value.stats.every(isHudStatId)
    )
      return { first: DEFAULT_HUD_PREFERENCES.first, second: value.stats };
    if (
      value.version === 2 &&
      'first' in value &&
      'second' in value &&
      validItems(value.first) &&
      validItems(value.second)
    ) {
      const first = value.first,
        second = value.second;
      if (!first.some((id) => second.includes(id))) return { first, second };
    }
    return DEFAULT_HUD_PREFERENCES;
  } catch {
    return DEFAULT_HUD_PREFERENCES;
  }
}
export function readHudPreferences(storage?: HudStorage): HudPreferences {
  try {
    return parseHudPreferences((storage ?? localStorage).getItem(KEY));
  } catch {
    return DEFAULT_HUD_PREFERENCES;
  }
}
export function writeHudPreferences(rows: HudPreferences, storage?: HudStorage): boolean {
  try {
    (storage ?? localStorage).setItem(KEY, JSON.stringify({ version: 2, ...rows }));
    return true;
  } catch {
    return false;
  }
}
export function moveHudStat(
  items: readonly HudItemId[],
  index: number,
  step: -1 | 1,
): readonly HudItemId[] {
  const target = index + step;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
