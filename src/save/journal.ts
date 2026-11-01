import type { SaveMetaInput } from '../shared/api';
import { parseSave, SaveError, type SaveData } from '../sim/save';
import { formatCityRef, type CityRef } from './SaveStore';

/**
 * The save journal (docs/specs/saving.md, "Never lose a city"): a synchronous copy of the open
 * city in localStorage, written before every store write and when the tab hides or closes.
 * IndexedDB and fetch are asynchronous, so a reload can kill them mid-write; localStorage
 * finishes before the page goes. An entry is removed only once its store confirms a save at
 * least as new, so a leftover entry always means "the store may have missed this".
 */

const PREFIX = 'citybuilder:journal:';

/** A city not saved anywhere yet (no CityRef) has one shared slot. */
export type JournalKey = CityRef | 'new';

export interface JournalEntry {
  readonly meta: SaveMetaInput;
  readonly data: SaveData;
}

const keyOf = (k: JournalKey) => PREFIX + (k === 'new' ? 'new' : formatCityRef(k));

/** Store a snapshot; `json` is the save's JSON text (verifySave already produced it). Returns false if storage refused. */
export function writeJournal(key: JournalKey, meta: SaveMetaInput, json: string): boolean {
  try {
    localStorage.setItem(keyOf(key), `{"meta":${JSON.stringify(meta)},"data":${json}}`);
    return true;
  } catch {
    // Quota or storage disabled (private mode): the store write is still attempted.
    return false;
  }
}

export function readJournal(key: JournalKey): JournalEntry | null {
  let text: string | null;
  try {
    text = localStorage.getItem(keyOf(key));
  } catch {
    return null;
  }
  if (text === null) return null;
  try {
    const raw: unknown = JSON.parse(text);
    if (typeof raw !== 'object' || raw === null || !('meta' in raw) || !('data' in raw) || !isMetaInput(raw.meta)) return null;
    return { meta: raw.meta, data: parseSave(raw.data) };
  } catch (err) {
    if (err instanceof SaveError || err instanceof SyntaxError) return null;
    throw err;
  }
}

export function clearJournal(key: JournalKey) {
  try {
    localStorage.removeItem(keyOf(key));
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

/** Is `a` a newer snapshot than `b`? Saves without a time count as oldest. */
export function isNewer(a: SaveData, b: SaveData): boolean {
  return (a.savedAt ?? 0) > (b.savedAt ?? 0);
}

function isMetaInput(v: unknown): v is SaveMetaInput {
  if (typeof v !== 'object' || v === null) return false;
  const o: Readonly<Record<string, unknown>> = { ...v };
  return (
    typeof o.name === 'string' &&
    typeof o.preset === 'string' &&
    ['population', 'funds', 'day', 'size', 'seed'].every((k) => typeof o[k] === 'number')
  );
}

/** Cheap check (no parsing) for the start screen. */
export function hasJournal(key: JournalKey): boolean {
  try {
    return localStorage.getItem(keyOf(key)) !== null;
  } catch {
    return false;
  }
}
