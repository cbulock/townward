import type { TourProgress } from '../../../src/shared/api.ts';
import { queryOne, type Db } from '../../db/db.ts';

/** SQL for tour progress: one row per user. */
export class TourRepository {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  find(userId: number): Promise<TourProgress | null> {
    return queryOne<TourProgress>(this.db, 'SELECT step, done FROM tour_progress WHERE user_id = $1', [userId]);
  }

  async upsert(userId: number, p: TourProgress): Promise<void> {
    await this.db.query(
      `INSERT INTO tour_progress (user_id, step, done) VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET step = $2, done = $3, updated_at = now()`,
      [userId, p.step, p.done],
    );
  }
}
