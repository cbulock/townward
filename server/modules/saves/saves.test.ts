import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API_LIMITS } from '../../../src/shared/api.ts';
import { startTestServer, type TestServer } from '../../test/testServer.ts';

let t: TestServer;
beforeAll(async () => {
  t = await startTestServer();
});
afterAll(() => t.close());

const meta = { name: 'Testville', population: 1200, funds: 5000.5, day: 90, size: 128, preset: 'riverValley', seed: 42 };
const data = { v: 1, hello: 'world', layers: { road: 'AAAA' } };

function idOf(json: unknown): number {
  if (typeof json === 'object' && json !== null && 'meta' in json && typeof json.meta === 'object' && json.meta !== null && 'id' in json.meta) {
    if (typeof json.meta.id === 'number') return json.meta.id;
  }
  throw new Error('no id in response');
}

describe('saves', () => {
  it('needs a session', async () => {
    expect((await t.client()('GET', '/saves')).status).toBe(401);
  });

  it('creates, lists, loads, updates and deletes a city', async () => {
    const api = await t.signedUp('owner@x.co');
    const created = await api('POST', '/saves', { meta, data });
    expect(created.status).toBe(201);
    const id = idOf(created.json);

    const list = await api('GET', '/saves');
    expect(list.json).toMatchObject({ saves: [{ id, name: 'Testville', population: 1200, funds: 5000.5 }] });
    expect(JSON.stringify(list.json)).not.toContain('hello');

    expect((await api('GET', `/saves/${id}`)).json).toMatchObject({ meta: { id }, data });

    const updated = await api('PUT', `/saves/${id}`, { meta: { ...meta, population: 2000 }, data: { ...data, hello: 'again' } });
    expect(updated.status).toBe(200);
    expect((await api('GET', `/saves/${id}`)).json).toMatchObject({ meta: { population: 2000 }, data: { hello: 'again' } });

    expect((await api('DELETE', `/saves/${id}`)).status).toBe(204);
    expect((await api('GET', `/saves/${id}`)).status).toBe(404);
  });

  it("keeps cities private to their owner", async () => {
    const owner = await t.signedUp('mine@x.co');
    const id = idOf((await owner('POST', '/saves', { meta, data })).json);
    const other = await t.signedUp('theirs@x.co');
    expect((await other('GET', `/saves/${id}`)).status).toBe(404);
    expect((await other('PUT', `/saves/${id}`, { meta, data })).status).toBe(404);
    expect((await other('DELETE', `/saves/${id}`)).status).toBe(404);
    expect((await other('GET', '/saves')).json).toEqual({ saves: [] });
  });

  it('rejects bad bodies and ids', async () => {
    const api = await t.signedUp('bad@x.co');
    expect((await api('POST', '/saves', { meta, data: 'not an object' })).status).toBe(400);
    expect((await api('POST', '/saves', { meta: { ...meta, name: '  ' }, data })).json).toEqual({ error: 'City needs a name' });
    expect((await api('GET', '/saves/abc')).status).toBe(400);
  });

  it(`caps an account at ${API_LIMITS.savesPerUser} cities`, async () => {
    const api = await t.signedUp('hoarder@x.co');
    for (let i = 0; i < API_LIMITS.savesPerUser; i++) expect((await api('POST', '/saves', { meta, data })).status).toBe(201);
    expect((await api('POST', '/saves', { meta, data })).status).toBe(403);
  });
});
