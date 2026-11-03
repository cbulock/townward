import { z } from 'zod';

/**
 * Bot check for the forms that send email (D-084). Cloudflare Turnstile when configured: the
 * browser solves an (usually invisible) challenge and sends us a one-use token, which we confirm
 * with Cloudflare. Without keys every request passes, and the honeypot and send limits remain.
 */
export interface HumanCheck {
  /** True when `token` proves a person filled in the form from `address`. */
  verify(token: string | undefined, address: string): Promise<boolean>;
}

export const noHumanCheck: HumanCheck = { verify: async () => true };

const SiteVerify = z.object({
  success: z.boolean(),
  'error-codes': z.array(z.string()).optional(),
  hostname: z.string().optional(),
});

export function turnstileCheck(secretKey: string): HumanCheck {
  return {
    async verify(token, address) {
      if (!token) {
        console.warn('Turnstile: no token sent with the form');
        return false;
      }
      try {
        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          body: new URLSearchParams({ secret: secretKey, response: token, remoteip: address }),
          signal: AbortSignal.timeout(10_000),
        });
        const body = SiteVerify.safeParse(await res.json());
        if (!body.success) {
          console.error(`Turnstile answered ${res.status} with an unexpected body`);
          return false;
        }
        // invalid-input-secret: wrong TURNSTILE_SECRET_KEY; timeout-or-duplicate: token expired or reused.
        if (!body.data.success) console.warn(`Turnstile refused a token: ${(body.data['error-codes'] ?? []).join(', ') || 'no reason given'}`);
        return body.data.success;
      } catch (err) {
        // Fail closed: if Cloudflare can't vouch for the player, no email goes out.
        console.error('Turnstile unreachable', err);
        return false;
      }
    },
  };
}
