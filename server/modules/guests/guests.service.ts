import { randomBytes } from 'node:crypto';
import type { GuestState } from '../../../src/shared/api.ts';
import type { GuestRow, GuestsRepository } from './guests.repository.ts';

/** Trial length and the secret for fingerprints (config GUEST_*). */
export interface GuestRules {
  readonly secret: string;
  readonly nudgeMinutes: number;
  readonly limitMinutes: number;
}

/** The client beats every 30 s; a longer silence is a break (tab closed, laptop asleep), not play. */
const MAX_GAP_S = 90;
/** One heartbeat never earns more than this. */
const MAX_CREDIT_S = 60;
/** A new guest on a known fingerprint carries on that fingerprint's trial for this long. */
const MATCH_DAYS = 30;
/** Guests not seen for this long are deleted. */
const KEEP_DAYS = 90;
const DAY_MS = 86_400_000;

export interface GuestStatus {
  readonly guestId: string;
  readonly state: GuestState;
  readonly playSeconds: number;
}

/**
 * Guest trials (D-083). Play time is measured here, from the gaps between heartbeats, so a
 * client can't report less than it played. Clearing cookies gives a new id, but the
 * fingerprint brings the used time back.
 */
export class GuestsService {
  private readonly repo: GuestsRepository;
  readonly rules: GuestRules;
  private readonly now: () => number;

  constructor(repo: GuestsRepository, rules: GuestRules, now: () => number = Date.now) {
    this.repo = repo;
    this.rules = rules;
    this.now = now;
  }

  async heartbeat(id: string | null, fingerprint: string): Promise<GuestStatus> {
    const now = this.now();
    const known = id ? await this.repo.find(id) : null;
    if (!known) {
      const row: GuestRow = {
        id: randomBytes(16).toString('base64url'),
        fingerprint,
        playSeconds: await this.repo.mostUsed(fingerprint, now - MATCH_DAYS * DAY_MS),
        lastSeen: now,
      };
      await this.repo.create(row);
      return this.status(row);
    }
    const gap = Math.max(0, (now - known.lastSeen) / 1000);
    const credit = gap <= MAX_GAP_S ? Math.min(gap, MAX_CREDIT_S) : 0;
    return this.status((await this.repo.touch(known.id, credit, fingerprint, now)) ?? known);
  }

  /** Remember which account a guest became (signing up from the gate). */
  claim(id: string, userId: number): Promise<void> {
    return this.repo.claim(id, userId);
  }

  prune(): Promise<void> {
    return this.repo.prune(this.now() - KEEP_DAYS * DAY_MS);
  }

  private status(row: GuestRow): GuestStatus {
    const minutes = row.playSeconds / 60;
    const state: GuestState = minutes >= this.rules.limitMinutes ? 'gate' : minutes >= this.rules.nudgeMinutes ? 'nudge' : 'ok';
    return { guestId: row.id, state, playSeconds: row.playSeconds };
  }
}
