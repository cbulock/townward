import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { API_LIMITS } from '../src/shared/api.ts';
import type { Db } from './db/db.ts';
import { errorHandler, notFoundHandler } from './http/errors.ts';
import { loadUser, securityHeaders } from './http/middleware.ts';
import type { TrustProxy } from './config.ts';
import { authRoutes } from './modules/auth/auth.routes.ts';
import { AnalyticsRepository } from './modules/analytics/analytics.repository.ts';
import { analyticsRoutes } from './modules/analytics/analytics.routes.ts';
import { AnalyticsService } from './modules/analytics/analytics.service.ts';
import { AuthLimiter } from './modules/auth/auth.limits.ts';
import { AuthService } from './modules/auth/auth.service.ts';
import { healthRoutes } from './modules/health/health.routes.ts';
import type { GithubApi } from './modules/oauth/github.api.ts';
import { githubRoutes } from './modules/oauth/oauth.routes.ts';
import { OAuthService } from './modules/oauth/oauth.service.ts';
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
  /** Sign in with GitHub, when configured (config GITHUB_*; tests pass a fake API). */
  readonly github?: { readonly clientId: string; readonly publicUrl: string; readonly api: GithubApi };
}

export function createApp(db: Db, opts: AppOptions): express.Express & { auth: AuthService } {
  const auth = new AuthService(db);
  const saves = new SavesService(new SavesRepository(db));
  const analytics = new AnalyticsService(new AnalyticsRepository(db));

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
  if (opts.github) api.use('/auth/github', githubRoutes(new OAuthService(db, auth), { ...opts.github, secureCookies: opts.secureCookies }));
  api.use('/auth', authRoutes(auth, opts.secureCookies, opts.authLimits, { github: !!opts.github }));
  api.use('/saves', savesRoutes(saves));
  api.use('/events', analyticsRoutes(analytics));
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
