import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { readCookie, SESSION_COOKIE, sessionCookieOptions } from '../../http/middleware.ts';
import { RateLimiter } from '../../http/rateLimit.ts';
import { addressOf } from '../auth/auth.limits.ts';
import { SESSION_DAYS } from '../auth/auth.service.ts';
import type { GithubApi } from './github.api.ts';
import type { OAuthService } from './oauth.service.ts';

/** Short-lived cookie carrying the anti-forgery state and where to return (10 minutes). */
const STATE_COOKIE = 'cb_oauth';
const STATE_MAX_AGE = 10 * 60_000;
const SavedState = z.object({ state: z.string().min(16), returnTo: z.string() });

/** The state cookie, or null if it's missing, expired or not ours. */
function readSavedState(req: Request): z.output<typeof SavedState> | null {
  const raw = readCookie(req, STATE_COOKIE);
  if (!raw) return null;
  try {
    const parsed = SavedState.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export interface GithubRouteOptions {
  readonly clientId: string;
  readonly publicUrl: string;
  readonly api: GithubApi;
  readonly secureCookies: boolean;
}

/** Only same-site paths: "/x" yes, "//evil.com" or "https://…" no (no open redirects). */
function safeReturnTo(v: unknown): string {
  return typeof v === 'string' && /^\/(?!\/)[\w\-./?=&%:+]*$/.test(v) && v.length <= 300 ? v : '/';
}

function sameState(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * /api/auth/github: start (redirect to GitHub) and callback (GitHub redirects back). Failures
 * land on the site with `?auth_error=…` so the dialog can say what happened.
 */
export function githubRoutes(oauth: OAuthService, opts: GithubRouteOptions): Router {
  const router = Router();
  const cookie = sessionCookieOptions(opts.secureCookies);
  const callbackUrl = `${opts.publicUrl}/api/auth/github/callback`;
  // Each sign-in costs two GitHub calls and a DB write: cap them per address.
  const limiter = new RateLimiter({ max: 30, windowMs: 10 * 60_000 });

  const fail = (res: Response, returnTo: string, reason: string) => {
    res.clearCookie(STATE_COOKIE, cookie);
    const sep = returnTo.includes('?') ? '&' : '?';
    res.redirect(302, `${returnTo}${sep}auth_error=${encodeURIComponent(reason)}`);
  };

  router.get('/', (req: Request, res: Response) => {
    const state = randomBytes(24).toString('base64url');
    const returnTo = safeReturnTo(req.query.returnTo);
    res.cookie(STATE_COOKIE, JSON.stringify({ state, returnTo }), { ...cookie, maxAge: STATE_MAX_AGE });
    const url = new URL('https://github.com/login/oauth/authorize');
    url.search = new URLSearchParams({ client_id: opts.clientId, redirect_uri: callbackUrl, scope: 'read:user user:email', state, allow_signup: 'true' }).toString();
    res.redirect(302, url.toString());
  });

  router.get('/callback', async (req: Request, res: Response) => {
    const saved = readSavedState(req);
    const returnTo = safeReturnTo(saved?.returnTo);
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const code = typeof req.query.code === 'string' ? req.query.code : '';

    const address = addressOf(req);
    if (limiter.retryAfter(address) > 0) return fail(res, returnTo, 'Too many sign-in attempts. Try again in a few minutes.');
    limiter.fail(address);

    if (req.query.error === 'access_denied') return fail(res, returnTo, 'GitHub sign-in was cancelled.');
    if (!saved || !state || !sameState(saved.state, state)) {
      return fail(res, returnTo, 'That sign-in link expired. Please try again.');
    }
    if (!code) return fail(res, returnTo, 'GitHub didn’t send a sign-in code. Please try again.');
    try {
      const profile = await opts.api.profileForCode(code, callbackUrl);
      const session = await oauth.signInWithGithub(profile);
      res.clearCookie(STATE_COOKIE, cookie);
      res.cookie(SESSION_COOKIE, session.token, { ...cookie, maxAge: SESSION_DAYS * 86_400_000 });
      res.redirect(302, returnTo);
    } catch (err) {
      console.error('github sign-in failed', err);
      fail(res, returnTo, 'Couldn’t sign in with GitHub. Please try again.');
    }
  });

  return router;
}
