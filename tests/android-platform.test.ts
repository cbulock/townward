import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it('native builds disable server-dependent guest trials even in production', async () => {
  vi.stubEnv('MODE', 'native');
  vi.stubEnv('PROD', true);
  const { GUEST_TRIAL_ON } = await import('../src/app/account/guestPlay');
  expect(GUEST_TRIAL_ON).toBe(false);
});

it('web production builds retain guest trial behavior', async () => {
  vi.stubEnv('MODE', 'production');
  vi.stubEnv('PROD', true);
  const { GUEST_TRIAL_ON } = await import('../src/app/account/guestPlay');
  expect(GUEST_TRIAL_ON).toBe(true);
});
