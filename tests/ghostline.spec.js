// End-to-end checks for Ghostline. The game exposes window.__game (the Phaser game) for tests.
import { test, expect } from '@playwright/test';

const scenes = (page) => page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key));
const play = (page, fn, arg) => page.evaluate(([src, a]) => (0, eval)(src)(window.__game.scene.getScene('play'), a), [fn.toString(), arg]);

async function boot(page, save, { stations = false } = {}) {
  const errors = [];
  // v9: most tests step through Ward 4 without walking; the station test turns the nurse stations on
  await page.addInitScript((on) => { window.__noStations = !on; }, stations);
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

// THE WRONG SIDE OF THE BED: drive the opening with its own step() and a fake stick
const op = (page, fn, arg) => page.evaluate(([src, a]) => (0, eval)(src)(window.__opening, a), [fn.toString(), arg]);
const opUntil = (page, x, phase, max = 60) => op(page, (s, { x, phase, max }) => {
  s.debugInput = { x };
  let n = 0;
  while (s.phase !== phase && n < max * 60) { s.step(1 / 60); n++; }
  s.debugInput = { x: 0 };
  return { phase: s.phase, x: Math.round(s.m.x), t: n / 60 };
}, { x, phase, max });

test('first launch plays the opening: body + ghost, Ghostline once, shadow, Boo, then the run', async ({ page }) => {
  const errors = await boot(page);
  expect(await scenes(page)).toContain('opening');
  expect(await scenes(page)).not.toContain('story');
  await op(page, (s) => { s.begin(); });
  expect((await opUntil(page, 0, 'explore', 20)).phase).toBe('explore');
  const seen = await op(page, (s) => ({ shown: s.m.shown, body: s.blanket.visible, lamps: s.lamps, clock: s.clockState }));
  expect(seen.lamps).toBe(0); // the power is out
  expect(seen.clock).toBe('off');
  expect(seen.shown).toBe(true);
  expect(seen.body).toBe(true);
  // nothing happens on a timer: stand still for 30 s
  const idle = await op(page, (s) => { for (let i = 0; i < 1800; i++) s.step(1 / 60); return { phase: s.phase, flags: { ...s.flags } }; });
  expect(idle.phase).toBe('explore');
  expect(idle.flags.discover).toBe(0);
  // walk to the bed: the discovery fires once
  expect((await opUntil(page, -1, 'discover', 10)).phase).toBe('discover');
  expect((await opUntil(page, 0, 'explore2', 15)).phase).toBe('explore2');
  expect(await op(page, (s) => s.line)).toBeGreaterThan(0.9);
  await opUntil(page, -1, 'none', 3); // back past the bed again: no second discovery
  expect(await op(page, (s) => s.flags.discover)).toBe(1);
  // the camera follows Milo's world position (not a fixed screen spot)
  const camA = await op(page, (s) => s.cam.x);
  expect((await opUntil(page, 1, 'shadow', 20)).phase).toBe('shadow');
  const camB = await op(page, (s) => s.cam.x);
  expect(camB - camA).toBeGreaterThan(150);
  // THE STRETCH: shadow only
  expect((await opUntil(page, 0, 'boo', 20)).phase).toBe('boo');
  expect(await op(page, (s) => s.sh.on)).toBe(true);
  expect(await op(page, (s) => s.children.list.concat(s.worldL.list).some((o) => o.texture && /^stretch_/.test(o.texture.key)))).toBe(false);
  expect((await opUntil(page, 0, 'end', 15)).phase).toBe('end');
  expect(await op(page, (s) => s.flags)).toEqual({ discover: 1, shadow: 1, boo: 1, ended: 1 });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ghostline-save')).storySeen)).toBe(true);
  await op(page, (s) => { s.toRun(); });
  await page.waitForTimeout(1200);
  expect(await scenes(page)).toEqual(expect.arrayContaining(['play', 'hud']));
  expect(errors).toEqual([]);
});

test('opening v2: both Milos in one shot, the impossible touch, the Ghostline wrist -> wrist -> floor, anchored', async ({ page }) => {
  const errors = await boot(page);
  await op(page, (s) => { s.begin(); });
  // the awakening: one held shot, the zoom never changes, both Milos are in frame together after the rise
  const shot = await op(page, (s) => {
    let both = 0, zs = new Set();
    while (s.phase !== 'explore') {
      s.step(1 / 60); s.render(); zs.add(Math.round(s.cam.z * 1000));
      const v = s.cameras.main.worldView;
      const inView = (x, y) => x > v.x && x < v.right && y > v.y && y < v.bottom;
      if (s.rise < 0 && s.m.shown && inView(s.gx, s.gy - 40) && inView(s.blanket.x + 20, s.blanket.y + 10)) both += 1 / 60;
    }
    return { both, zs: [...zs], clock: s.clockState, battery: s.battery };
  });
  expect(shot.zs).toEqual([1333]); // 4/3 only: one art pixel = 4 screen px, no close-ups
  expect(shot.both).toBeGreaterThan(1.4); // held ~2 s with both of him in shot before control
  expect(shot.clock).toBe('off');
  expect(shot.battery).toBe(true);
  // walking to the bed: Milo stops, looks, hesitates, reaches, his hand goes through, the hand twitches, the line
  const beat = await op(page, (s) => {
    s.debugInput = { x: -1 };
    let n = 0;
    while (s.phase !== 'discover' && n++ < 600) { s.step(1 / 60); s.render(); }
    s.debugInput = { x: 0 };
    const poses = [], stages = [], said = new Set();
    let twitched = false, ctlDuring = false, overlap = 1e9, stageOrder = [];
    while (s.phase === 'discover' && n++ < 2000) {
      s.step(1 / 60); s.render();
      if (s.pose && poses[poses.length - 1] !== s.pose) poses.push(s.pose);
      if (s.twitch > 0) twitched = true;
      if (s.control && s.phase === 'discover') ctlDuring = true;
      if (s.bubble) said.add(s.bubble.str);
      if (s.pose === 'reach2') { const w = s.wrist(); overlap = Math.min(overlap, Math.abs(w.x - 6 - s.hand.x - 6)); }
      if (stageOrder[stageOrder.length - 1] !== s.gl.stage) stageOrder.push(s.gl.stage);
    }
    return { phase: s.phase, control: s.control, poses, twitched, ctlDuring, said: [...said], overlap, stageOrder, line: s.line };
  });
  expect(beat.phase).toBe('explore2');
  expect(beat.control).toBe(true);
  expect(beat.ctlDuring).toBe(false);
  expect(beat.poses).toEqual(['look', 'unsure', 'reach1', 'reach2', 'reach3', 'recoil']);
  expect(beat.twitched).toBe(true);
  expect(beat.said).toContain("NO. THAT'S ME.");
  expect(beat.overlap).toBeLessThan(12); // his hand is right over his own
  expect(beat.stageOrder).toEqual([0, 1, 2, 3, 4]); // pulse wrist -> wrist, flash, into the floor, settled
  expect(beat.line).toBe(1);
  // the thread hangs from his moving wrist, ends at the living wrist and goes into the seam under the bed
  const moves = await op(page, (s) => {
    const out = [];
    s.debugInput = { x: 1 };
    for (let i = 0; i < 90; i++) { s.step(1 / 60); s.render(); if (i % 30 === 29) { const w = s.wrist(); out.push({ d: Math.hypot(w.x - s.glPts.start.x, w.y - s.glPts.start.y), x: w.x, mid: s.glPts.mid, end: s.glPts.end }); } }
    s.debugInput = { x: 0 };
    for (let i = 0; i < 300; i++) s.step(1 / 60);
    return { out, a: s.gl.a };
  });
  moves.out.forEach((o) => expect(o.d).toBeLessThan(0.01));
  expect(moves.out[2].x - moves.out[0].x).toBeGreaterThan(60);
  expect(moves.out[0].mid.y).toBeLessThan(moves.out[0].end.y); // living wrist above the floor seam
  expect(moves.a).toBeLessThan(0.5); // it settles to a faint thread
  expect(errors).toEqual([]);
});

test('opening v2: walking to the door first meets a shut door, the monitor and the body call him back', async ({ page }) => {
  const errors = await boot(page);
  await op(page, (s) => { s.begin(); });
  await opUntil(page, 0, 'explore', 25);
  const r = await op(page, (s) => {
    s.debugInput = { x: 1 };
    let maxX = 0, glance = false, loud = false;
    for (let i = 0; i < 60 * 9; i++) { s.step(1 / 60); maxX = Math.max(maxX, s.m.x); if (s.glance > 0) glance = true; if (s.loud > 0) loud = true; }
    s.debugInput = { x: 0 };
    return { maxX, glance, loud, phase: s.phase, shut: s.doorOpen < 0.05, hint: s.hintShown };
  });
  expect(r.maxX).toBeGreaterThan(880); // he gets all the way to the door
  expect(r.maxX).toBeLessThan(900); // and it is shut
  expect(r.shut).toBe(true);
  expect(r.glance && r.loud).toBe(true);
  expect(r.phase).toBe('explore');
  expect(r.hint).toBe(false); // he moved: no hint
  // standing still a while shows the small movement hint
  const h = await op(page, (s) => { s.scene.restart(); return true; });
  await page.waitForTimeout(400);
  const idle = await op(page, (s) => { s.begin(); while (s.phase !== 'explore') s.step(1 / 60); for (let i = 0; i < 60 * 6; i++) s.step(1 / 60); return s.hintShown; });
  expect(h && idle).toBe(true);
  expect(errors).toEqual([]);
});

test('?opening=1 replays the opening for a returning player and leaves the save alone', async ({ page }) => {
  const errors = await boot(page, { key: 'ghostline-save', value: { version: 8, storySeen: true, candles: 77, runs: 4 } });
  expect(await scenes(page)).toContain('menu');
  await page.goto('/?opening=1');
  await page.waitForFunction(() => window.__opening);
  await page.waitForTimeout(300);
  expect(await scenes(page)).toContain('opening');
  await op(page, (s) => { s.begin(); });
  await opUntil(page, 0, 'explore', 20);
  await op(page, (s) => { s.scene.restart(); });
  await page.waitForTimeout(400);
  expect(await scenes(page)).toContain('opening');
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('ghostline-save')));
  expect(s.candles).toBe(77);
  expect(s.runs).toBe(4);
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

test('v8 runner: THE STRETCH is only a shadow while you run; its arm shows on a stumble, its body when caught', async ({ page }) => {
  const errors = await boot(page, { key: 'ghostline-save', value: { version: 8, storySeen: true, runs: 5, story: { met: ['ivy'], beaten: ['matron'] } } });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const r = await play(page, (s) => {
    s.openingDone = true; s.nextTrickT = 1e9; s.trickZone = 0;
    const at = (gap) => { for (let i = 0; i < 120; i++) { s.invuln = 1e9; s.gap = gap; s.lastStumble = -99; s.step(1 / 120, false); if (i % 10 === 0) s.render(0); } s.render(0); return { body: s.stretch.visible, shadow: +s.stretchShadow.alpha.toFixed(2), len: Math.round(s.stretchShadow.displayHeight) }; };
    const far = at(118), near = at(30);
    s.shield = false; s.invuln = 0; s.gap = 90; s.hit('grave');
    for (let i = 0; i < 18; i++) s.step(1 / 120, false);
    s.render(0);
    const arm = { body: s.stretch.visible, drawn: s.armGfx.commandBuffer.length > 0 };
    s.invuln = 0; s.hit('grave'); // the second one: caught
    for (let i = 0; i < 40; i++) s.step(1 / 120, false);
    s.render(0);
    return { far, near, arm, caught: { dead: s.dead, body: s.stretch.visible } };
  });
  expect(r.far.body).toBe(false);
  expect(r.near.body).toBe(false);
  expect(r.far.shadow).toBeGreaterThan(0.3);
  expect(r.near.len).toBeGreaterThan(r.far.len); // longer the closer it is
  expect(r.arm).toEqual({ body: false, drawn: true });
  expect(r.caught).toEqual({ dead: true, body: true });
  expect(errors).toEqual([]);
});

test('v8 runner: Boo only comes when he is needed (the opening, flights), Milo runs alone with the lantern', async ({ page }) => {
  const errors = await boot(page, { key: 'ghostline-save', value: { version: 8, storySeen: true, runs: 5, story: { met: ['ivy'], beaten: ['matron'] } } });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const r = await play(page, (s) => {
    s.openingDone = true; s.nextTrickT = 1e9; s.trickZone = 0;
    const run = (n) => { for (let i = 0; i < n; i++) { s.invuln = 1e9; s.gap = 110; s.step(1 / 120, false); } s.render(0); return +s.ghost.alpha.toFixed(2); };
    const alone = run(600);
    const lantern = +s.lanternGlow.alpha.toFixed(2);
    s.startFlight('orb');
    const flying = run(90);
    return { alone, lantern, flying, lit: +s.lanternGlow.alpha.toFixed(2) };
  });
  expect(r.alone).toBeLessThan(0.05);
  expect(r.lantern).toBeLessThan(0.05);
  expect(r.flying).toBeGreaterThan(0.45); // 0.5 = Boo while you are invulnerable (the test keeps Milo safe)
  expect(r.lit).toBeGreaterThan(0.3);
  expect(errors).toEqual([]);
});

test('v8 story, world 2: meet Ansel on slab 9, THE CORONER ends world 2, beating him saves it', async ({ page }) => {
  const save = { version: 8, storySeen: true, runs: 5, mode: 'creative', creative: { x: (400 + 40) * 24, rebirths: 0 }, story: { met: ['ivy'], beaten: ['matron'] } };
  const errors = await boot(page, { key: 'ghostline-save', value: save });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const r = await play(page, (s) => {
    s.openingDone = true; s.started = true;
    let n = 0, sat = false;
    while (!s.bossOn && s.worldX / 24 < 796 && n < 200000) { s.invuln = 1e9; s.gap = 118; s.step(1 / 120, Math.floor(n / 40) % 2 === 0); if (s.ally && s.ally.img.texture.key === 'ansel_sit') sat = true; n++; }
    return { m: Math.floor(s.worldX / 24), zone: s.zoneIndex, bossOn: s.bossOn, sat, met: JSON.parse(localStorage.getItem('ghostline-save')).story.met };
  });
  expect(r).toEqual({ m: expect.any(Number), zone: 1, bossOn: true, sat: true, met: ['ivy', 'ansel'] });
  expect(r.m).toBeGreaterThanOrEqual(768);
  await page.waitForFunction(() => window.__game.scene.isActive('boss') && window.__boss);
  expect(await page.evaluate(() => ({ id: window.__boss.bossId, powers: window.__boss.powers, sheet: window.__boss.sheet, light: !!window.__boss.power }))).toEqual({ id: 'coroner', powers: ['penlight', 'sheet'], sheet: true, light: true });
  await page.evaluate(() => window.__boss.win());
  await page.waitForFunction(() => !window.__game.scene.isActive('boss') && !window.__game.scene.isPaused('play'), null, { timeout: 10000 });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ghostline-save')).story.beaten)).toEqual(['matron', 'coroner']);
  expect(errors).toEqual([]);
});

test('v8 Coroner: his light goes through a plain dodge, not through the Sheet; tags file you; a drawer is a step', async ({ page }) => {
  const errors = await boot(page, { key: 'ghostline-save', value: { version: 8, storySeen: true } });
  const launch = (powers) => page.evaluate((powers) => new Promise((res) => {
    const g = window.__game; g.scene.getScenes(true).forEach((sc) => sc.scene.stop());
    window.__boss = null;
    g.scene.start('boss', { boss: 'coroner', powers, char: 'survivor', onEnd: () => {} });
    const wait = () => (window.__boss ? res() : setTimeout(wait, 50)); wait();
  }), powers);
  const fight = (fn) => page.evaluate((src) => { const B = window.__boss; window.__game.loop.sleep(); return (0, eval)(src)(B); }, fn.toString());
  await launch(['penlight', 'sheet']);
  const r = await fight((B) => {
    const N = (n) => { for (let i = 0; i < n; i++) B.step(1 / 120); };
    N(220); // the intro
    const sweep = (sheet) => {
      B.inv = 0; B.hearts = 5; B.queue = ['light']; B.bstate = 'idle'; B.bt = 0; B.bx = 490; B.x = 200; B.sheetCd = sheet ? 0 : 9; B.unseenT = 0;
      B.sheet = sheet; B.coronerAttack(false);
      let n = 0, dodged = false;
      while (B.bstate !== 'check' && n++ < 2000) {
        if (B.col && !dodged && Math.abs(B.col.x - B.x) < 60) { B.act.dodge = true; B.act.dodgeDir = 1; dodged = true; }
        N(1); B.act.dodge = false;
      }
      return { hearts: B.hearts, lost: B.lostYou, filed: B.filedT > 0 };
    };
    const plain = sweep(false), sheet = sweep(true);
    // a toe tag that hits files you
    B.bstate = 'idle'; B.bt = 9; B.inv = 0; B.hearts = 5; B.filedT = 0; B.unseenT = 0; B.x = 300; B.y = 0;
    B.tags.push({ x: 300, y: 300, vx: 0, vy: 0, spin: 0, stuck: false, life: 1 }); N(1);
    const tag = { hearts: B.hearts, filed: B.filedT > 0 };
    // a low drawer, out and still: Milo lands on it
    B.tags = []; B.drawers = [{ side: -1, row: 'low', max: 200, len: 200, state: 'hold', t: 9, delay: 0, v: 760 }];
    B.x = 120; B.y = 60; B.vy = 0; B.grounded = false; B.inv = 99;
    for (let i = 0; i < 120; i++) N(1);
    return { plain, sheet, tag, onDrawer: Math.round(B.y), grounded: B.grounded };
  });
  expect(r.plain.hearts).toBeLessThan(5);
  expect(r.plain.filed).toBe(true);
  expect(r.sheet).toEqual({ hearts: 5, lost: true, filed: false });
  expect(r.tag).toEqual({ hearts: 4, filed: true });
  expect(r.onDrawer).toBe(22);
  expect(r.grounded).toBe(true);
  expect(errors).toEqual([]);
});

// v8 the Night Matron, rebuilt: three acts in a tall building
const startMatron = (page, extra = {}) => page.evaluate((extra) => new Promise((res) => {
  const g = window.__game; g.scene.getScenes(true).forEach((sc) => sc.scene.stop()); window.__boss = null;
  setTimeout(() => g.scene.start('boss', { boss: 'matron', powers: ['penlight'], char: 'survivor', onEnd: () => {}, ...extra }), 60);
  const wait = () => (window.__boss && window.__game.scene.isActive('boss') ? res() : setTimeout(wait, 50)); wait();
}), extra);

test('v8 Matron: the first attack teaches (slower, one line), "!" before each, gold = the lantern swings by itself', async ({ page }) => {
  const errors = await boot(page, { key: 'ghostline-save', value: { version: 8, storySeen: true } });
  await startMatron(page);
  const r = await page.evaluate(() => {
    const B = window.__boss; window.__game.loop.sleep();
    const N = (n) => { for (let i = 0; i < n; i++) B.step(1 / 120); };
    N(220);
    B.queue = ['curtain']; B.bstate = 'idle'; B.bt = 0; N(1);
    const first = { bt: +B.bt.toFixed(2), prompt: B.prompt.text, bang: B.bangT > 0 };
    B.bstate = 'idle'; B.bt = 0; B.queue = ['curtain']; N(1);
    const again = { bt: +B.bt.toFixed(2) };
    // she slams the wall after a charge: GOLD, and the lantern swings when Milo is close
    B.curtainSpec = null; B.curtain = null; B.queue = ['roll']; B.bstate = 'idle'; B.bt = 0; B.x = 400; B.bx = 700; N(1);
    const tell = B.bstate;
    B.inv = 99; let n = 0; while (B.bstate !== 'wallStun' && n++ < 1200) N(1);
    const open = B.isOpen(), hp0 = B.hp;
    B.x = B.bx + 30; B.y = 1000; B.inv = 99; N(60);
    return { first, again, tell, open, hit: hp0 - B.hp, cracks: B.cracks.length, area: B.area, grounded: B.grounded };
  });
  expect(r.first.prompt).toBe('A CURTAIN. JUMP IT, OR STAND ON A BED');
  expect(r.first.bang).toBe(true);
  expect(r.first.bt).toBeGreaterThan(r.again.bt);
  expect(r.tell).toBe('tellRoll');
  expect(r.open).toBe(true);
  expect(r.hit).toBeGreaterThan(0);
  expect(r.cracks).toBeGreaterThan(0);
  expect(r.area).toBe('ward4');
  expect(errors).toEqual([]);
});

test('v8 Matron: each act ends cracked and only the Penlight ends it; the floor falls, the stairs, the moths', async ({ page }) => {
  const errors = await boot(page, { key: 'ghostline-save', value: { version: 8, storySeen: true } });
  await startMatron(page);
  const r = await page.evaluate(() => {
    const B = window.__boss; window.__game.loop.sleep();
    const N = (n) => { for (let i = 0; i < n; i++) B.step(1 / 120); };
    const out = {};
    N(220);
    // act 1 ends: she cracks, the lantern does nothing now, the light does
    B.bstate = 'check'; B.bt = 3; B.hp = 21; B.damageBoss();
    out.cracked = B.bstate; out.charge = B.charge; out.prompt = B.prompt.text;
    B.x = B.bx + 60; B.y = 1000; N(60); out.hpCracked = B.hp;
    B.usePower(); out.trans = B.state;
    N(120 * 3.4);
    out.act2 = { phase: B.phase, state: B.state, area: B.area, below: B.y > 1200, grounded: B.grounded, beds: B.surfs.filter((s) => s.bed).length };
    // act 2: she drops where Milo stands
    B.queue = ['dive']; B.bstate = 'idle'; B.bt = 0; B.inv = 99; N(1); out.rise = B.bstate;
    let n = 0; while (B.bstate !== 'stuck' && n++ < 1200) N(1); out.stuck = B.bstate;
    // act 2 ends, the wall breaks, Milo walks into the stairwell
    B.bstate = 'check'; B.bt = 3; B.hp = 11; B.damageBoss(); N(240);
    B.x = B.bx + 60; B.charge = 1; B.usePower(); N(120 * 3.2);
    out.walk = { state: B.state, walkIn: B.walkIn, wall: B.wallBroken };
    B.act.right = true; n = 0; while (B.phase !== 3 && n++ < 1200) N(1); B.act.right = false;
    out.act3 = { phase: B.phase, area: B.area, room: B.room.l, kb: B.kb };
    // act 3: a gurney comes down the stairs, one landing at a time
    B.queue = ['gurney']; B.bstate = 'idle'; B.bt = 0; B.inv = 99; N(1); n = 0; while (!B.gurneys.length && n++ < 600) N(1);
    const k0 = B.gurneys[0].k; n = 0; while (B.gurneys.length && B.gurneys[0].k === k0 && n++ < 1200) N(1);
    out.gurney = { from: k0, down: B.gurneys.length ? B.gurneys[0].k : -1 };
    // hitting her makes her run higher and kill the lamps
    B.ashHazards(); B.bstate = 'check'; B.bt = 3; B.hp = 8; const kb = B.kb; B.damageBoss(); N(240);
    out.flee = { up: B.kb - kb, dark: B.darkWant > 0.5 };
    B.charge = 1; B.x = B.bx + 40; B.y = B.by; B.usePower(); out.relit = B.darkWant;
    // the last act ends with the light: she sits, the moths fly
    B.ashHazards(); B.bstate = 'check'; B.bt = 3; B.hp = 1; B.damageBoss(); n = 0; while (B.bstate !== 'cracked' && n++ < 2000) N(1);
    out.top = B.kb;
    B.x = B.bx + 60; B.y = B.by; B.charge = 1; B.usePower(); N(240);
    out.won = { state: B.state, moths: B.parts.filter((p) => p.kind === 'moth').length };
    return out;
  });
  expect(r.cracked).toBe('cracked');
  expect(r.charge).toBe(1);
  expect(r.prompt).toContain('LIGHT HER');
  expect(r.hpCracked).toBe(20);
  expect(r.trans).toBe('trans');
  expect(r.act2).toEqual({ phase: 2, state: 'fight', area: 'below', below: true, grounded: true, beds: 5 });
  expect(r.rise).toBe('rise');
  expect(r.stuck).toBe('stuck');
  expect(r.walk).toEqual({ state: 'fight', walkIn: true, wall: true });
  expect(r.act3).toEqual({ phase: 3, area: 'stair', room: 932, kb: 3 });
  expect(r.gurney.down).toBe(r.gurney.from - 1);
  expect(r.flee.up).toBeGreaterThan(0);
  expect(r.flee.dark).toBe(true);
  expect(r.relit).toBe(0);
  expect(r.top).toBe(12);
  expect(r.won.state).toBe('won');
  expect(r.won.moths).toBeGreaterThan(10);
  expect(errors).toEqual([]);
});

test('v8 Matron: lose = how close + TRY AGAIN starts at the act you reached; Boo saves once', async ({ page }) => {
  const errors = await boot(page, { key: 'ghostline-save', value: { version: 8, storySeen: true } });
  await startMatron(page, { phase: 2 });
  const r = await page.evaluate(() => {
    const B = window.__boss; window.__game.loop.sleep();
    const N = (n) => { for (let i = 0; i < n; i++) B.step(1 / 120); };
    N(220);
    const start = { phase: B.phase, hp: B.hp, area: B.area };
    B.inv = 0; B.hearts = 1; B.hurt(B.x + 10); const boo = { used: B.booUsed, hearts: B.hearts };
    N(240); B.hp = 15; B.inv = 0; B.hurt(B.x + 10);
    N(200);
    return { start, boo, choice: B.choice, sub: B.subText.text };
  });
  expect(r.start).toEqual({ phase: 2, hp: 20, area: 'below' });
  expect(r.boo).toEqual({ used: true, hearts: 1 });
  expect(r.choice).toBe(true);
  expect(r.sub).toBe('50% OF THE WAY THERE');
  await page.evaluate(() => { window.__game.loop.wake(); window.__boss.retry(); });
  await page.waitForFunction(() => window.__boss && window.__boss.state === 'intro' && window.__boss.tries === 1);
  expect(await page.evaluate(() => ({ hearts: window.__boss.hearts, hp: window.__boss.hp, phase: window.__boss.phase, area: window.__boss.area }))).toEqual({ hearts: 5, hp: 20, phase: 2, area: 'below' });
  expect(errors).toEqual([]);
});

test('v8 Matron: keyboard and touch play the same fight (move, jump, dodge, drop through a bed, light)', async ({ page }) => {
  const errors = await boot(page, { key: 'ghostline-save', value: { version: 8, storySeen: true } });
  await startMatron(page);
  await page.waitForFunction(() => window.__boss.state === 'fight', null, { timeout: 5000 });
  const B = () => page.evaluate(() => { const b = window.__boss; return { x: b.x, y: b.y, grounded: b.grounded, dodgeT: b.dodgeT, beam: !!b.beam, ground: b.ground && b.ground.bed ? 'bed' : 'floor' }; });
  await page.evaluate(() => { const b = window.__boss; b.bt = 99; b.queue = []; b.inv = 99; });
  // keyboard
  const x0 = (await B()).x;
  await page.keyboard.down('d'); await page.waitForTimeout(300); await page.keyboard.up('d');
  expect((await B()).x).toBeGreaterThan(x0 + 20);
  await page.keyboard.press('w'); await page.waitForTimeout(80);
  expect((await B()).grounded).toBe(false);
  await page.waitForTimeout(700);
  await page.evaluate(() => { const b = window.__boss; b.x = 360; b.y = 980; b.ground = b.surfAt(360, 980); b.grounded = true; b.dodgeCd = 0; });
  expect((await B()).ground).toBe('bed');
  await page.keyboard.press('s'); await page.waitForTimeout(400);
  expect((await B()).y).toBe(1000); // dodge in place on a bed = drop through it
  await page.evaluate(() => { window.__boss.charge = 1; });
  await page.keyboard.press('e'); await page.waitForTimeout(50);
  expect((await B()).beam).toBe(true);
  // touch (mouse = the same pointers): left half drag moves, right tap jumps, right swipe dodges
  await page.waitForTimeout(600);
  const box = await page.locator('canvas').boundingBox();
  const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
  const x1 = (await B()).x;
  await page.mouse.move(...at(0.2, 0.7)); await page.mouse.down(); await page.mouse.move(...at(0.27, 0.7), { steps: 3 });
  await page.waitForTimeout(300); await page.mouse.up();
  expect((await B()).x).toBeGreaterThan(x1 + 15);
  await page.waitForTimeout(200);
  await page.mouse.move(...at(0.8, 0.6)); await page.mouse.down(); await page.waitForTimeout(60);
  expect((await B()).grounded).toBe(false);
  await page.mouse.up(); await page.waitForTimeout(800);
  await page.evaluate(() => { window.__boss.dodgeCd = 0; });
  await page.mouse.move(...at(0.7, 0.6)); await page.mouse.down(); await page.mouse.move(...at(0.85, 0.6), { steps: 2 });
  await page.waitForTimeout(40);
  expect((await B()).dodgeT).toBeGreaterThan(0);
  await page.mouse.up();
  expect(errors).toEqual([]);
});

test('v9 prototype: run into the nurse station, walk and jump, it cannot get you, leave by the exit, run again (twice)', async ({ page }) => {
  const errors = await boot(page, { key: 'ghostline-save', value: { version: 8, storySeen: true, runs: 5, story: { met: ['ivy'], beaten: ['matron'] } } }, { stations: true });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const r = await play(page, (s) => {
    s.openingDone = true; s.started = true;
    const real = s.inputMap.held;
    let dir = '';
    s.inputMap.held = (k) => k === dir || real(k);
    const step = (sec, hold = false) => { for (let i = 0; i < sec * 120 && !s.dead; i++) { s.invuln = 1e9; s.step(1 / 120, hold); } };
    const out = [];
    for (let visit = 0; visit < 2; visit++) {
      let n = 0;
      while (!s.stationFree() && n < 120000 && !s.dead) { s.invuln = 1e9; s.gap = 118; s.step(1 / 120, false); n++; }
      const st = s.station, wx0 = st.wx0;
      const o = { inside: s.stationFree(), m: Math.round(s.worldX / 24), speed: s.speed, traps: s.traps.filter((t) => !t.gone && Math.abs(t.wx - s.worldX) < 900).length };
      // it can't come in: even right behind you, nothing happens
      s.gap = 30; step(4); o.caught = s.dead; o.light = s.light;
      // walk left to the wall, it stops there
      dir = 'left'; step(5); o.leftWall = Math.round(s.worldX - wx0); s.render(0); o.faceLeft = s.player.flipX;
      // walk right onto the desk: jump, land on it
      dir = 'right'; while (s.worldX - wx0 < 500) step(1 / 120);
      dir = ''; step(0.3); s.jumpLatch = true; step(0.9, true); o.onDesk = Math.round(324 - (s.py + 22));
      // drop through it with a slide
      s.slideLatch = true; step(0.6); o.dropped = Math.round(324 - (s.py + 22));
      // the chart up on the cabinet
      if (visit === 0) { s.worldX = wx0 + 170; s.py = 324 - 172 - 22; s.vy = 0; s.grounded = true; step(0.1); o.read = st.read; }
      // touch: the left-half thumb walks too
      s.stThumb = { id: 9, x0: 100, x: 140 }; o.thumbDir = s.stationDir(); s.stThumb = null;
      // out the exit: the run picks back up and it chases again
      dir = 'right'; step(8); dir = '';
      o.after = { phase: s.station ? s.station.phase : null, next: s.station ? Math.round(s.station.wx0 / 24) : null, run: Math.round(s.speed), gap: Math.round(s.gap), light: s.light < 1 };
      step(1.5); o.gapLater = s.gap; o.dead = s.dead;
      out.push(o);
    }
    s.inputMap.held = real;
    return out;
  });
  for (const [i, o] of r.entries()) {
    expect(o.inside).toBe(true);
    expect(o.m).toBe([55, 170][i] + 5);
    expect(o.speed).toBe(0);
    expect(o.traps).toBe(0);
    expect(o.caught).toBe(false);
    expect(o.light).toBe(1);
    expect(o.leftWall).toBe(24);
    expect(o.faceLeft).toBe(true);
    expect(o.onDesk).toBe(52);
    expect(o.dropped).toBe(0);
    expect(o.thumbDir).toBeGreaterThan(0.9);
    expect(o.after.run).toBeGreaterThan(220);
    expect(o.dead).toBe(false);
  }
  expect(r[0].read).toBe(true);
  expect(r[0].after.next).toBe(170);
  expect(r[1].after.phase === null || r[1].after.phase === 'out').toBe(true);
  expect(errors).toEqual([]);
});

// ART LAB (Visual Art Benchmark V1): isolated preview at ?artlab=1, not part of the game
test('art lab: ?artlab=1 opens alone; 5 views; six different poses; same boy; Boo; Ghostline anchored; the shadow reads', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ghostline-save', JSON.stringify({ version: 8, storySeen: true, best: 123 })); });
  await page.goto('/?artlab=1');
  await page.waitForFunction(() => window.__artlab && window.__artlab.scr);
  expect(await scenes(page)).toEqual(['artlab']);
  const saveBefore = await page.evaluate(() => localStorage.getItem('ghostline-save'));
  expect(JSON.parse(saveBefore).best).toBe(123);
  const r = await page.evaluate(async () => {
    const L = window.__artlab, A = await import('/src/artlab-assets.js');
    const out = { views: [] };
    for (let i = 0; i < 5; i++) { L.setView(i); L.draw(); out.views.push(L.view); }
    // poses: every pair differs a lot, and the faces (head rows) differ too
    const frames = A.POSE_ORDER.map((k) => L.F[k].buf);
    let minAll = 1e9, minHead = 1e9;
    for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) {
      let all = 0;
      for (let i = 0; i < frames[a].d.length; i++) if (frames[a].d[i] !== frames[b].d[i]) all++;
      minAll = Math.min(minAll, all);
      // faces compared on their own (each head is a different drawing, not a recolor)
      const fa = A.FACES[A.POSES[A.POSE_ORDER[a]].face], fb = A.FACES[A.POSES[A.POSE_ORDER[b]].face];
      let head = 0; fa.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== fb[y][x]) head++; }));
      minHead = Math.min(minHead, head);
    }
    out.minAll = minAll; out.minHead = minHead;
    // same boy: the spirit has a pixel wherever the living boy does, and the value order is kept
    let miss = 0, agree = 0, pairs = 0;
    for (const k of A.POSE_ORDER) {
      const lv = L.F[k].buf, gh = L.F[k].gbuf;
      const lum = (c) => { const v = A.rgb(c); return v[0] * 0.3 + v[1] * 0.59 + v[2] * 0.11; };
      const px = [];
      for (let i = 0; i < lv.d.length; i++) { if (!lv.d[i]) continue; if (!gh.d[i]) miss++; else px.push(i); }
      for (let n = 0; n < 400; n++) { const i = px[(n * 7919) % px.length], j = px[(n * 104729 + 13) % px.length]; const dl = lum(lv.d[i]) - lum(lv.d[j]); if (Math.abs(dl) < 25) continue; pairs++; if (Math.sign(dl) === Math.sign(lum(gh.d[i]) - lum(gh.d[j]))) agree++; }
    }
    out.miss = miss; out.agree = agree / pairs;
    // Boo: cap, brass badge/keys, lantern glass, mustache
    const cnt = (b, cols) => b.d.filter((c) => cols.includes(c)).length;
    out.boo = { cap: cnt(L.booBuf, ['#33455f', '#4d6380', '#222f44']), brass: cnt(L.booBuf, ['#d6a84a', '#c9a24c']), glass: cnt(L.booBuf, ['#ffe4a0', '#fff3cf']), stache: cnt(L.booBuf, ['#fbfcfa']) };
    // Ghostline: starts on the spirit's wristband in every pose, passes the living wristband, ends in the floor seam
    L.setView(2);
    const band = (b, x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ([A.PAL.band, A.PAL.bandSh].includes(b.get(Math.floor(x) + dx, Math.floor(y) + dy))) return true; return false; };
    out.anchor = [];
    for (let i = 0; i < 6; i++) {
      L.poseIx = i;
      for (const br of [false, true]) {
        L.breath = br;
        const pose = L.poseNow(), f = L.F[pose + (br ? '_b' : '')], p = L.pos[3];
        const gw = L.ghostWrist(), { pts, wristIx } = L.ghostPath();
        const fx = p.flip ? A.FW - (gw[0] - (p.x - A.FW / 2)) : gw[0] - (p.x - A.FW / 2), fy = gw[1] - (p.y - A.FH);
        const lw = L.livingWrist(), last = pts[pts.length - 1];
        out.anchor.push({ pose, start: Math.hypot(pts[0][0] - gw[0], pts[0][1] - gw[1]) < 0.01, onBand: band(f.buf, fx, fy),
          mid: Math.hypot(pts[wristIx][0] - lw[0], pts[wristIx][1] - lw[1]) < 0.01, seam: last[1] === A.SEAM_Y });
      }
    }
    out.livingBand = band(L.sl.buf, L.sl.wrist[0], L.sl.wrist[1]);
    // the shadow: darker than the lit wall around it
    L.setView(3); L.draw();
    const img = L.ctx.getImageData(0, 0, A.AW, A.AH).data;
    let sIn = 0, nIn = 0, sOut = 0, nOut = 0;
    for (let y = 27; y < 116; y++) for (let x = 190; x < 320; x++) {
      const i = y * A.AW + x, v = img[i * 4] * 0.3 + img[i * 4 + 1] * 0.59 + img[i * 4 + 2] * 0.11;
      if (L.shadowMask.m[i]) { sIn += v; nIn++; } else { sOut += v; nOut++; }
    }
    out.shadow = { inside: sIn / nIn, outside: sOut / nOut, px: L.shadowPx };
    return out;
  });
  expect(r.views).toEqual([0, 1, 2, 3, 4]);
  expect(r.minAll).toBeGreaterThan(150);
  expect(r.minHead).toBeGreaterThan(6);
  expect(r.miss).toBe(0);
  expect(r.agree).toBeGreaterThan(0.9);
  expect(r.boo.cap).toBeGreaterThan(20);
  expect(r.boo.brass).toBeGreaterThan(6);
  expect(r.boo.glass).toBeGreaterThan(20);
  expect(r.boo.stache).toBeGreaterThan(15);
  for (const a of r.anchor) expect(a, a.pose).toEqual({ pose: a.pose, start: true, onBand: true, mid: true, seam: true });
  expect(r.livingBand).toBe(true);
  expect(r.shadow.px).toBeGreaterThan(3000);
  expect(r.shadow.outside / Math.max(1, r.shadow.inside)).toBeGreaterThan(2);
  // touch: a tap on a tab and a swipe change the view
  const box = await page.locator('canvas').boundingBox();
  const at = (x, y) => [box.x + x * box.width / 640, box.y + y * box.height / 360];
  await page.mouse.click(...at(130 + 20, 14));
  expect(await page.evaluate(() => window.__artlab.view)).toBe(1);
  await page.mouse.move(...at(400, 200)); await page.mouse.down(); await page.mouse.move(...at(250, 200), { steps: 4 }); await page.mouse.up();
  expect(await page.evaluate(() => window.__artlab.view)).toBe(2);
  // the lab never touches the save
  expect(await page.evaluate(() => localStorage.getItem('ghostline-save'))).toBe(saveBefore);
  expect(errors).toEqual([]);
});

