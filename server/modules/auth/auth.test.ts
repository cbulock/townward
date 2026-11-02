import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from '../../test/testServer.ts';

let t: TestServer;
beforeAll(async () => {
  t = await startTestServer();
});
afterAll(() => t.close());

describe('auth', () => {
  it('signs up with an httpOnly session cookie and knows who you are', async () => {
    const api = t.client();
    const r = await api('POST', '/auth/signup', { email: ' Mayor@Example.com ', password: 'correct horse' });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ user: { email: 'mayor@example.com' } });
    expect(r.setCookie).toMatch(/HttpOnly/i);
    expect(r.setCookie).toMatch(/SameSite=Lax/i);
    expect((await api('GET', '/auth/me')).json).toMatchObject({ user: { email: 'mayor@example.com' } });
    // The same email in any case is taken.
    expect((await t.client()('POST', '/auth/signup', { email: 'MAYOR@example.com', password: 'whatever123' })).status).toBe(409);
  });

  it('validates input with readable messages', async () => {
    const api = t.client();
    expect((await api('POST', '/auth/signup', { email: 'not-an-email', password: 'longenough' })).json).toEqual({
      error: 'Enter a valid email address',
    });
    expect((await api('POST', '/auth/signup', { email: 'a@b.co', password: 'short' })).json).toEqual({
      error: 'Password needs at least 8 characters',
    });
  });

  it('logs in with the right password only, with one message for every failure', async () => {
    await t.signedUp('c@d.co');
    const wrong = await t.client()('POST', '/auth/login', { email: 'c@d.co', password: 'password-2' });
    const nobody = await t.client()('POST', '/auth/login', { email: 'nobody@d.co', password: 'password-1' });
    expect(wrong.status).toBe(401);
    expect(nobody.json).toEqual(wrong.json);
    expect((await t.client()('POST', '/auth/login', { email: 'C@D.co', password: 'password-1' })).status).toBe(200);
  });

  it('logout ends the session', async () => {
    const api = await t.signedUp('bye@x.co');
    expect((await api('POST', '/auth/logout')).status).toBe(204);
    expect((await api('GET', '/auth/me')).json).toMatchObject({ user: null });
  });

  it('limits repeated attempts', async () => {
    const api = t.client();
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) statuses.push((await api('POST', '/auth/login', { email: 'x@y.co', password: 'password-1' })).status);
    expect(statuses).toContain(429);
  });
});
