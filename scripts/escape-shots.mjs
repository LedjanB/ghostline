// ESCAPE PROOF gameplay recording (?escape=1), the real game at a fixed 30 fps, played with the keyboard.
// node scripts/escape-shots.mjs [outDir]  ->  shots/escape/
// Phaser's rAF loop is paused and the game is stepped 1/30 s per frame (game.step), with real key events sent
// between frames: attempt 1 hops straight over Bed 8 and the shadow's arm takes him; attempt 2 gets up on
// Bed 8, lets the arm pass, and goes through the door.
//   escape.mp4  +  1-threat 2-run 3-the-arm 4-caught 5-on-bed-8 6-through-the-door (.png)
import { chromium } from '@playwright/test';
import http from 'node:http';
import { readFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || join(ROOT, 'shots', 'escape');
const FR = join(OUT, 'frames-tmp');
await rm(FR, { recursive: true, force: true }); await mkdir(FR, { recursive: true });
const server = http.createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png' }[extname(p)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type }); res.end(await readFile(p));
  } catch { res.writeHead(404); res.end(); }
}).listen(8132);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=swiftshader', '--mute-audio'] });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:8132/?escape=1');
await page.waitForFunction(() => window.__escape && window.__escape.milo?.sprite?.texture?.key);
await page.evaluate(() => {
  const g = window.__game; g.loop.sleep();
  let t = g.loop.now || performance.now();
  window.__step = () => { t += 1000 / 30; g.step(t, 1000 / 30); };
  window.__st = () => { const e = window.__escape; return { ph: e.phase, x: e.m.x, y: e.m.y, sw: e.sweep ? e.sweep.t : -1, done: e.sweepDone, caught: e.caught, esc: e.escaped, tries: e.tries }; };
});
const keys = new Set();
const hold = async (k, on) => { if (on && !keys.has(k)) { keys.add(k); await page.keyboard.down(k); } if (!on && keys.has(k)) { keys.delete(k); await page.keyboard.up(k); } };
const want = [
  ['1-threat', (s) => s.ph === 'threat' && s.t >= 1.2],
  ['2-run', (s) => s.ph === 'run' && s.tries === 0 && s.x > 520],
  ['3-the-arm', (s) => s.sw > 0.75 && s.tries === 0],
  ['4-caught', (s) => s.caught > 0 && s.caught < 0.45],
  ['5-on-bed-8', (s) => s.tries === 1 && s.sw > 0.85 && s.y < 270],
  ['6-through-the-door', (s) => s.esc > 0.25],
];
const log = [];
let n = 0, end = -1;
for (; n < 30 * 30; n++) {
  const s = await page.evaluate(() => ({ ...window.__st(), t: window.__escape.t }));
  // the player: attempt 1 hops Bed 8 at once; attempt 2 climbs it, waits for the arm, then runs for the door
  if (s.ph === 'run' && !s.caught && !s.esc) {
    if (s.tries === 0) { await hold('d', true); await hold('Space', s.x > 788 && s.x < 800); } // a quick hop
    else {
      const onBed = s.y < 270 && s.x > 850;
      const wait = onBed && !s.done;
      await hold('d', !wait && n % 1 === 0);
      await hold('Space', !onBed && s.x > 792 && s.x < 845);
    }
  } else { await hold('d', false); await hold('Space', false); }
  await page.evaluate(() => window.__step());
  const file = join(FR, `f${String(n).padStart(5, '0')}.png`);
  await page.screenshot({ path: file });
  const s2 = await page.evaluate(() => ({ ...window.__st(), t: window.__escape.t }));
  while (want.length && want[0][1](s2)) { await copyFile(file, join(OUT, want[0][0] + '.png')); log.push([want[0][0], +(n / 30).toFixed(2)]); want.shift(); }
  if (s2.ph === 'escaped' && end < 0) end = n + 40;
  if (end > 0 && n >= end) break;
}
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(FR, 'f%05d.png'), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(OUT, 'escape.mp4')]);
await rm(FR, { recursive: true, force: true });
console.log(JSON.stringify({ out: OUT, frames: n + 1, seconds: +((n + 1) / 30).toFixed(1), stills: log, missing: want.map((w) => w[0]), last: await page.evaluate(() => window.__st()), errors }));
await browser.close(); server.close();
if (errors.length) process.exit(1);
