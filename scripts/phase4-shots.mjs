// Screenshots of the phase 4 content (scares, THE STRETCH up close, a normal run frame). Serve the folder on :8000 first.
// Usage: node scripts/phase4-shots.mjs <outDir> [scares,stretch,run]
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
const sim = (fn, arg) => page.evaluate(([src, a]) => { window.__game.scene.getScene('hud')?.rebirthText?.setVisible(false); return (0, eval)(src)(window.__game.scene.getScene('play'), a); }, [fn.toString(), arg]); // the harness runs in creative mode: hide its label
const base = (w, extra = {}) => ({ version: 7, storySeen: true, runs: 12, tips: [], mode: 'creative', creative: { x: (w * 400 + 40) * 24, rebirths: 0 }, ...extra });
const IDS = ['ward', 'morgue', 'woods', 'graveyard', 'sewer', 'catacombs', 'carnival', 'otherside'];
const phases = process.argv[3] ? process.argv[3].split(',') : ['scares', 'stretch', 'run'];
if (phases.includes('scares')) for (let w = 0; w < 8; w++) {
  for (const at of [-0.4, 0.12]) {
    await start(base(w));
    await sim((s, [id, at]) => {
      s.openingDone = true; s.startRun(); s.hitStop = 1e9; s.nextTrapX = s.worldX + 1e6;
      for (let i = 0; i < 240; i++) { s.invuln = 9; s.step(1 / 120, false); }
      s.traps.forEach((t) => s.dropTrap(t)); s.traps = []; s.trick = null;
      s.startScare(id);
      let n = 0; while (s.scare && s.scare.t < s.scare.def.hush + at && n++ < 2000) { s.invuln = 9; s.step(1 / 120, false); }
    }, [IDS[w], at]);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/scare-${IDS[w]}-${at < 0 ? 'hush' : 'hit'}.png` });
  }
}
if (phases.includes('stretch')) for (const [name, gap] of [['far', 118], ['middle', 66], ['near', 32]]) {
  await start(base(1));
  await sim((s, gap) => {
    s.openingDone = true; s.startRun(); s.hitStop = 1e9; s.nextTrapX = s.worldX + 1e6;
    for (let i = 0; i < 240; i++) { s.invuln = 9; s.gap = gap; s.lastStumble = -99; s.step(1 / 120, false); }
  }, gap);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/stretch-${name}.png` });
}
if (phases.includes('run')) for (const w of [0, 4]) { // an ordinary moment: a weapon, a trap, the one message, the corner note
  await start({ version: 7, storySeen: true, runs: 12, tips: [], mode: 'normal' });
  await sim((s, w) => {
    s.openingDone = true; s.startRun(); s.hitStop = 1e9;
    s.worldX = (w * 400 + 60) * 24; s.zoneIndex = w;
    for (let i = 0; i < 200; i++) { s.invuln = 9; s.step(1 / 120, false); }
    s.armWeapon(w ? 'holy' : 'salt');
    s.addTrap(w ? 'vent' : 'crate', s.worldX + 300);
    for (let i = 0; i < 70; i++) { s.invuln = 9; s.step(1 / 120, false); }
  }, w);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/run-${w + 1}.png` });
}
console.log('errors', errs);
await b.close();
