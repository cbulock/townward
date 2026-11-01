import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { API_LIMITS } from '../src/shared/api.ts';
import type { Db } from './db/db.ts';
import { errorHandler, notFoundHandler } from './http/errors.ts';
import { loadUser, securityHeaders } from './http/middleware.ts';
import type { TrustProxy } from './config.ts';
import { authRoutes } from './modules/auth/auth.routes.ts';
import { AuthLimiter } from './modules/auth/auth.limits.ts';
import { AuthService } from './modules/auth/auth.service.ts';
import { healthRoutes } from './modules/health/health.routes.ts';
import { SavesRepository } from './modules/saves/saves.repository.ts';
import { savesRoutes } from './modules/saves/saves.routes.ts';
import { SavesService } from './modules/saves/saves.service.ts';

/** Assembles the save server (docs/specs/saving.md): services, then middleware and routers. */

export interface AppOptions {
  /** Send cookies with `Secure` (production, behind HTTPS). */
  readonly secureCookies: boolean;
  /** Serve the built client from this folder (production). */
  readonly staticDir?: string;
  /** Express `trust proxy` (config TRUST_PROXY). Default: loopback only. */
  readonly trustProxy?: TrustProxy;
  /** Login and signup limits (tests pass their own clock or rules). */
  readonly authLimits?: AuthLimiter;
}

export function createApp(db: Db, opts: AppOptions): express.Express & { auth: AuthService } {
  const auth = new AuthService(db);
  const saves = new SavesService(new SavesRepository(db));

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', opts.trustProxy ?? 'loopback');
  app.use(securityHeaders(opts.secureCookies));

  const api = express.Router();
  api.use(express.json({ limit: API_LIMITS.bodyBytes }));
  api.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  api.use('/health', healthRoutes(db));
  api.use(loadUser((token) => auth.userForToken(token)));
  api.use('/auth', authRoutes(auth, opts.secureCookies, opts.authLimits));
  api.use('/saves', savesRoutes(saves));
  api.use(notFoundHandler);
  api.use(errorHandler);
  app.use('/api', api);

  // Production: serve the built client; every other path (/, /demo …) falls back to the app.
  // Hashed bundles never change, so they cache for a year; index.html is always revalidated.
  const dir = opts.staticDir;
  if (dir && existsSync(dir)) {
    app.use('/assets', express.static(join(dir, 'assets'), { immutable: true, maxAge: '365d', fallthrough: false }));
    app.use(express.static(dir, { index: false, maxAge: '1h' }));
    app.get('/{*path}', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(join(dir, 'index.html'));
    });
  }
  return Object.assign(app, { auth });
}
