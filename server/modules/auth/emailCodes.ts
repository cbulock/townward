import { createHash, randomInt } from 'node:crypto';
import { API_LIMITS, type CodePurpose } from '../../../src/shared/api.ts';
import { queryOne, type Db } from '../../db/db.ts';
import { badRequest } from '../../http/errors.ts';
import type { Email } from '../email/mailer.ts';

/**
 * One-time codes sent by email (D-084): one live code per email and purpose. Only a hash is
 * stored, a code dies after `CODE_TRIES` wrong guesses or `CODE_MINUTES`, and using it deletes it.
 * A sign-up row also holds the chosen password's hash until the code is confirmed.
 */

export const CODE_MINUTES = 10;
export const CODE_TRIES = 5;

const hashCode = (purpose: CodePurpose, email: string, code: string) => createHash('sha256').update(`${purpose}:${email}:${code}`).digest('hex');
const newCode = () => String(randomInt(0, 10 ** API_LIMITS.codeLength)).padStart(API_LIMITS.codeLength, '0');

export class EmailCodes {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /** A fresh code for `email`, replacing any earlier one. */
  async issue(purpose: CodePurpose, email: string, passHash: string | null): Promise<string> {
    const code = newCode();
    await this.db.query(
      `INSERT INTO email_codes (email, purpose, code_hash, pass_hash, expires_at)
       VALUES ($1, $2, $3, $4, now() + make_interval(mins => $5))
       ON CONFLICT (email, purpose) DO UPDATE
         SET code_hash = EXCLUDED.code_hash, pass_hash = EXCLUDED.pass_hash, attempts = 0, expires_at = EXCLUDED.expires_at`,
      [email, purpose, hashCode(purpose, email, code), passHash, CODE_MINUTES],
    );
    return code;
  }

  /** A new code for a request already started (resend), or null if there is none. */
  async reissue(purpose: CodePurpose, email: string): Promise<string | null> {
    const code = newCode();
    const row = await queryOne<{ email: string }>(
      this.db,
      `UPDATE email_codes SET code_hash = $3, attempts = 0, expires_at = now() + make_interval(mins => $4)
       WHERE email = $1 AND purpose = $2 RETURNING email`,
      [email, purpose, hashCode(purpose, email, code), CODE_MINUTES],
    );
    return row ? code : null;
  }

  /** Use up a correct code and return what was stored with it; 400 with a reason otherwise. */
  async consume(purpose: CodePurpose, email: string, code: string): Promise<{ passHash: string | null }> {
    // Matching and deleting in one statement: two requests can't both use one code.
    const used = await queryOne<{ pass_hash: string | null }>(
      this.db,
      `DELETE FROM email_codes WHERE email = $1 AND purpose = $2 AND code_hash = $3 AND expires_at > now() AND attempts < $4
       RETURNING pass_hash`,
      [email, purpose, hashCode(purpose, email, code), CODE_TRIES],
    );
    if (used) return { passHash: used.pass_hash };
    const missed = await queryOne<{ attempts: number; live: boolean }>(
      this.db,
      'UPDATE email_codes SET attempts = attempts + 1 WHERE email = $1 AND purpose = $2 RETURNING attempts, expires_at > now() AS live',
      [email, purpose],
    );
    if (!missed || !missed.live) throw badRequest('That code has expired. Send a new one.');
    const left = CODE_TRIES - missed.attempts;
    if (left <= 0) throw badRequest('Too many wrong codes. Send a new one.');
    throw badRequest(`That code isn't right. ${left} ${left === 1 ? 'try' : 'tries'} left.`);
  }

  /** Forget requests nobody finished (run hourly). */
  async prune(): Promise<void> {
    await this.db.query("DELETE FROM email_codes WHERE expires_at <= now() - interval '1 day'");
  }
}

/** The email that carries a code. Codes are digits only, so they need no escaping. */
export function codeEmail(purpose: CodePurpose, to: string, code: string): Email {
  const what = purpose === 'signup' ? 'confirm your email for Openpolis' : 'reset your Openpolis password';
  const ignore =
    purpose === 'signup'
      ? "If you didn't sign up, ignore this email: no account is made without the code."
      : "If you didn't ask, ignore this email: your password stays the same.";
  return {
    to,
    subject: `${code} is your Openpolis code`,
    text: `Use ${code} to ${what}. It expires in ${CODE_MINUTES} minutes.\n\n${ignore}`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#1c2430">
<p style="margin:0 0 16px">Use this code to ${what}:</p>
<p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:8px">${code}</p>
<p style="margin:0 0 16px;color:#5b6676">It expires in ${CODE_MINUTES} minutes.</p>
<p style="margin:0;color:#5b6676;font-size:13px">${ignore}</p>
</div>`,
  };
}
