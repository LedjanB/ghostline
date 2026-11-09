import { test, expect } from '@playwright/test';

test('wardlab boots with existing Milo, moves, and switches ghost form', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?wardlab=1');
  await page.waitForFunction(() => window.__game?.scene?.isActive('wardlab'));
  await page.waitForFunction(() => {
    const s = window.__game.scene.getScene('wardlab');
    return s.milo?.sprite?.texture?.key === 'milo2_living';
  });
  const start = await page.evaluate(() => window.__game.scene.getScene('wardlab').m.x);
  await page.keyboard.down('d');
  await page.waitForTimeout(700);
  await page.keyboard.up('d');
  const after = await page.evaluate(() => window.__game.scene.getScene('wardlab').m.x);
  expect(after).toBeGreaterThan(start + 20);
  await page.keyboard.press('g');
  await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('wardlab').ghost)).toBe(true);
  expect(errors).toEqual([]);
});
