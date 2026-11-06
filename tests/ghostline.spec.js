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
  expect(s.version).toBe(8);
  expect(s.ending).toEqual({ seen: false, runs: 0 });
  expect(s.story).toEqual({ met: [], beaten: [] });
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
  const errors = await boot(page, { key: 'ghostline-save', value: { version: 5, storySeen: true, runs: 5 } });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await simulate(page, 200);
  await play(page, (s) => { s.invuln = 0; s.shield = false; s.souls = 0; s.hit('beam'); s.invuln = 0; s.hit('beam'); });
  await page.waitForFunction(() => window.__game.scene.isActive('over'), null, { timeout: 15000 });
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('ghostline-save')));
  expect(save.best).toBeGreaterThanOrEqual(200);
  expect(save.stats.deaths.caught).toBe(1);
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
  // v6: getting caught is what rebirths you in creative mode
  await play(page, (s) => { s.invuln = 0; s.caught('caught'); s.invuln = 0; s.caught('pit'); });
  expect(await play(page, (s) => [s.dead, s.rebirths])).toEqual([false, before + 2]);
  await play(page, (s) => s.requestPause());
  const x = await page.evaluate(() => JSON.parse(localStorage.getItem('ghostline-save')).creative.x);
  expect(x / 24).toBeGreaterThan(499);
});

test('missions complete and pay out', async ({ page }) => {
  await boot(page, { key: 'ghostline-save', value: { version: 5, storySeen: true, runs: 5 } });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await simulate(page, 160);
  await play(page, (s) => { s.invuln = 0; s.shield = false; s.souls = 0; s.hit('beam'); s.invuln = 0; s.hit('beam'); });
  await page.waitForFunction(() => window.__game.scene.isActive('over'), null, { timeout: 15000 });
  const m = await page.evaluate(() => JSON.parse(localStorage.getItem('ghostline-save')).missions);
  expect(m.done).toContain('m150');
  expect(m.active.length).toBe(3);
});

test('score = meters x mission multiplier + combo points, and a hit drops the combo', async ({ page }) => {
  const errors = await boot(page, { key: 'ghostline-save', value: { version: 7, storySeen: true, missions: { active: [], done: [], stars: 0, level: 4, totals: {} } } });
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
  const errors = await boot(page, { key: 'ghostline-save', value: { version: 7, storySeen: true, runs: 5 } });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await simulate(page, 50);
  await play(page, (s) => { s.invuln = 0; s.rush = null; s.shield = false; s.souls = 0; s.hit('beam'); s.invuln = 0; s.hit('beam'); });
  await page.waitForFunction(() => window.__game.scene.isActive('over'), null, { timeout: 15000 });
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('ghostline-save')));
  expect(save.unlocks.got).toBeGreaterThanOrEqual(1);
  expect(save.boo.trail).toBe('ember');
  expect(save.bestScore).toBeGreaterThan(0);
  await page.waitForTimeout(2900); // the results stay readable for 2.6 s before the first card
  expect(await page.evaluate(() => !!window.__game.scene.getScene('over').card)).toBe(true);
  expect(errors).toEqual([]);
});

test('the unlocks screen and journal open from the menu', async ({ page }) => {
  const errors = await boot(page, { key: 'ghostline-save', value: { version: 7, storySeen: true, unlocks: { got: 12, points: 0, fresh: 3 } } });
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
  const errors = await boot(page, { key: 'ghostline-save', value: { version: 7, storySeen: true, owned: ['survivor', 'vampire'], selected: 'vampire' } });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const r = await play(page, (s) => ({ tint: s.look.tint, fx: s.look.look.fx, layer: s.layers.look }));
  expect(r).toEqual({ tint: 0xff6060, fx: 'bats', layer: 0xff6060 });
  expect(errors).toEqual([]);
});

// ---------------- v6 runner ----------------
test('runner: a stumble lets THE STRETCH closer, a second one in a row gets you caught', async ({ page }) => {
  const errors = await boot(page, { key: 'ghostline-save', value: { version: 7, storySeen: true, runs: 5 } });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await simulate(page, 60);
  const r = await play(page, (s) => {
    s.shield = false; s.souls = 0;
    const before = s.gap;
    s.invuln = 0; s.hit('grave');
    const one = { gap: s.gap, dead: s.dead, stumbles: s.stumbles };
    s.invuln = 0; s.hit('grave');
    return { before, one, dead: s.dead, cause: s.deathCause };
  });
  expect(r.one.dead).toBe(false);
  expect(r.one.stumbles).toBe(1);
  expect(r.before - r.one.gap).toBe(40);
  expect(r.dead).toBe(true);
  expect(r.cause).toBe('caught');
  expect(errors).toEqual([]);
});

