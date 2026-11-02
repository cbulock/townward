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
  // 2: anonymous usage events (docs/specs/analytics.md)
  `
  CREATE TABLE events (
    id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kind         text NOT NULL,
    visitor      text NOT NULL,
    user_id      integer REFERENCES users(id) ON DELETE SET NULL,
    path         text NOT NULL,
    referrer     text,
    utm_source   text,
    utm_medium   text,
    utm_campaign text,
    browser      text NOT NULL,
    os           text NOT NULL,
    device       text NOT NULL,
    timezone     text,
    language     text,
    screen       text,
    props        text,
    created_at   timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX events_by_time ON events(created_at DESC);
  CREATE INDEX events_by_kind ON events(kind, created_at DESC);
  `,
  // 3: sign-in with GitHub (docs/specs/saving.md, "Accounts"); OAuth-only accounts have no password
  `
  ALTER TABLE users ALTER COLUMN pass_hash DROP NOT NULL;
  CREATE TABLE oauth_accounts (
    provider         text NOT NULL,
    provider_user_id text NOT NULL,
    user_id          integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (provider, provider_user_id)
  );
  CREATE INDEX oauth_by_user ON oauth_accounts(user_id);
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
