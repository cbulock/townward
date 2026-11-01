import type { SaveMeta } from '../shared/api';
import { parseSave, SaveError } from '../sim/save';
import type { SaveStore } from './SaveStore';

/**
 * Cities on this device, in IndexedDB. Metadata and data live in separate object stores
 * (same id), so listing cities never reads their data.
 */

const DB_NAME = 'citybuilder';
const META = 'meta';
const DATA = 'data';

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(META, { keyPath: 'id', autoIncrement: true });
      req.result.createObjectStore(DATA);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opening = null;
      reject(req.error ?? new Error('IndexedDB unavailable'));
    };
  });
  return opening;
}

function done<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function committed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
  });
}

function isMeta(v: unknown): v is SaveMeta {
  return typeof v === 'object' && v !== null && 'id' in v && typeof v.id === 'number' && 'name' in v && typeof v.name === 'string';
}

export const localStore: SaveStore = {
  kind: 'local',

  async list() {
    const db = await open();
    const rows: unknown[] = await done(db.transaction(META).objectStore(META).getAll());
    return rows.filter(isMeta).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async load(id) {
    const db = await open();
    const tx = db.transaction([META, DATA]);
    const [meta, data]: unknown[] = await Promise.all([done(tx.objectStore(META).get(id)), done(tx.objectStore(DATA).get(id))]);
    if (!isMeta(meta)) throw new SaveError('City not found on this device');
    return { meta, data: parseSave(data) };
  },

  async create(input, data) {
    const db = await open();
    const tx = db.transaction([META, DATA], 'readwrite');
    const updatedAt = Date.now();
    // The id comes from the store's key generator, so the record is added without one first.
    const key = await done(tx.objectStore(META).add({ ...input, updatedAt }));
    if (typeof key !== 'number') throw new Error('unexpected IndexedDB key');
    const meta: SaveMeta = { ...input, id: key, updatedAt };
    tx.objectStore(META).put(meta);
    tx.objectStore(DATA).put(data, key);
    await committed(tx);
    return meta;
  },

  async update(id, input, data) {
    const db = await open();
    const tx = db.transaction([META, DATA], 'readwrite');
    const meta: SaveMeta = { ...input, id, updatedAt: Date.now() };
    tx.objectStore(META).put(meta);
    tx.objectStore(DATA).put(data, id);
    await committed(tx);
    return meta;
  },

  async remove(id) {
    const db = await open();
    const tx = db.transaction([META, DATA], 'readwrite');
    tx.objectStore(META).delete(id);
    tx.objectStore(DATA).delete(id);
    await committed(tx);
  },
};
