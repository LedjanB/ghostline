// THE FIRST ENCOUNTER (opening, cinematic revision V1): checks + screenshots at native 640x360.
// node scripts/encounter-shots.mjs [outDir]  -> shots/encounter/
// 1 every player position (near the bed, mid-room, rushing the exit, retreating, idle) must reach the rescue and the
//   end, with the shadow and the hand on screen at the key moments (logged);
// 2 the eight beats as PNGs (curtain, first shadow, approach, fear, ignition, recoil, Boo protecting, to the corridor);
// 3 Boo's sheets (cold + lit) at 3x for the art review.
import { chromium } from '@playwright/test';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || join(ROOT, 'shots', 'encounter');
await mkdir(OUT, { recursive: true });
const server = http.createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png' }[extname(p)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type }); res.end(await readFile(p));
  } catch { res.writeHead(404); res.end(); }
}).listen(8126);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=swiftshader', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.text().startsWith('[stuck]')) console.log(m.text()); });
const fresh = async () => {
  await page.goto('http://localhost:8126/?opening=1');
  await page.waitForFunction(() => window.__opening && window.__opening.sys.isActive());
  await page.evaluate(() => {
    const S = window.__opening; S.freeze = true; S.begin();
    // wait in sim time for a condition; never hangs (logs where it got stuck)
    window.U = (S, c) => { let q = 0; while (c() && q++ < 3600) S.step(1 / 60); if (q >= 3600) console.log('[stuck]', c.toString(), S.phase, S.enc.st, Math.round(S.m.x), Math.round(S.sh.len), S.sh.pts && Math.round(S.sh.pts.total), S.control); };
  });
};
// to the encounter: wake, the discovery, control back
const PRE = (S) => {
  const N = (sec, x = 0) => { S.debugInput = { x }; for (let i = 0; i < sec * 60; i++) S.step(1 / 60); };
  while (S.phase !== 'explore') S.step(1 / 60);
  S.debugInput = { x: -1 }; while (S.phase !== 'discover') S.step(1 / 60);
  S.debugInput = { x: 0 }; while (S.phase !== 'explore2') S.step(1 / 60);
  N(0.5);
};

// ---- 1 every position reaches the rescue, with the danger on screen ----
const plans = {
  bed: "S.m.x > 260 ? -1 : 0",
  mid: "S.m.x < 600 ? 1 : 0",
  exit: "1",
  retreat: "S.phase === 'shadow' && S.enc.st === 'reach' ? -1 : (S.m.x < 520 ? 1 : 0)",
  idle: "0",
  jumpy: "S.phase === 'escape' ? 1 : (S.m.x < 700 ? 1 : -1)",
};
const results = {};
for (const [name, plan] of Object.entries(process.env.QUICK ? {} : plans)) {
  await fresh();
  results[name] = await page.evaluate(([pre, plan, name]) => {
    const S = window.__opening;
    (0, eval)('(' + pre + ')')(S);
    const f = new Function('S', 'return ' + plan);
    const log = [];
    let last = '', n = 0, handSeenAtGrab = null, figureSeen = 0, booOnScreenAtFlare = null, rescueX = null;
    while (S.phase !== 'end' && n < 60 * 120) {
      const jump = name === 'jumpy' && n % 50 === 0;
      S.debugInput = { x: S.control ? f(S) : 0, jump };
      S.step(1 / 60); n++;
      const key = S.phase + '/' + S.enc.st;
      if (key !== last) { log.push(`${(n / 60).toFixed(1)}s ${key} x=${Math.round(S.m.x)} cam=${Math.round(S.cam.x)}`); last = key; }
      if (S.phase === 'rescue' && handSeenAtGrab === null) { handSeenAtGrab = S.sh.hand ? S.inView(S.sh.hand.x, S.sh.hand.y, 0) : false; rescueX = Math.round(S.m.x); }
      if (S.enc.st === 'figure' && S.inView(S.sh.fx, 190, 40)) figureSeen += 1 / 60;
      if (S.flare > 0.95 && booOnScreenAtFlare === null) booOnScreenAtFlare = S.inView(S.booA.x, 270, 0) && S.inView(S.m.x, 270, 0);
    }
    return { end: S.phase, t: (n / 60).toFixed(1), flags: S.flags, seen: +S.enc.seen.toFixed(1), seenReach: +S.enc.seenReach.toFixed(1), handSeenAtGrab, booOnScreenAtFlare, figureSeen: +figureSeen.toFixed(1), rescueX, log };
  }, [PRE.toString(), plan, name]);
  console.log(name, JSON.stringify({ ...results[name], log: undefined }));
  results[name].log.forEach((l) => console.log('   ', l));
}

