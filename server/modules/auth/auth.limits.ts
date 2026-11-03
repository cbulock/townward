import type { Request } from 'express';
import { RateLimiter, type LimitRule } from '../../http/rateLimit.ts';

/**
 * Brute-force protection for /api/auth (D-073). Only failures count, so normal play never meets
 * a limit: a wrong password counts against that email from that address and, more loosely,
 * against the address; a successful login clears its email's count. Signup attempts are
 * counted per address, generously, to stop scripted account creation.
 *
 * Emailed codes (D-084) are strict, since each one lands in someone's inbox and spends our
 * provider quota: every email sent counts, per recipient (a cooldown, an hourly and a daily cap,
 * so nobody can be "OTP bombed"), per address, and across the whole server per day.
 */
export interface AuthLimitRules {
  /** Wrong passwords for one email from one address. */
  readonly perAccount: LimitRule;
  /** Wrong passwords from one address across all emails (password spraying). */
  readonly perAddress: LimitRule;
  /** Signup attempts from one address. */
  readonly signup: LimitRule;
  /** Code emails to one recipient: a pause between two… */
  readonly codeCooldown: LimitRule;
  /** …at most this many an hour… */
  readonly codePerEmail: LimitRule;
  /** …and this many a day. */
  readonly codePerEmailDay: LimitRule;
  /** Code emails requested from one address, to any recipients. */
  readonly codePerAddress: LimitRule;
  /** Code emails from the whole server per day (keeps the provider's free quota for real players). */
  readonly codeDaily: LimitRule;
  /** Wrong codes from one address, across emails. */
  readonly wrongCodes: LimitRule;
}

const MINUTE = 60_000;
export const DAY = 24 * 60 * MINUTE;

export const AUTH_LIMITS: AuthLimitRules = {
  perAccount: { max: 8, windowMs: 15 * MINUTE },
  perAddress: { max: 60, windowMs: 15 * MINUTE },
  signup: { max: 20, windowMs: 60 * MINUTE },
  codeCooldown: { max: 1, windowMs: MINUTE },
  codePerEmail: { max: 3, windowMs: 60 * MINUTE },
  codePerEmailDay: { max: 6, windowMs: DAY },
  codePerAddress: { max: 6, windowMs: 60 * MINUTE },
  codeDaily: { max: 250, windowMs: DAY },
  wrongCodes: { max: 20, windowMs: 60 * MINUTE },
};

/** Key for the server-wide daily email budget. */
export const ALL = '*';

export class AuthLimiter {
  readonly perAccount: RateLimiter;
  readonly perAddress: RateLimiter;
  readonly signup: RateLimiter;
  readonly codeCooldown: RateLimiter;
  readonly codePerEmail: RateLimiter;
  readonly codePerEmailDay: RateLimiter;
  readonly codePerAddress: RateLimiter;
  readonly codeDaily: RateLimiter;
  readonly wrongCodes: RateLimiter;

  constructor(rules: AuthLimitRules = AUTH_LIMITS, now?: () => number) {
    this.perAccount = new RateLimiter(rules.perAccount, now);
    this.perAddress = new RateLimiter(rules.perAddress, now);
    this.signup = new RateLimiter(rules.signup, now);
    this.codeCooldown = new RateLimiter(rules.codeCooldown, now);
    this.codePerEmail = new RateLimiter(rules.codePerEmail, now);
    this.codePerEmailDay = new RateLimiter(rules.codePerEmailDay, now);
    this.codePerAddress = new RateLimiter(rules.codePerAddress, now);
    this.codeDaily = new RateLimiter(rules.codeDaily, now);
    this.wrongCodes = new RateLimiter(rules.wrongCodes, now);
  }
}

/** The client's address (behind a proxy, Express reads it from X-Forwarded-For per `trust proxy`). */
export const addressOf = (req: Request) => req.ip ?? 'unknown';

/** Key for one email from one address. */
export const accountKey = (address: string, email: string) => `${address}|${email.trim().toLowerCase()}`;
