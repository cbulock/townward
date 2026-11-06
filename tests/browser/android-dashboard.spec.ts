import { expect, test, type Page } from '@playwright/test';

async function start(page: Page) {
  await page.route('https://openpolis.space/api/**', (route) => route.abort());
  await page.goto('/?seed=42&size=64&water=0&trees=0&rivers=0&coast=0&funds=100000');
  await expect(page.getByRole('navigation', { name: 'Build tools' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
}
test('two rows, rotation and a live dashboard fit both phone orientations', async ({ page }) => {
  await start(page);
  const rotate = page.getByRole('button', { name: /Rotate clockwise/ });
  await expect(rotate).toBeVisible();
  const orientation = await rotate.getAttribute('aria-label');
  const funds = await page
    .getByRole('button', { name: 'Budget and taxes', exact: true })
    .innerText();
  for (let i = 0; i < 4; i++) await rotate.click();
  await expect(rotate).toHaveAttribute('aria-label', orientation!);
  expect(
    await page.getByRole('button', { name: 'Budget and taxes', exact: true }).innerText(),
  ).toBe(funds);
  for (const viewport of [
    { width: 360, height: 640 },
    { width: 640, height: 360 },
  ]) {
    await page.setViewportSize(viewport);
    const summary = page.getByRole('banner', { name: 'City summary' });
    for (const button of await summary.getByRole('button').all()) {
      const box = await button.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(48);
      expect(box!.height).toBeGreaterThanOrEqual(48);
    }
    await page.getByRole('button', { name: 'Expand city dashboard', exact: true }).click();
    const dashboard = page.getByRole('region', { name: 'City dashboard' });
    await expect(dashboard).toBeVisible();
    const bottom = await dashboard.boundingBox();
    const dock = await page.getByRole('navigation', { name: 'Build tools' }).boundingBox();
    expect(dock!.y - (bottom!.y + bottom!.height)).toBeGreaterThanOrEqual(48);
    await rotate.click();
    await expect(dashboard).toBeVisible();
    await page.touchscreen.tap(25, viewport.height - 100);
    await expect(dashboard).toBeVisible();
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await expect(dashboard).toHaveCount(0);
    await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  }
});
test('customization applies, reorders, cancels, resets and survives reload', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Expand city dashboard', exact: true }).click();
  await page.getByRole('button', { name: 'Customize', exact: true }).click();
  await page.locator('.phone-stat-choices label').filter({ hasText: 'Happiness' }).click();
  await expect(page.getByRole('checkbox', { name: 'Happiness', exact: true })).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeEnabled();
  await page.getByRole('checkbox', { name: 'Water', exact: true }).check();
  await page.getByRole('button', { name: 'Move Water left', exact: true }).click();
  await page.getByRole('button', { name: 'Move Water left', exact: true }).click();
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.locator('.phone-pinned-stat').first()).toContainText('Water');
  await page.reload();
  await expect(page.locator('.phone-pinned-stat').first()).toContainText('Water');
  await expect(page.getByRole('region', { name: 'City dashboard' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Expand city dashboard', exact: true }).click();
  await page.getByRole('button', { name: 'Customize', exact: true }).click();
  await page.getByRole('button', { name: 'Reset to defaults', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel customization', exact: true }).click();
  await expect(page.locator('.phone-pinned-stat').first()).toContainText('Water');
  await page.getByRole('button', { name: 'Customize', exact: true }).click();
  await page.getByRole('button', { name: 'Reset to defaults', exact: true }).click();
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.locator('.phone-pinned-stat').first()).toContainText('Happiness');
  await page.getByRole('button', { name: 'Customize', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('openpolis-back', { cancelable: true })));
  await expect(page.getByRole('button', { name: 'Apply', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'City dashboard' })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('openpolis-back', { cancelable: true })));
  await expect(page.getByRole('region', { name: 'City dashboard' })).toHaveCount(0);
});

test('rotation and expansion preserve a construction draft, while alerts supersede the dashboard', async ({
  page,
}) => {
  await start(page);
  const funds = page.getByRole('button', { name: 'Budget and taxes', exact: true });
  const before = await funds.innerText();
  await page.getByRole('button', { name: 'Roads', exact: true }).click();
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 170, y: 290 }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: 215, y: 308 }],
  });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
  await expect(page.locator('.draft-confirm')).toBeVisible();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /Rotate clockwise/ }).click();
  await page.getByRole('button', { name: 'Expand city dashboard', exact: true }).click();
  await expect(page.locator('.draft-confirm')).toBeVisible();
  const panel = await page.getByRole('region', { name: 'City dashboard' }).boundingBox();
  const confirmation = await page.locator('.draft-confirm').boundingBox();
  expect(panel!.y + panel!.height).toBeLessThanOrEqual(confirmation!.y - 8);
  expect(await funds.innerText()).toBe(before);
  await page.getByRole('button', { name: 'Collapse city dashboard', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await funds.innerText()).toBe(before);
  await page.getByRole('button', { name: 'Expand city dashboard', exact: true }).click();
  await page.getByRole('button', { name: /^Alerts/ }).click();
  await expect(page.getByRole('region', { name: 'City dashboard' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Alerts', exact: true })).toBeVisible();
});

test('keyboard dashboard activation closes alerts without requiring an outside touch', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: /^Alerts/ }).click();
  await expect(page.getByRole('dialog', { name: 'Alerts', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Expand city dashboard', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'City dashboard' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Alerts', exact: true })).toHaveCount(0);
});

