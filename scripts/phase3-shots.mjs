// Screenshots of the phase 3 content (tricks, set pieces, the door, weapons). Serve the folder on :8000 first.
// Usage: node scripts/phase3-shots.mjs <outDir> [tricks,pieces,door,weapons]
import { chromium } from '@playwright/test';
const OUT = process.argv[2];
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=swiftshader', '--mute-audio'] });
const page = await b.newPage({ viewport: { width: 640, height: 360 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
async function start(save) {
  await page.goto('http://localhost:8000/');
  await page.evaluate((sv) => { localStorage.clear(); localStorage.setItem('ghostline-save', JSON.stringify(sv)); }, save);
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  await page.evaluate(() => { const g = window.__game; g.scene.getScenes(true).forEach((sc) => sc.scene.key !== 'play' && sc.scene.stop()); g.scene.start('play'); });
  await page.waitForFunction(() => window.__game.scene.getScene('play')?.runner && window.__game.scene.isActive('play'));
  await page.waitForTimeout(1400); // the opening '!' and the controls fade out first
}
const sim = (fn, arg) => page.evaluate(([src, a]) => (0, eval)(src)(window.__game.scene.getScene('play'), a), [fn.toString(), arg]);
const base = (w, extra = {}) => ({ version: 7, storySeen: true, runs: 12, tips: [], mode: 'creative', creative: { x: (w * 400 + 40) * 24, rebirths: 0 }, ...extra });
const TR = ['ward', 'morgue', 'woods', 'graveyard', 'sewer', 'catacombs', 'carnival'];
const phases = process.argv[3] ? process.argv[3].split(',') : ['tricks', 'pieces', 'door', 'weapons', 'patterns'];
if (phases.includes('tricks')) for (let w = 0; w < 7; w++) {
  for (const at of [0.7, 1.25]) {
    await start(base(w));
    await sim((s, at) => {
      s.openingDone = true; s.started = true; s.hitStop = 1e9; s.nextTrapX = s.worldX + 1e6;
      for (let i = 0; i < 240; i++) s.step(1 / 120, true);
      s.traps.forEach((t) => s.dropTrap(t)); s.traps = [];
      s.startTrick(true);
      const tr = s.trick; let n = 0;
      while (tr.t < tr.tell * at + (at > 1 ? 0.15 : 0) && n++ < 2000) { s.invuln = 9; s.step(1 / 120, true); }
    }, at);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/trick-${TR[w]}-${at}.png` });
  }
}
if (phases.includes('pieces')) for (let w = 0; w < 8; w++) {
  await start(base(w, { creative: { x: (w * 400 + 100) * 24, rebirths: 0 } }));
  await sim((s) => {
    s.openingDone = true; s.started = true; s.hitStop = 1e9; s.nextWeaponX = Infinity;
    let n = 0; while (!s.flying && n++ < 40000) { s.invuln = 9; s.jumpLatch = false; s.step(1 / 120, true); }
    n = 0; while (n++ < 120 * 2.6) { s.invuln = 9; s.step(1 / 120, s.py > 180); }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/piece-${w + 1}.png` });
}
if (phases.includes('door')) {
  for (const [name, got, frames] of [['locked', 8, [1.0, 2.6]], ['ending', 99, [1.5, 4.5, 8.8, 10.6, 11.9, 15.2, 20.8]]]) {
    for (const f of frames) {
      await start({ version: 7, storySeen: true, runs: 12, tips: [], unlocks: { got, points: 0, fresh: 0 }, mode: 'normal' });
      await sim((s, f) => {
        s.openingDone = true; s.started = true; s.hitStop = 1e9;
        s.worldX = (3200 - 20) * 24; s.zoneIndex = 7; s.nextTrapX = s.worldX + 1e6; s.chasmZones.add(7); s.trickZone = 7; s.nextTrickT = 99;
        s.traps.forEach((t) => s.dropTrap(t)); s.traps = [];
        let n = 0; while (!s.finish && n++ < 9000) { s.invuln = 9; s.step(1 / 120, true); }
        n = 0; while (s.finish && s.finish.t < f && n++ < 9000) s.step(1 / 120, false);
      }, f);
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/door-${name}-${f}.png` });
    }
  }
}
if (phases.includes('weapons')) for (const [kind, w, trap] of [['salt', 0, 'gurney'], ['flame', 2, 'roots'], ['holy', 4, 'vent'], ['bone', 3, 'trick']]) {
  await start(base(w));
  await sim((s, [kind, trap]) => {
    s.openingDone = true; s.started = true; s.hitStop = 1e9; s.nextTrapX = s.worldX + 1e6;
    for (let i = 0; i < 200; i++) s.step(1 / 120, true);
    s.armWeapon(kind);
    if (trap === 'trick') s.startTrick(false); else { s.addTrap(trap, s.worldX + 330); s.addTrap('crate', s.worldX + 520); }
    for (let i = 0; i < 45; i++) { s.invuln = 9; s.step(1 / 120, true); }
  }, [kind, trap]);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/weapon-${kind}.png` });
}
console.log('errors', errs);
await b.close();