// ---- 2 the beats ----
await fresh();
const at = async (fn, file) => {
  const err = await page.evaluate((src) => { const S = window.__opening; try { (0, eval)('(' + src + ')')(S); } catch (e) { return e.stack; } return ''; }, fn.toString());
  if (err) console.log(file, err.split('\n').slice(0, 5).join(' / '));
  await page.waitForTimeout(200);
  if (file) await page.screenshot({ path: join(OUT, file + '.png') });
};
await at(PRE, '');
await at((S) => { S.debugInput = { x: 1 }; U(S, () => (S.m.x < 470)); S.debugInput = { x: 0 }; U(S, () => (!(S.dent > 0.8))); }, '1-curtain-disturbance');
await at((S) => { U(S, () => (!(S.enc.st === 'figure' && S.sh.rise > 0.95))); for (let i = 0; i < 20; i++) S.step(1 / 60); }, '2-first-shadow');
await at((S) => { S.debugInput = { x: 1 }; U(S, () => (S.m.x < 640)); S.debugInput = { x: 0 }; U(S, () => (!(S.sh.climb > 0.9))); }, '2b-up-the-wall');
await at((S) => { U(S, () => (!(S.enc.st === 'reach' && S.sh.len > 250))); }, '3-shadow-approaching');
await at((S) => { U(S, () => (!(S.enc.scared && S.milo.frame === 'fear3'))); for (let i = 0; i < 30; i++) S.step(1 / 60); }, '4-milo-frightened');
await at((S) => { U(S, () => (S.phase !== 'rescue')); for (let i = 0; i < 40; i++) S.step(1 / 60); }, '4b-trapped');
await at((S) => { U(S, () => (!(S.booS.on && S.booS.mode === 'come' && Math.abs(S.booS.x - S.booS.tx) < 60))); }, '5-lantern-coming');
await at((S) => { U(S, () => (!(S.flare > 0.9))); for (let i = 0; i < 6; i++) S.step(1 / 60); }, '5b-lantern-flare');
await at((S) => { U(S, () => (!(S.sh.burn > 0.7))); for (let i = 0; i < 14; i++) S.step(1 / 60); }, '6-shadow-recoiling');
await at((S) => { U(S, () => (!(S.bubble && S.bubble.str === 'THERE YOU ARE.'))); for (let i = 0; i < 50; i++) S.step(1 / 60); }, '7-boo-protecting');
await at((S) => { U(S, () => (!(S.bubble && S.bubble.str === 'WHAT IS THAT?'))); for (let i = 0; i < 50; i++) S.step(1 / 60); }, '7b-what-is-that');
await at((S) => { U(S, () => (!(S.bubble && S.bubble.str === 'NOT NOW, KID. MOVE.'))); for (let i = 0; i < 60; i++) S.step(1 / 60); }, '7c-move');
await at((S) => { U(S, () => (S.phase !== 'escape')); S.debugInput = { x: 1 }; for (let i = 0; i < 60 * 1.6; i++) S.step(1 / 60); }, '8-to-the-corridor');
await at((S) => { U(S, () => (!(S.enc.st === 'lunge' && S.sh.len > 160))); }, '8b-last-reach');
await at((S) => { U(S, () => (!(S.enc.st === 'gone'))); for (let i = 0; i < 10; i++) S.step(1 / 60); }, '8c-last-reach-burns');
await at((S) => { S.debugInput = { x: 0 }; U(S, () => (!(S.m.x > 925))); }, '8d-through-the-door');
await at((S) => { U(S, () => (S.phase !== 'end')); for (let i = 0; i < 60; i++) S.step(1 / 60); }, '9-end');
// ---- 3 Boo's sheets ----
await page.setViewportSize({ width: 1280, height: 720 });
await page.evaluate(() => {
  const S = window.__opening;
  const c = document.createElement('canvas'); c.width = 1280; c.height = 720; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.fillStyle = '#20222c'; x.fillRect(0, 0, 1280, 720);
  const a = S.textures.get('boo2_cold').getSourceImage(), b = S.textures.get('boo2_lit').getSourceImage(), m = S.textures.get('milo2_ghost').getSourceImage();
  x.drawImage(m, 0, 0, 96, 100, 0, 10, 192, 200);
  x.drawImage(a, 0, 0, 768, 100, 160, 10, 1100, 143);
  x.drawImage(b, 0, 0, 768, 100, 160, 170, 1100, 143);
  x.drawImage(a, 0, 100, 768, 100, 160, 330, 1100, 143);
  x.drawImage(b, 0, 100, 768, 100, 160, 490, 1100, 143);
  document.body.innerHTML = ''; document.body.style.margin = '0'; document.body.appendChild(c);
});
await page.screenshot({ path: join(OUT, '10-boo-sheets.png') });
console.log('errors:', errors.length ? errors : 'none');
await browser.close(); server.close();