// MILO LAB MOVE (new Milo movement prototype V2): walk, run, jump in a test corridor, keyboard / touch / gamepad
test('milo lab move: frames exist; keyboard walk, run, turn, jump, land; touch thumb; gamepad stick; acting intact', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ghostline-save', JSON.stringify({ version: 8, storySeen: true, best: 123 })); });
  await page.goto('/?milolab=1&move=1');
  await page.waitForFunction(() => window.__milolab && window.__milolab.move && window.__milolab.mover);
  const before = await page.evaluate(() => localStorage.getItem('ghostline-save'));
  const r = await page.evaluate(async () => {
    const L = window.__milolab, M = await import('/src/milo-sprite.js');
    const names = M.MILO_MOVES.flatMap((n) => M.MILO_ANIMS[n].frames.map((f) => f[0]));
    return { missing: names.filter((n) => !(n in L.mover.index)), walk: M.MILO_ANIMS.walk.frames.length, run: M.MILO_ANIMS.run.frames.length,
      acting: M.MILO_SEQUENCES.every((s) => M.MILO_ANIMS[s].frames.length >= 10), room: L.roomObjs.every((o) => !o.visible) };
  });
  expect(r.missing).toEqual([]);
  expect(r.walk).toBe(8); expect(r.run).toBe(6); expect(r.acting).toBe(true); expect(r.room).toBe(true);
  const st = () => page.evaluate(() => { const L = window.__milolab; return { anim: L.mover.anim, x: L.mv.x, y: L.mv.y, vx: L.mv.vx, ground: L.mv.ground, facing: L.mover.facing, flip: L.mover.sprite.flipX }; });
  const x0 = (await st()).x;
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__milolab.mover.anim === 'walk');
  await page.waitForTimeout(400);
  let s = await st();
  expect(s.x).toBeGreaterThan(x0); expect(Math.abs(s.vx)).toBeLessThan(80);
  await page.keyboard.down('Shift');
  await page.waitForFunction(() => window.__milolab.mover.anim === 'run');
  await page.waitForFunction(() => window.__milolab.mv.vx > 170);
  await page.keyboard.up('Shift'); await page.keyboard.up('ArrowRight');
  await page.waitForFunction(() => window.__milolab.mover.anim === 'idle');
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(() => window.__milolab.mv.vx < -20);
  s = await st(); expect(s.facing).toBe(-1); expect(s.flip).toBe(true);
  await page.keyboard.up('ArrowLeft');
  await page.waitForFunction(() => window.__milolab.mover.anim === 'idle');
  // jump: every phase shows, he lands back on the floor
  const seen = page.evaluate(() => new Promise((res) => {
    const L = window.__milolab, got = new Set(), t0 = performance.now();
    const tick = () => { got.add(L.mover.anim); if ((got.has('land') && L.mv.ground) || performance.now() - t0 > 4000) res([...got]); else requestAnimationFrame(tick); };
    tick();
  }));
  await page.keyboard.down('Space'); await page.waitForTimeout(300); await page.keyboard.up('Space');
  const phases = await seen;
  for (const a of ['jump_start', 'rise', 'fall', 'land']) expect(phases).toContain(a);
  expect((await st()).y).toBe(300);
  // touch: left-half thumb dragged far = run right; right half = jump
  await page.evaluate(() => { const L = window.__milolab; L.thumb = { id: 9, x0: 100, y0: 250, x: 170 }; });
  await page.waitForFunction(() => window.__milolab.mover.anim === 'run');
  await page.evaluate(() => { const L = window.__milolab; L.thumb = null; L.jumpTap = true; L.jumpPtr = 8; });
  await page.waitForFunction(() => !window.__milolab.mv.ground);
  await page.evaluate(() => { window.__milolab.jumpPtr = null; });
  await page.waitForFunction(() => window.__milolab.mv.ground && window.__milolab.mover.anim !== 'run');
  // gamepad: left stick half tilt walks left, full tilt runs
  const padV = (x) => page.evaluate((sx) => { const L = window.__milolab; L.__pad = L.__pad || L.input.gamepad; Object.defineProperty(L.input, 'gamepad', { configurable: true, value: { total: 1, getAll: () => [{ leftStick: { x: sx, y: 0 }, buttons: [] }] } }); }, x);
  await padV(-0.5);
  await page.waitForFunction(() => window.__milolab.mover.anim === 'walk' && window.__milolab.mover.facing === -1);
  await padV(-1);
  await page.waitForFunction(() => window.__milolab.mover.anim === 'run');
  await page.evaluate(() => { const L = window.__milolab; Object.defineProperty(L.input, 'gamepad', { configurable: true, value: L.__pad }); });
  // back to the acting lab: room and acting Milo return
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => { const L = window.__milolab; return !L.move && L.milo.sprite.visible && L.roomObjs.every((o) => o.visible); });
  await page.keyboard.press('3');
  expect(await page.evaluate(() => window.__milolab.milo.anim)).toBe('touch');
  expect(await page.evaluate(() => localStorage.getItem('ghostline-save'))).toBe(before);
  expect(errors).toEqual([]);
});

