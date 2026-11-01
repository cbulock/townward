import { useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';
import { storeFor } from '../../save/CitySaver';
import type { CityRef, StoreKind } from '../../save/SaveStore';
import type { SaveMeta } from '../../shared/api';
import { PRESET_IDS, PRESETS } from '../../sim/terrain/presets';
import { authAtom } from '../atoms';
import { cityDate, timeAgo } from '../format';

interface Entry {
  readonly store: StoreKind;
  readonly meta: SaveMeta;
}

/** This device's cities, plus the account's when logged in, newest first. */
async function fetchCities(loggedIn: boolean): Promise<{ entries: Entry[]; error: string | null }> {
  const [local, cloud] = await Promise.allSettled([storeFor('local').list(), loggedIn ? storeFor('cloud').list() : Promise.resolve([])]);
  const entries: Entry[] = [];
  if (local.status === 'fulfilled') entries.push(...local.value.map((meta) => ({ store: 'local' as const, meta })));
  if (cloud.status === 'fulfilled') entries.push(...cloud.value.map((meta) => ({ store: 'cloud' as const, meta })));
  entries.sort((a, b) => b.meta.updatedAt - a.meta.updatedAt);
  return { entries, error: cloud.status === 'rejected' ? "Couldn't load your account's cities" : null };
}

const presetOf = (id: string) => PRESET_IDS.find((p) => p === id) ?? null;

/**
 * "Your cities": this device's cities, plus the account's once logged in, newest first.
 * Click to continue; local cities can be uploaded to the account; delete asks first.
 */
export function CityList({ onOpen }: { onOpen: (ref: CityRef) => void }) {
  const auth = useAtomValue(authAtom);
  const loggedIn = auth.status === 'user';
  const [entries, setEntries] = useState<readonly Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /** Bumped after a delete or upload to reload the list. */
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (auth.status === 'checking') return;
    let cancelled = false;
    void fetchCities(loggedIn).then((r) => {
      if (cancelled) return;
      setEntries(r.entries);
      setError(r.error);
    });
    return () => {
      cancelled = true;
    };
  }, [auth.status, loggedIn, version]);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
      setConfirming(null);
      setVersion((v) => v + 1);
    }
  };

  const remove = (e: Entry) => run(keyOf(e), () => storeFor(e.store).remove(e.meta.id));
  /** Copy a device city into the account, then drop the device copy. */
  const upload = (e: Entry) =>
    run(keyOf(e), async () => {
      const { data } = await storeFor('local').load(e.meta.id);
      const { name, population, funds, day, size, preset, seed } = e.meta;
      await storeFor('cloud').create({ name, population, funds, day, size, preset, seed }, data);
      await storeFor('local').remove(e.meta.id);
    });

  if (!entries || (entries.length === 0 && !error)) return null;

  return (
    <section className="panel cities-card" aria-label="Your cities">
      <header className="cities-header">
        <h2>Your cities</h2>
        {error && <span className="cities-error">{error}</span>}
      </header>
      <ul className="cities-strip">
        {entries.map((e) => {
          const key = keyOf(e);
          const m = e.meta;
          const preset = presetOf(m.preset);
          return (
            <li key={key} className="city-tile">
              <button type="button" className="city-open" disabled={busy === key} onClick={() => onOpen({ store: e.store, id: m.id })}>
                <span className="city-tile-name">{m.name}</span>
                <span className="city-tile-stats">
                  {m.population.toLocaleString()} people · {cityDate(m.day)}
                </span>
                <span className="city-tile-meta">
                  {preset ? PRESETS[preset].name : m.preset} · {m.size}² · {timeAgo(m.updatedAt)}
                </span>
                <span className={`city-badge is-${e.store}`}>{e.store === 'cloud' ? 'Account' : 'This device'}</span>
              </button>
              <div className="city-actions">
                {confirming === key ? (
                  <>
                    <span>Delete for good?</span>
                    <button type="button" className="link-button is-danger" onClick={() => void remove(e)}>
                      Delete
                    </button>
                    <button type="button" className="link-button" onClick={() => setConfirming(null)}>
                      Keep
                    </button>
                  </>
                ) : (
                  <>
                    {e.store === 'local' && loggedIn && (
                      <button type="button" className="link-button" disabled={busy === key} onClick={() => void upload(e)}>
                        Move to account
                      </button>
                    )}
                    <button type="button" className="link-button is-dim" disabled={busy === key} onClick={() => setConfirming(key)}>
                      Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const keyOf = (e: Entry) => `${e.store}:${e.meta.id}`;
