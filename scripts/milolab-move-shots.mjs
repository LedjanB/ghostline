// Screenshots + a video of MILO LAB MOVE (walk, run, jump) at native 640x360, driven with real key presses.
// node scripts/milolab-move-shots.mjs [outDir]  ->  shots/milolab-move/*.png, frames.png (every movement frame x3), move.webm
import { chromium } from '@playwright/test';
import http from 'node:http';
import { readFile, mkdir, rename, readdir } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || join(ROOT, 'shots', 'milolab-move');
await mkdir(OUT, { recursive: true });
const server = http.createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png' }[extname(p)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type }); res.end(await readFile(p));
  } catch { res.writeHead(404); res.end(); }
}).listen(8128);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=swiftshader', '--mute-audio'] });
const errors = [];
const open = async (ctx, q = '') => {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:8128/?milolab=1&move=1' + q);
  await page.waitForFunction(() => window.__milolab && window.__milolab.move);
  await page.waitForTimeout(400);
  return page;
};
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
const page = await open(ctx);
const L = (fn) => page.evaluate(fn);
const shot = (name) => page.screenshot({ path: join(OUT, name + '.png') });
const until = (cond, ms = 4000) => page.waitForFunction(cond, null, { timeout: ms, polling: 'raf' });

await shot('1-idle');
await page.keyboard.down('ArrowRight');
await until(() => window.__milolab.mover.anim === 'walk' && window.__milolab.mover.frame === 'walk0');
await page.waitForTimeout(250); await shot('2-walk-right');
await page.keyboard.down('Shift');
await until(() => window.__milolab.mover.anim === 'run');
await page.waitForTimeout(500); await shot('3-run');
await page.keyboard.up('Shift'); await page.keyboard.up('ArrowRight');
await until(() => window.__milolab.mover.anim === 'idle');
await page.keyboard.down('ArrowLeft');
await until(() => window.__milolab.mover.anim === 'walk');
await page.waitForTimeout(300); await shot('4-walk-left');
await page.keyboard.up('ArrowLeft');
await until(() => window.__milolab.mover.anim === 'idle');
// jump in place: crouch, rise, apex, fall, land
await page.keyboard.down('Space');
await until(() => window.__milolab.mover.frame === 'jump_rise'); await shot('5-jump-rise');
await until(() => window.__milolab.mover.anim === 'apex'); await shot('6-jump-apex');
await page.keyboard.up('Space');
await until(() => window.__milolab.mover.anim === 'fall'); await shot('7-jump-fall');
await until(() => window.__milolab.mover.frame === 'land0'); await shot('8-land');
// running jump onto the bed, ghost
await L(() => window.__milolab.setGhost(true));
await page.keyboard.down('ArrowRight'); await page.keyboard.down('Shift');
await until(() => window.__milolab.mv.x > 300, 6000);
await page.keyboard.down('Space'); await page.waitForTimeout(260); await shot('9-ghost-running-jump');
await page.keyboard.up('Space');
await until(() => window.__milolab.mv.ground, 3000);
await page.keyboard.up('ArrowRight'); await page.keyboard.up('Shift');
await page.waitForTimeout(700); await shot('10-ghost-on-the-bed');
await L(() => { const S = window.__milolab; S.setGhost(false); S.setZoom(true); });
await page.waitForTimeout(200); await shot('11-zoom-inspect');
await page.close();

// all movement frames, living row and ghost row, x3 (review sheet)
const sheet = await ctx.newPage();
await sheet.goto('http://localhost:8128/assets/milo/frames.json');
const meta = JSON.parse(await sheet.evaluate(() => document.body.innerText));
const moveNames = meta.frames.slice(meta.frames.indexOf('side'));
await sheet.setViewportSize({ width: 1500, height: 1000 });
await sheet.setContent(`<body style="margin:0;background:#141a2a;font:11px monospace;color:#ffe0a0"><div id=g style="display:flex;flex-wrap:wrap;gap:4px;padding:6px"></div></body>`);
await sheet.evaluate(([names, all]) => {
  const g = document.getElementById('g');
  for (const sheetName of ['milo-living', 'milo-ghost']) for (const n of names) {
    const k = all.indexOf(n), d = document.createElement('div');
    d.style.cssText = 'width:192px;text-align:center';
    d.innerHTML = `<div style="width:192px;height:200px;background:url(http://localhost:8128/assets/milo/${sheetName}.png) -${(k % 8) * 192}px -${Math.floor(k / 8) * 200}px / 1536px auto;image-rendering:pixelated"></div>${n}`;
    g.appendChild(d);
  }
}, [moveNames, meta.frames]);
await sheet.waitForTimeout(500);
await sheet.screenshot({ path: join(OUT, 'frames.png'), fullPage: true });
await sheet.close();

// video: walk, run, turn around, jumps onto the props, game size
const vctx = await browser.newContext({ viewport: { width: 640, height: 360 }, recordVideo: { dir: OUT, size: { width: 640, height: 360 } } });
const vp = await open(vctx);
const k = vp.keyboard, w = (ms) => vp.waitForTimeout(ms);
await w(800);
await k.down('ArrowRight'); await w(1600); await k.down('Shift'); await w(900);
await k.down('Space'); await w(350); await k.up('Space'); await w(900);
await k.up('Shift'); await w(700); await k.up('ArrowRight'); await w(900);
await k.down('ArrowLeft'); await w(1200); await k.up('ArrowLeft'); await w(700);
await k.down('Space'); await w(500); await k.up('Space'); await w(1000);
await k.down('ArrowRight'); await k.down('Shift'); await w(1800);
await k.down('Space'); await w(400); await k.up('Space'); await w(1200);
await k.down('Space'); await w(400); await k.up('Space'); await w(1400);
await k.up('Shift'); await k.up('ArrowRight'); await w(1200);
await vp.close(); await vctx.close();
for (const f of await readdir(OUT)) if (f.endsWith('.webm') && f !== 'move.webm') await rename(join(OUT, f), join(OUT, 'move.webm'));
console.log('errors:', errors.length ? errors : 'none');
await browser.close(); server.close();