test('runner: Boo carries you over the chasm, and it waits where you land', async ({ page }) => {
  const errors = await boot(page, { key: 'ghostline-save', value: { version: 7, storySeen: true, runs: 5 } });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const r = await play(page, (s) => {
    s.openingDone = true;
    let flew = false, n = 0;
    for (; n < 120 * 60 && !(flew && !s.flying); n++) { s.invuln = 1e9; s.step(1 / 120, n % 40 < 20); if (s.flying && s.flyKind === 'section') flew = true; }
    return { flew, flying: s.flying, gap: Math.round(s.gap), m: Math.floor(s.worldX / 24), dead: s.dead, zoneChasm: s.chasmZones.has(0) };
  });
  expect(r.flew).toBe(true);
  expect(r.flying).toBe(false);
  expect(r.zoneChasm).toBe(true);
  expect(r.gap).toBeLessThan(118); // it caught up while you were in the air
  expect(r.m).toBeGreaterThan(220);
  expect(r.dead).toBe(false);
  // three air hits and it's waiting right where you land
  const r2 = await play(page, (s) => {
    s.shield = false; // a shield power-up picked up on the way would absorb one hit
    s.startFlight('orb');
    for (let i = 0; i < 3; i++) { s.invuln = 0; s.hit('banshee'); }
    s.invuln = 0; s.endFlight();
    return { dead: s.dead, cause: s.deathCause };
  });
  expect(r2).toEqual({ dead: true, cause: 'caught' });
  expect(errors).toEqual([]);
});

test('runner: the salt shotgun fires on its own and smashes a crate into candles', async ({ page }) => {
  const errors = await boot(page, { key: 'ghostline-save', value: { version: 7, storySeen: true } });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const r = await play(page, (s) => {
    s.openingDone = true;
    s.armSalt();
    const crate = s.addTrap('crate', s.worldX + 180);
    const candles = s.candles.length;
    for (let n = 0; n < 120 && !crate.gone; n++) { s.invuln = 1e9; s.step(1 / 120, false); }
    return { gone: crate.gone, kills: s.kills, candles: s.candles.length - candles, ammo: s.weapon.ammo };
  });
  expect(r.gone).toBe(true);
  expect(r.kills).toBe(1);
  expect(r.candles).toBeGreaterThanOrEqual(2);
  expect(r.ammo).toBeLessThan(24);
  expect(errors).toEqual([]);
});

test('runner: on a first run, Boo saves you until 300 m', async ({ page }) => {
  const errors = await boot(page, { key: 'ghostline-save', value: { version: 7, storySeen: true } });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await simulate(page, 80);
  const r = await play(page, (s) => {
    s.shield = false;
    s.invuln = 0; s.hit('grave'); s.invuln = 0; s.hit('grave');
    return { safe: s.safeRun, dead: s.dead, rescues: s.rescues };
  });
  expect(r).toEqual({ safe: true, dead: false, rescues: 1 });
  expect(errors).toEqual([]);
});

// ---------------- v6 phase 3 (alpha) ----------------
const startRun = async (page, save) => {
  const errors = await boot(page, { key: 'ghostline-save', value: { version: 7, storySeen: true, runs: 12, ...save } });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  return errors;
};

test('phase 3: every hand-made trap pattern leaves time to jump or slide', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const P = await import('/src/patterns.js');
    return { unfair: P.ALL_PATTERNS.filter((p) => !P.patternFair(p)).map((p) => p.id), worlds: Object.keys(P.WORLD_PATTERNS).length, n: P.ALL_PATTERNS.length };
  });
  expect(r.unfair).toEqual([]);
  expect(r.worlds).toBe(8);
  expect(r.n).toBeGreaterThanOrEqual(20);
});

