import { z } from 'zod';
import { API_LIMITS } from '../../../src/shared/api.ts';

// Trim first: pasted emails often carry a stray space.
const Email = z.string().trim().pipe(z.email('Enter a valid email address').max(254));
const Password = z
  .string()
  .min(API_LIMITS.passwordMin, `Password needs at least ${API_LIMITS.passwordMin} characters`)
  .max(API_LIMITS.passwordMax, 'Password is too long');
// Spaces from a copied code are forgiven.
const Code = z
  .string()
  .transform((s) => s.replace(/\s+/g, ''))
  .pipe(z.string().regex(new RegExp(`^\\d{${API_LIMITS.codeLength}}$`), `Enter the ${API_LIMITS.codeLength}-digit code from the email`));

/** Bot defences (HumanProof in src/shared/api.ts). */
const Human = {
  captcha: z.string().max(4096).optional(),
  website: z.string().max(500).optional(),
};

export const Credentials = z.object({ email: Email, password: Password });
export const SignupForm = z.object({ email: Email, password: Password, ...Human });
export const ForgotForm = z.object({ email: Email, ...Human });
export const VerifyForm = z.object({ email: Email, code: Code });
export const ResetForm = z.object({ email: Email, code: Code, password: Password });
export const ResendForm = z.object({ email: Email, purpose: z.enum(['signup', 'reset']) });
