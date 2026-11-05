// Captures store screenshots into docs/store/screenshots/. Needs the game served on :8000 (npm start).
// Run: node scripts/screenshots.mjs
import { chromium } from '@playwright/test';
import { promises as fs } from 'node:fs';

const OUT = 'docs/store/screenshots';
await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--use-gl=swiftshader'] } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:8000/');
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ghostline-save', JSON.stringify({ version: 5, storySeen: true, candles: 900, best: 1200, stats: { maxZone: 6 } })); });
await page.reload();
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/01-menu.png` });
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
const shots = [[0, 120, '02-ward'], [2, 900, '03-woods'], [3, 1300, '04-graveyard'], [5, 2100, '05-catacombs'], [6, 2500, '06-carnival'], [7, 2950, '07-otherside']];
for (const [zone, m, name] of shots) {
  await page.evaluate((m) => {
    const s = window.__game.scene.getScene('play');
    s.invuln = 1e9; s.light = 1; s.worldX = m * 24;
  }, m - 30);
  // let the gate pass and the zone settle, holding now and then so the hero flies
  for (let i = 0; i < 8; i++) { await page.evaluate(() => { window.__game.scene.getScene('play').invuln = 1e9; }); await page.keyboard.down('Space'); await page.waitForTimeout(260); await page.keyboard.up('Space'); await page.waitForTimeout(260); }
  await page.screenshot({ path: `${OUT}/${name}.png` });
}
// itch.io cover image is 630x500
await page.setViewportSize({ width: 630, height: 500 });
await page.goto('http://localhost:8000/');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'docs/store/cover-630x500.png' });
await browser.close();
console.log('screenshots saved to', OUT);
