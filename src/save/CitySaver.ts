import type { ChangeStamp, Game } from '../game/Game';
import { summarize } from '../sim/save';
import { cityStats } from '../sim/systems/population';
import { ApiError } from './api';
import { cloudStore } from './cloudStore';
import { localStore } from './localStore';
import type { CityRef, SaveStore, StoreKind } from './SaveStore';

/** Autosave for the open city (docs/specs/saving.md, "When It Saves"). */

export const AUTOSAVE_MS = 45_000;
const EDIT_SAVE_DEBOUNCE_MS = 1_000;

export type SaveStatus =
  | { readonly kind: 'new' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly at: number; readonly store: StoreKind }
  | { readonly kind: 'error'; readonly message: string };

export interface CitySaverOptions {
  /** The save this city was loaded from, or null for a new city. */
  readonly ref: CityRef | null;
  /** Where new saves should go right now: the account when logged in, else this device. */
  readonly preferredStore: () => StoreKind;
  readonly onStatus: (status: SaveStatus) => void;
  /** The city got a (new) home: first save, or moved into the account. */
  readonly onRef: (ref: CityRef) => void;
}

const STORES: Readonly<Record<StoreKind, SaveStore>> = { local: localStore, cloud: cloudStore };

const sameStamp = (a: ChangeStamp | null, b: ChangeStamp) => a !== null && a.edits === b.edits && a.day === b.day;

export class CitySaver {
  private ref: CityRef | null;
  /** What the last successful save contained; null = never saved in this session. */
  private saved: ChangeStamp | null;
  private inFlight: Promise<void> | null = null;
  private readonly timer: ReturnType<typeof setInterval>;
  private editTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly offWorldChanged: () => void;
  private readonly game: Game;
  private readonly opts: CitySaverOptions;

  constructor(game: Game, opts: CitySaverOptions) {
    this.game = game;
    this.opts = opts;
    this.ref = opts.ref;
    // A loaded city starts out saved.
    this.saved = opts.ref ? game.changeStamp : null;
    this.timer = setInterval(() => void this.autosave(), AUTOSAVE_MS);
    this.offWorldChanged = game.events.on('worldChanged', () => this.scheduleEditSave());
    document.addEventListener('visibilitychange', this.onVisibility);
    opts.onStatus(opts.ref ? { kind: 'saved', at: Date.now(), store: opts.ref.store } : { kind: 'new' });
  }

  get cityRef(): CityRef | null {
    return this.ref;
  }

  /**
   * Is there anything worth saving? A new city is only saved once the player has built
   * something, so rerolling maps doesn't fill the city list.
   */
  get dirty(): boolean {
    const stamp = this.game.changeStamp;
    if (this.ref === null && stamp.edits === 0) return false;
    return !sameStamp(this.saved, stamp) || this.needsMove();
  }

  /** Save if anything changed (the autosave timer, tab hidden, leaving the city). */
  autosave(): Promise<void> {
    return this.dirty ? this.saveNow() : (this.inFlight ?? Promise.resolve());
  }

  /** Save now, even a new city with no edits. Never throws: failures show in the status. */
  saveNow(): Promise<void> {
    // One save at a time; a request during a save runs right after it.
    if (this.inFlight) return this.inFlight.then(() => this.saveNow());
    this.inFlight = this.write().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  dispose() {
    clearInterval(this.timer);
    if (this.editTimer !== null) clearTimeout(this.editTimer);
    this.offWorldChanged();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private readonly onVisibility = () => {
    if (document.visibilityState === 'hidden') void this.autosave();
  };

  private scheduleEditSave() {
    if (this.editTimer !== null) return;
    this.editTimer = setTimeout(() => {
      this.editTimer = null;
      void this.autosave();
    }, EDIT_SAVE_DEBOUNCE_MS);
  }

  /** A guest city whose player has since logged in moves into the account. */
  private needsMove(): boolean {
    return this.ref?.store === 'local' && this.opts.preferredStore() === 'cloud';
  }

  private async write() {
    const stamp = this.game.changeStamp;
    const data = this.game.snapshot();
    const meta = summarize(data, cityStats(this.game.world).population);
    const target = this.ref && !this.needsMove() ? this.ref.store : this.opts.preferredStore();
    this.opts.onStatus({ kind: 'saving' });
    try {
      const store = STORES[target];
      if (this.ref && this.ref.store === target) {
        await store.update(this.ref.id, meta, data);
      } else {
        const created = await store.create(meta, data);
        const previous = this.ref;
        this.ref = { store: target, id: created.id };
        this.opts.onRef(this.ref);
        // Moved into the account: drop the copy on this device.
        if (previous) await STORES[previous.store].remove(previous.id).catch(() => undefined);
      }
      this.saved = stamp;
      this.opts.onStatus({ kind: 'saved', at: Date.now(), store: target });
    } catch (err) {
      this.opts.onStatus({ kind: 'error', message: describe(err) });
    }
  }
}

function describe(err: unknown): string {
  if (err instanceof ApiError) return err.status === 401 ? 'Log in again to save to your account' : err.message;
  if (err instanceof Error) return err.message;
  return 'Save failed';
}

export function storeFor(kind: StoreKind): SaveStore {
  return STORES[kind];
}
