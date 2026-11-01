import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RateLimiter } from '../../http/rateLimit.ts';
import { startTestServer, type TestServer } from '../../test/testServer.ts';

describe('RateLimiter', () => {
  it('counts failures per key within a window, then lets the key try again', () => {
    let now = 0;
    const l = new RateLimiter({ max: 3, windowMs: 60_000 }, () => now);
    for (let i = 0; i < 3; i++) l.fail('a');
    expect(l.retryAfter('a')).toBe(60);
    expect(l.retryAfter('b')).toBe(0);
    now = 30_000;
    expect(l.retryAfter('a')).toBe(30);
    now = 60_000;
    expect(l.retryAfter('a')).toBe(0);
  });

  it('forgets a key when cleared', () => {
    const l = new RateLimiter({ max: 1, windowMs: 60_000 });
    l.fail('a');
    l.clear('a');
    expect(l.retryAfter('a')).toBe(0);
  });
});

describe('auth limits (D-073)', () => {
  let t: TestServer;
  beforeAll(async () => {
    t = await startTestServer();
  });
  afterAll(() => t.close());

  it('never limits a player who logs in successfully, however often', async () => {
    await t.signedUp('often@x.co');
    for (let i = 0; i < 25; i++) {
      expect((await t.client()('POST', '/auth/login', { email: 'often@x.co', password: 'password-1' })).status).toBe(200);
    }
  });

  it('a successful login clears earlier wrong passwords', async () => {
    await t.signedUp('typo@x.co');
    const api = t.client();
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < 6; i++) expect((await api('POST', '/auth/login', { email: 'typo@x.co', password: 'wrong-pass' })).status).toBe(401);
      expect((await api('POST', '/auth/login', { email: 'typo@x.co', password: 'password-1' })).status).toBe(200);
    }
  });

  it('locks one email after repeated wrong passwords, with Retry-After, without locking others', async () => {
    await t.signedUp('target@x.co');
    await t.signedUp('other@x.co');
    const api = t.client();
    let last = await api('POST', '/auth/login', { email: 'target@x.co', password: 'wrong-pass' });
    for (let i = 0; i < 10; i++) last = await api('POST', '/auth/login', { email: 'target@x.co', password: 'wrong-pass' });
    expect(last.status).toBe(429);
    expect(Number(last.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(last.json).toMatchObject({ retryAfter: expect.any(Number) });
    // Even the right password waits out the lock…
    expect((await api('POST', '/auth/login', { email: 'target@x.co', password: 'password-1' })).status).toBe(429);
    // …but another account from the same address is unaffected.
    expect((await api('POST', '/auth/login', { email: 'other@x.co', password: 'password-1' })).status).toBe(200);
  });

  it('invalid signup forms never use up attempts', async () => {
    const api = t.client();
    for (let i = 0; i < 30; i++) expect((await api('POST', '/auth/signup', { email: 'bad', password: 'x' })).status).toBe(400);
    expect((await api('POST', '/auth/signup', { email: 'fine@x.co', password: 'password-1' })).status).toBe(200);
  });
});

describe('server basics', () => {
  let t: TestServer;
  beforeAll(async () => {
    t = await startTestServer();
  });
  afterAll(() => t.close());

  it('reports health and sends security headers', async () => {
    const r = await t.client()('GET', '/health');
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ ok: true });
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('x-frame-options')).toBe('DENY');
  });
});
