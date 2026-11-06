import { expect, it } from 'vitest';
import { withLocalBackups, type BackupIndex } from '../src/save/nativeCloudBackups';
import type { SaveStore } from '../src/save/SaveStore';
import type { SaveMeta, SaveMetaInput } from '../src/shared/api';
import type { SaveData } from '../src/sim/save';
import { serialize } from '../src/sim/save';
import { City } from '../src/sim/City';
import { generateTerrain } from '../src/sim/terrain/generate';
import { presetSettings } from '../src/sim/terrain/presets';
import { ApiError } from '../src/save/api';

function memoryStore(kind: 'local' | 'cloud'): SaveStore {
  const rows = new Map<number, { meta: SaveMeta; data: SaveData }>();
  let next = 1;
  return {
    kind,
    async list() {
      return [...rows.values()].map((row) => row.meta);
    },
    async load(id) {
      const row = rows.get(id);
      if (!row) throw new Error('missing');
      return row;
    },
    async create(meta, data) {
      const id = next++;
      const result = { ...meta, id, updatedAt: 1 };
      rows.set(id, { meta: result, data });
      return result;
    },
    async update(id, meta, data) {
      const result = { ...meta, id, updatedAt: 2 };
      rows.set(id, { meta: result, data });
      return result;
    },
    async remove(id) {
      rows.delete(id);
    },
  };
}

function fixture() {
  const remote = memoryStore('cloud');
  const local = memoryStore('local');
  const ids = new Map<string, number>();
  const index: BackupIndex = {
    read: (key) => ids.get(key) ?? null,
    write: (key, id) => {
      ids.set(key, id);
    },
    remove: (key) => {
      ids.delete(key);
    },
    detach: (id) => {
      for (const [key, value] of ids) if (value === id) ids.delete(key);
    },
  };
  const terrain = presetSettings('coastal', 5, 64);
  const data = serialize(new City(generateTerrain(terrain)), terrain, 'Backup');
  const meta: SaveMetaInput = {
    name: 'Backup',
    population: 0,
    funds: 1,
    day: 3,
    size: 64,
    preset: 'coastal',
    seed: 5,
  };
  return { remote, local, index, store: withLocalBackups(remote, local, index), data, meta };
}

it('failed cloud creation leaves one reusable durable local copy', async () => {
  const { remote, local, store, data, meta } = fixture();
  remote.create = async () => {
    throw new ApiError(0, 'offline');
  };
  await expect(store.create(meta, data)).rejects.toThrow('offline');
  await expect(store.create(meta, { ...data, savedAt: 25 })).rejects.toThrow('offline');
  const copies = await local.list();
  expect(copies).toHaveLength(1);
  expect((await local.load(copies[0].id)).data.savedAt).toBe(25);
});

it('cloud updates persist locally before network failure and reopen from that copy offline', async () => {
  const { remote, local, store, data, meta } = fixture();
  const created = await store.create(meta, data);
  remote.update = async () => {
    throw new ApiError(0, 'offline');
  };
  await expect(store.update(created.id, meta, { ...data, savedAt: 35 })).rejects.toThrow('offline');
  remote.load = async () => {
    throw new ApiError(0, 'offline');
  };
  expect((await store.load(created.id)).data.savedAt).toBe(35);
  expect(await local.list()).toHaveLength(1);
});

it('an unauthorized cloud response never falls back to a different account session', async () => {
  const { remote, store, data, meta } = fixture();
  const created = await store.create(meta, data);
  remote.load = async () => {
    throw new ApiError(401, 'Log in');
  };
  await expect(store.load(created.id)).rejects.toThrow('Log in');
});

it('a device copy opened for independent editing is never overwritten by later cloud saves', async () => {
  const { local, index, store, data, meta } = fixture();
  const cloud = await store.create(meta, data);
  const [copy] = await local.list();
  index.detach(copy.id);
  await local.update(copy.id, meta, { ...data, savedAt: 50 });
  await store.update(cloud.id, meta, { ...data, savedAt: 75 });
  expect((await local.load(copy.id)).data.savedAt).toBe(50);
  expect(await local.list()).toHaveLength(2);
});
it('opening an older cloud snapshot cannot erase a newer offline recovery copy', async () => {
  const { remote, local, store, data, meta } = fixture();
  const cloud = await store.create(meta, data);
  remote.update = async () => {
    throw new ApiError(0, 'offline');
  };
  await expect(store.update(cloud.id, meta, { ...data, savedAt: 50 })).rejects.toThrow('offline');
  await store.load(cloud.id);
  const [copy] = await local.list();
  expect((await local.load(copy.id)).data.savedAt).toBe(50);
  // A later save of the older cloud state gets a new timestamp; it must not erase offline work.
  await expect(store.update(cloud.id, meta, { ...data, savedAt: 75 })).rejects.toThrow('offline');
  expect((await local.load(copy.id)).data.savedAt).toBe(50);
});
