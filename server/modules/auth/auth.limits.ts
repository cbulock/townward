import type { Request } from 'express';
import { RateLimiter, type LimitRule } from '../../http/rateLimit.ts';

/**
 * Brute-force protection for /api/auth (D-073). Only failures count, so normal play never meets
 * a limit: a wrong password counts against that email from that address and, more loosely,
 * against the address; a successful login clears its email's count. Signup attempts are
 * counted per address, generously, to stop scripted account creation.
 */
export interface AuthLimitRules {
  /** Wrong passwords for one email from one address. */
  readonly perAccount: LimitRule;
  /** Wrong passwords from one address across all emails (password spraying). */
  readonly perAddress: LimitRule;
  /** Signup attempts from one address. */
  readonly signup: LimitRule;
}

const MINUTE = 60_000;

export const AUTH_LIMITS: AuthLimitRules = {
  perAccount: { max: 8, windowMs: 15 * MINUTE },
  perAddress: { max: 60, windowMs: 15 * MINUTE },
  signup: { max: 20, windowMs: 60 * MINUTE },
};

export class AuthLimiter {
  readonly perAccount: RateLimiter;
  readonly perAddress: RateLimiter;
  readonly signup: RateLimiter;

  constructor(rules: AuthLimitRules = AUTH_LIMITS, now?: () => number) {
    this.perAccount = new RateLimiter(rules.perAccount, now);
    this.perAddress = new RateLimiter(rules.perAddress, now);
    this.signup = new RateLimiter(rules.signup, now);
  }
}

/** The client's address (behind a proxy, Express reads it from X-Forwarded-For per `trust proxy`). */
export const addressOf = (req: Request) => req.ip ?? 'unknown';

/** Key for one email from one address. */
export const accountKey = (address: string, email: string) => `${address}|${email.trim().toLowerCase()}`;
