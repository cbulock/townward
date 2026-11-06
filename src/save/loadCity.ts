import type { SaveData } from '../sim/save';
import { storeFor } from './CitySaver';
import { clearJournal, isNewer, readJournal } from './journal';
import type { CityRef } from './SaveStore';
import { NATIVE_APP } from '../app/platform';
import { nativeBackupIndex } from './cloudStore';

/**
 * Open a saved city from its store, or from the journal when that copy is newer (the tab
 * closed before the store confirmed the last save) or the store can't be read right now.
 */
export async function loadCity(ref: CityRef): Promise<SaveData> {
  // Opening a device copy makes it independent: later cloud activity must not overwrite edits.
  if (NATIVE_APP && ref.store === 'local') nativeBackupIndex.detach(ref.id);
  const journal = readJournal(ref);
  try {
    const { data } = await storeFor(ref.store).load(ref.id);
    return journal && isNewer(journal.data, data) ? journal.data : data;
  } catch (err) {
    if (journal) return journal.data;
    throw err;
  }
}

/** A new city that was never stored (closed before its first save): put it on this device. */
export async function recoverNewCity(): Promise<CityRef | null> {
  const entry = readJournal('new');
  if (!entry) {
    // Unreadable: drop it, or every visit would try again.
    clearJournal('new');
    return null;
  }
  const meta = await storeFor('local').create(entry.meta, entry.data);
  clearJournal('new');
  return { store: 'local', id: meta.id };
}
