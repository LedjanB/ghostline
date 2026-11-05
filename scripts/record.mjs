// Records a real-time bot run as frames (for AI testers; `ffmpeg -framerate 4 -i frame-%04d.png run.mp4` makes a clip).
// Usage: node scripts/record.mjs <outDir> [profile=regular] [seconds=150] [startWorld=0] [pages=12]
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const [out, profile = 'regular', secs = '150', world = '0', pages = '12'] = process.argv.slice(2);
const src = await readFile(new URL('./bot.mjs', import.meta.url), 'utf8');
const brainSrc = src.slice(src.indexOf('function brain('), src.indexOf('// ---------------- one run'));
const PROFILES = { casual: { jitter: 0.07, lapse: 0.07, fly: 0.6, airLag: 0.2 }, regular: { jitter: 0.045, lapse: 0.035, fly: 0.8, airLag: 0.14 }, expert: { jitter: 0.02, lapse: 0.01, fly: 0.95, airLag: 0.09 } };
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
const page = await ctx.newPage();
await page.goto('http://localhost:8000/');
await page.evaluate(([g]) => { localStorage.clear(); localStorage.setItem('ghostline-save', JSON.stringify({ version: 7, storySeen: true, runs: 12, tips: [], unlocks: { got: Number(g), points: 0, fresh: 0 } })); }, [pages]);
await page.reload();
await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
await page.waitForTimeout(1500);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game.scene.isActive('play') && window.__game.scene.getScene('play').runner);
await page.evaluate(([bs, prof, w]) => {
  const s = window.__game.scene.getScene('play');
  const bot = (0, eval)('(' + bs + ')')(s, { profile: prof, seed: 4242 });
  if (Number(w) > 0) { s.worldX = (Number(w) * 400 + 20) * 24; s.zoneIndex = Number(w); s.layers.destroy?.(); }
  // the game is stepped here (fixed 120 Hz) and only drawn by its own loop, so frames stay true to game time
  s.inputMap.held = (k) => (k === 'slide' ? bot.held() : false);
  s.hitStop = 1e9; s.openingDone = true; s.jumpLatch = true;
  window.__advance = (sec) => {
    for (let n = 0; n < sec * 120 && !s.ended; n++) {
      let holding = false;
      if (!s.dead) { if (s.flying) holding = bot.air(); else { bot.ground(1 / 120); holding = true; } }
      s.step(1 / 120, holding);
    }
    if (s.ended && !window.__fin) { window.__fin = true; s.hitStop = 0; s.afterDeath(); }
    return { m: Math.floor(s.worldX / 24), z: s.zoneIndex, ended: s.ended };
  };
}, [brainSrc, PROFILES[profile], world]);
const end = Date.now() + Number(secs) * 1000;
let i = 0, overAt = 0;
while (Date.now() < end) {
  const st = await page.evaluate((dt) => window.__advance(dt), Number(process.env.FRAME_S || 0.5));
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${out}/frame-${String(i++).padStart(4, '0')}.png` });
  if (st.ended) await page.waitForTimeout(600);
  const sc = await page.evaluate(() => window.__game.scene.getScenes(true).map((x) => x.scene.key));
  if (sc.includes('over') && !overAt) overAt = Date.now();
  if (overAt && Date.now() - overAt > 5000) break;
}
console.log('frames', i);
await ctx.close(); await b.close();
