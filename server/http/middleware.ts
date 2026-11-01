import type { CookieOptions, Request, RequestHandler, Response } from 'express';
import type { ApiUser } from '../../src/shared/api.ts';
import { tooManyRequests, unauthorized } from './errors.ts';

/** Cross-cutting HTTP pieces: the session cookie, the signed-in user, rate limiting. */

export const SESSION_COOKIE = 'cb_session';

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

export function sessionCookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure, path: '/' };
}

/** Looks a session token up; provided by the auth module. */
export type SessionLookup = (token: string) => Promise<ApiUser | null>;

/**
 * Attach the signed-in user (or null) to `res.locals.user`. Read it with `currentUser` or
 * `requireUser`, which keep the typing in one place.
 */
export function loadUser(lookup: SessionLookup): RequestHandler {
  return async (req, res, next) => {
    const token = readCookie(req, SESSION_COOKIE);
    res.locals.user = token ? await lookup(token) : null;
    next();
  };
}

function isApiUser(v: unknown): v is ApiUser {
  return typeof v === 'object' && v !== null && 'id' in v && typeof v.id === 'number' && 'email' in v && typeof v.email === 'string';
}

export function currentUser(res: Response): ApiUser | null {
  const user: unknown = res.locals.user;
  return isApiUser(user) ? user : null;
}

/** The signed-in user, or throw 401. */
export function requireUser(res: Response): ApiUser {
  const user = currentUser(res);
  if (!user) throw unauthorized();
  return user;
}

/** Fixed-window limit per client IP (login and signup). In memory: fine for one server process. */
export function rateLimit(max: number, windowMs: number): RequestHandler {
  const hits = new Map<string, { count: number; reset: number }>();
  return (req, _res, next) => {
    const now = Date.now();
    if (hits.size > 10_000) for (const [k, h] of hits) if (h.reset <= now) hits.delete(k);
    const key = req.ip ?? 'unknown';
    const h = hits.get(key);
    if (!h || h.reset <= now) hits.set(key, { count: 1, reset: now + windowMs });
    else if (++h.count > max) throw tooManyRequests();
    next();
  };
}
