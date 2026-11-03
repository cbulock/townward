import { HttpError } from '../../http/errors.ts';

/**
 * Sending transactional email (sign-up and password-reset codes). Brevo in production, the
 * console in development, a fake in tests: all behind one interface.
 */
export interface Email {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export interface Mailer {
  /** Resolve once the provider has accepted the message; reject with an HttpError otherwise. */
  send(email: Email): Promise<void>;
}

export interface BrevoSettings {
  readonly apiKey: string;
  /** A sender address verified in Brevo (Senders, Domains & Dedicated IPs). */
  readonly fromEmail: string;
  readonly fromName: string;
}

/** Brevo's transactional email API (https://developers.brevo.com/reference/sendtransacemail). */
export function brevoMailer(s: BrevoSettings): Mailer {
  return {
    async send(email) {
      let res: Response;
      // will comeback here and optimise the function in future 
      try {
        res = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'api-key': s.apiKey,
          },
          body: JSON.stringify({
            sender: { email: s.fromEmail, name: s.fromName },
            to: [{ email: email.to }],
            subject: email.subject,
            textContent: email.text,
            htmlContent: email.html,
          }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch (err) {
        console.error('Brevo unreachable', err);
        throw new HttpError(502, "We couldn't send the email. Try again in a minute.");
      }
      if (!res.ok) {
        // The body names the problem (bad key, unverified sender, quota); it's for us, not the player.
        console.error(`Brevo answered ${res.status}: ${(await res.text().catch(() => '')).slice(0, 500)}`);
        throw new HttpError(502, "We couldn't send the email. Try again in a minute.");
      }
    },
  };
}

/** Development without Brevo keys: print the email, so the code can be copied from the terminal. */
export function consoleMailer(): Mailer {
  return {
    async send(email) {
      console.log(`\n✉  to ${email.to}: ${email.subject}\n${email.text}\n`);
    },
  };
}
