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
// real time, a scripted player: wake, walk right, jump, back to the bed, the touch, the Ghostline, out to the shadow, Boo
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:8125/?opening=1');
await page.waitForFunction(() => window.__opening);
await page.waitForTimeout(600);
await page.evaluate(() => {
  const S = window.__opening; S.begin();
  let t0 = null, plan = 0;
  window.__drive = setInterval(() => {
    const now = performance.now() / 1000;
    if (S.phase === 'explore') {
      if (t0 === null) t0 = now;
      const t = now - t0;
      S.debugInput = t < 2.2 ? { x: 1, jump: t > 1.4 && t < 1.46 } : { x: -1 };
    } else if (S.phase === 'explore2') {
      if (plan === 0) { plan = 1; t0 = now; }
      const t = now - t0;
      S.debugInput = t < 1 ? { x: 0 } : { x: 1, jump: t > 2.6 && t < 2.66 };
    } else if (S.phase === 'shadow') S.debugInput = { x: 0.6 };
    else S.debugInput = null;
  }, 30);
});
await page.waitForFunction(() => window.__opening && window.__opening.phase === 'end', null, { timeout: 120000, polling: 250 });
await page.waitForTimeout(2500);
const video = page.video();
await ctx.close();
const { rename } = await import('node:fs/promises');
await rename(await video.path(), join(OUT, 'opening-full.webm'));
console.log('errors:', errors.length ? errors : 'none');
await browser.close(); server.close();
