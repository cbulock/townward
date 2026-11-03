import { z } from 'zod';
import type { GuestRules } from './modules/guests/guests.service.ts';

/** Server settings from the environment, validated once at startup (docs/deploy.md). */

const Env = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),
  /** Matches docker-compose.yml for local development. */
  DATABASE_URL: z.string().default('postgres://citybuilder:citybuilder@localhost:5432/citybuilder'),
  /**
   * Which proxies to trust for the client address (Express `trust proxy`): `loopback` when run
   * directly, a hop count such as `1` behind one load balancer, or a list of addresses. Wrong
   * here means every player shares the proxy's address for rate limits.
   */
  TRUST_PROXY: z.string().default('loopback'),
  /** Public address of the site, for OAuth callbacks, e.g. https://openpolis.space. */
  PUBLIC_URL: z.url().optional(),
  /** GitHub OAuth app (docs/deploy.md). Sign-in with GitHub is off unless both are set. */
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  /** Brevo transactional email (docs/deploy.md). Codes for sign-up and password reset are off unless both are set. */
  BREVO_API_KEY: z.string().optional(),
  /** Sender address, verified in Brevo, e.g. noreply@openpolis.space. */
  MAIL_FROM: z.email().optional(),
  MAIL_FROM_NAME: z.string().default('Openpolis'),
  /** Most code emails the server sends per day (Brevo's free plan allows 300). */
  MAIL_DAILY_LIMIT: z.coerce.number().int().positive().default(250),
  /** Cloudflare Turnstile bot check on forms that send email; off unless both are set. */
  TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  /** Key for guest fingerprints (D-083). Required in production; any long random string. */
  GUEST_SECRET: z.string().min(32).optional(),
  /** Guest trial: a reminder after this many minutes of play, a sign-in wall after the limit. */
  GUEST_NUDGE_MINUTES: z.coerce.number().positive().default(10),
  GUEST_LIMIT_MINUTES: z.coerce.number().positive().default(30),
});

/** Development and tests only. */
export const DEV_GUEST_SECRET = 'development-guest-secret-not-for-production';

export type TrustProxy = boolean | number | string;

export interface Config {
  readonly production: boolean;
  readonly port: number;
  readonly databaseUrl: string;
  readonly trustProxy: TrustProxy;
  /** GitHub sign-in, when configured. */
  readonly github: GithubConfig | null;
  /** Brevo, when configured. */
  readonly email: EmailConfig | null;
  /** Most code emails per day, whichever mailer is used. */
  readonly mailDailyLimit: number;
  /** Cloudflare Turnstile, when configured. */
  readonly turnstile: TurnstileConfig | null;
  readonly guests: GuestRules;
}

export interface GithubConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  /** Site origin the callback lives under (no trailing slash). */
  readonly publicUrl: string;
}

export interface EmailConfig {
  readonly apiKey: string;
  readonly fromEmail: string;
  readonly fromName: string;
}

export interface TurnstileConfig {
  readonly siteKey: string;
  readonly secretKey: string;
}

function parseTrustProxy(v: string): TrustProxy {
  if (v === 'true') return true;
  if (v === 'false') return false;
  return /^\d+$/.test(v) ? Number(v) : v;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // Compose passes unset variables as empty strings: treat those as absent.
  const e = Env.parse(Object.fromEntries(Object.entries(env).filter(([, v]) => v !== '')));
  const github =
    e.GITHUB_CLIENT_ID && e.GITHUB_CLIENT_SECRET
      ? {
          clientId: e.GITHUB_CLIENT_ID,
          clientSecret: e.GITHUB_CLIENT_SECRET,
          publicUrl: (e.PUBLIC_URL ?? `http://localhost:${e.PORT}`).replace(/\/+$/, ''),
        }
      : null;
  const production = e.NODE_ENV === 'production';
  // A known secret would let anyone recompute fingerprints, so production refuses to start without one.
  if (production && !e.GUEST_SECRET) throw new Error('GUEST_SECRET is required in production (32+ random characters, e.g. `openssl rand -base64 48`)');
  const guests: GuestRules = {
    secret: e.GUEST_SECRET ?? DEV_GUEST_SECRET,
    nudgeMinutes: e.GUEST_NUDGE_MINUTES,
    limitMinutes: e.GUEST_LIMIT_MINUTES,
  };
  const email = e.BREVO_API_KEY && e.MAIL_FROM ? { apiKey: e.BREVO_API_KEY, fromEmail: e.MAIL_FROM, fromName: e.MAIL_FROM_NAME } : null;
  const turnstile = e.TURNSTILE_SITE_KEY && e.TURNSTILE_SECRET_KEY ? { siteKey: e.TURNSTILE_SITE_KEY, secretKey: e.TURNSTILE_SECRET_KEY } : null;
  return {
    production,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    trustProxy: parseTrustProxy(e.TRUST_PROXY),
    github,
    email,
    mailDailyLimit: e.MAIL_DAILY_LIMIT,
    turnstile,
    guests,
  };
}
