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
    let cookie = '';
    return async (method, path, body) => {
      const res = await fetch(base + path, {
        method,
        headers: { 'content-type': 'application/json', cookie },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';')[0];
      const text = await res.text();
      const json: unknown = text ? JSON.parse(text) : null;
      return { status: res.status, json, setCookie, headers: res.headers };
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
