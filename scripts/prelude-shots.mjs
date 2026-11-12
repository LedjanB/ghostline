// Real Phaser captures of the opening prelude preview (?opening=1&prelude=1) at native 640x360.
// node scripts/prelude-shots.mjs [outDir]  ->  shots/opening-prelude/
//   1-exterior.png   St. Mercy in the rain (3 s into the shot)
//   2-corridor.png   the corridor to Ward 4 (1.6 s into the shot)
//   3-bed7.png       the existing opening after the hand-off, once its fade-in from black is done
//   prelude.mp4      the whole run, gate press to Bed 7: Chrome's own screencast of the real game, encoded with ffmpeg
import { chromium } from '@playwright/test';
import http from 'node:http';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || join(ROOT, 'shots', 'opening-prelude');
await mkdir(OUT, { recursive: true });
const server = http.createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png' }[extname(p)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type }); res.end(await readFile(p));
  } catch { res.writeHead(404); res.end(); }
}).listen(8131);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const vdir = join(OUT, 'video-tmp');
await rm(vdir, { recursive: true, force: true }); await mkdir(vdir, { recursive: true });
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const frames = [];
cdp.on('Page.screencastFrame', async (f) => {
  const name = `f${String(frames.length).padStart(5, '0')}.jpg`;
  frames.push({ name, ts: f.metadata.timestamp });
  writeFile(join(vdir, name), Buffer.from(f.data, 'base64'));
  try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* closed */ }
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:8131/?opening=1&prelude=1');
await page.waitForFunction(() => window.__prelude && window.__game.scene.isActive('prelude'));
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 640, maxHeight: 360 });
await page.keyboard.press('Enter');
const at = (shot, t) => page.waitForFunction(([s, k]) => window.__prelude?.shot === s && window.__prelude.shotT >= k, [shot, t], { timeout: 30000 });
await at('exterior', 3.0); await page.screenshot({ path: join(OUT, '1-exterior.png') });
await at('corridor', 1.6); await page.screenshot({ path: join(OUT, '2-corridor.png') });
await page.waitForFunction(() => window.__opening && window.__game.scene.isActive('opening') && window.__opening.phase !== 'gate' && window.__opening.fade < 0.06, null, { timeout: 30000 });
await page.screenshot({ path: join(OUT, '3-bed7.png') });
const opening = await page.evaluate(() => ({ phase: window.__opening.phase, clock: window.__opening.clockState, t: +window.__opening.t.toFixed(2) }));
await page.waitForTimeout(2500);
await cdp.send('Page.stopScreencast');
await page.waitForTimeout(300);
await ctx.close();
// frames arrive when the page changes: hold each one until the next (real timing), then encode
const list = frames.map((f, i) => `file '${f.name}'\nduration ${Math.max(0.001, ((frames[i + 1]?.ts ?? f.ts + 0.04) - f.ts)).toFixed(4)}`).join('\n') + `\nfile '${frames.at(-1).name}'\n`;
await writeFile(join(vdir, 'list.txt'), list);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(vdir, 'list.txt'), '-vf', 'fps=30,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-movflags', '+faststart', join(OUT, 'prelude.mp4')]);
await rm(vdir, { recursive: true, force: true });
console.log(JSON.stringify({ out: OUT, opening, frames: frames.length, seconds: +(frames.at(-1).ts - frames[0].ts).toFixed(1), errors }));
await browser.close();
server.close();
if (errors.length) process.exit(1);
