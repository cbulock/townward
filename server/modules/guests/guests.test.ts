import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestResponse, type TestServer } from '../../test/testServer.ts';
import { fingerprint, networkOf } from './fingerprint.ts';

let t: TestServer;
let clock = 1_800_000_000_000;
beforeAll(async () => {
  t = await startTestServer({ guests: { secret: 'test-secret-test-secret-test-secret', nudgeMinutes: 1, limitMinutes: 2 }, guestClock: () => clock });
});
afterAll(() => t.close());

interface Beat {
  readonly kind: string;
  readonly guestId?: string;
  readonly state?: string;
  readonly playSeconds?: number;
}

function isBeat(v: unknown): v is Beat {
  return typeof v === 'object' && v !== null && 'kind' in v && typeof v.kind === 'string';
}

function body(r: TestResponse): Beat {
  if (!isBeat(r.json)) throw new Error('not a heartbeat response');
  return r.json;
}

/** Moves the server's clock. Every client here shares one address and User-Agent, so one fingerprint. */
const tick = (s: number) => {
  clock += s * 1000;
};

describe('guest trial', () => {
  it('gives a new guest an id cookie and no time used', async () => {
    const api = t.client();
    const r = await api('POST', '/guest/heartbeat', {});
    expect(r.status).toBe(200);
    expect(r.setCookie).toContain('cb_guest=');
    expect(r.setCookie).toContain('HttpOnly');
    expect(body(r)).toMatchObject({ kind: 'guest', state: 'ok', playSeconds: 0 });
  });

  it('counts time between heartbeats on the server, not breaks', async () => {
    tick(1e6);
    const api = t.client();
    await api('POST', '/guest/heartbeat', {});
    tick(30);
    expect(body(await api('POST', '/guest/heartbeat', {})).playSeconds).toBe(30);
    tick(600); // tab closed for ten minutes
    expect(body(await api('POST', '/guest/heartbeat', {})).playSeconds).toBe(30);
    tick(30);
    expect(body(await api('POST', '/guest/heartbeat', {}))).toMatchObject({ playSeconds: 60, state: 'nudge' });
    tick(30);
    await api('POST', '/guest/heartbeat', {});
    tick(30);
    expect(body(await api('POST', '/guest/heartbeat', {}))).toMatchObject({ playSeconds: 120, state: 'gate' });
  });

  it('keeps the used time when cookies are cleared on the same device', async () => {
    // Same address and User-Agent as the guest above, who is gated: a fresh client starts gated.
    const fresh = t.client();
    const r = body(await fresh('POST', '/guest/heartbeat', {}));
    expect(r.state).toBe('gate');
    expect(r.playSeconds).toBeGreaterThanOrEqual(120);
  });

  it('uses the device copy of the id when the cookie is gone', async () => {
    const first = t.client();
    const id = body(await first('POST', '/guest/heartbeat', {})).guestId;
    const second = t.client();
    expect(body(await second('POST', '/guest/heartbeat', { guestId: id })).guestId).toBe(id);
  });

  it('asks nothing of signed-in players and remembers who the guest became', async () => {
    const api = await t.signedUp('member@x.co');
    expect(body(await api('POST', '/guest/heartbeat', {}))).toEqual({ kind: 'member' });
  });

  it('rejects malformed ids', async () => {
    expect((await t.client()('POST', '/guest/heartbeat', { guestId: "x' OR 1=1" })).status).toBe(400);
  });

  it('stores no address or User-Agent', async () => {
    const rows = await t.db.query<Record<string, unknown>>('SELECT * FROM guests');
    expect(JSON.stringify(rows)).not.toContain('127.0.0.1');
    expect(Object.keys(rows[0] ?? {})).toEqual(['id', 'fingerprint', 'play_seconds', 'last_seen_ms', 'claimed_by', 'created_at']);
  });
});

describe('fingerprint', () => {
  const chrome = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

  it('reads networks: IPv4 as is, IPv6 by /64', () => {
    expect(networkOf('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(networkOf('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe('2001:db8:1:2::/64');
    expect(networkOf('2001:db8:1:2:1111:2222:3333:4444')).toBe('2001:db8:1:2::/64');
  });

  it('differs by device and by secret, and hides the address', () => {
    const a = fingerprint('s'.repeat(32), '203.0.113.7', chrome);
    expect(a).toBe(fingerprint('s'.repeat(32), '203.0.113.7', chrome));
    expect(a).not.toBe(fingerprint('s'.repeat(32), '203.0.113.7', iphone));
    expect(a).not.toBe(fingerprint('t'.repeat(32), '203.0.113.7', chrome));
    expect(a).not.toContain('203');
  });
});
