import { createHash, randomBytes } from 'node:crypto';
import type { ApiUser } from '../../../src/shared/api.ts';
import { queryOne, type Db } from '../../db/db.ts';
import { conflict, unauthorized } from '../../http/errors.ts';
import { DUMMY_HASH, hashPassword, verifyPassword } from './password.ts';

/** Accounts and sessions (docs/specs/saving.md, "Server"). */

export const SESSION_DAYS = 30;

export interface Session {
  readonly user: ApiUser;
  /** Goes in the cookie; only its SHA-256 is stored. */
  readonly token: string;
}

const sha256 = (token: string) => createHash('sha256').update(token).digest('hex');
const normalizeEmail = (email: string) => email.trim().toLowerCase();

export class AuthService {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /** Create an account and sign it in. 409 if the email is taken. */
  async signup(email: string, password: string): Promise<Session> {
    const hash = await hashPassword(password);
    const row = await queryOne<ApiUser>(
      this.db,
      'INSERT INTO users (email, pass_hash) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING RETURNING id, email',
      [normalizeEmail(email), hash],
    );
    if (!row) throw conflict('An account with this email already exists. Log in instead.');
    return this.startSession(row);
  }

  /** 401 for an unknown email or a wrong password (the same message for both). */
  async login(email: string, password: string): Promise<Session> {
    const row = await queryOne<ApiUser & { pass_hash: string }>(this.db, 'SELECT id, email, pass_hash FROM users WHERE email = $1', [
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

  async logout(token: string): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
  }

  private async startSession(user: ApiUser): Promise<Session> {
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
