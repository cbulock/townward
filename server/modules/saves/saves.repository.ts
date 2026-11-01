import type { SaveMeta, SaveMetaInput } from '../../../src/shared/api.ts';
import { queryOne, type Db } from '../../db/db.ts';

/** SQL for city saves. Every query is scoped to its owner. Data is JSON text, passed through untouched. */

const META = `id, name, population, funds, day, size, preset, seed,
  (extract(epoch FROM updated_at) * 1000)::float8 AS "updatedAt"`;

export class SavesRepository {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  list(userId: number): Promise<SaveMeta[]> {
    return this.db.query<SaveMeta>(`SELECT ${META} FROM saves WHERE user_id = $1 ORDER BY updated_at DESC`, [userId]);
  }

  find(userId: number, id: number): Promise<(SaveMeta & { data: string }) | null> {
    return queryOne(this.db, `SELECT ${META}, data FROM saves WHERE id = $1 AND user_id = $2`, [id, userId]);
  }

  /** Insert unless the user already has `limit` saves (checked in the same statement); null if full. */
  createWithin(userId: number, limit: number, m: SaveMetaInput, data: string): Promise<SaveMeta | null> {
    return queryOne(
      this.db,
      `INSERT INTO saves (user_id, name, population, funds, day, size, preset, seed, data)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9
       WHERE (SELECT count(*) FROM saves WHERE user_id = $1) < $10
       RETURNING ${META}`,
      [userId, m.name, m.population, m.funds, m.day, m.size, m.preset, m.seed, data, limit],
    );
  }

  update(userId: number, id: number, m: SaveMetaInput, data: string): Promise<SaveMeta | null> {
    return queryOne(
      this.db,
      `UPDATE saves SET name = $3, population = $4, funds = $5, day = $6, size = $7, preset = $8, seed = $9, data = $10,
         updated_at = now()
       WHERE id = $1 AND user_id = $2
       RETURNING ${META}`,
      [id, userId, m.name, m.population, m.funds, m.day, m.size, m.preset, m.seed, data],
    );
  }

  async remove(userId: number, id: number): Promise<boolean> {
    const rows = await this.db.query<{ id: number }>('DELETE FROM saves WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
    return rows.length > 0;
  }
}
