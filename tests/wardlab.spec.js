import { test, expect } from '@playwright/test';

const lab = (page, fn, arg) => page.evaluate(([src, a]) => {
  const s = window.__game.scene.getScene('wardlab');
  return new Function('s', 'a', src)(s, a);
}, [fn, arg]);
// records every frame in the page, so short states (airborne, land) can't fall between two polls on a slow machine
const watchAir = (page) => lab(page, 's.__seen = new Set(); s.events.on("postupdate", () => { s.__seen.add(s.m.ground ? "ground" : "air"); s.__seen.add(s.milo.anim); });');
const boot = async (page, errors) => {
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?wardlab=1');
  await page.waitForFunction(() => window.__game?.scene?.isActive('wardlab'));
  await page.waitForFunction(() => window.__game.scene.getScene('wardlab').milo?.sprite?.texture?.key === 'milo2_living');
};

test('wardlab boots with existing Milo, moves, and switches ghost form', async ({ page }) => {
  const errors = [];
  await boot(page, errors);
  const start = await lab(page, 'return s.m.x');
  await page.keyboard.down('d');
  await page.waitForTimeout(700);
  await page.keyboard.up('d');
  const after = await lab(page, 'return s.m.x');
  expect(after).toBeGreaterThan(start + 20);
  await page.keyboard.press('g');
  await expect.poll(() => lab(page, 'return s.ghost')).toBe(true);
  expect(errors).toEqual([]);
});

test('wardlab walk and run cycles are timed to ground speed, then stop to idle', async ({ page }) => {
  const errors = [];
  await boot(page, errors);
  await page.keyboard.down('d');
  await expect.poll(() => lab(page, 'return s.milo.anim === "walk" && Math.abs(s.m.vx) >= 104'), { timeout: 10000 }).toBe(true);
  const walk = await lab(page, 'return { anim: s.milo.anim, speed: s.milo.speed, vx: s.m.vx }');
  expect(walk.anim).toBe('walk');
  expect(walk.speed).toBeGreaterThan(0.95);
  expect(walk.speed).toBeLessThan(1.05);
  await page.keyboard.down('Shift');
  await expect.poll(() => lab(page, 'return s.milo.anim === "run" && Math.abs(s.m.vx) >= 260'), { timeout: 10000 }).toBe(true);
  const run = await lab(page, 'return { anim: s.milo.anim, speed: s.milo.speed }');
  await page.keyboard.up('Shift');
  await page.keyboard.up('d');
  expect(run.anim).toBe('run');
  expect(run.speed).toBeGreaterThan(0.9);
  await expect.poll(() => lab(page, 'return s.milo.anim'), { timeout: 10000 }).toBe('idle');
  expect(errors).toEqual([]);
});

test('wardlab bed blocks a walk, a jump lands on top with the land frames', async ({ page }) => {
  const errors = [];
  await boot(page, errors);
  await lab(page, 's.m.x = 120; s.milo.setFacing(1);');
  await page.keyboard.down('d');
  await expect.poll(() => lab(page, 'return s.m.blocked === true'), { timeout: 10000 }).toBe(true);
  await page.waitForTimeout(300);
  const blocked = await lab(page, 'return s.m.x');
  expect(blocked).toBeLessThan(196);
  expect(await lab(page, 'return s.milo.anim')).not.toMatch(/walk|run/); // no treading in place
  await watchAir(page);
  await page.keyboard.down('Space');
  // on the bed top (it lasts until he walks off at x 446), then let go
  await expect.poll(() => lab(page, 'return s.m.ground && s.m.y === 265 && s.m.x > 220'), { timeout: 10000 }).toBe(true);
  await page.keyboard.up('d');
  await page.keyboard.up('Space');
  expect(await lab(page, 'return [...s.__seen]')).toEqual(expect.arrayContaining(['air', 'jump_start', 'land']));
  await expect.poll(() => lab(page, 'return s.m.ground && s.m.y === 265'), { timeout: 10000 }).toBe(true);
  expect(errors).toEqual([]);
});

test('wardlab touch: left-half drag walks, far drag runs, right-half tap jumps', async ({ page }) => {
  const errors = [];
  await boot(page, errors);
  const box = await page.locator('canvas').boundingBox();
  const k = box.width / 640, X = (gx) => box.x + gx * k, Y = (gy) => box.y + gy * k;
  await lab(page, 's.m.x = 520;');
  await page.mouse.move(X(120), Y(250));
  await page.mouse.down();
  await page.mouse.move(X(150), Y(250));
  await expect.poll(() => lab(page, 'return s.milo.anim'), { timeout: 10000 }).toBe('walk');
  await page.mouse.move(X(200), Y(250));
  await expect.poll(() => lab(page, 'return s.milo.anim'), { timeout: 10000 }).toBe('run');
  await page.mouse.up();
  await expect.poll(() => lab(page, 'return s.milo.anim'), { timeout: 10000 }).toBe('idle');
  await watchAir(page);
  await page.mouse.click(X(500), Y(250));
  await expect.poll(() => lab(page, 'return s.__seen.has("air")'), { timeout: 10000 }).toBe(true);
  expect(errors).toEqual([]);
});
