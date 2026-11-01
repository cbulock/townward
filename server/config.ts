import { z } from 'zod';

/** Server settings from the environment, validated once at startup. */

const Env = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),
  /** Matches docker-compose.yml for local development. */
  DATABASE_URL: z.string().default('postgres://citybuilder:citybuilder@localhost:5432/citybuilder'),
});

export interface Config {
  readonly production: boolean;
  readonly port: number;
  readonly databaseUrl: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const e = Env.parse(env);
  return { production: e.NODE_ENV === 'production', port: e.PORT, databaseUrl: e.DATABASE_URL };
}
