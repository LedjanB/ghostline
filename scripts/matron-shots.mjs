// Screenshots of THE NIGHT MATRON's three acts (and the moths). node scripts/matron-shots.mjs [outDir]
import { chromium } from '@playwright/test';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || join(ROOT, 'shots', 'matron');
await mkdir(OUT, { recursive: true });
const server = http.createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png' }[extname(p)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type }); res.end(await readFile(p));
  } catch { res.writeHead(404); res.end(); }
}).listen(8124);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=swiftshader', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:8124/');
await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
const start = (phase) => page.evaluate((phase) => new Promise((res) => {
  const g = window.__game; g.scene.getScenes(true).forEach((sc) => sc.scene.stop()); window.__boss = null;
  setTimeout(() => g.scene.start('boss', { boss: 'matron', powers: ['penlight'], char: 'survivor', phase, taught: ['roll', 'curtain', 'dive', 'gurney', 'open', 'ready', 'dark', 'graze'], onEnd: () => {} }), 60);
  const wait = () => (window.__boss ? res() : setTimeout(wait, 50)); wait();
}), phase);
// run the sim to a moment, then let it draw
const at = async (fn, name) => {
  const err = await page.evaluate((src) => { const B = window.__boss; window.__game.loop.sleep(); try { (0, eval)('(' + src + ')')(B); } catch (e) { return e.stack; } window.__game.loop.wake(); return ''; }, fn.toString());
  if (err) console.log(name, err.split(String.fromCharCode(10)).slice(0, 6).join(' / '));
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(OUT, name + '.png') });
};
const N = (B, n) => { for (let i = 0; i < n; i++) B.step(1 / 120); };
await start(1);
await at((B) => { for (let i = 0; i < 240; i++) B.step(1 / 120); B.queue = ['roll']; B.bstate = 'idle'; B.bt = 0; for (let i = 0; i < 20; i++) B.step(1 / 120); B.bt = 9; }, '1-roll-tell');
await at((B) => { B.x = 300; B.bstate = 'wallStun'; B.bx = 60; B.bt = 3; B.hitT = 0.06; B.face = -1; for (let i = 0; i < 3; i++) B.addCrack(); }, '1-open');
await at((B) => { B.bstate = 'idle'; B.bt = 0; B.queue = ['curtain']; B.x = 300; for (let i = 0; i < 200; i++) B.step(1 / 120); }, '1-curtain');
await at((B) => { B.hp = 18; B.mCrack(); B.x = B.bx + 120; B.charge = 1; B.usePower(); for (let i = 0; i < 150; i++) B.step(1 / 120); }, '1-collapse');
await at((B) => { for (let i = 0; i < 45; i++) B.step(1 / 120); window.__game.loop.sleep(); }, '1-fall');
await start(2);
await at((B) => { for (let i = 0; i < 240; i++) B.step(1 / 120); B.queue = ['dive']; B.bstate = 'idle'; B.bt = 0; for (let i = 0; i < 120; i++) B.step(1 / 120); }, '2-dive');
await start(3);
await at((B) => { for (let i = 0; i < 240; i++) B.step(1 / 120); B.queue = ['gurney2']; B.bstate = 'idle'; B.bt = 0; for (let i = 0; i < 260; i++) B.step(1 / 120); }, '3-gurneys');
await at((B) => { B.ashHazards(); B.x = 1236; B.y = 1360 - 84 * 5; B.ground = B.surfAt(B.x, B.y); B.grounded = true; B.darkWant = 0.86; B.dark = 0.86; B.kb = 6; B.bx = 1060; B.by = 1360 - 84 * 6; B.bstate = 'idle'; B.bt = 5; B.charge = 1; B.usePower(); for (let i = 0; i < 20; i++) B.step(1 / 120); }, '3-dark-penlight');
await at((B) => { B.x = 1100; B.y = 1360 - 84 * 12; B.ground = B.surfAt(B.x, B.y); B.kb = 12; B.bx = 1052; B.by = 1360 - 84 * 12; B.win(); for (let i = 0; i < 300; i++) B.step(1 / 120); }, '3-moths');
console.log('errors:', errors.length ? errors : 'none');
await browser.close(); server.close();
