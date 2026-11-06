import { expect, test } from '@playwright/test';

test.describe('mouse input', () => {
  test.use({ hasTouch: false, isMobile: false });
  test('rejected mouse construction does not enter touch confirmation', async ({ page }) => {
    await page.route('https://openpolis.space/api/**', (route) => route.abort());
    await page.goto('/?seed=42&size=64&water=0&trees=0&rivers=0&coast=0&funds=0');
    await expect(page.getByRole('navigation', { name: 'Build tools' })).toBeVisible();
    await page.getByRole('button', { name: 'Civic', exact: true }).click();
    await page.getByRole('tab', { name: 'Utilities', exact: true }).click();
    await page.locator('.building-card').filter({ hasText: 'Water Tower' }).click();
    await page.mouse.click(170, 290);
    await expect(page.locator('.draft-confirm')).toHaveCount(0);
  });
});

test('phone HUD keeps tools readable and reachable across orientations', async ({ page }) => {
  await page.route('https://openpolis.space/api/**', (route) => route.abort());
  await page.goto('/?seed=42&size=64&funds=100000');
  const dock = page.getByRole('navigation', { name: 'Build tools' });
  await expect(dock).toBeVisible();
  await page.getByRole('button', { name: 'Zones', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Connect account' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Homes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Done · Homes', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zones', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  for (const viewport of [
    { width: 360, height: 640 },
    { width: 640, height: 360 },
  ]) {
    await page.setViewportSize(viewport);
    for (const button of await dock.getByRole('button').all()) {
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(48);
      expect(box!.height).toBeGreaterThanOrEqual(48);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }
    await page.getByRole('button', { name: 'Civic', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Utilities', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close panel', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
