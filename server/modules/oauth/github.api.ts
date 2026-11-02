import { z } from 'zod';
import { HttpError } from '../../http/errors.ts';

/**
 * The two GitHub calls sign-in needs: swap the one-time code for a token, then read who the
 * player is. Behind an interface so tests can stand in for GitHub.
 */
export interface GithubProfile {
  /** GitHub's numeric user id, as text (stable even if they rename their account). */
  readonly id: string;
  readonly login: string;
  /** Their primary email if GitHub has verified it, else null. */
  readonly verifiedEmail: string | null;
}

export interface GithubApi {
  /** Exchange the callback's `code` for the player's profile. */
  profileForCode(code: string, redirectUri: string): Promise<GithubProfile>;
}

const TokenResponse = z.object({ access_token: z.string() });
const UserResponse = z.object({ id: z.number(), login: z.string() });
const EmailsResponse = z.array(z.object({ email: z.string(), primary: z.boolean(), verified: z.boolean() }));

/** Calls GitHub with a timeout; anything unexpected becomes a 502 the callback reports. */
async function getJson(url: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new HttpError(502, `GitHub answered ${res.status}`);
  return res.json();
}

export function httpGithubApi(clientId: string, clientSecret: string): GithubApi {
  return {
    async profileForCode(code, redirectUri) {
      const token = TokenResponse.safeParse(
        await getJson('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: { accept: 'application/json', 'content-type': 'application/json' },
          body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
        }),
      );
      if (!token.success) throw new HttpError(502, 'GitHub refused the sign-in code');
      const headers = { accept: 'application/vnd.github+json', authorization: `Bearer ${token.data.access_token}`, 'user-agent': 'openpolis' };
      const user = UserResponse.parse(await getJson('https://api.github.com/user', { headers }));
      const emails = EmailsResponse.safeParse(await getJson('https://api.github.com/user/emails', { headers }));
      const primary = emails.success ? emails.data.find((e) => e.primary && e.verified) : undefined;
      return { id: String(user.id), login: user.login, verifiedEmail: primary?.email ?? null };
    },
  };
}
