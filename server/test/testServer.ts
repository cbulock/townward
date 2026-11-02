import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, type AppOptions } from '../app.ts';
import type { Db } from '../db/db.ts';
import { createTestDb } from './testDb.ts';

export interface TestResponse {
  readonly status: number;
  readonly json: unknown;
  readonly setCookie: string | null;
  readonly headers: Headers;
}

/** Sends requests like a browser: JSON bodies, and it keeps the session cookie. */
export type TestClient = (method: string, path: string, body?: unknown) => Promise<TestResponse>;

export interface TestServer {
  /** The server's database, for checking what was stored. */
  readonly db: Db;
  /** A new client with no session. */
  client(): TestClient;
  /** A new client already signed up and logged in. */
  signedUp(email: string): Promise<TestClient>;
  close(): Promise<void>;
}

/** Start the real app on a random port over a fresh PGlite database. */
export async function startTestServer(opts: Partial<AppOptions> = {}): Promise<TestServer> {
  const db: Db = await createTestDb();
  const app = createApp(db, { secureCookies: false, ...opts });
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port }: AddressInfo = server.address() as AddressInfo; // listen() on a TCP port always reports an AddressInfo
  const base = `http://127.0.0.1:${port}/api`;

  const client = (): TestClient => {
    // A tiny cookie jar: every cookie the server sets, minus the ones it clears.
    const jar = new Map<string, string>();
    return async (method, path, body) => {
      const res = await fetch(base + path, {
        method,
        redirect: 'manual',
        headers: { 'content-type': 'application/json', cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const setCookies = res.headers.getSetCookie();
      for (const c of setCookies) {
        const [pair] = c.split(';');
        const eq = pair.indexOf('=');
        const name = pair.slice(0, eq).trim();
        const cleared = /Expires=Thu, 01 Jan 1970|Max-Age=0/i.test(c) || pair.slice(eq + 1) === '';
        if (cleared) jar.delete(name);
        else jar.set(name, pair.slice(eq + 1));
      }
      const text = await res.text();
      let json: unknown;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = text;
      }
      return { status: res.status, json, setCookie: setCookies.length ? setCookies.join(', ') : null, headers: res.headers };
    };
  };

  return {
    db,
    client,
    async signedUp(email) {
      const c = client();
      const r = await c('POST', '/auth/signup', { email, password: 'password-1' });
      if (r.status !== 200) throw new Error(`signup failed: ${r.status}`);
      return c;
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await db.close();
    },
  };
}
