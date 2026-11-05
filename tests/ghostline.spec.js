// End-to-end checks for Ghostline. The game exposes window.__game (the Phaser game) for tests.
import { test, expect } from '@playwright/test';

const scenes = (page) => page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key));
const play = (page, fn, arg) => page.evaluate(([src, a]) => (0, eval)(src)(window.__game.scene.getScene('play'), a), [fn.toString(), arg]);

async function boot(page, save) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.evaluate((s) => { localStorage.clear(); if (s) localStorage.setItem(s.key, JSON.stringify(s.value)); }, save);
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  await page.waitForTimeout(500);
  return errors;
}

// step the real game logic quickly instead of waiting in real time
async function simulate(page, meters, { invuln = true } = {}) {
  return play(page, (s, { m, invuln }) => {
    s.openingDone = true;
    let n = 0;
    while (s.worldX / 24 < m && n < 300000 && !s.dead) {
      if (invuln) s.invuln = 1e9;
      s.step(1 / 120, Math.floor(n / 40) % 2 === 0);
      n++;
    }
    if (invuln) s.invuln = 0;
    return { meters: Math.floor(s.worldX / 24), zone: s.zoneIndex, dead: s.dead };
  }, { m: meters, invuln });
}

test('first launch plays the story, then starts a run', async ({ page }) => {
  const errors = await boot(page);
  expect(await scenes(page)).toContain('story');
  await page.evaluate(() => window.__game.scene.getScene('story').finish());
  await page.waitForTimeout(1200);
  expect(await scenes(page)).toEqual(expect.arrayContaining(['play', 'hud']));
  expect(errors).toEqual([]);
});

test('an old v1 save migrates to the current version and keeps progress', async ({ page }) => {
  await boot(page, { key: 'ghostline-save-v1', value: { candles: 321, best: 999, owned: ['survivor', 'nurse'], selected: 'nurse', muted: true, runs: 7 } });
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('ghostline-save')));
  expect(s.version).toBe(6);
  expect(s.candles).toBe(321);
  expect(s.bestScore).toBe(0);
  expect(s.boo).toEqual({ hat: 'none', trail: 'ecto' });
  expect(s.best).toBe(999);
  expect(s.owned).toContain('nurse');
  expect(s.settings.muted).toBe(true);
});

test('a corrupt save falls back to the backup', async ({ page }) => {
  await boot(page, { key: 'ghostline-save', value: { version: 5, storySeen: true, candles: 50 } });
  await page.evaluate(() => { localStorage.setItem('ghostline-save.bak', localStorage.getItem('ghostline-save')); localStorage.setItem('ghostline-save', '{broken'); });
  await page.reload();
  await page.waitForFunction(() => window.__game);
  const s = await page.evaluate(async () => (await import('/src/save.js')).Save.get());
  expect(s.candles).toBe(50);
});

test('backup code restores a save', async ({ page }) => {
  await boot(page, { key: 'ghostline-save', value: { version: 5, storySeen: true, candles: 10 } });
  const after = await page.evaluate(async () => {
    const { Save } = await import('/src/save.js');
    const code = Save.exportCode();
    Save.update((s) => { s.candles = 0; });
    return { ok: Save.importCode(code), candles: Save.get().candles, bad: Save.importCode('nope') };
  });
  expect(after).toEqual({ ok: true, candles: 10, bad: false });
});

test('the journey goes through all 8 zones in order, never looping', async ({ page }) => {
  await boot(page, { key: 'ghostline-save', value: { version: 5, storySeen: true } });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const seen = [];
  for (let z = 1; z <= 7; z++) {
    const r = await simulate(page, z * 400 + 30);
    seen.push(r.zone);
  }
  expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7]);
  const layer = await play(page, (s) => s.layers.zone);
  expect(layer).toBe('otherside');
});

test('dying shows the results screen and retry starts a fresh run', async ({ page }) => {
  const errors = await boot(page, { key: 'ghostline-save', value: { version: 5, storySeen: true } });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await simulate(page, 200);
  await play(page, (s) => { s.invuln = 0; s.shield = false; s.souls = 0; s.hit('beam'); });
  await page.waitForFunction(() => window.__game.scene.isActive('over'), null, { timeout: 15000 });
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('ghostline-save')));
  expect(save.best).toBeGreaterThanOrEqual(200);
  expect(save.stats.deaths.beam).toBe(1);
  // reveal cards (level-ups, unlocks) come first; Enter clears each, then RETRY
  await page.waitForTimeout(1300);
  for (let i = 0; i < 10 && await page.evaluate(() => window.__game.scene.isActive('over')); i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1200);
  expect(await play(page, (s) => Math.floor(s.worldX / 24))).toBeLessThan(100);
  expect(errors).toEqual([]);
});

