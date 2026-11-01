import type { Response } from 'express';
import { tooManyRequests } from './errors.ts';

/**
 * Attempt counting for login and signup (D-073). A limiter counts *failures* per key in a fixed
 * window; `check` throws 429 once a key has used its budget. Success can `clear` a key, so a
 * player who logs in normally never gets near a limit. In memory: right for one server process;
 * a multi-instance deploy would move these counters to Postgres or Redis.
 */

export interface LimitRule {
  /** Failures allowed per window. */
  readonly max: number;
  readonly windowMs: number;
}

interface Bucket {
  count: number;
  reset: number;
}

/** Cap on tracked keys; expired buckets are swept before the map grows past it. */
const MAX_KEYS = 50_000;

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  readonly rule: LimitRule;
  private readonly now: () => number;

  constructor(rule: LimitRule, now: () => number = Date.now) {
    this.rule = rule;
    this.now = now;
  }

  /** Seconds until `key` may try again, or 0 if it's under its limit. */
  retryAfter(key: string): number {
    const b = this.buckets.get(key);
    const t = this.now();
    if (!b || b.reset <= t || b.count < this.rule.max) return 0;
    return Math.ceil((b.reset - t) / 1000);
  }

  /** Count one failure for `key`. */
  fail(key: string) {
    const t = this.now();
    const b = this.buckets.get(key);
    if (!b || b.reset <= t) {
      if (this.buckets.size >= MAX_KEYS) this.sweep(t);
      this.buckets.set(key, { count: 1, reset: t + this.rule.windowMs });
    } else {
      b.count++;
    }
  }

  clear(key: string) {
    this.buckets.delete(key);
  }

  private sweep(t: number) {
    for (const [k, b] of this.buckets) if (b.reset <= t) this.buckets.delete(k);
    // Still full (a flood of distinct keys): drop the oldest entries rather than grow without bound.
    if (this.buckets.size >= MAX_KEYS) {
      let n = this.buckets.size - MAX_KEYS / 2;
      for (const k of this.buckets.keys()) {
        if (n-- <= 0) break;
        this.buckets.delete(k);
      }
    }
  }
}

/** Throw 429 if any of the (limiter, key) pairs is over its limit. */
export function checkLimits(res: Response, pairs: readonly (readonly [RateLimiter, string])[]) {
  const wait = Math.max(0, ...pairs.map(([l, k]) => l.retryAfter(k)));
  if (wait > 0) {
    res.set('Retry-After', String(wait));
    throw tooManyRequests(wait);
  }
}
