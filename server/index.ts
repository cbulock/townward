import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createPgDb } from './db/db.ts';
import { migrate } from './db/migrations.ts';
import { httpGithubApi } from './modules/oauth/github.api.ts';

/**
 * Save server entry point, run by bun. `bun run dev` runs it next to Vite (which proxies /api
 * here); `bun run start` also serves the built client. Postgres: `docker compose up -d`.
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
const app = createApp(db, {
  secureCookies: config.production,
  staticDir: config.production ? `${root}dist` : undefined,
  trustProxy: config.trustProxy,
  guests: config.guests,
  github: config.github ? { clientId: config.github.clientId, publicUrl: config.github.publicUrl, api: httpGithubApi(config.github.clientId, config.github.clientSecret) } : undefined,
});
if (config.github) console.log(`GitHub sign-in on (callback ${config.github.publicUrl}/api/auth/github/callback)`);
const server = app.listen(config.port, () => console.log(`save server on http://localhost:${config.port}`));

// Expired sessions and long-gone guests are tidied hourly, so the tables don't grow with every visitor.
const pruning = setInterval(() => {
  void app.auth.pruneSessions().catch((err: unknown) => console.error('session prune failed', err));
  void app.guests.prune().catch((err: unknown) => console.error('guest prune failed', err));
}, 3_600_000);
pruning.unref();

function shutdown() {
  clearInterval(pruning);
  server.close(() => void db.close());
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