test('phase 3: every world has its own flight set piece, and each one builds its hazards', async ({ page }) => {
  const errors = await startRun(page, {});
  const r = await play(page, (s) => {
    const out = {};
    for (let w = 0; w < 8; w++) {
      s.traps.forEach((t) => s.dropTrap(t)); s.traps = []; s.trick = null; s.chasm = null;
      s.worldX = (w * 400 + 100) * 24; s.zoneIndex = w; s.nextTrapX = s.worldX + 1e6; s.trickZone = w; s.nextTrickT = 99;
      let n = 0;
      for (; n < 120 * 30 && !s.flying; n++) { s.invuln = 1e9; s.step(1 / 120, true); }
      const title = s.setPiece && s.setPiece.title;
      let made = 0, maxI = 0, segs = s.setPiece ? s.setPiece.segs.length : -1;
      const count = () => s.beams.length + s.hands.length + s.warnings.length + s.lasers.length + s.banshees.length;
      for (n = 0; n < 120 * 20 && s.flying; n++) { s.invuln = 1e9; const c0 = count(); s.step(1 / 120, s.py > 180); made += Math.max(0, count() - c0); if (s.setPiece) maxI = s.setPiece.i; }
      out[w] = { title, done: maxI === segs, made, landed: !s.flying };
    }
    return out;
  });
  const titles = new Set(Object.values(r).map((x) => x.title));
  expect(titles.size).toBe(8);
  for (const w of Object.values(r)) { expect(w.done).toBe(true); expect(w.landed).toBe(true); expect(w.made).toBeGreaterThan(3); }
  expect(errors).toEqual([]);
});

test('phase 3: THE STRETCH has a trick in every world, it can hurt you, and it ends', async ({ page }) => {
  const errors = await startRun(page, {});
  const r = await play(page, (s) => {
    const out = {};
    for (let w = 0; w < 7; w++) {
      s.zoneIndex = w;
      s.traps.forEach((t) => s.dropTrap(t)); s.traps = []; s.trick = null;
      s.startTrick(false);
      const t = s.trick;
      let armed = false, n = 0;
      for (; n < 120 * 8 && s.trick === t; n++) { s.invuln = 1e9; s.nextTrapX = s.worldX + 1e6; s.step(1 / 120, false); if (!t.gone && s.trickBox(t)) armed = true; }
      out[t.trick] = { armed, ended: s.trick !== t };
    }
    return out;
  });
  expect(Object.keys(r).sort()).toEqual(['burrow', 'canopy', 'ceiling', 'drawer', 'reach', 'ride', 'skull']);
  expect(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.armed && v.ended]))).toEqual({ burrow: true, canopy: true, ceiling: true, drawer: true, reach: true, ride: true, skull: true });
  expect(errors).toEqual([]);
});

test('phase 3: each weapon only aims at what it answers', async ({ page }) => {
  const errors = await startRun(page, {});
  const r = await play(page, (s) => {
    s.openingDone = true;
    s.traps.forEach((t) => s.dropTrap(t)); s.traps = [];
    const vent = s.addTrap('vent', s.worldX + 160);
    const crate = s.addTrap('crate', s.worldX + 220);
    s.armWeapon('salt');
    const salt = s.targets('salt').map((x) => x.t.kind);
    s.weapon = null;
    s.armWeapon('holy');
    for (let n = 0; n < 240 && !vent.gone; n++) { s.invuln = 1e9; s.step(1 / 120, false); }
    return { salt, ventGone: vent.gone, crateLeft: !crate.gone || crate.wx < s.worldX };
  });
  expect(r.salt).toEqual(['crate']);
  expect(r.ventGone).toBe(true); // holy water douses the steam
  expect(r.crateLeft).toBe(true); // and leaves the crate to the salt
  expect(errors).toEqual([]);
});

test('phase 3: the door at the end of world 8 stays shut without every journal page', async ({ page }) => {
  const errors = await startRun(page, { unlocks: { got: 8, points: 0, fresh: 0 } });
  const r = await play(page, (s) => {
    s.openingDone = true;
    s.worldX = 3150 * 24; s.zoneIndex = 7; s.chasmZones.add(7); s.nextTrapX = s.worldX + 1e6;
    let n = 0;
    for (; n < 120 * 20 && !s.ended; n++) { s.invuln = 1e9; s.trickZone = 7; s.nextTrickT = 99; s.step(1 / 120, false); }
    return { kind: s.finish && s.finish.kind, ended: s.ended, cause: s.lastHitKind };
  });
  expect(r).toEqual({ kind: 'locked', ended: true, cause: 'door' });
  expect(errors).toEqual([]);
});

