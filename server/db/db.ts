import pg from 'pg';

/**
 * What repositories need from a database. Postgres in Docker in development and production
 * (`pg`), PGlite (Postgres in WASM) in tests: server/test/testDb.ts.
 */
export interface Queryable {
  /**
   * Run `text` with `$1…` parameters. `R` is the row shape the SQL selects: each repository
   * declares it next to its query, and keeps column types to int4, float8 and text so both
   * drivers return plain numbers and strings.
   */
  query<R>(text: string, params?: readonly unknown[]): Promise<R[]>;
  /** Run a script of one or more statements without parameters (migrations). */
  exec(sql: string): Promise<void>;
}

export interface Db extends Queryable {
  /** Run `fn` on one connection inside BEGIN … COMMIT, rolling back if it throws. */
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** The first row, or null. */
export async function queryOne<R>(db: Queryable, text: string, params?: readonly unknown[]): Promise<R | null> {
  const rows = await db.query<R>(text, params);
  return rows[0] ?? null;
}

function pgQueryable(client: pg.Pool | pg.PoolClient): Queryable {
  return {
    async query<R>(text: string, params: readonly unknown[] = []) {
      const result = await client.query(text, [...params]);
      // pg types rows as `any`; the caller's R documents the shape its SQL selects.
      const rows: R[] = result.rows;
      return rows;
    },
    async exec(sql: string) {
      await client.query(sql);
    },
  };
}

export function createPgDb(connectionString: string): Db {
  const pool = new pg.Pool({ connectionString, max: 10 });
  return {
    ...pgQueryable(pool),
    async transaction<T>(fn: (tx: Queryable) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(pgQueryable(client));
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
