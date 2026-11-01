import type { CookieOptions, Request, RequestHandler, Response } from 'express';
import type { ApiUser } from '../../src/shared/api.ts';
import { unauthorized } from './errors.ts';

/** Cross-cutting HTTP pieces: the session cookie, the signed-in user, security headers. */

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

/**
 * Security headers on every response. HSTS only in production (it pins the domain to HTTPS).
 * No CSP yet: the client loads Google Fonts and builds textures from canvases; add one when the
 * deploy domain is known.
 */
export function securityHeaders(production: boolean): RequestHandler {
  return (_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
    if (production) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  };
}
