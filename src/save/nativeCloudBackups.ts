import { ApiError } from './api';
import type { SaveStore } from './SaveStore';
import type { SaveMeta, SaveMetaInput } from '../shared/api';
import type { SaveData } from '../sim/save';

export interface BackupIndex {
  read(key: string): number | null;
  write(key: string, id: number): void;
  remove(key: string): void;
  detach(id: number): void;
}

/** Durable device copies are independent saves, visible even when the account is unreachable. */
export function withLocalBackups(
  remote: SaveStore,
  local: SaveStore,
  index: BackupIndex,
): SaveStore {
  const queues = new Map<string, Promise<SaveMeta>>();
  const backup = (key: string, meta: SaveMetaInput, data: SaveData, preserveNewer = false): Promise<SaveMeta> => {
    const previous = queues.get(key);
    const next = (previous ?? Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        let id = index.read(key);
        if (id !== null) {
          const current = await local.load(id).catch(() => null);
          if (current && (current.data.savedAt ?? 0) > (data.savedAt ?? 0)) {
            if (!preserveNewer) return current.meta;
            // An older remote state gets a different backup; later saves cannot erase offline work.
            index.remove(key);
            id = null;
          }
        }
        const saved =
          id === null ? await local.create(meta, data) : await local.update(id, meta, data);
        index.write(key, saved.id);
        return saved;
      });
    queues.set(key, next);
    void next
      .finally(() => {
        if (queues.get(key) === next) queues.delete(key);
      })
      .catch(() => undefined);
    return next;
  };
  const cloudKey = (id: number) => `cloud:${id}`;
  return {
    kind: 'cloud',
    list: () => remote.list(),
    async load(id) {
      let result;
      try {
        result = await remote.load(id);
      } catch (error) {
        const localId = index.read(cloudKey(id));
        if (!(error instanceof ApiError) || error.status !== 0 || localId === null) throw error;
        const copy = await local.load(localId);
        return { ...copy, meta: { ...copy.meta, id } };
      }
      const { name, population, funds, day, size, preset, seed } = result.meta;
      await backup(cloudKey(id), { name, population, funds, day, size, preset, seed }, result.data, true);
      return result;
    },
    async create(meta, data) {
      const key = `pending:${meta.seed}:${meta.name}`;
      const copy = await backup(key, meta, data);
      const created = await remote.create(meta, data);
      index.write(cloudKey(created.id), copy.id);
      index.remove(key);
      return created;
    },
    async update(id, meta, data) {
      await backup(cloudKey(id), meta, data);
      return remote.update(id, meta, data);
    },
    // Removing a cloud city does not erase its separate device recovery copy.
    remove: (id) => remote.remove(id),
  };
}

/** Save IDs are globally unique within this backend; namespace the index by its origin. */
export function persistentBackupIndex(origin: string): BackupIndex {
  const memory = new Map<string, number>();
  const prefix = `citybuilder.native-backup:${origin}:`;
  const storageKey = (key: string) => prefix + key;
  const remove = (key: string) => {
    memory.delete(key);
    try {
      localStorage.removeItem(storageKey(key));
    } catch {
      /* Device copy remains available. */
    }
  };
  return {
    read(key) {
      try {
        const value = Number(localStorage.getItem(storageKey(key)));
        return Number.isSafeInteger(value) && value > 0 ? value : (memory.get(key) ?? null);
      } catch {
        return memory.get(key) ?? null;
      }
    },
    write(key, id) {
      memory.set(key, id);
      try {
        localStorage.setItem(storageKey(key), String(id));
      } catch {
        /* The IndexedDB copy itself remains durable. */
      }
    },
    remove,
    detach(id) {
      const keys = new Set([...memory].filter(([, value]) => value === id).map(([key]) => key));
      try {
        for (let n = 0; n < localStorage.length; n++) {
          const key = localStorage.key(n);
          if (key?.startsWith(prefix) && Number(localStorage.getItem(key)) === id)
            keys.add(key.slice(prefix.length));
        }
      } catch {
        /* In-memory mappings still detach if storage is unavailable. */
      }
      keys.forEach(remove);
    },
  };
}
