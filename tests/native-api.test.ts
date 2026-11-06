import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

it('native API calls target the deployed existing backend and include session credentials', async () => {
  vi.stubEnv('MODE', 'native');
  let url: unknown;
  let credentials: unknown;
  vi.stubGlobal('fetch', async (input: unknown, init: RequestInit) => {
    url = input;
    credentials = init.credentials;
    return Response.json({
      user: null,
      providers: { github: false, emailCodes: true, turnstileSiteKey: null },
    });
  });
  const { api } = await import('../src/save/api');
  expect((await api.me()).providers.emailCodes).toBe(true);
  expect(url).toBe('https://openpolis.space/api/auth/me');
  expect(credentials).toBe('include');
});

it('hosted web requests stay same-origin', async () => {
  vi.stubEnv('MODE', 'production');
  let url: unknown;
  vi.stubGlobal('fetch', async (input: unknown) => {
    url = input;
    return Response.json({ saves: [] });
  });
  const { api } = await import('../src/save/api');
  expect(await api.listSaves()).toEqual([]);
  expect(url).toBe('/api/saves');
});
