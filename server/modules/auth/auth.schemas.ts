import { z } from 'zod';
import { API_LIMITS } from '../../../src/shared/api.ts';

export const Credentials = z.object({
  // Trim first: pasted emails often carry a stray space.
  email: z.string().trim().pipe(z.email('Enter a valid email address').max(254)),
  password: z
    .string()
    .min(API_LIMITS.passwordMin, `Password needs at least ${API_LIMITS.passwordMin} characters`)
    .max(API_LIMITS.passwordMax, 'Password is too long'),
});
