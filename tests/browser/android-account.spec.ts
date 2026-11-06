import { expect, test } from '@playwright/test';
import { City } from '../../src/sim/City';
import { serialize } from '../../src/sim/save';
import { generateTerrain } from '../../src/sim/terrain/generate';
import { presetSettings } from '../../src/sim/terrain/presets';

test('Android email login opens a cloud city and keeps a device copy available offline', async ({
  page,
}) => {
  const terrain = presetSettings('coastal', 42, 64);
  const data = serialize(new City(generateTerrain(terrain)), terrain, 'Remote City');
  const meta = {
    id: 7,
    name: 'Remote City',
    population: 0,
    funds: data.city.funds,
    day: 0,
    size: 64,
    preset: 'coastal',
    seed: 42,
    updatedAt: Date.now(),
  };
  const user = { id: 9, email: 'mayor@example.test' };
  let signedIn = false;
  const headers = {
    'access-control-allow-origin': 'http://127.0.0.1:5291',
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  };
  await page.route('https://openpolis.space/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (path === '/api/auth/login') {
      signedIn = true;
      await route.fulfill({ headers, json: { user } });
      return;
    }
    if (path === '/api/auth/me') {
      await route.fulfill({
        headers,
        json: {
          user: signedIn ? user : null,
          providers: { github: false, emailCodes: true, turnstileSiteKey: null },
        },
      });
      return;
    }
    if (path === '/api/saves') {
      await route.fulfill({ headers, json: { saves: signedIn ? [meta] : [] } });
      return;
    }
    if (path === '/api/saves/7') {
      await route.fulfill({ headers, json: { meta, data } });
      return;
    }
    if (path === '/api/tour') {
      await route.fulfill({ headers, json: { progress: null } });
      return;
    }
    await route.fulfill({ status: 204, headers });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  await page.locator('.auth-submit').click();
  await page.getByRole('button', { name: 'Continue Remote City', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Build tools' })).toBeVisible();
  await page.route('https://openpolis.space/api/**', (route) => route.abort());
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Continue Remote City', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Continue Remote City', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Build tools' })).toBeVisible();
});

test('Back closes the account dialog before leaving a phone city', async ({ page }) => {
  await page.route('https://openpolis.space/api/auth/me', (route) =>
    route.fulfill({
      json: { user: null, providers: { github: false, emailCodes: true, turnstileSiteKey: null } },
      headers: {
        'access-control-allow-origin': 'http://127.0.0.1:5291',
        'access-control-allow-credentials': 'true',
      },
    }),
  );
  await page.goto('/?seed=42&size=64&funds=100000');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.locator('.auth-dialog')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('openpolis-back', { cancelable: true })));
  await expect(page.locator('.auth-dialog')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Build tools' })).toBeVisible();
});
