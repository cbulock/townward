import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createPgDb } from './db/db.ts';
import { migrate } from './db/migrations.ts';
import { turnstileCheck } from './modules/auth/humanCheck.ts';
import { brevoMailer, consoleMailer } from './modules/email/mailer.ts';
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

// Brevo when configured; in development the codes are printed here instead, so the flow still works.
const mailer = config.email ? brevoMailer(config.email) : config.production ? null : consoleMailer();
if (config.email) console.log(`Email codes on (Brevo, from ${config.email.fromEmail})`);
else if (mailer) console.log('Email codes on (printed to this console: set BREVO_API_KEY and MAIL_FROM to send them)');
else console.warn('Email codes off: sign-up skips email confirmation and there is no password reset (set BREVO_API_KEY and MAIL_FROM)');

const root = fileURLToPath(new URL('..', import.meta.url));
const app = createApp(db, {
  secureCookies: config.production,
  staticDir: config.production ? `${root}dist` : undefined,
  trustProxy: config.trustProxy,
  guests: config.guests,
  email: mailer ? { mailer, dailyLimit: config.mailDailyLimit } : undefined,
  human: config.turnstile ? { check: turnstileCheck(config.turnstile.secretKey), siteKey: config.turnstile.siteKey } : undefined,
  github: config.github
    ? {
        clientId: config.github.clientId,
        publicUrl: config.github.publicUrl,
        api: httpGithubApi(config.github.clientId, config.github.clientSecret),
      }
    : undefined,
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
