import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const bridge = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
  CapacitorHttp: bridge,
}));
beforeEach(() => {
  vi.stubEnv('MODE', 'native');
  bridge.request.mockReset();
  vi.stubGlobal('fetch', async () => {
    throw new Error('Unexpected WebView fetch');
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

it('uses the native bridge with the existing endpoint instead of WebView fetch', async () => {
  bridge.request.mockResolvedValue({
    status: 200,
    headers: {},
    data: { user: { id: 9, email: 'mayor@example.test' } },
  });
  const { api } = await import('../src/save/api');
  expect(await api.login('mayor@example.test', 'test-password')).toEqual({
    id: 9,
    email: 'mayor@example.test',
  });
  expect(bridge.request).toHaveBeenCalledWith(
    expect.objectContaining({
      url: 'https://openpolis.space/api/auth/login',
      method: 'POST',
      data: { email: 'mayor@example.test', password: 'test-password' },
      disableRedirects: true,
    }),
  );
});
it('preserves server errors and Retry-After through the native transport', async () => {
  bridge.request.mockResolvedValue({
    status: 429,
    headers: { 'Retry-After': '42' },
    data: { error: 'Wait before trying again' },
  });
  const { api } = await import('../src/save/api');
  await expect(api.login('mayor@example.test', 'test-password')).rejects.toMatchObject({
    status: 429,
    retryAfter: 42,
  });
});
it('handles empty successful logout replies', async () => {
  bridge.request.mockResolvedValue({ status: 204, headers: {}, data: '' });
  const { api } = await import('../src/save/api');
  await expect(api.logout()).resolves.toBeUndefined();
});
