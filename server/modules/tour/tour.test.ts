import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from '../../test/testServer.ts';

let t: TestServer;
beforeAll(async () => {
  t = await startTestServer();
});
afterAll(() => t.close());

describe('tour progress', () => {
  it('needs a session', async () => {
    expect((await t.client()('GET', '/tour')).status).toBe(401);
    expect((await t.client()('PUT', '/tour', { step: 'camera', done: false })).status).toBe(401);
  });

  it('starts empty, then remembers the step', async () => {
    const api = await t.signedUp('tour@x.co');
    expect((await api('GET', '/tour')).json).toEqual({ progress: null });
    expect((await api('PUT', '/tour', { step: 'draw-road', done: false })).status).toBe(204);
    expect((await api('GET', '/tour')).json).toEqual({ progress: { step: 'draw-road', done: false } });
  });

  it('keeps a finished tour finished', async () => {
    const api = await t.signedUp('finished@x.co');
    await api('PUT', '/tour', { step: 'done', done: true });
    await api('PUT', '/tour', { step: 'camera', done: false });
    expect((await api('GET', '/tour')).json).toEqual({ progress: { step: 'done', done: true } });
  });

  it('is private to each player', async () => {
    const a = await t.signedUp('a-tour@x.co');
    await a('PUT', '/tour', { step: 'speed', done: false });
    const b = await t.signedUp('b-tour@x.co');
    expect((await b('GET', '/tour')).json).toEqual({ progress: null });
  });

  it('rejects bad bodies', async () => {
    const api = await t.signedUp('bad-tour@x.co');
    expect((await api('PUT', '/tour', { step: 'DROP TABLE', done: false })).status).toBe(400);
    expect((await api('PUT', '/tour', { step: 'camera' })).status).toBe(400);
  });
});
