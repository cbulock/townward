import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HUD_PREFERENCES,
  HUD_ITEMS,
  parseHudPreferences,
  readHudPreferences,
  writeHudPreferences,
  moveHudStat,
} from '../src/app/mobile/hudPreferences';

describe('two-row phone HUD preferences', () => {
  it('accepts any number of unique items in either row, including empty rows', () => {
    for (const layout of [
      { first: [], second: [] },
      { first: ['water', 'jobs', 'clock', 'date'], second: ['funds', 'population'] },
      { first: HUD_ITEMS.map(([id]) => id), second: [] },
    ]) {
      expect(parseHudPreferences(JSON.stringify({ version: 2, ...layout }))).toEqual(layout);
    }
  });
  it('migrates the original second-row pins without losing their order or empty selection', () => {
    for (const stats of [[], ['water'], ['water', 'jobs', 'clock', 'date']])
      expect(parseHudPreferences(JSON.stringify({ version: 1, stats }))).toEqual({
        first: DEFAULT_HUD_PREFERENCES.first,
        second: stats,
      });
  });
  it('recovers from corrupt, duplicate, unknown or unsupported preferences', () => {
    for (const value of [
      null,
      '{',
      'null',
      '{}',
      JSON.stringify({ version: 3, first: [], second: [] }),
      JSON.stringify({ version: 2, first: ['water'], second: ['water'] }),
      JSON.stringify({ version: 2, first: ['unknown'], second: [] }),
      JSON.stringify({ version: 2, first: [], second: ['date', 'date'] }),
    ])
      expect(parseHudPreferences(value)).toEqual(DEFAULT_HUD_PREFERENCES);
  });
  it('persists both rows and their item order', () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    };
    const layout = { first: ['water', 'funds'], second: ['jobs', 'clock'] } as const;
    expect(writeHudPreferences(layout, storage)).toBe(true);
    expect(readHudPreferences(storage)).toEqual(layout);
  });
  it('keeps play available when storage throws', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    };
    expect(readHudPreferences(storage)).toEqual(DEFAULT_HUD_PREFERENCES);
    expect(writeHudPreferences(DEFAULT_HUD_PREFERENCES, storage)).toBe(false);
  });
  it('reorders controls and statistics without moving beyond the row boundaries', () => {
    expect(moveHudStat(['funds', 'water', 'speed'], 1, -1)).toEqual(['water', 'funds', 'speed']);
    expect(moveHudStat(['funds', 'water'], 0, -1)).toEqual(['funds', 'water']);
  });
});
