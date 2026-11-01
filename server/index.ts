import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createPgDb } from './db/db.ts';
import { migrate } from './db/migrations.ts';

/**
 * Save server entry point. `pnpm dev` runs it next to Vite (which proxies /api here);
 * `pnpm start` also serves the built client. Postgres: `docker compose up -d`.
 */

const config = loadConfig();
const db = createPgDb(config.databaseUrl);

try {
  await migrate(db);
} catch (err) {
  console.error(`Can't reach Postgres at ${config.databaseUrl}. Is it running? (docker compose up -d)\n`, err);
  process.exit(1);
}

const root = fileURLToPath(new URL('..', import.meta.url));
const app = createApp(db, { secureCookies: config.production, staticDir: config.production ? `${root}dist` : undefined });
const server = app.listen(config.port, () => console.log(`save server on http://localhost:${config.port}`));

function shutdown() {
  server.close(() => void db.close());
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