test('phase 3: with every page the door opens, the ending plays once, then endless mode', async ({ page }) => {
  const errors = await startRun(page, { unlocks: { got: 33, points: 0, fresh: 0 } });
  const r = await play(page, (s) => {
    s.openingDone = true;
    s.worldX = 3150 * 24; s.zoneIndex = 7; s.chasmZones.add(7); s.nextTrapX = s.worldX + 1e6;
    let n = 0;
    for (; n < 120 * 25 && !s.ended; n++) { s.invuln = 1e9; s.trickZone = 7; s.nextTrickT = 99; s.step(1 / 120, false); }
    return { kind: s.finish && s.finish.kind, ended: s.ended };
  });
  expect(r).toEqual({ kind: 'ending', ended: true });
  const save = await page.evaluate(async () => (await import('/src/save.js')).Save.get());
  expect(save.ending.seen).toBe(true);
  // endless: starts past the door, the score counts only what you ran, and a new depth every 400 m
  await page.evaluate(async () => { const { Save } = await import('/src/save.js'); Save.update((s) => { s.mode = 'endless'; }); });
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const e = await play(page, (s) => {
    const start = Math.floor(s.worldX / 24), score0 = s.totalScore();
    s.openingDone = true;
    for (let n = 0; n < 120 * 40 && !s.dead; n++) { s.invuln = 1e9; s.step(1 / 120, n % 40 < 20); }
    return { start, beyond: s.beyond, score0, depth: s.depth, dead: s.dead };
  });
  expect(e.start).toBeGreaterThan(3200);
  expect(e.beyond).toBe(true);
  expect(e.score0).toBeLessThan(300); // not the 3,200 m before the door
  expect(e.depth).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('phase 4: one message on screen at a time (a headline clears the popup; only danger beats a headline)', async ({ page }) => {
  const errors = await startRun(page, {});
  const r = await play(page, (s) => {
    s.openingDone = true; s.started = true;
    const up = () => (s.popups || []).filter((o) => o.active).length + (s.headlineUp() ? 1 : 0) + (s.bubble ? 1 : 0);
    s.popup('SMASH!', '#ffd0a0');
    s.headline('THE WARD', 'A SECOND LINE', 1.0, true);
    const afterHead = up();
    s.popup('POOF!', '#c8ffc0'); // not important: waits out the headline
    const afterPoof = { n: up(), head: s.headlineUp() };
    s.popup('STUMBLE!', '#ff8a9a'); // danger: clears the headline
    const afterDanger = { n: up(), head: s.headlineUp() };
    return { afterHead, afterPoof, afterDanger, subLine: s.headObjs ? s.headObjs.length : 0 };
  });
  expect(r.afterHead).toBe(1);
  expect(r.afterPoof).toEqual({ n: 1, head: true });
  expect(r.afterDanger).toEqual({ n: 1, head: false });
  expect(errors).toEqual([]);
});

test('phase 4: every world has a scare, it never spawns a trap or hurts you, and it ends', async ({ page }) => {
  const errors = await startRun(page, {});
  const r = await play(page, (s) => {
    s.openingDone = true; s.started = true;
    const out = {};
    for (let w = 0; w < 8; w++) {
      s.zoneIndex = w; s.traps.forEach((t) => s.dropTrap(t)); s.traps = []; s.trick = null; s.scare = null;
      const id = ['ward', 'morgue', 'woods', 'graveyard', 'sewer', 'catacombs', 'carnival', 'otherside'][w];
      s.startScare(id);
      const before = s.traps.length, gap0 = s.gap;
      let n = 0, spawned = 0, hit = false;
      for (; n < 120 * 5 && s.scare; n++) { s.step(1 / 120, false); spawned = Math.max(spawned, s.traps.filter((t) => !t.gone).length - before); if (s.scare?.hit) hit = true; }
      out[id] = { ended: !s.scare, hit, spawned, dead: s.dead, gapKept: s.gap >= gap0 - 5 };
    }
    return out;
  });
  for (const v of Object.values(r)) expect(v).toEqual({ ended: true, hit: true, spawned: 0, dead: false, gapKept: true });
  expect(Object.keys(r).length).toBe(8);
  expect(errors).toEqual([]);
});

test('phase 4: THE STRETCH changes as it gets closer (far, middle, near)', async ({ page }) => {
  const errors = await startRun(page, {});
  const r = await play(page, (s) => {
    s.openingDone = true; s.started = true; s.nextTrapX = s.worldX + 1e6;
    const at = (gap) => { s.gap = gap; s.lastStumble = -99; s.catchUpT = 0; for (let i = 0; i < 90; i++) { s.invuln = 1e9; s.step(1 / 120, false); if (i % 10 === 0) s.render(0); } s.render(0); return { st: s.stretchSt, anim: s.stretch.anims.currentAnim.key, booAhead: s.ghostX > 150 }; };
    return [at(118), at(70), at(34)];
  });
  expect(r.map((x) => x.st)).toEqual(['f', 'm', 'n']);
  expect(r[0].anim).toBe('stretch_walk');
  expect(r[1].anim).toBe('stretch_walk_m');
  expect(r[2].anim).toBe('stretch_walk_n');
  expect(r.map((x) => x.booAhead)).toEqual([false, false, true]); // Boo gets out of the way when it's close
  expect(errors).toEqual([]);
});

test('phase 4: the ending plays its beats: the journal, the close-up, the lit ward', async ({ page }) => {
  const errors = await startRun(page, { unlocks: { got: 33, points: 0, fresh: 0 } });
  const r = await play(page, (s) => {
    s.openingDone = true;
    s.worldX = 3150 * 24; s.zoneIndex = 7; s.chasmZones.add(7); s.nextTrapX = s.worldX + 1e6;
    const seen = { tiles: false, face: false, ward: false };
    for (let n = 0; n < 120 * 40 && !s.ended; n++) {
      s.invuln = 1e9; s.trickZone = 7; s.nextTrickT = 99; s.step(1 / 120, false);
      if (n % 12 === 0) { s.render(0); if (s.endTiles) seen.tiles = true; if (s.endFace) seen.face = true; if (s.finish?.wardIn) seen.ward = s.layers.A.far.texture.key === 'ward_far'; }
    }
    return { ...seen, ended: s.ended };
  });
  expect(r).toEqual({ tiles: true, face: true, ward: true, ended: true });
  expect(errors).toEqual([]);
});

test('v8 story: meet Ivy, the Matron arena ends world 1, beating her saves it and the next run goes past', async ({ page }) => {
  const errors = await boot(page, { key: 'ghostline-save', value: { version: 7, storySeen: true, runs: 5 } });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const run = () => play(page, (s) => {
    s.openingDone = true; s.started = true;
    let n = 0;
    while (!s.bossOn && s.worldX / 24 < 396 && n < 200000 && !s.dead) { s.invuln = 1e9; s.gap = 118; s.step(1 / 120, Math.floor(n / 40) % 2 === 0); n++; }
    return { m: Math.floor(s.worldX / 24), bossOn: s.bossOn, dead: s.dead, met: JSON.parse(localStorage.getItem('ghostline-save')).story.met };
  });
  const r = await run();
  expect(r).toEqual({ m: expect.any(Number), bossOn: true, dead: false, met: ['ivy'] });
  expect(r.m).toBeGreaterThanOrEqual(368);
  await page.waitForFunction(() => window.__game.scene.isActive('boss') && window.__boss);
  expect(await page.evaluate(() => ({ powers: window.__boss.powers, paused: window.__game.scene.isPaused('play') }))).toEqual({ powers: ['penlight'], paused: true });
  await page.evaluate(() => window.__boss.win());
  await page.waitForFunction(() => !window.__game.scene.isActive('boss') && !window.__game.scene.isPaused('play'), null, { timeout: 10000 });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ghostline-save')).story.beaten)).toEqual(['matron']);
  // the run goes on to the gate
  const r1 = await run();
  expect(r1.bossOn).toBe(false);
  expect(r1.dead).toBe(false);
  // a new run with that save: no arena this time
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ghostline-save')));
  await boot(page, { key: 'ghostline-save', value: saved });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const r2 = await run();
  expect(r2.bossOn).toBe(false);
  expect(r2.m).toBeGreaterThanOrEqual(395);
  expect(errors).toEqual([]);
});
