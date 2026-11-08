// Screenshots of the ART LAB (Visual Art Benchmark V1) at native 640x360. node scripts/artlab-shots.mjs [outDir]
// 1-awakening, 2-acting, 3-ghostline (+3b another pose: the thread stays on), 4-threat, 5-compare-v2.
// The lab buttons are hidden (?clean=1); nothing is magnified.
import { chromium } from '@playwright/test';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || join(ROOT, 'shots', 'artlab');
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
await page.goto('http://localhost:8126/?artlab=1&clean=1');
await page.waitForFunction(() => window.__artlab && window.__artlab.scr);
const shot = async (view, name, setup) => {
  await page.evaluate(([v, src]) => { const L = window.__artlab; L.setView(v); L.freeze = false; if (src) (0, eval)('(' + src + ')')(L); }, [view, setup ? setup.toString() : '']);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, name + '.png') });
};
await shot(0, '1-awakening', (L) => { L.t = 1.2; L.freeze = true; });
await shot(1, '2-acting', (L) => { L.t = 0.5; L.freeze = true; });
await shot(2, '3-ghostline', (L) => { L.t = 0.95; L.freeze = true; });
await shot(2, '3b-ghostline-other-pose', (L) => { L.poseIx = 3; L.t = 1.6; L.freeze = true; L.poseT = -99; });
await shot(3, '4-threat', (L) => { L.t = 2; L.freeze = true; });
await shot(4, '5-compare-v2', (L) => { L.t = 0.5; L.freeze = true; });
console.log('errors:', errors.length ? errors : 'none');
await browser.close(); server.close();
