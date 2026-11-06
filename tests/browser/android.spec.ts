import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://openpolis.space/api/auth/me', (route) =>
    route.fulfill({
      json: { user: null, providers: { github: false, emailCodes: true, turnstileSiteKey: null } },
      headers: {
        'access-control-allow-origin': 'http://127.0.0.1:5291',
        'access-control-allow-credentials': 'true',
      },
    }),
  );
});

async function drag(page: Page, x: number, y: number, endX = x + 45, endY = y + 18) {
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: endX, y: endY }],
  });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
}

test('native menu remains playable when the optional backend is unreachable', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:5291')) requests.push(request.url());
  });
  await page.route('**/api/**', (route) => {
    return route.abort();
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start building' })).toBeVisible();
  await expect(page.locator('.rotate-prompt, .guest-gate')).toHaveCount(0);
  expect(requests).toEqual(['https://openpolis.space/api/auth/me']);
});

test('touch release drafts, Cancel is free, Confirm commits once and local city reopens', async ({
  page,
}) => {
  await page.goto('/?seed=42&size=64&water=0&trees=0&rivers=0&coast=0&funds=100000&name=Touchtest');
  await expect(page.getByRole('navigation', { name: 'Build tools' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  const funds = page.getByRole('button', { name: 'Budget and taxes', exact: true });
  const before = await funds.innerText();
  await page.getByRole('button', { name: 'Roads', exact: true }).click();
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  await drag(page, 170, 290);
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
  expect(await funds.innerText()).toBe(before);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await funds.innerText()).toBe(before);
  await expect(page.locator('.draft-confirm')).toHaveCount(0);
  await drag(page, 170, 290);
  const confirm = page.getByRole('button', { name: 'Build', exact: true });
  await expect(confirm).toBeEnabled();
  await confirm.click();
  expect(await funds.innerText()).not.toBe(before);
  await expect(page.locator('.draft-confirm')).toHaveCount(0);
  const after = await funds.innerText();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: 'Save and return to your cities' }).click();
  await page.getByRole('button', { name: 'Continue Touchtest', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Build tools' })).toBeVisible();
  expect(await funds.innerText()).toBe(after);
  await page.screenshot({ path: 'artifacts/android-portrait.png' });
  await page.setViewportSize({ width: 640, height: 360 });
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Civic', exact: true }).click();
  await expect(page.locator('.phone-sheet')).toBeVisible();
  await page.screenshot({ path: 'artifacts/android-landscape.png' });
});

test('resize cancels pending construction and Back closes the sheet first', async ({ page }) => {
  await page.goto('/?seed=42&size=64&water=0&trees=0&rivers=0&coast=0&funds=100000');
  await expect(page.getByRole('navigation', { name: 'Build tools' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  await page.getByRole('button', { name: 'Roads', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('openpolis-back', { cancelable: true })));
  await expect(page.locator('.phone-sheet')).toHaveCount(0);
  await drag(page, 170, 290);
  await expect(page.locator('.draft-confirm')).toBeVisible();
  await page.setViewportSize({ width: 640, height: 360 });
  await expect(page.locator('.draft-confirm')).toHaveCount(0);
});

test('building relocation and inspector demolition both wait for confirmation', async ({
  page,
}) => {
  await page.goto('/?seed=42&size=64&water=0&trees=0&rivers=0&coast=0&funds=100000');
  await expect(page.getByRole('navigation', { name: 'Build tools' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  await page.getByRole('button', { name: 'Civic', exact: true }).click();
  await page.getByRole('tab', { name: 'Utilities', exact: true }).click();
  await page.locator('.building-card').filter({ hasText: 'Water Tower' }).click();
  await page.touchscreen.tap(170, 290);
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await page.getByRole('button', { name: 'Pan', exact: true }).click();
  await page.touchscreen.tap(170, 290);
  await expect(page.getByRole('button', { name: 'Demolish', exact: true })).toBeVisible();
  const funds = page.getByRole('button', { name: 'Budget and taxes', exact: true });
  const before = await funds.innerText();
  await page.getByRole('button', { name: 'Demolish', exact: true }).click();
  await expect(page.locator('.draft-confirm')).toBeVisible();
  expect(await funds.innerText()).toBe(before);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Pan', exact: true }).click();
  await page.touchscreen.tap(170, 290);
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  await page.touchscreen.tap(235, 330);
  await expect(page.locator('.draft-confirm')).toBeVisible();
  expect(await funds.innerText()).toBe(before);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await funds.innerText()).toBe(before);
});

test('expanded display and twelve minutes of offline play remain available', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await page.route('**/api/**', (route) => route.abort());
  await page.goto('/?seed=42&size=128&funds=100000');
  await expect(page.getByRole('toolbar', { name: 'Build tools' })).toBeVisible();
  await page.clock.install();
  await page.clock.fastForward(12 * 60_000);
  await expect(page.locator('.guest-gate, .rotate-prompt')).toHaveCount(0);
  await expect(page.getByRole('toolbar', { name: 'Build tools' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/android-expanded.png' });
});

test('expanded-layout Back dismisses the alerts popover before offering to leave', async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto('/?seed=42&size=64&funds=100000');
  await expect(page.getByRole('toolbar', { name: 'Build tools' })).toBeVisible();
  await page.locator('.alerts-button').click();
  await expect(page.locator('.alerts-button')).toHaveAttribute('aria-expanded', 'true');
  let prompted = false;
  page.on('dialog', async (dialog) => {
    prompted = true;
    await dialog.dismiss();
  });
  await page.evaluate(() => window.dispatchEvent(new Event('openpolis-back', { cancelable: true })));
  await expect(page.locator('.alerts-button')).toHaveAttribute('aria-expanded', 'false');
  expect(prompted).toBe(false);
});
