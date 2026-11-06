import { expect, test } from '@playwright/test';

test('pinch navigation cancels a draft even when the second finger lands on Build', async ({
  page,
}) => {
  await page.route('https://openpolis.space/api/**', (route) => route.abort());
  await page.goto('/?seed=42&size=64&water=0&trees=0&rivers=0&coast=0&funds=100000');
  await expect(page.getByRole('navigation', { name: 'Build tools' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  const funds = page.getByRole('button', { name: 'Budget and taxes', exact: true });
  const before = await funds.innerText();
  await page.getByRole('button', { name: 'Roads', exact: true }).click();
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  const input = await page.context().newCDPSession(page);
  const start = { id: 1, x: 140, y: 280 };
  await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  await input.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ ...start, x: 190, y: 300 }],
  });
  await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const build = page.getByRole('button', { name: 'Build', exact: true });
  await expect(build).toBeEnabled();
  const box = await build.boundingBox();
  if (!box) throw new Error('Build confirmation must be visible');
  const first = { id: 1, x: 130, y: 250 };
  const second = { id: 2, x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
  await input.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [first, second],
  });
  await input.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { ...first, x: 110 },
      { ...second, x: second.x + 20 },
    ],
  });
  await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [first] });
  await input.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ ...first, x: 115, y: 230 }],
  });
  await expect(page.locator('.draft-confirm')).toHaveCount(0);
  await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await funds.innerText()).toBe(before);
  await expect(page.getByRole('button', { name: 'Roads', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // A new gesture after all fingers lift can deliberately draw another draft.
  await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.draft-confirm')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await funds.innerText()).toBe(before);
  await input.detach();
});
