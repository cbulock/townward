import type { SaveMeta, SaveMetaInput } from '../shared/api';
import type { SaveData } from '../sim/save';

/**
 * Where cities are kept (docs/specs/saving.md, "Client"): this device (IndexedDB) or the
 * player's account (the save server). Both look the same to the rest of the game.
 */

export type StoreKind = 'local' | 'cloud';

export interface SaveStore {
  readonly kind: StoreKind;
  list(): Promise<SaveMeta[]>;
  /** Throws SaveError if the stored data isn't a loadable save. */
  load(id: number): Promise<{ meta: SaveMeta; data: SaveData }>;
  create(meta: SaveMetaInput, data: SaveData): Promise<SaveMeta>;
  update(id: number, meta: SaveMetaInput, data: SaveData): Promise<SaveMeta>;
  remove(id: number): Promise<void>;
}

/** Which store and which city: kept in the URL as `?city=local:3`. */
export interface CityRef {
  readonly store: StoreKind;
  readonly id: number;
}

export function formatCityRef(ref: CityRef): string {
  return `${ref.store}:${ref.id}`;
}

export function parseCityRef(text: string | null): CityRef | null {
  const m = text?.match(/^(local|cloud):(\d+)$/);
  if (!m) return null;
  const store: StoreKind = m[1] === 'local' ? 'local' : 'cloud';
  return { store, id: Number(m[2]) };
}
