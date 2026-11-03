import { Router, type Response } from 'express';
import type { AuthProviders, AuthResponse, CodeSentResponse, MeResponse, SignupResponse } from '../../../src/shared/api.ts';
import { badRequest, HttpError, notFound } from '../../http/errors.ts';
import { currentUser, readCookie, SESSION_COOKIE, sessionCookieOptions } from '../../http/middleware.ts';
import { checkLimits } from '../../http/rateLimit.ts';
import { parse } from '../../http/validate.ts';
import { accountKey, addressOf, ALL, AuthLimiter } from './auth.limits.ts';
import { Credentials, ForgotForm, ResendForm, ResetForm, SignupForm, VerifyForm } from './auth.schemas.ts';
import { normalizeEmail, SESSION_DAYS, type AuthService, type Session } from './auth.service.ts';
import { noHumanCheck, type HumanCheck } from './humanCheck.ts';

export interface AuthRouteOptions {
  readonly secureCookies: boolean;
  readonly limits?: AuthLimiter;
  /** Sign-in methods besides email, for /me (email codes are read from the service). */
  readonly github?: boolean;
  /** Bot check for forms that send email, and the site key the browser needs for it. */
  readonly human?: { readonly check: HumanCheck; readonly siteKey: string };
}

/**
 * /api/auth: signup, login, logout, me; with email codes on (D-084) also signup/verify,
 * password/forgot, password/reset and code/resend.
 */
export function authRoutes(auth: AuthService, opts: AuthRouteOptions): Router {
  const router = Router();
  const cookie = sessionCookieOptions(opts.secureCookies);
  const limits = opts.limits ?? new AuthLimiter();
  const human = opts.human?.check ?? noHumanCheck;
  const providers: AuthProviders = {
    github: !!opts.github,
    emailCodes: auth.emailCodes,
    turnstileSiteKey: opts.human?.siteKey ?? null,
  };

  const startSession = (res: Response, session: Session) => {
    res.cookie(SESSION_COOKIE, session.token, { ...cookie, maxAge: SESSION_DAYS * 86_400_000 });
  };
  const signedIn = (res: Response, session: Session) => {
    startSession(res, session);
    const body: AuthResponse = { user: session.user };
    res.json(body);
  };
  const codeSent = (res: Response, email: string) => {
    const body: CodeSentResponse = { email };
    res.status(202).json(body);
  };
  const needCodes = () => {
    if (!auth.emailCodes) throw notFound();
  };
  const requireHuman = async (token: string | undefined, address: string) => {
    if (!(await human.verify(token, address))) throw badRequest('Please confirm you’re not a robot, then try again.');
  };

  /** Every limit on sending a code to `email` for `address`; throws 429 (or 503 when the day's budget is gone). */
  const checkSend = (res: Response, address: string, email: string) => {
    if (limits.codeDaily.retryAfter(ALL) > 0) throw new HttpError(503, 'We’ve sent too many emails today. Please try again tomorrow, or sign in with GitHub.');
    checkLimits(res, [
      [limits.codeCooldown, email],
      [limits.codePerEmail, email],
      [limits.codePerEmailDay, email],
      [limits.codePerAddress, address],
    ]);
    // Counted before sending, so a burst of parallel requests can't slip past the checks.
    limits.codeCooldown.fail(email);
    limits.codePerEmail.fail(email);
    limits.codePerEmailDay.fail(email);
    limits.codePerAddress.fail(address);
  };
  /** Run a code check, counting a wrong code against the address. */
  const withCode = async (address: string, run: () => Promise<Session>): Promise<Session> => {
    try {
      return await run();
    } catch (err) {
      if (err instanceof HttpError && err.status === 400) limits.wrongCodes.fail(address);
      throw err;
    }
  };

  router.post('/signup', async (req, res) => {
    // Invalid input is answered before counting: typos in the form never use up attempts.
    const { email, password, captcha, website } = parse(SignupForm, req.body);
    const address = addressOf(req);
    checkLimits(res, [[limits.signup, address]]);
    limits.signup.fail(address);
    if (!auth.emailCodes) {
      const session = await auth.signup(email, password);
      startSession(res, session);
      const body: SignupResponse = { kind: 'user', user: session.user };
      res.json(body);
      return;
    }
    const to = normalizeEmail(email);
    const pending: SignupResponse = { kind: 'verify', email: to };
    // Bots fill in every field; people never see this one. Answer as if it worked and send nothing.
    if (website) {
      res.status(202).json(pending);
      return;
    }
    await requireHuman(captcha, address);
    checkSend(res, address, to);
    await auth.startSignup(to, password);
    limits.codeDaily.fail(ALL);
    res.status(202).json(pending);
  });

  router.post('/signup/verify', async (req, res) => {
    needCodes();
    const { email, code } = parse(VerifyForm, req.body);
    const address = addressOf(req);
    checkLimits(res, [[limits.wrongCodes, address]]);
    signedIn(res, await withCode(address, () => auth.finishSignup(email, code)));
  });

  router.post('/password/forgot', async (req, res) => {
    needCodes();
    const { email, captcha, website } = parse(ForgotForm, req.body);
    const address = addressOf(req);
    const to = normalizeEmail(email);
    if (!website) {
      await requireHuman(captcha, address);
      checkSend(res, address, to);
      if (await auth.startReset(to)) limits.codeDaily.fail(ALL);
    }
    // The same answer whether or not the account exists.
    codeSent(res, to);
  });

  router.post('/password/reset', async (req, res) => {
    needCodes();
    const { email, code, password } = parse(ResetForm, req.body);
    const address = addressOf(req);
    checkLimits(res, [[limits.wrongCodes, address]]);
    const session = await withCode(address, () => auth.resetPassword(email, code, password));
    limits.perAccount.clear(accountKey(address, email));
    signedIn(res, session);
  });

  router.post('/code/resend', async (req, res) => {
    needCodes();
    const { email, purpose } = parse(ResendForm, req.body);
    const address = addressOf(req);
    const to = normalizeEmail(email);
    checkSend(res, address, to);
    if (await auth.resendCode(purpose, to)) limits.codeDaily.fail(ALL);
    // A reset says nothing about whether the account exists; a sign-up can simply start over.
    else if (purpose === 'signup') throw badRequest('That sign-up has expired. Please start again.');
    codeSent(res, to);
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
    const body: MeResponse = { user: currentUser(res), providers };
    res.json(body);
  });

  return router;
}
