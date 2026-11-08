// Screenshots of THE WRONG SIDE OF THE BED (opening v2). node scripts/opening-shots.mjs [outDir]
// 1 both Milos after the awakening, 2 Milo reaching for his own hand, 3 the Ghostline going into the floor,
// 4 the thread stays on his wrist when he walks away, 5 the door at the far end, 6 the sprite sheet (art review).
// Nov 8: the new Milo (raster sprites): separation, awakening acting, walk, jump, hands, reach, through, recoil.
import { chromium } from '@playwright/test';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || join(ROOT, 'shots', 'opening');
await mkdir(OUT, { recursive: true });
const server = http.createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png' }[extname(p)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type }); res.end(await readFile(p));
  } catch { res.writeHead(404); res.end(); }
}).listen(8125);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=swiftshader', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:8125/?opening=1');
await page.waitForFunction(() => window.__opening);
await page.evaluate(() => { const s = window.__opening; s.begin(); });
// run the sim to a moment (frozen: update() only draws), then let it draw
const at = async (fn, name) => {
  const err = await page.evaluate((src) => { const S = window.__opening; S.freeze = true; try { (0, eval)('(' + src + ')')(S); } catch (e) { return e.stack; } return ''; }, fn.toString());
  if (err) console.log(name, err.split(String.fromCharCode(10)).slice(0, 6).join(' / '));
  await page.waitForTimeout(250);
  if (name) await page.screenshot({ path: join(OUT, name + '.png') });
};
const N = (S, sec, x = 0) => { S.debugInput = { x }; for (let i = 0; i < sec * 60; i++) S.step(1 / 60); S.debugInput = { x: 0 }; };
await at((S) => { for (let i = 0; i < 60 * 3.6; i++) S.step(1 / 60); }, '00-before-333');
await at((S) => { while (S.rise < 0) S.step(1 / 60); for (let i = 0; i < 60 * 1.2; i++) S.step(1 / 60); }, '0-separating');
await at((S) => { while (S.rise < 2.1) S.step(1 / 60); for (let i = 0; i < 30; i++) S.step(1 / 60); }, '0b-sitting-up');
await at((S) => { while (S.rise >= 0) S.step(1 / 60); for (let i = 0; i < 60; i++) S.step(1 / 60); }, '1-both-milos');
await at((S) => { while (S.milo.frame !== 'look_l2') S.step(1 / 60); }, '1b-looks-around');
await at((S) => { while (S.phase !== 'explore') S.step(1 / 60); S.debugInput = { x: 1 }; for (let i = 0; i < 60 * 1.5; i++) S.step(1 / 60); S.debugInput = { x: 0 }; }, '1c-walk');
await at((S) => { S.debugInput = { x: 1, jump: true }; S.step(1 / 60); S.debugInput = { x: 1 }; for (let i = 0; i < 20; i++) S.step(1 / 60); S.debugInput = { x: 0 }; }, '1d-jump');
await at((S) => { for (let i = 0; i < 60; i++) S.step(1 / 60); S.debugInput = { x: -1 }; while (S.phase !== 'discover') S.step(1 / 60); S.debugInput = { x: 0 }; while (S.milo.frame !== 'hands2') S.step(1 / 60); }, '2a-hands');
await at((S) => { while (S.milo.frame !== 'shock1') S.step(1 / 60); }, '2a2-shock');
await at((S) => { while (S.milo.frame !== 'reach3') S.step(1 / 60); for (let i = 0; i < 20; i++) S.step(1 / 60); }, '2-reaching');
await at((S) => { while (!S.through) S.step(1 / 60); for (let i = 0; i < 8; i++) S.step(1 / 60); }, '2b-through');
await at((S) => { while (!S.bubble) S.step(1 / 60); for (let i = 0; i < 50; i++) S.step(1 / 60); }, '2c-thats-me');
await at((S) => { while (S.gl.stage < 1) S.step(1 / 60); for (let i = 0; i < 40; i++) S.step(1 / 60); }, '3a-pulse');
await at((S) => { while (!(S.gl.stage === 3 && S.gl.k > 0.85)) S.step(1 / 60); }, '3-ghostline-floor');
await at((S) => { while (S.phase !== 'explore2') S.step(1 / 60); S.debugInput = { x: 1 }; for (let i = 0; i < 150; i++) S.step(1 / 60); S.debugInput = { x: 0 }; for (let i = 0; i < 20; i++) S.step(1 / 60); }, '4-thread-follows');
await at((S) => { S.debugInput = { x: 1, jump: true }; S.step(1 / 60); S.debugInput = { x: 1 }; for (let i = 0; i < 22; i++) S.step(1 / 60); S.debugInput = { x: 0 }; }, '4b-thread-jump');
await at((S) => { for (let i = 0; i < 60; i++) S.step(1 / 60); S.m.x = 600; S.m.vx = 0; for (let i = 0; i < 300; i++) S.step(1 / 60); }, '5-room-window');
// the first encounter has its own shots: node scripts/encounter-shots.mjs
// the Milo sheets used here (living, ghost, bed 7) at 2x on grey
await page.evaluate(() => {
  const S = window.__opening;
  const c = document.createElement('canvas'); c.width = 1280; c.height = 720; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.fillStyle = '#20222c'; x.fillRect(0, 0, 1280, 720);
  const a = S.textures.get('milo2_ghost').getSourceImage(); x.drawImage(a, 0, 0, 768, 400, 0, 0, 768, 400);
  const b = S.textures.get('milo2_sleep').getSourceImage(); x.drawImage(b, 0, 0, b.width, b.height, 0, 420, b.width * 1.5, b.height * 1.5);
  document.body.innerHTML = ''; document.body.style.margin = '0'; document.body.appendChild(c);
});
await page.screenshot({ path: join(OUT, '6-sprites.png') });
console.log('errors:', errors.length ? errors : 'none');
await browser.close(); server.close();
