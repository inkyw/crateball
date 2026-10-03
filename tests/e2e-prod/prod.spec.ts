import { expect, test } from '@playwright/test';

test('prod imajı: sahne yüklenir, dev araçları yok, WebSocket el sıkışır', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page).toHaveTitle('Gece Gelmeden');
  await expect(page.locator('canvas#game')).toBeVisible();
  await page.keyboard.press('F1');
  await expect(page.locator('#debug-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => typeof (window as unknown as Record<string, unknown>).__game)).toBe(
    'undefined',
  );
  const reply = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const ws = new WebSocket(`ws://${location.host}/ws`);
        ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', protocolVersion: 1 }));
        ws.onmessage = (e) => {
          resolve((JSON.parse(String(e.data)) as { t: string }).t);
          ws.close();
        };
        ws.onerror = () => reject(new Error('ws hatası'));
      }),
  );
  expect(reply).toBe('welcome');
  expect(errors).toEqual([]);
});
