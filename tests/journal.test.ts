import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearJournal, hasJournal, isNewer, readJournal, writeJournal } from '../src/save/journal';
import { City } from '../src/sim/City';
import { serialize, verifySave } from '../src/sim/save';
import { generateTerrain } from '../src/sim/terrain/generate';
import { presetSettings } from '../src/sim/terrain/presets';

const terrain = presetSettings('coastal', 5, 64);
const meta = { name: 'J', population: 0, funds: 1, day: 3, size: 64, preset: 'coastal', seed: 5 };

beforeEach(() => {
  const items = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    removeItem: (k: string) => void items.delete(k),
  });
});

describe('save journal', () => {
  it('round-trips a checked snapshot per city and clears it', () => {
    const data = { ...serialize(new City(generateTerrain(terrain)), terrain, 'J'), savedAt: 10 };
    const ref = { store: 'local', id: 3 } as const;
    expect(writeJournal(ref, meta, verifySave(data))).toBe(true);
    expect(hasJournal(ref)).toBe(true);
    expect(hasJournal('new')).toBe(false);
    const entry = readJournal(ref);
    expect(entry?.meta).toEqual(meta);
    expect(entry?.data.savedAt).toBe(10);
    expect(isNewer(entry!.data, { ...data, savedAt: 9 })).toBe(true);
    clearJournal(ref);
    expect(readJournal(ref)).toBeNull();
  });

  it('treats an unreadable entry as missing', () => {
    localStorage.setItem('citybuilder:journal:new', '{oops');
    expect(readJournal('new')).toBeNull();
  });

  it('reports a full storage instead of throwing', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    expect(writeJournal('new', meta, '{}')).toBe(false);
  });
});
