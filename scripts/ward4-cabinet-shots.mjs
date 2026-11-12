// Real Phaser screenshots of WARD LAB (?wardlab=1) at native 640x360: Bed 7's cabinet shown and hidden.
// node scripts/ward4-cabinet-shots.mjs [outDir]  ->  shots/ward4-cabinet/
//   cabinet-visible.png   the game as it runs: room-shell-v1 + cabinet.png (+ the bits it missed, from the plate)
//   cabinet-hidden.png    the same frame with the cabinet hidden (K): the repainted wall, floor and bed end
//   reference-plate.png   the same frame drawn the old way (room-plate.png background, uncropped bed body)
// Milo stands on Bed 7 facing the cabinet; the scene is paused so all three are the same frame.
import { chromium } from '@playwright/test';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || join(ROOT, 'shots', 'ward4-cabinet');
await mkdir(OUT, { recursive: true });
const server = http.createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png' }[extname(p)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type }); res.end(await readFile(p));
  } catch { res.writeHead(404); res.end(); }
}).listen(8129);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=swiftshader', '--mute-audio'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:8129/?wardlab=1');
await page.waitForFunction(() => window.__game?.scene?.isActive('wardlab') && window.__game.scene.getScene('wardlab').milo?.sprite?.texture?.key === 'milo2_living');
// Milo on the mattress, facing the cabinet; the camera follows him to the room's left edge
await page.evaluate(() => {
  const s = window.__game.scene.getScene('wardlab');
  Object.assign(s.m, { x: 330, y: 265, vx: 0, vy: 0, ground: true });
  s.milo.setFacing(-1);
});
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const s = window.__game.scene.getScene('wardlab');
  s.cameras.main.scrollX = Math.round(s.cameras.main.scrollX);
  s.scene.pause(); // update() stops (Milo, rain, camera frozen); the scene keeps rendering
});
const frame = () => page.waitForTimeout(300);
const shot = (name) => page.screenshot({ path: join(OUT, name + '.png') });
const state = await page.evaluate(() => {
  const s = window.__game.scene.getScene('wardlab');
  return { cam: s.cameras.main.scrollX, milo: [s.m.x, s.m.y], anim: s.milo.anim, bg: s.shell.texture.key };
});

await frame(); await shot('cabinet-visible');
await page.evaluate(() => window.__game.scene.getScene('wardlab').setCabinetVisible(false));
await frame(); await shot('cabinet-hidden');
// the old way, for a pixel diff: plate background, uncropped bed body, cabinet on
await page.evaluate(() => {
  const s = window.__game.scene.getScene('wardlab');
  s.setCabinetVisible(true); for (const img of s.cabinetExtra) img.setVisible(false);
  s.shell.setTexture('wardlab_plate', '__BASE'); s.bedBody.setCrop();
});
await frame(); await shot('reference-plate');

console.log(JSON.stringify({ out: OUT, state, errors }));
await browser.close();
server.close();
if (errors.length) process.exit(1);
