import type { Db } from './db.ts';

/**
 * Schema migrations, applied in order at startup. Never edit a released migration: add a new one.
 * Column types stay int4 / float8 / text / timestamptz so every driver returns plain JS values.
 */
const MIGRATIONS: readonly string[] = [
  // 1: accounts, sessions and city saves (docs/specs/saving.md)
  `
  CREATE TABLE users (
    id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email      text NOT NULL UNIQUE,
    pass_hash  text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE sessions (
    token_hash text PRIMARY KEY,
    user_id    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL
  );
  CREATE INDEX sessions_by_user ON sessions(user_id);
  CREATE TABLE saves (
    id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       text NOT NULL,
    population integer NOT NULL,
    funds      double precision NOT NULL,
    day        integer NOT NULL,
    size       integer NOT NULL,
    preset     text NOT NULL,
    seed       double precision NOT NULL,
    data       text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX saves_by_user ON saves(user_id, updated_at DESC);
  `,
];

export async function migrate(db: Db): Promise<void> {
  await db.exec('CREATE TABLE IF NOT EXISTS schema_version (version integer NOT NULL)');
  const [row] = await db.query<{ version: number }>('SELECT COALESCE(MAX(version), 0)::int AS version FROM schema_version');
  for (let v = (row?.version ?? 0) + 1; v <= MIGRATIONS.length; v++) {
    await db.transaction(async (tx) => {
      await tx.exec(MIGRATIONS[v - 1]);
      await tx.query('INSERT INTO schema_version (version) VALUES ($1)', [v]);
    });
  }
}