test('creative mode never dies and continues where you left off', async ({ page }) => {
  await boot(page, { key: 'ghostline-save', value: { version: 5, storySeen: true, mode: 'creative' } });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await simulate(page, 500);
  const before = await play(page, (s) => { s.shield = false; s.rush = null; return s.rebirths; });
  await play(page, (s) => { s.invuln = 0; s.hit('hand'); s.invuln = 0; s.hit('laser'); });
  expect(await play(page, (s) => [s.dead, s.rebirths])).toEqual([false, before + 2]);
  await play(page, (s) => s.requestPause());
  const x = await page.evaluate(() => JSON.parse(localStorage.getItem('ghostline-save')).creative.x);
  expect(x / 24).toBeGreaterThan(499);
});

test('missions complete and pay out', async ({ page }) => {
  await boot(page, { key: 'ghostline-save', value: { version: 5, storySeen: true } });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await simulate(page, 160);
  await play(page, (s) => { s.invuln = 0; s.shield = false; s.souls = 0; s.hit('beam'); });
  await page.waitForFunction(() => window.__game.scene.isActive('over'), null, { timeout: 15000 });
  const m = await page.evaluate(() => JSON.parse(localStorage.getItem('ghostline-save')).missions);
  expect(m.done).toContain('m150');
  expect(m.active.length).toBe(3);
});

test('score = meters x mission multiplier + combo points, and a hit drops the combo', async ({ page }) => {
  const errors = await boot(page, { key: 'ghostline-save', value: { version: 6, storySeen: true, missions: { active: [], done: [], stars: 0, level: 4, totals: {} } } });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const r = await play(page, (s) => {
    // step and check in one go, so the live game loop can't land a hit in between
    s.openingDone = true;
    for (let n = 0; s.worldX / 24 < 100 && n < 100000; n++) { s.invuln = 1e9; s.step(1 / 120, n % 80 < 40); }
    s.resetCombo(); s.points = 0;
    for (let i = 0; i < 12; i++) s.addCombo('near');
    const tier = s.comboTier, combo = s.combo, points = s.points;
    const meters = Math.floor(s.worldX / 24);
    const total = s.totalScore();
    s.invuln = 0; s.rush = null; s.shield = true; s.hit('beam');
    return { mult: s.mult, tier, combo, points, ok: total === meters * 4 + points, after: s.combo, dead: s.dead };
  });
  expect(r.mult).toBe(4);
  expect(r.tier).toBe(2);
  expect(r.combo).toBe(12);
  // 11 near misses at x1 + the 12th at x2, all times the x4 multiplier
  expect(r.points).toBe((11 * 25 + 25 * 2) * 4);
  expect(r.ok).toBe(true);
  expect(r.after).toBe(0);
  expect(r.dead).toBe(false);
  expect(errors).toEqual([]);
});

test('every run unlocks something, new hats and trails go straight on Boo', async ({ page }) => {
  const errors = await boot(page, { key: 'ghostline-save', value: { version: 6, storySeen: true } });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await simulate(page, 50);
  await play(page, (s) => { s.invuln = 0; s.rush = null; s.shield = false; s.souls = 0; s.hit('beam'); });
  await page.waitForFunction(() => window.__game.scene.isActive('over'), null, { timeout: 15000 });
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('ghostline-save')));
  expect(save.unlocks.got).toBeGreaterThanOrEqual(1);
  expect(save.boo.trail).toBe('ember');
  expect(save.bestScore).toBeGreaterThan(0);
  await page.waitForTimeout(1300);
  expect(await page.evaluate(() => !!window.__game.scene.getScene('over').card)).toBe(true);
  expect(errors).toEqual([]);
});

test('the unlocks screen and journal open from the menu', async ({ page }) => {
  const errors = await boot(page, { key: 'ghostline-save', value: { version: 6, storySeen: true, unlocks: { got: 12, points: 0, fresh: 3 } } });
  await page.evaluate(() => window.__game.scene.getScene('menu').overlay('unlocks'));
  await page.waitForTimeout(400);
  expect(await scenes(page)).toContain('unlocks');
  const r = await page.evaluate(() => {
    const u = window.__game.scene.getScene('unlocks');
    u.pickHat(u.hatBtns[1].item, u.hatBtns[1]);
    u.openJournal(); u.turn(1); u.closeJournal();
    return { hat: JSON.parse(localStorage.getItem('ghostline-save')).boo.hat, pages: u.pages.length, fresh: JSON.parse(localStorage.getItem('ghostline-save')).unlocks.fresh };
  });
  expect(r).toEqual({ hat: 'top', pages: 4, fresh: 0 });
  expect(errors).toEqual([]);
});

test('every character has its own world look', async ({ page }) => {
  const errors = await boot(page, { key: 'ghostline-save', value: { version: 6, storySeen: true, owned: ['survivor', 'vampire'], selected: 'vampire' } });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const r = await play(page, (s) => ({ tint: s.look.tint, fx: s.look.look.fx, layer: s.layers.look }));
  expect(r).toEqual({ tint: 0xff6060, fx: 'bats', layer: 0xff6060 });
  expect(errors).toEqual([]);
});
