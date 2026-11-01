import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from '../../test/testServer.ts';
import { readUserAgent } from './userAgent.ts';

const visit = { kind: 'visit', visitor: 'abc12345def', path: '/', referrer: 't.co', utmSource: 'twitter', timezone: 'Asia/Kolkata', language: 'en-IN', screen: '1440x900' };

interface Row {
  kind: string;
  visitor: string;
  user_id: number | null;
  referrer: string | null;
  utm_source: string | null;
  timezone: string | null;
  device: string;
  props: string | null;
}

describe('usage events (docs/specs/analytics.md)', () => {
  let t: TestServer;
  beforeAll(async () => {
    t = await startTestServer();
  });
  afterAll(() => t.close());

  const rows = () => t.db.query<Row>('SELECT kind, visitor, user_id, referrer, utm_source, timezone, device, props FROM events ORDER BY id');

  it('stores a guest visit without an account or IP address', async () => {
    expect((await t.client()('POST', '/events', visit)).status).toBe(204);
    const [row] = await rows();
    expect(row).toMatchObject({ kind: 'visit', visitor: 'abc12345def', user_id: null, referrer: 't.co', utm_source: 'twitter', timezone: 'Asia/Kolkata' });
    const columns = await t.db.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name = 'events'");
    expect(columns.map((c) => c.column_name)).not.toContain('ip');
  });

  it('links a signed-in player and keeps small props', async () => {
    const api = await t.signedUp('player@x.co');
    expect((await api('POST', '/events', { ...visit, kind: 'city_start', props: { kind: 'new', size: 128, customFunds: true } })).status).toBe(204);
    const last = (await rows()).at(-1);
    expect(last?.user_id).toEqual(expect.any(Number));
    expect(JSON.parse(last?.props ?? '{}')).toEqual({ kind: 'new', size: 128, customFunds: true });
  });

  it('rejects unknown kinds and oversized or nested props', async () => {
    const api = t.client();
    expect((await api('POST', '/events', { ...visit, kind: 'hack' })).status).toBe(400);
    expect((await api('POST', '/events', { ...visit, visitor: 'x' })).status).toBe(400);
    expect((await api('POST', '/events', { ...visit, props: { a: { nested: 1 } } })).status).toBe(400);
    const many = Object.fromEntries(Array.from({ length: 13 }, (_, k) => [`k${k}`, k]));
    expect((await api('POST', '/events', { ...visit, props: many })).status).toBe(400);
  });
});

describe('event rate limit', () => {
  let t: TestServer;
  beforeAll(async () => {
    t = await startTestServer();
  });
  afterAll(() => t.close());

  it('accepts a normal session but stops a flood from one address', async () => {
    const api = t.client();
    const statuses: number[] = [];
    for (let i = 0; i < 125; i++) statuses.push((await api('POST', '/events', visit)).status);
    expect(statuses.slice(0, 120).every((s) => s === 204)).toBe(true);
    expect(statuses.slice(120).every((s) => s === 429)).toBe(true);
    const [{ n }] = await t.db.query<{ n: number }>('SELECT count(*)::int AS n FROM events');
    expect(n).toBe(120);
  });
});

describe('readUserAgent', () => {
  it('reads browser, OS and device', () => {
    expect(readUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36')).toEqual({ browser: 'Chrome', os: 'macOS', device: 'desktop' });
    expect(readUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toEqual({ browser: 'Safari', os: 'iOS', device: 'mobile' });
    expect(readUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0')).toMatchObject({ browser: 'Edge', os: 'Windows' });
    expect(readUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)').device).toBe('bot');
    expect(readUserAgent(undefined).device).toBe('bot');
  });
});
