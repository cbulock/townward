import { parseSave } from '../sim/save';
import { api } from './api';
import type { SaveStore } from './SaveStore';
import { NATIVE_APP, NATIVE_API_ORIGIN } from '../app/platform';
import { localStore } from './localStore';
import { persistentBackupIndex, withLocalBackups } from './nativeCloudBackups';

/** Cities in the player's account, on the save server. */
const remoteStore: SaveStore = {
  kind: 'cloud',
  list: () => api.listSaves().then((saves) => [...saves]),
  async load(id) {
    const r = await api.loadSave(id);
    return { meta: r.meta, data: parseSave(r.data) };
  },
  create: (meta, data) => api.createSave({ meta, data }),
  update: (id, meta, data) => api.updateSave(id, { meta, data }),
  remove: (id) => api.deleteSave(id),
};

export const nativeBackupIndex = persistentBackupIndex(NATIVE_API_ORIGIN);
export const cloudStore: SaveStore = NATIVE_APP
  ? withLocalBackups(remoteStore, localStore, nativeBackupIndex)
  : remoteStore;
