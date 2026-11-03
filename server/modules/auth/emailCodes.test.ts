import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { queryOne } from '../../db/db.ts';
import { startTestServer, type TestServer } from '../../test/testServer.ts';
import type { Email, Mailer } from '../email/mailer.ts';
import { AUTH_LIMITS, AuthLimiter } from './auth.limits.ts';
import type { HumanCheck } from './humanCheck.ts';

/** Emailed codes for sign-up and password reset, and the limits that stop OTP bombing (D-084). */

const MINUTE = 60_000;

let t: TestServer;
let sent: Email[] = [];
let now = 0;
/** The fake Turnstile accepts exactly this token. */
const HUMAN = 'human-token';

const mailer: Mailer = {
  async send(email) {
    sent.push(email);
  },
};
const human: HumanCheck = { verify: async (token) => token === HUMAN };

/** The code in the latest email to `to`. */
function codeFor(to: string): string {
  const mail = sent.filter((m) => m.to === to).at(-1);
  const code = mail?.text.match(/\b(\d{6})\b/)?.[1];
  if (!code) throw new Error(`no code sent to ${to}`);
  return code;
}

beforeAll(async () => {
  t = await startTestServer({
    email: { mailer, dailyLimit: 1000 },
    human: { check: human, siteKey: 'site-key' },
    authLimits: new AuthLimiter({ ...AUTH_LIMITS, codeDaily: { max: 1000, windowMs: 24 * 60 * MINUTE } }, () => now),
  });
});
afterAll(() => t.close());
beforeEach(() => {
  sent = [];
  // A fresh hour (and day) for every test, so limits from one don't leak into the next.
  now += 2 * 24 * 60 * MINUTE;
});

const signup = (email: string, extra: Record<string, string> = {}) =>
  t.client()('POST', '/auth/signup', { email, password: 'password-1', captcha: HUMAN, ...extra });

describe('sign-up with an emailed code', () => {
  it('tells the client codes and Turnstile are on', async () => {
    expect((await t.client()('GET', '/auth/me')).json).toMatchObject({ providers: { emailCodes: true, turnstileSiteKey: 'site-key' } });
  });

  it('creates the account only after the right code', async () => {
    const api = t.client();
    const r = await api('POST', '/auth/signup', { email: ' New@Mayor.co ', password: 'password-1', captcha: HUMAN });
    expect(r.status).toBe(202);
    expect(r.json).toEqual({ kind: 'verify', email: 'new@mayor.co' });
    expect(r.setCookie).toBeNull();
    expect(await queryOne(t.db, 'SELECT 1 FROM users WHERE email = $1', ['new@mayor.co'])).toBeNull();
    const code = codeFor('new@mayor.co');
    // Only the hash is stored.
    expect(JSON.stringify(await t.db.query('SELECT * FROM email_codes'))).not.toContain(code);

    const wrong = code === '000000' ? '111111' : '000000';
    const miss = await api('POST', '/auth/signup/verify', { email: 'new@mayor.co', code: wrong });
    expect(miss.status).toBe(400);
    expect(miss.json).toEqual({ error: "That code isn't right. 4 tries left." });

    const ok = await api('POST', '/auth/signup/verify', { email: 'new@mayor.co', code: ` ${code.slice(0, 3)} ${code.slice(3)} ` });
    expect(ok.status).toBe(200);
    expect(ok.json).toMatchObject({ user: { email: 'new@mayor.co' } });
    expect((await api('GET', '/auth/me')).json).toMatchObject({ user: { email: 'new@mayor.co' } });
    // Used up, and the password chosen at step 1 works.
    expect((await t.client()('POST', '/auth/signup/verify', { email: 'new@mayor.co', code })).status).toBe(400);
    expect((await t.client()('POST', '/auth/login', { email: 'new@mayor.co', password: 'password-1' })).status).toBe(200);
  });

  it('kills a code after five wrong guesses', async () => {
    await signup('guess@x.co');
    const code = codeFor('guess@x.co');
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await t.client()('POST', '/auth/signup/verify', { email: 'guess@x.co', code: wrong });
    const late = await t.client()('POST', '/auth/signup/verify', { email: 'guess@x.co', code });
    expect(late.status).toBe(400);
  });

  it('expires codes after ten minutes', async () => {
    await signup('slow@x.co');
    await t.db.query("UPDATE email_codes SET expires_at = now() - interval '1 second' WHERE email = $1", ['slow@x.co']);
    const r = await t.client()('POST', '/auth/signup/verify', { email: 'slow@x.co', code: codeFor('slow@x.co') });
    expect(r.json).toEqual({ error: 'That code has expired. Send a new one.' });
  });

  it('refuses a taken email without sending anything', async () => {
    await t.db.query("INSERT INTO users (email, pass_hash) VALUES ('taken2@x.co', 'x')");
    expect((await signup('taken2@x.co')).status).toBe(409);
    expect(sent).toHaveLength(0);
  });

  it('a new code replaces the old one', async () => {
    await signup('again@x.co');
    const first = codeFor('again@x.co');
    now += 2 * MINUTE;
    expect((await t.client()('POST', '/auth/code/resend', { email: 'again@x.co', purpose: 'signup' })).status).toBe(202);
    const second = codeFor('again@x.co');
    if (first !== second) expect((await t.client()('POST', '/auth/signup/verify', { email: 'again@x.co', code: first })).status).toBe(400);
    expect((await t.client()('POST', '/auth/signup/verify', { email: 'again@x.co', code: second })).status).toBe(200);
  });

  it('a resend needs a sign-up in progress', async () => {
    const r = await t.client()('POST', '/auth/code/resend', { email: 'nobody@x.co', purpose: 'signup' });
    expect(r.status).toBe(400);
    expect(sent).toHaveLength(0);
  });
});

