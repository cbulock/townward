import { queryOne, type Db } from '../../db/db.ts';

/** A guest as stored: no address, no User-Agent, only the keyed fingerprint. */
export interface GuestRow {
  readonly id: string;
  readonly fingerprint: string;
  readonly playSeconds: number;
  /** Epoch milliseconds of the last heartbeat. */
  readonly lastSeen: number;
}

const COLS = `id, fingerprint, play_seconds AS "playSeconds", last_seen_ms::float8 AS "lastSeen"`;

export class GuestsRepository {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  find(id: string): Promise<GuestRow | null> {
    return queryOne<GuestRow>(this.db, `SELECT ${COLS} FROM guests WHERE id = $1`, [id]);
  }

  /** Most play time used by any guest on this fingerprint seen since `sinceMs`. */
  async mostUsed(fingerprint: string, sinceMs: number): Promise<number> {
    const row = await queryOne<{ used: number }>(
      this.db,
      'SELECT COALESCE(MAX(play_seconds), 0)::int AS used FROM guests WHERE fingerprint = $1 AND last_seen_ms >= $2',
      [fingerprint, sinceMs],
    );
    return row?.used ?? 0;
  }

  async create(row: GuestRow): Promise<void> {
    await this.db.query('INSERT INTO guests (id, fingerprint, play_seconds, last_seen_ms) VALUES ($1, $2, $3, $4)', [
      row.id,
      row.fingerprint,
      row.playSeconds,
      row.lastSeen,
    ]);
  }

  /** Add play time and move the last-seen mark (the fingerprint follows the guest's network). */
  touch(id: string, addSeconds: number, fingerprint: string, nowMs: number): Promise<GuestRow | null> {
    return queryOne<GuestRow>(
      this.db,
      `UPDATE guests SET play_seconds = play_seconds + $2, fingerprint = $3, last_seen_ms = $4 WHERE id = $1 RETURNING ${COLS}`,
      [id, Math.round(addSeconds), fingerprint, nowMs],
    );
  }

  async claim(id: string, userId: number): Promise<void> {
    await this.db.query('UPDATE guests SET claimed_by = $2 WHERE id = $1 AND claimed_by IS NULL', [id, userId]);
  }

  async prune(beforeMs: number): Promise<void> {
    await this.db.query('DELETE FROM guests WHERE last_seen_ms < $1', [beforeMs]);
  }
}
