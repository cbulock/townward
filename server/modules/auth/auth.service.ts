import { createHash, randomBytes } from 'node:crypto';
import type { ApiUser, CodePurpose } from '../../../src/shared/api.ts';
import { queryOne, type Db } from '../../db/db.ts';
import { conflict, unauthorized } from '../../http/errors.ts';
import type { Email, Mailer } from '../email/mailer.ts';
import { codeEmail, EmailCodes } from './emailCodes.ts';
import { DUMMY_HASH, hashPassword, verifyPassword } from './password.ts';

/**
 * Accounts and sessions (docs/specs/saving.md, "Server"). With a mailer, sign-up confirms the
 * email with a code before the account exists, and a forgotten password is reset by code (D-084).
 */

export const SESSION_DAYS = 30;

export interface Session {
  readonly user: ApiUser;
  /** Goes in the cookie; only its SHA-256 is stored. */
  readonly token: string;
}

const sha256 = (token: string) => createHash('sha256').update(token).digest('hex');
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const TAKEN = 'An account with this email already exists. Log in instead.';

export class AuthService {
  private readonly db: Db;
  private readonly mailer: Mailer | null;
  private readonly codes: EmailCodes;

  constructor(db: Db, mailer: Mailer | null = null) {
    this.db = db;
    this.mailer = mailer;
    this.codes = new EmailCodes(db);
  }

  /** Sign-up needs an emailed code, and password reset is available. */
  get emailCodes(): boolean {
    return this.mailer !== null;
  }

  /** Create an account and sign it in. 409 if the email is taken. */
  async signup(email: string, password: string): Promise<Session> {
    const hash = await hashPassword(password);
    const row = await queryOne<ApiUser>(
      this.db,
      'INSERT INTO users (email, pass_hash) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING RETURNING id, email',
      [normalizeEmail(email), hash],
    );
    if (!row) throw conflict(TAKEN);
    return this.startSession(row);
  }

  /** Sign-up with email codes, step 1: hold the account and email a code. 409 if the email is taken. */
  async startSignup(email: string, password: string): Promise<void> {
    const to = normalizeEmail(email);
    if (await queryOne(this.db, 'SELECT 1 FROM users WHERE email = $1', [to])) throw conflict(TAKEN);
    const code = await this.codes.issue('signup', to, await hashPassword(password));
    await this.send(codeEmail('signup', to, code));
  }

  /** Step 2: the right code creates the account and signs it in. */
  async finishSignup(email: string, code: string): Promise<Session> {
    const to = normalizeEmail(email);
    const { passHash } = await this.codes.consume('signup', to, code);
    const row = await queryOne<ApiUser>(
      this.db,
      'INSERT INTO users (email, pass_hash) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING RETURNING id, email',
      [to, passHash],
    );
    // Taken meanwhile (by GitHub sign-in with the same verified email).
    if (!row) throw conflict(TAKEN);
    return this.startSession(row);
  }

  /**
   * Email a reset code if the account exists. Returns whether an email went out; the caller
   * answers the same either way, so the form can't be used to discover who has an account.
   */
  async startReset(email: string): Promise<boolean> {
    const to = normalizeEmail(email);
    if (!(await queryOne(this.db, 'SELECT 1 FROM users WHERE email = $1', [to]))) return false;
    await this.send(codeEmail('reset', to, await this.codes.issue('reset', to, null)));
    return true;
  }

  /** The right code sets a new password, signs out every other session, and signs in here. */
  async resetPassword(email: string, code: string, password: string): Promise<Session> {
    const to = normalizeEmail(email);
    await this.codes.consume('reset', to, code);
    const user = await queryOne<ApiUser>(this.db, 'UPDATE users SET pass_hash = $2 WHERE email = $1 RETURNING id, email', [
      to,
      await hashPassword(password),
    ]);
    if (!user) throw unauthorized('That account no longer exists');
    await this.db.query('DELETE FROM sessions WHERE user_id = $1', [user.id]);
    return this.startSession(user);
  }

  /** Send a new code for a sign-up or reset already started. Returns whether an email went out. */
  async resendCode(purpose: CodePurpose, email: string): Promise<boolean> {
    const to = normalizeEmail(email);
    const code = await this.codes.reissue(purpose, to);
    if (!code) return false;
    await this.send(codeEmail(purpose, to, code));
    return true;
  }

  private async send(email: Email): Promise<void> {
    if (!this.mailer) throw new Error('email codes are off (no mailer)');
    await this.mailer.send(email);
  }

  /** 401 for an unknown email or a wrong password (the same message for both). */
  async login(email: string, password: string): Promise<Session> {
    const row = await queryOne<ApiUser & { pass_hash: string | null }>(this.db, 'SELECT id, email, pass_hash FROM users WHERE email = $1', [
      normalizeEmail(email),
    ]);
    const ok = await verifyPassword(password, row?.pass_hash ?? DUMMY_HASH);
    if (!row || !ok) throw unauthorized('Wrong email or password');
    return this.startSession({ id: row.id, email: row.email });
  }

  async userForToken(token: string): Promise<ApiUser | null> {
    return queryOne<ApiUser>(
      this.db,
      'SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()',
      [sha256(token)],
    );
  }

  /** Delete every expired session and stale email code (run now and then; logins also tidy their own). */
  async pruneSessions(): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE expires_at <= now()');
    await this.codes.prune();
  }

  async logout(token: string): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
  }

  /** Sign in a known user (password login, signup, or an OAuth provider). */
  async startSession(user: ApiUser): Promise<Session> {
    const token = randomBytes(32).toString('base64url');
    await this.db.query('DELETE FROM sessions WHERE user_id = $1 AND expires_at <= now()', [user.id]);
    await this.db.query(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))`, [
      sha256(token),
      user.id,
      SESSION_DAYS,
    ]);
    return { user, token };
  }
}