describe('bot defences', () => {
  it('needs the Turnstile token', async () => {
    const r = await t.client()('POST', '/auth/signup', { email: 'bot@x.co', password: 'password-1' });
    expect(r.status).toBe(400);
    expect((await signup('bot@x.co', { captcha: 'forged' })).status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it('answers a filled honeypot as if it worked, and sends nothing', async () => {
    const r = await signup('honey@x.co', { website: 'http://spam.example' });
    expect(r.status).toBe(202);
    expect(r.json).toEqual({ kind: 'verify', email: 'honey@x.co' });
    const f = await t.client()('POST', '/auth/password/forgot', { email: 'honey@x.co', captcha: HUMAN, website: 'x' });
    expect(f.status).toBe(202);
    expect(sent).toHaveLength(0);
  });
});

describe('OTP bombing limits', () => {
  it('waits a minute between two codes to one inbox', async () => {
    await signup('victim1@x.co');
    const again = await t.client()('POST', '/auth/code/resend', { email: 'victim1@x.co', purpose: 'signup' });
    expect(again.status).toBe(429);
    expect(Number(again.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(sent).toHaveLength(1);
  });

  it('sends at most three codes an hour and six a day to one inbox, from any address', async () => {
    await signup('victim2@x.co');
    for (let i = 0; i < 4; i++) {
      now += 2 * MINUTE;
      await t.client()('POST', '/auth/code/resend', { email: 'victim2@x.co', purpose: 'signup' });
    }
    expect(sent).toHaveLength(3);
    for (let i = 0; i < 6; i++) {
      now += 61 * MINUTE;
      await t.client()('POST', '/auth/code/resend', { email: 'victim2@x.co', purpose: 'signup' });
    }
    expect(sent).toHaveLength(6);
    const r = await t.client()('POST', '/auth/code/resend', { email: 'victim2@x.co', purpose: 'signup' });
    expect(r.json).toMatchObject({ error: expect.stringMatching(/hours/) });
  });

  it('limits code emails from one address across many inboxes', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) statuses.push((await signup(`spray${i}@x.co`)).status);
    expect(statuses.filter((s) => s === 202)).toHaveLength(6);
    expect(statuses.at(-1)).toBe(429);
    expect(sent).toHaveLength(6);
  });

  it('stops all code emails once the day’s budget is spent', async () => {
    const tight = await startTestServer({ email: { mailer, dailyLimit: 2 } });
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 3; i++) statuses.push((await tight.client()('POST', '/auth/signup', { email: `budget${i}@x.co`, password: 'password-1' })).status);
      expect(statuses).toEqual([202, 202, 503]);
    } finally {
      await tight.close();
    }
  });
});

describe('forgot password', () => {
  it('answers the same for unknown emails, and sends nothing', async () => {
    const r = await t.client()('POST', '/auth/password/forgot', { email: 'ghost@x.co', captcha: HUMAN });
    expect(r.status).toBe(202);
    expect(r.json).toEqual({ email: 'ghost@x.co' });
    expect(sent).toHaveLength(0);
  });

  it('resets the password by code and signs out every other session', async () => {
    await signup('forgetful2@x.co');
    const old = t.client();
    expect((await old('POST', '/auth/signup/verify', { email: 'forgetful2@x.co', code: codeFor('forgetful2@x.co') })).status).toBe(200);

    // The one-minute pause between two codes to one inbox applies across purposes.
    now += 2 * MINUTE;
    expect((await t.client()('POST', '/auth/password/forgot', { email: 'Forgetful2@x.co', captcha: HUMAN })).status).toBe(202);
    const api = t.client();
    const r = await api('POST', '/auth/password/reset', { email: 'forgetful2@x.co', code: codeFor('forgetful2@x.co'), password: 'brand-new-pass' });
    expect(r.status).toBe(200);
    expect((await api('GET', '/auth/me')).json).toMatchObject({ user: { email: 'forgetful2@x.co' } });
    expect((await old('GET', '/auth/me')).json).toMatchObject({ user: null });
    expect((await t.client()('POST', '/auth/login', { email: 'forgetful2@x.co', password: 'password-1' })).status).toBe(401);
    expect((await t.client()('POST', '/auth/login', { email: 'forgetful2@x.co', password: 'brand-new-pass' })).status).toBe(200);
  });

  it('lets a GitHub-only account set a password', async () => {
    await t.db.query("INSERT INTO users (email, pass_hash) VALUES ('octo@x.co', NULL)");
    await t.client()('POST', '/auth/password/forgot', { email: 'octo@x.co', captcha: HUMAN });
    const r = await t.client()('POST', '/auth/password/reset', { email: 'octo@x.co', code: codeFor('octo@x.co'), password: 'first-password' });
    expect(r.status).toBe(200);
  });

  it('a reset code is not a sign-up code', async () => {
    await t.db.query("INSERT INTO users (email, pass_hash) VALUES ('mixed@x.co', NULL)");
    await t.client()('POST', '/auth/password/forgot', { email: 'mixed@x.co', captcha: HUMAN });
    expect((await t.client()('POST', '/auth/signup/verify', { email: 'mixed@x.co', code: codeFor('mixed@x.co') })).status).toBe(400);
  });
});

describe('without a mailer', () => {
  it('signs up at once and has no code endpoints', async () => {
    const plain = await startTestServer();
    try {
      expect((await plain.client()('GET', '/auth/me')).json).toMatchObject({ providers: { emailCodes: false, turnstileSiteKey: null } });
      const r = await plain.client()('POST', '/auth/signup', { email: 'now@x.co', password: 'password-1' });
      expect(r.json).toMatchObject({ kind: 'user', user: { email: 'now@x.co' } });
      expect((await plain.client()('POST', '/auth/password/forgot', { email: 'now@x.co' })).status).toBe(404);
    } finally {
      await plain.close();
    }
  });
});
