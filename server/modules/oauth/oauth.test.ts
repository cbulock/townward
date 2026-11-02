import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestClient, type TestServer } from '../../test/testServer.ts';
import type { GithubApi, GithubProfile } from './github.api.ts';

/** Stands in for GitHub: each code maps to a profile; unknown codes fail like GitHub would. */
const profiles = new Map<string, GithubProfile>([
  ['code-octo', { id: '101', login: 'octo', verifiedEmail: 'Octo@Example.com' }],
  ['code-existing', { id: '202', login: 'already', verifiedEmail: 'already@x.co' }],
  ['code-noemail', { id: '303', login: 'quiet', verifiedEmail: null }],
]);
const fakeGithub: GithubApi = {
  async profileForCode(code) {
    const p = profiles.get(code);
    if (!p) throw new Error('bad code');
    return p;
  },
};

/** Start a sign-in, then come back from "GitHub" with `code` and the state the server issued. */
async function githubSignIn(api: TestClient, code: string, returnTo = '/'): Promise<{ status: number; location: string | null }> {
  const start = await api('GET', `/auth/github?returnTo=${encodeURIComponent(returnTo)}`);
  const state = new URL(start.headers.get('location') ?? 'x:').searchParams.get('state') ?? '';
  const back = await api('GET', `/auth/github/callback?code=${code}&state=${state}`);
  return { status: back.status, location: back.headers.get('location') };
}

describe('sign in with GitHub', () => {
  let t: TestServer;
  beforeAll(async () => {
    t = await startTestServer({ github: { clientId: 'cid', publicUrl: 'https://openpolis.space', api: fakeGithub } });
  });
  afterAll(() => t.close());

  it('says GitHub is available', async () => {
    expect((await t.client()('GET', '/auth/me')).json).toMatchObject({ providers: { github: true } });
  });

  it('sends the player to GitHub with our callback and a fresh state', async () => {
    const r = await t.client()('GET', '/auth/github');
    expect(r.status).toBe(302);
    const url = new URL(r.headers.get('location') ?? '');
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('redirect_uri')).toBe('https://openpolis.space/api/auth/github/callback');
    expect(url.searchParams.get('state')?.length).toBeGreaterThanOrEqual(16);
    expect(r.setCookie).toMatch(/cb_oauth=.*HttpOnly/i);
  });

  it('creates an account, signs in, and returns to where the player was', async () => {
    const api = t.client();
    const r = await githubSignIn(api, 'code-octo', '/?city=local:3');
    expect(r).toEqual({ status: 302, location: '/?city=local:3' });
    expect((await api('GET', '/auth/me')).json).toMatchObject({ user: { email: 'octo@example.com' } });
    // Signing in again is the same account.
    const again = t.client();
    await githubSignIn(again, 'code-octo');
    expect((await again('GET', '/auth/me')).json).toMatchObject({ user: { email: 'octo@example.com' } });
    const [{ n }] = await t.db.query<{ n: number }>("SELECT count(*)::int AS n FROM users WHERE email = 'octo@example.com'");
    expect(n).toBe(1);
  });

  it('links to an existing account with the same verified email', async () => {
    const owner = await t.signedUp('already@x.co');
    const ownerId = ((await owner('GET', '/auth/me')).json as { user: { id: number } }).user.id;
    const api = t.client();
    await githubSignIn(api, 'code-existing');
    expect((await api('GET', '/auth/me')).json).toMatchObject({ user: { id: ownerId } });
  });

  it('gives accounts without a verified email a private GitHub address, with no password', async () => {
    const api = t.client();
    await githubSignIn(api, 'code-noemail');
    expect((await api('GET', '/auth/me')).json).toMatchObject({ user: { email: '303+quiet@users.noreply.github.com' } });
    // No password exists, so password login can't get in.
    const tryPw = await t.client()('POST', '/auth/login', { email: '303+quiet@users.noreply.github.com', password: 'anything-1' });
    expect(tryPw.status).toBe(401);
  });

  it('rejects a callback whose state is missing or forged', async () => {
    const api = t.client();
    await api('GET', '/auth/github');
    const forged = await api('GET', '/auth/github/callback?code=code-octo&state=forged-state-123456');
    expect(forged.status).toBe(302);
    expect(forged.headers.get('location')).toMatch(/^\/\?auth_error=/);
    expect((await api('GET', '/auth/me')).json).toMatchObject({ user: null });
    // Without the start step there's no state cookie at all.
    const cold = await t.client()('GET', '/auth/github/callback?code=code-octo&state=whatever-state-1234');
    expect(cold.headers.get('location')).toMatch(/auth_error=/);
  });

  it('reports a cancelled or failed GitHub sign-in on the page', async () => {
    const api = t.client();
    const r = await githubSignIn(api, 'code-unknown');
    expect(r.location).toMatch(/^\/\?auth_error=/);
    expect((await api('GET', '/auth/me')).json).toMatchObject({ user: null });
  });

  it('never redirects off-site after sign-in', async () => {
    for (const evil of ['//evil.com', 'https://evil.com', '/\\evil.com']) {
      const r = await githubSignIn(t.client(), 'code-octo', evil);
      expect(r.location).toBe('/');
    }
  });
});

describe('without GitHub configured', () => {
  let t: TestServer;
  beforeAll(async () => {
    t = await startTestServer();
  });
  afterAll(() => t.close());

  it('hides the option and has no GitHub routes', async () => {
    expect((await t.client()('GET', '/auth/me')).json).toMatchObject({ providers: { github: false } });
    expect((await t.client()('GET', '/auth/github')).status).toBe(404);
  });
});
