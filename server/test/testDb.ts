import { PGlite, type Transaction } from '@electric-sql/pglite';
import type { Db, Queryable } from '../db/db.ts';
import { migrate } from '../db/migrations.ts';

/** A fresh, migrated in-process Postgres (PGlite) for tests: no Docker needed. */

function queryable(pg: PGlite | Transaction): Queryable {
  return {
    async query<R>(text: string, params: readonly unknown[] = []) {
      const result = await pg.query<R>(text, [...params]);
      return result.rows;
    },
    async exec(sql: string) {
      await pg.exec(sql);
    },
  };
}

export async function createTestDb(): Promise<Db> {
  const pg = new PGlite();
  const db: Db = {
    ...queryable(pg),
    transaction: (fn) => pg.transaction((tx) => fn(queryable(tx))),
    close: () => pg.close(),
  };
  await migrate(db);
  return db;
}