// MILO LAB (new Milo, animation prototype V1): isolated preview at ?milolab=1, not part of the game
test('milo lab: ?milolab=1 opens alone; raster frames; four sequences play to the end; ghost toggle; save untouched', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ghostline-save', JSON.stringify({ version: 8, storySeen: true, best: 123 })); });
  await page.goto('/?milolab=1');
  await page.waitForFunction(() => window.__milolab && window.__milolab.milo);
  const before = await page.evaluate(() => localStorage.getItem('ghostline-save'));
  expect(await scenes(page)).toEqual(['milolab']);
  const r = await page.evaluate(async () => {
    const L = window.__milolab, M = await import('/src/milo-sprite.js');
    const meta = L.milo.meta, tex = L.textures.get(M.MILO_KEYS.living);
    // every frame used by a sequence exists in the sheet, and every sequence ends
    const missing = Object.values(M.MILO_ANIMS).flatMap((a) => a.frames.map((f) => f[0])).filter((n) => !(n in L.milo.index));
    const ends = {};
    for (const s of M.MILO_SEQUENCES) {
      L.milo.play(s); let t = 0, frames = new Set();
      while (!L.milo.done && t < 60000) { L.milo.update(50); frames.add(L.milo.frame); t += 50; }
      ends[s] = { done: L.milo.done, frames: frames.size };
    }
    L.setGhost(true);
    const ghostKey = L.milo.sprite.texture.key;
    return { n: meta.frames.length, texFrames: tex.frameTotal, w: tex.source[0].width, missing, ends, ghostKey, size: [meta.frameWidth, meta.frameHeight] };
  });
  expect(r.n).toBeGreaterThanOrEqual(30);
  expect(r.texFrames - 1).toBeGreaterThanOrEqual(r.n); // + Phaser's __BASE frame
  expect(r.missing).toEqual([]);
  for (const s of ['awakening', 'realization', 'touch', 'fear']) { expect(r.ends[s].done).toBe(true); expect(r.ends[s].frames).toBeGreaterThanOrEqual(6); }
  expect(r.ghostKey).toBe('milo2_ghost');
  expect(r.size).toEqual([96, 100]);
  // keyboard: 3 plays the touch; gamepad-style focus moves with arrows
  await page.keyboard.press('3');
  expect(await page.evaluate(() => window.__milolab.milo.anim)).toBe('touch');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.__milolab.milo.anim)).toBe('awakening');
  expect(await page.evaluate(() => localStorage.getItem('ghostline-save'))).toBe(before);
  expect(errors).toEqual([]);
});
