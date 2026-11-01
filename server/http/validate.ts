import type { z } from 'zod';
import { badRequest } from './errors.ts';

/** Parse untrusted input with a schema, or throw a 400 carrying the first problem. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw badRequest(result.error.issues[0]?.message ?? 'Invalid request');
  return result.data;
}
