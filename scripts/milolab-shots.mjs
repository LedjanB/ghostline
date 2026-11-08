// Screenshots + a video of the MILO LAB (new Milo, animation prototype V1) at native 640x360.
// node scripts/milolab-shots.mjs [outDir]  ->  shots/milolab/*.png and play-all.webm (all four sequences, game size).
import { chromium } from '@playwright/test';
import http from 'node:http';
import { readFile, mkdir, rename, readdir } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || join(ROOT, 'shots', 'milolab');
await mkdir(OUT, { recursive: true });
const server = http.createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png' }[extname(p)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type }); res.end(await readFile(p));
  } catch { res.writeHead(404); res.end(); }
}).listen(8127);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=swiftshader', '--mute-audio'] });
const errors = [];
const open = async (ctx, q) => {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:8127/?milolab=1' + q);
  await page.waitForFunction(() => window.__milolab && window.__milolab.milo);
  return page;
};
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
const page = await open(ctx, '');
const shot = async (name, fn, arg) => {
  await page.evaluate(([src, a]) => { const L = window.__milolab; L.freeze = false; (0, eval)('(' + src + ')')(L, a); }, [fn.toString(), arg ?? null]);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, name + '.png') });
};
// hold one frame of a sequence
const hold = (L, [seq, frame, ghost]) => {
  L.setCompare(false); L.setGhost(!!ghost); L.pose(seq, 0);
  for (let s = 0; s < 99 && L.milo.frame !== frame; s++) L.milo.step = s + 1;
  L.milo.show();
};
await shot('1-idle', hold, ['idle', 'idle0']);
await shot('2-realization-hands', hold, ['realization', 'hands0']);
await shot('2b-realization-shock', hold, ['realization', 'shock1']);
await shot('3-reaching', hold, ['touch', 'reach3']);
await shot('3b-touch-through', hold, ['touch', 'touch1', true]);
await shot('4-fear', hold, ['fear', 'fear3']);
await shot('4b-fear-zoom', (L) => { L.setZoom(true); }, null);
await shot('5-living-ghost-compare', (L) => { L.setZoom(false); L.setGhost(false); L.freeze = false; L.setCompare(true); }, null);
await shot('6-ui', (L) => { L.setCompare(false); L.playSeq('idle'); }, null);
await page.close();

// video: PLAY ALL at game size, no UI
const vctx = await browser.newContext({ viewport: { width: 640, height: 360 }, recordVideo: { dir: OUT, size: { width: 640, height: 360 } } });
const vp = await open(vctx, '&clean=1&ghost=1');
await vp.evaluate(() => window.__milolab.playAll());
await vp.waitForTimeout(42000);
await vp.close(); await vctx.close();
for (const f of await readdir(OUT)) if (f.endsWith('.webm') && f !== 'play-all.webm') await rename(join(OUT, f), join(OUT, 'play-all.webm'));
console.log('errors:', errors.length ? errors : 'none');
await browser.close(); server.close();
