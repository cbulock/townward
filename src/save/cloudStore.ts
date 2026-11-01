import { parseSave } from '../sim/save';
import { api } from './api';
import type { SaveStore } from './SaveStore';

/** Cities in the player's account, on the save server. */
export const cloudStore: SaveStore = {
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
