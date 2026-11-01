import { z } from 'zod';

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
});

export type TrustProxy = boolean | number | string;

export interface Config {
  readonly production: boolean;
  readonly port: number;
  readonly databaseUrl: string;
  readonly trustProxy: TrustProxy;
}

function parseTrustProxy(v: string): TrustProxy {
  if (v === 'true') return true;
  if (v === 'false') return false;
  return /^\d+$/.test(v) ? Number(v) : v;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const e = Env.parse(env);
  return { production: e.NODE_ENV === 'production', port: e.PORT, databaseUrl: e.DATABASE_URL, trustProxy: parseTrustProxy(e.TRUST_PROXY) };
}
