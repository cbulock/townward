import { Router, type Response } from 'express';
import type { AuthResponse, MeResponse } from '../../../src/shared/api.ts';
import { HttpError } from '../../http/errors.ts';
import { currentUser, readCookie, SESSION_COOKIE, sessionCookieOptions } from '../../http/middleware.ts';
import { checkLimits } from '../../http/rateLimit.ts';
import { parse } from '../../http/validate.ts';
import { accountKey, addressOf, AuthLimiter } from './auth.limits.ts';
import { Credentials } from './auth.schemas.ts';
import { SESSION_DAYS, type AuthService, type Session } from './auth.service.ts';

/** /api/auth: signup, login, logout, me. */
export function authRoutes(auth: AuthService, secureCookies: boolean, limits = new AuthLimiter()): Router {
  const router = Router();
  const cookie = sessionCookieOptions(secureCookies);

  const signedIn = (res: Response, session: Session) => {
    res.cookie(SESSION_COOKIE, session.token, { ...cookie, maxAge: SESSION_DAYS * 86_400_000 });
    const body: AuthResponse = { user: session.user };
    res.json(body);
  };

  router.post('/signup', async (req, res) => {
    // Invalid input is answered before counting: typos in the form never use up attempts.
    const { email, password } = parse(Credentials, req.body);
    const address = addressOf(req);
    checkLimits(res, [[limits.signup, address]]);
    limits.signup.fail(address);
    signedIn(res, await auth.signup(email, password));
  });

  router.post('/login', async (req, res) => {
    const { email, password } = parse(Credentials, req.body);
    const address = addressOf(req);
    const account = accountKey(address, email);
    checkLimits(res, [
      [limits.perAccount, account],
      [limits.perAddress, address],
    ]);
    let session: Session;
    try {
      session = await auth.login(email, password);
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) {
        limits.perAccount.fail(account);
        limits.perAddress.fail(address);
      }
      throw err;
    }
    limits.perAccount.clear(account);
    signedIn(res, session);
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
