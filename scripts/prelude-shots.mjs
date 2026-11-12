// Opening V4 review cut (directed: St. Mercy, the corridor, Bed 7, 3:33, the separation), captured from the real Phaser game at a fixed 30 fps.
// node scripts/prelude-shots.mjs [outDir]  ->  shots/opening-v4/
// Phaser's own requestAnimationFrame loop is paused and the game is stepped by exactly 1/30 s per frame
// (game.step, the same call the loop makes), then each frame is screenshotted. So the video's cadence is exact:
// no dropped or repeated frames from screen recording, and what it shows is what the game draws.
//   opening-v4.mp4    gate press -> exterior -> corridor -> Bed 7 -> 3:33 -> separation -> his body (30 fps, H.264)
//   seven stills, one per action: someone at the entrance ... his living body
import { chromium } from '@playwright/test';
import http from 'node:http';
import { readFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || join(ROOT, 'shots', 'opening-v4');
const FR = join(OUT, 'frames-tmp');
await rm(FR, { recursive: true, force: true });
await mkdir(FR, { recursive: true });
const server = http.createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png' }[extname(p)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type }); res.end(await readFile(p));
  } catch { res.writeHead(404); res.end(); }
}).listen(8131);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=swiftshader', '--mute-audio'] });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:8131/?opening=1&prelude=1');
await page.waitForFunction(() => window.__prelude && window.__game.scene.isActive('prelude'));
await page.evaluate(() => {
  const g = window.__game;
  g.loop.sleep();
  let t = g.loop.now || performance.now();
  window.__step = () => { t += 1000 / 30; g.step(t, 1000 / 30); };
  window.__state = () => {
    const p = window.__prelude, v = window.__openingv2;
    if (p && g.scene.isActive('prelude')) return { s: p.shot, k: p.t };
    if (v && g.scene.isActive('openingv2')) return { s: 'room', k: v.t, phase: v.phase, rise: v.rise, landed: v.landed, clock: v.clockState, shot: v.shot };
    return { s: 'between', k: 0, active: g.scene.getScenes(true).map((x) => x.scene.key) };
  };
});
await page.keyboard.press('Enter');
const want = [ // still name, when: each one an action, not a location
  ['1-someone-at-the-entrance', (s) => s.s === 'exterior' && s.k >= 2.15],
  ['2-corridor-door-shadow', (s) => s.s === 'corridor' && s.k >= 6.85],
  ['3-asleep-breathing-twitch', (s) => s.s === 'room' && s.k >= 4.5],
  ['4-333-power-drops', (s) => s.s === 'room' && s.k >= 8.35],
  ['5-separation', (s) => s.s === 'room' && s.rise >= 3.15],
  ['6-his-hands', (s) => s.s === 'room' && s.k >= 21.8],
  ['7-his-living-body', (s) => s.s === 'room' && s.k >= 26.2],
];
let n = 0, endAt = -1;
const log = [];
for (; n < 30 * 50; n++) {
  await page.evaluate(() => window.__step());
  const st = await page.evaluate(() => window.__state());
  const file = join(FR, `f${String(n).padStart(5, '0')}.png`);
  await page.screenshot({ path: file });
  while (want.length && want[0][1](st)) { await copyFile(file, join(OUT, want[0][0] + '.png')); log.push([want[0][0], +(n / 30).toFixed(2), st.clock || '']); want.shift(); }
  if (st.s === 'room' && st.phase === 'end' && endAt < 0) endAt = n + 45;
  if (endAt > 0 && n >= endAt) break;
}
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(FR, 'f%05d.png'), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(OUT, 'opening-v4.mp4')]);
await rm(FR, { recursive: true, force: true });
console.log(JSON.stringify({ last: await page.evaluate(() => window.__state()), out: OUT, frames: n + 1, seconds: +((n + 1) / 30).toFixed(1), stills: log, missing: want.map((w) => w[0]), errors }));
await browser.close();
server.close();
if (errors.length) process.exit(1);
