// Screenshots of the v8 work: THE STRETCH as a shadow, the stumble arm, a shadow trick, Ansel on slab 9,
// THE CORONER arena. Serve the folder on :8000 first.
// Usage: node scripts/v8-shots.mjs <outDir> [shadow,arm,trick,ansel,coroner]
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
  await page.waitForTimeout(1400);
}
const sim = (fn, arg) => page.evaluate(([src, a]) => { window.__game.scene.getScene('hud')?.rebirthText?.setVisible(false); return (0, eval)(src)(window.__game.scene.getScene('play'), a); }, [fn.toString(), arg]);
const base = (w, extra = {}) => ({ version: 8, storySeen: true, runs: 12, tips: [], mode: 'creative', creative: { x: (w * 400 + 40) * 24, rebirths: 0 }, story: { met: ['ivy', 'ansel'], beaten: ['matron', 'coroner'] }, ...extra });
const phases = process.argv[3] ? process.argv[3].split(',') : ['shadow', 'arm', 'trick', 'ansel', 'coroner'];
const run = (s, n, gap) => { s.nextTrickT = 1e9; s.trickZone = s.zoneIndex; for (let i = 0; i < n; i++) { s.invuln = 9; if (gap) { s.gap = gap; s.lastStumble = -99; } s.step(1 / 120, false); } };

if (phases.includes('shadow')) for (const [name, gap] of [['far', 118], ['middle', 66], ['near', 32]]) {
  await start(base(0));
  await sim((s, [gap, runSrc]) => {
    const run = (0, eval)(runSrc);
    s.openingDone = true; s.startRun(); s.hitStop = 1e9; s.nextTrapX = s.worldX + 1e6;
    run(s, 420, gap);
  }, [gap, run.toString()]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/shadow-${name}.png` });
}
if (phases.includes('arm')) {
  await start(base(0));
  await sim((s, runSrc) => {
    const run = (0, eval)(runSrc);
    s.openingDone = true; s.startRun(); s.hitStop = 1e9; s.nextTrapX = s.worldX + 1e6;
    run(s, 400, 90); s.lungeT = 0.17; s.stumbleT = 0.3; s.render(0);
  }, run.toString());
  await page.waitForTimeout(80);
  await page.screenshot({ path: `${OUT}/stumble-arm.png` });
}
if (phases.includes('trick')) for (const [w, at] of [[0, 0.8], [3, 0.6]]) {
  await start(base(w));
  await sim((s, [at, runSrc]) => {
    const run = (0, eval)(runSrc);
    s.openingDone = true; s.startRun(); s.hitStop = 1e9; s.nextTrapX = s.worldX + 1e6;
    run(s, 300, 90); s.traps.forEach((t) => s.dropTrap(t)); s.traps = [];
    s.startTrick(false); let n = 0; while (s.trick && s.trick.t < at && n++ < 600) run(s, 1);
  }, [at, run.toString()]);
  await page.waitForTimeout(80);
  await page.screenshot({ path: `${OUT}/trick-w${w + 1}.png` });
}
if (phases.includes('ansel')) for (const at of [0.2, 2.0]) {
  await start(base(1, { creative: { x: (400 + 110) * 24, rebirths: 0 }, story: { met: ['ivy'], beaten: ['matron'] } }));
  await sim((s, [at, runSrc]) => {
    const run = (0, eval)(runSrc);
    s.openingDone = true; s.startRun(); s.hitStop = 1e9;
    s.nextTrapX = s.worldX + 1e6;
    let n = 0; while (!(s.ally && s.ally.said) && n++ < 4000) run(s, 1, 100);
    for (let i = 0; i < at * 120; i++) run(s, 1, 100);
  }, [at, run.toString()]);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/ansel-${at}.png` });
}
if (phases.includes('coroner')) for (const shot of ['tags', 'drawers', 'light', 'sheet', 'write', 'win']) {
  await start(base(1));
  await page.evaluate(() => {
    const play = window.__game.scene.getScene('play');
    play.scene.pause(); play.scene.sleep('hud');
    play.scene.launch('boss', { boss: 'coroner', powers: ['penlight', 'sheet'], char: 'survivor', onEnd: () => {} });
  });
  await page.waitForFunction(() => window.__boss);
  await page.evaluate((shot) => {
    const B = window.__boss;
    const stepN = (n) => { for (let i = 0; i < n; i++) B.step(1 / 120); };
    stepN(220); B.inv = 99;
    B.queue = []; B.bstate = 'idle'; B.bt = 0; B.x = 300; B.bx = 490;
    if (shot === 'win') { B.hp = 1; B.bstate = 'check'; B.damageBoss(); stepN(320); }
    else if (shot === 'write') { B.bstate = 'check'; B.bt = 9; B.x = 440; stepN(8); }
    else {
      const a = { tags: 'tags', drawers: 'drawers', light: 'light', sheet: 'light' }[shot];
      B.queue = [a]; B.x = shot === 'drawers' ? 90 : 230; B.coronerAttack(false);
      let n = 0; while (B.bstate.startsWith('tell') && n++ < 300) stepN(1);
      stepN(shot === 'tags' ? 40 : shot === 'drawers' ? 18 : 50);
      if (shot === 'sheet') { B.x = B.col.x - 20; B.unseenT = 0.5; B.dodgeT = 0.2; }
    }
    B.step = () => {}; // hold this moment: update() still draws it
  }, shot);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/coroner-${shot}.png` });
}
console.log('errors', errs);
await b.close();
