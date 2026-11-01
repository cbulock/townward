import { Router, type Response } from 'express';
import type { AuthResponse, MeResponse } from '../../../src/shared/api.ts';
import { currentUser, rateLimit, readCookie, SESSION_COOKIE, sessionCookieOptions } from '../../http/middleware.ts';
import { parse } from '../../http/validate.ts';
import { Credentials } from './auth.schemas.ts';
import { SESSION_DAYS, type AuthService, type Session } from './auth.service.ts';

/** /api/auth: signup, login, logout, me. */
export function authRoutes(auth: AuthService, secureCookies: boolean): Router {
  const router = Router();
  const cookie = sessionCookieOptions(secureCookies);
  const limit = rateLimit(10, 15 * 60_000);

  const signedIn = (res: Response, session: Session) => {
    res.cookie(SESSION_COOKIE, session.token, { ...cookie, maxAge: SESSION_DAYS * 86_400_000 });
    const body: AuthResponse = { user: session.user };
    res.json(body);
  };

  router.post('/signup', limit, async (req, res) => {
    const { email, password } = parse(Credentials, req.body);
    signedIn(res, await auth.signup(email, password));
  });

  router.post('/login', limit, async (req, res) => {
    const { email, password } = parse(Credentials, req.body);
    signedIn(res, await auth.login(email, password));
  });

  router.post('/logout', async (req, res) => {
    const token = readCookie(req, SESSION_COOKIE);
    if (token) await auth.logout(token);
    res.clearCookie(SESSION_COOKIE, cookie);
    res.status(204).end();
  });

  router.get('/me', (_req, res) => {
    const body: MeResponse = { user: currentUser(res) };
    res.json(body);
  });

  return router;
}