test('alerts respect safe insets and retain map clearance above the dock', async ({ page }) => {
  await start(page);
  await page.locator('.game-screen').evaluate((element) => {
    (element as HTMLElement).style.setProperty('--safe-t', '24px');
    (element as HTMLElement).style.setProperty('--safe-l', '20px');
    window.dispatchEvent(new Event('resize'));
  });
  await page.getByRole('button', { name: /^Alerts/ }).click();
  const alerts = page.getByRole('dialog', { name: 'Alerts', exact: true });
  const rect = await alerts.boundingBox();
  const dock = await page.getByRole('navigation', { name: 'Build tools' }).boundingBox();
  expect(rect!.x).toBe(28);
  expect(dock!.y - rect!.y - rect!.height).toBeGreaterThanOrEqual(48);
});

test('any number of pins fits the available width or scrolls without moving Rotate', async ({
  page,
}) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await start(page);
  await page.getByRole('button', { name: 'Expand city dashboard', exact: true }).click();
  await page.getByRole('button', { name: 'Customize', exact: true }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.locator('.phone-pinned-stat')).toHaveCount(10);
  const strip = page.getByRole('group', { name: 'Second row items' });
  const wide = await strip.boundingBox();
  await page.getByRole('button', { name: 'Collapse city dashboard', exact: true }).click();
  await page.setViewportSize({ width: 360, height: 640 });
  const narrow = await strip.boundingBox();
  expect(wide!.width).toBeGreaterThan(narrow!.width);
  expect(await strip.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  const rotate = page.getByRole('button', { name: /Rotate clockwise/ });
  const before = await rotate.boundingBox();
  await page.locator('.phone-pinned-stat').last().scrollIntoViewIfNeeded();
  await expect(page.locator('.phone-pinned-stat').last()).toBeInViewport();
  expect((await rotate.boundingBox())!.x).toBe(before!.x);
  await page.reload();
  await expect(page.locator('.phone-pinned-stat')).toHaveCount(10);
  await page.getByRole('button', { name: 'Expand city dashboard', exact: true }).click();
  await page.getByRole('button', { name: 'Customize', exact: true }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.uncheck();
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.locator('.phone-pinned-stat')).toHaveCount(0);
  await expect(rotate).toBeVisible();
  await page.reload();
  await expect(page.locator('.phone-pinned-stat')).toHaveCount(0);
});

test('both rows can select, transfer, reorder and persist statistics and controls', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Expand city dashboard', exact: true }).click();
  await page.getByRole('button', { name: 'Customize', exact: true }).click();
  await page.getByRole('button', { name: 'First row', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Happiness', exact: true }).check();
  for (let i = 0; i < 4; i++)
    await page.getByRole('button', { name: 'Move Happiness left', exact: true }).click();
  await page.getByRole('button', { name: 'Second row', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Happiness', exact: true })).not.toBeChecked();
  await page.getByRole('checkbox', { name: 'Treasury', exact: true }).check();
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  const first = page.getByRole('group', { name: 'First row items' });
  const second = page.getByRole('group', { name: 'Second row items' });
  await expect(first.locator('.phone-hud-slot').first()).toContainText('Happiness');
  await expect(first.getByRole('button', { name: 'Budget and taxes', exact: true })).toHaveCount(0);
  await expect(
    second.getByRole('button', { name: 'Budget and taxes', exact: true }),
  ).toBeAttached();
  await page.reload();
  await expect(first.locator('.phone-hud-slot').first()).toContainText('Happiness');
  await expect(
    second.getByRole('button', { name: 'Budget and taxes', exact: true }),
  ).toBeAttached();
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Rotate clockwise/ })).toBeVisible();
});
