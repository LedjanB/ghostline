// Bot players for Ghostline v6 (balance checks, no human playtesters).
// Each bot plays the real game logic (PlayScene.step at 120 Hz) with a skill profile:
//   reaction jitter (s), lapse (chance to miss a threat), and how it flies.
// It reads the world the way a player would: what's on screen now, and where it will be soon.
// Usage: node scripts/bot.mjs [runs=6] [profile=all] [--json]
//   CHROME_PATH=/path/to/chrome to use a system Chrome. Serves the folder on :8123 by itself.
import { chromium } from '@playwright/test';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const RUNS = Number(args[0] || 6);
const ONLY = args[1] || 'all';
const JSON_OUT = process.argv.includes('--json');

export const PROFILES = {
  casual: { jitter: 0.07, lapse: 0.07, fly: 0.6, airLag: 0.2, label: 'casual (new player)' },
  regular: { jitter: 0.045, lapse: 0.035, fly: 0.8, airLag: 0.14, label: 'regular (a few hours in)' },
  expert: { jitter: 0.02, lapse: 0.01, fly: 0.95, airLag: 0.09, label: 'expert (many hours in)' },
};

// ---------------- the brain (runs inside the page) ----------------
function brain(s, opts) {
  const FLOOR = 324, CEIL = 36, PX = 150, BOTTOM = FLOOR - 22, BEAM_END = FLOOR - 32;
  const rnd = (() => { let a = opts.seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const P = opts.profile;
  const WALK = { ghoul: 45, gurney: 110, cart: 170 };
  const ignored = new WeakSet(), noticed = new WeakSet();
  let pending = null, holdSlide = 0;
  const stats = { stumbles: {}, airHits: 0, flights: 0, pieces: {}, worldDeaths: {}, maxZone: 0 };

  // Milo's box over time for an action pressed after `d` seconds: 'none' | 'jump' | 'slide'
  function milo(action, d, tau) {
    let py = s.py, vy = s.vy, grounded = s.grounded;
    let sliding = s.slide > 0 ? s.slide : 0;
    if (holdSlide > 0) sliding = Math.max(sliding, holdSlide);
    const dt = 1 / 60;
    let t = 0;
    let pressed = false;
    while (t < tau) {
      if (!pressed && t >= d) {
        pressed = true;
        if (action === 'jump' && (grounded || py >= BOTTOM - 1)) { vy = -575 * (s.perk?.jump || 1); grounded = false; sliding = 0; }
        if (action === 'slide') { sliding = 1.1; if (!grounded) vy = Math.max(vy, 260); }
      }
      if (!grounded) { vy += (1800 + (sliding > 0 ? 2400 : 0)) * dt; py += vy * dt; if (py >= BOTTOM) { py = BOTTOM; vy = 0; grounded = true; } }
      if (sliding > 0) sliding -= dt;
      t += dt;
    }
    const sl = sliding > 0;
    return { l: PX - 8, r: PX + 8, t: sl ? (grounded ? py + 2 : py - 4) : py - 22, b: py + 22, grounded };
  }

  // where each threat will be in tau seconds (screen px); null = harmless then
  function boxAt(t, tau) {
    const v = s.speed, x = s.sx(t.wx) - v * tau - (WALK[t.kind] || 0) * tau;
    switch (t.kind) {
      case 'grave': return { l: x + 4, r: x + t.w - 4, t: FLOOR - t.h + 6, b: FLOOR };
      case 'crate': return { l: x + 3, r: x + t.w - 3, t: FLOOR - t.h + 3, b: FLOOR };
      case 'hand': return { l: x - 9, r: x + 9, t: FLOOR - 34, b: FLOOR };
      case 'beam': return { l: x - 5, r: x + 5, t: CEIL, b: BEAM_END + 4 };
      case 'ghoul': return { l: x - 8, r: x + 8, t: FLOOR - 28, b: FLOOR };
      case 'gurney': case 'cart': return { l: x + 4, r: x + t.w - 4, t: FLOOR - t.h + 4, b: FLOOR };
      case 'drawer': return { l: x, r: x + t.w, t: FLOOR - 48, b: FLOOR - 28 };
      case 'roots': return { l: x + 4, r: x + t.w - 4, t: FLOOR - 26, b: FLOOR };
      case 'sinkhole': case 'pit': return { l: x + 8, r: x + t.w - 8, t: FLOOR - 1, b: FLOOR + 1, floor: true };
      case 'vent': return ((s.clock + tau + t.ph) % 1.7) > 0.97 ? { l: x + 3, r: x + t.w - 3, t: FLOOR - 60, b: FLOOR } : null;
      case 'chandelier': return { l: x + 4, r: x + t.w - 4, t: FLOOR - 20, b: FLOOR };
      case 'eye': { const y = FLOOR - 40 + Math.sin((s.clock + tau) * 2.4 + t.ph) * 22; return { l: x + 3, r: x + t.w - 3, t: y - 9, b: y + 9 }; }
      case 'trick': return trickAt(t, tau);
    }
    return null;
  }

  function trickAt(t, tau) {
    const v = s.speed, left = t.tell - t.t; // seconds until it strikes
    const at = tau - left;                     // seconds after the strike
    const x = s.sx(t.wx) - v * tau;
    switch (t.trick) {
      case 'reach': return at > -0.02 && at < 0.42 ? { l: 0, r: PX + 40, t: FLOOR - 50, b: FLOOR - 27 } : null;
      case 'drawer': return { l: x - 70, r: x + 44, t: FLOOR - 18, b: FLOOR };
      case 'canopy': {
        if (t.phase === 'tell' && at < 0) return null;
        const sx = t.phase === 'tell' ? 640 - 120 - (v + 140) * at : s.sx(t.wx) - (v + 140) * tau;
        return { l: sx + 6, r: sx + 62, t: FLOOR - 34, b: FLOOR };
      }
      case 'burrow': return at > -0.02 && at < 0.3 ? { l: PX - 16, r: PX + 16, t: FLOOR - 44, b: FLOOR } : null;
      case 'ceiling': {
        const sx = t.dropped ? s.sx(t.wx) - v * tau : (at < 0 ? null : PX + 200 - v * at);
        return sx === null ? null : { l: sx - 22, r: sx + 22, t: FLOOR - 150, b: FLOOR - 25 };
      }
      case 'skull': {
        let sx = t.thrown ? t.sx : PX - s.gapVis * 0.72, sy = t.thrown ? t.sy : FLOOR - 70, vx = 300, vy = t.thrown ? t.svy : -120, b = t.bounces || 0;
        const start = t.thrown ? 0 : Math.max(0, left);
        if (tau < start) return null;
        for (let k = start; k < tau; k += 1 / 120) { sx += vx / 120; vy += 1400 / 120; sy += vy / 120; if (sy > FLOOR - 13) { sy = FLOOR - 13; b++; vy = -(b % 2 ? 560 : 380); } }
        return { l: sx - 11, r: sx + 11, t: sy - 11, b: sy + 11 };
      }
      case 'ride': {
        const cx = t.rolling ? t.cx + 330 * tau : (at < 0 ? null : -60 + 330 * at);
        return cx === null ? null : { l: cx + 2, r: cx + 50, t: FLOOR - 32, b: FLOOR };
      }
    }
    return null;
  }

  const M = opts.margin ?? 5; // players leave a little room
  const overlap = (m, b) => b && (b.floor ? m.grounded && PX > b.l - 2 && PX < b.r + 2 : m.r > b.l - M && m.l < b.r + M && m.b > b.t - 3 && m.t < b.b + 3);
  function firstHit(action, d) {
    const live = s.traps.filter((t) => !t.gone && !t.hit && t.kind !== 'chasm' && !ignored.has(t));
    const sw = s.swings.filter((w) => w.ground && w.hx !== undefined && !w.hitDone);
    for (let tau = 0; tau < 1.0; tau += 1 / 60) {
      const m = milo(action, d, tau);
      for (const t of live) if (overlap(m, boxAt(t, tau))) return tau;
      for (const w of sw) { // a low swing: same formula as the game, moved along
        const th = w.amp * Math.sin((s.clock + tau) * w.w + w.phase), x = w.x - s.speed * tau;
        const ex = x + Math.sin(th) * w.len, ey = CEIL - 4 + Math.cos(th) * w.len;
        const hx = ex + Math.sin(th) * w.info.off, hy = ey + Math.cos(th) * w.info.off;
        const nx = Math.max(m.l, Math.min(m.r, hx)), ny = Math.max(m.t, Math.min(m.b, hy));
        if (Math.hypot(hx - nx, hy - ny) < w.info.r + 2) return tau;
      }
    }
    return Infinity;
  }

  function ground(dt) {
    // a lapse: now and then a threat just isn't noticed in time
    for (const t of s.traps) {
      if (t.gone || noticed.has(t)) continue;
      const x = s.sx(t.wx);
      if (x < 640 + 10 || t.kind === 'trick') { noticed.add(t); if (rnd() < P.lapse && t.kind !== 'chasm') ignored.add(t); }
    }
    if (holdSlide > 0) holdSlide -= dt;
    if (pending) { pending.t -= dt; if (pending.t <= 0) { if (pending.a === 'jump') s.jumpLatch = true; else { s.slideLatch = true; holdSlide = pending.hold; } pending = null; } return; }
    const d = Math.max(0, 0.03 + gauss() * P.jitter * 0.6);
    const none = firstHit('none', 0);
    if (opts.trace) opts.trace.push({ c: +s.clock.toFixed(3), py: Math.round(s.py), g: s.grounded, none, traps: s.traps.filter((t) => !t.gone && s.sx(t.wx) < 400).map((t) => t.kind + ':' + Math.round(s.sx(t.wx))).join(' ') });
    if (none === Infinity) { if (holdSlide > 0 && firstHit('none', 0) === Infinity) holdSlide = Math.min(holdSlide, 0.02); return; }
    if (none > 0.55) return; // not yet
    const j = firstHit('jump', d), sl = firstHit('slide', d);
    // an action is good if it really clears (a jump that lands on the thing only delays the hit)
    const okJ = j === Infinity || j > 0.8, okS = sl === Infinity || sl > none + 0.35;
    let best = j >= sl ? 'jump' : 'slide';
    if (okJ && !okS) best = 'jump'; else if (okS && !okJ) best = 'slide';
    if (!okJ && !okS && none > 0.08) return; // a later press may work
    if (best === 'jump' && none > 0.32 && !(s.traps.some((t) => t.kind === 'trick' && !t.gone))) return; // players jump late, not early
    if (opts.trace) opts.trace.push({ press: best, j, sl, none, d });
    pending = { a: best, t: Math.max(0, d + gauss() * P.jitter), hold: best === 'slide' ? 1.2 : 0 };
  }

  // flying: follow the candle line, but steer to the clearest height
  let airTarget = null, airNext = 0;
  function air() {
    // a player re-reads the screen a few times a second, and reacts to what they saw a moment ago
    if (airTarget !== null && s.clock < airNext) return s.py + s.vy * 0.09 > airTarget;
    airNext = s.clock + P.airLag * 0.6;
    const v = s.speed;
    const danger = (y, tau) => {
      let c = 999;
      const px = PX;
      for (const b of s.beams) {
        const dx = -v * tau;
        const ax = b.ax + dx, bx = b.bx + dx;
        let ay = b.ay, by = b.by;
        if (b.osc) { const yy = b.baseY + Math.sin((s.clock + tau) * b.osc.w + b.osc.ph) * b.osc.amp; ay += yy - b.y; by += yy - b.y; }
        if (b.rot) { const ang = b.ang + b.rot * tau, cx = (ax + bx) / 2, cy = (ay + by) / 2, hx = Math.cos(ang) * b.len / 2, hy = Math.sin(ang) * b.len / 2; c = Math.min(c, seg(px, y, cx - hx, cy - hy, cx + hx, cy + hy) - 16); continue; }
        c = Math.min(c, seg(px, y, ax, ay, bx, by) - 16);
      }
      for (const h of s.hands) { const x = h.x - v * tau; if (Math.abs(x - px) < 24) { const tip = h.fromFloor ? FLOOR - h.reach : CEIL + h.reach; c = Math.min(c, h.fromFloor ? tip + 6 - y - 12 : y - (tip - 6) - 12); } }
      for (const b of s.banshees) { const x = b.x - (v + b.vx) * tau; c = Math.min(c, Math.hypot(px - x, y - b.y) - 28); }
      for (const w of s.warnings) if (Math.abs(w.y - y) < 34 && tau > 0.3) c = Math.min(c, Math.abs(w.y - y) - 30);
      for (const L of s.lasers) if (L.phase !== 'out') for (const ly of L.lanes) c = Math.min(c, Math.abs(y - ly) - 22);
      return c;
    };
    let best = s.py, bestScore = -1e9;
    const cand = s.candles.filter((c) => !c.dead && c.x > PX + 20 && c.x < PX + 170).sort((a, b) => a.x - b.x)[0];
    for (let y = 60; y <= 300; y += 8) {
      let c = 999;
      for (const tau of [0.1, 0.2, 0.3, 0.45, 0.6]) c = Math.min(c, danger(y, tau + P.airLag * 0.5) + 90 * tau);
      let sc = Math.min(c, 60) - Math.abs(y - s.py) * 0.12;
      if (cand && rnd() < P.fly) sc -= Math.abs(y - cand.y) * 0.05;
      if (sc > bestScore) { bestScore = sc; best = y; }
    }
    const lag = (1 - P.fly) * 30 * gauss();
    airTarget = best + lag;
    return s.py + s.vy * 0.09 > airTarget;
  }
  function seg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    let k = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; k = Math.max(0, Math.min(1, k));
    return Math.hypot(px - ax - dx * k, py - ay - dy * k);
  }

  return { ground, air, stats, held: () => holdSlide > 0 };
}

// ---------------- one run ----------------
function playRun(s, cfg) {
  const make = (0, eval)('(' + cfg.brain + ')');
  const bot = make(s, cfg);
  s.inputMap = { ...s.inputMap, held: (k) => (k === 'slide' ? bot.held() : false), pressed: () => false, update: () => {} };
  s.openingDone = true; s.openingT = 9;
  if (cfg.world !== undefined) { // start just before this world's flight section
    s.worldX = (cfg.world * 400 + 150) * 24; s.zoneIndex = cfg.world; s.nextTrapX = s.worldX + 99999; s.cleanFromX = s.worldX;
    s.nextWeaponX = Infinity; s.nextOrbX = Infinity;
  }
  s.jumpLatch = true; // start
  const dt = 1 / 120;
  const dbg = [];
  let n = 0, wasFlying = false, lastAir = 0, pieceAir = 0, piece = null;
  const flights = [];
  const stumbles = [];
  const orig = s.stumble;
  const airHits = [];
  const origHit = s.hit;
  s.hit = function (kind) { if (s.flying && s.invuln <= 0 && !s.rush) airHits.push(kind); return origHit.call(this, kind); };
  s.stumble = function (kind) { if (cfg.trace) cfg.trace.push({ STUMBLE: kind, py: s.py, slide: s.slide, g: s.grounded }); stumbles.push({ kind, m: Math.floor(s.worldX / 24), lapse: false }); return orig.call(this, kind); };
  const maxSteps = cfg.maxM ? 2e6 : 2e6;
  while (n < maxSteps && !s.ended) {
    let holding = false;
    if (!s.dead) {
      if (s.flying) holding = bot.air(); else { bot.ground(dt); holding = true; }
    }
    s.step(dt, holding);
    if (cfg.dbg && n % 60 === 0) dbg.push(`${Math.floor(s.worldX / 24)}m z${s.zoneIndex} trick:${s.trick ? s.trick.trick + '/' + s.trick.phase : '-'} chasm:${!!s.chasm} fly:${s.flying} gate:${!!s.gate} dead:${s.dead}`);
    if (s.flying && !wasFlying) { piece = s.setPiece ? s.setPiece.title : (s.flyKind || 'air'); lastAir = s.airHits || 0; }
    if (!s.flying && wasFlying) { flights.push({ piece, hits: (s.airHits || 0), kinds: airHits.splice(0) }); }
    wasFlying = s.flying;
    if (s.finish && s.finish.t > 1) break;
    if (cfg.maxM && s.worldX / 24 > cfg.maxM) break;
    if (cfg.world !== undefined && flights.length) break;
    n++;
  }
  return {
    dbg, m: Math.floor(s.worldX / 24), zone: s.zoneIndex, cause: s.lastHitKind || '', finish: s.finish ? s.finish.kind : '',
    flights, tricksSeen: [...(s.tricksSeen || [])], tricksBeat: s.tricksBeat || 0, patterns: s.patterns || 0,
    kills: s.kills || 0, score: s.totalScore(), secs: Math.round(s.clock), stumbles,
  };
}

async function main() {
  const server = http.createServer(async (req, res) => {
    try {
      const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
      const type = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.png': 'image/png' }[extname(p)] || 'application/octet-stream';
      res.writeHead(200, { 'content-type': type }); res.end(await readFile(p));
    } catch { res.writeHead(404); res.end(); }
  }).listen(8123);
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=swiftshader', '--mute-audio'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const report = {};
  const start = async (save) => {
    await page.goto('http://localhost:8123/');
    await page.evaluate((sv) => { localStorage.clear(); localStorage.setItem('ghostline-save', JSON.stringify(sv)); }, save);
    await page.reload();
    await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
    await page.evaluate(() => { const g = window.__game; g.scene.getScenes(true).forEach((sc) => sc.scene.key !== 'play' && sc.scene.stop()); g.scene.start('play'); });
    await page.waitForFunction(() => window.__game.scene.getScene('play')?.runner && window.__game.scene.isActive('play'));
    await page.evaluate(() => window.__game.loop.sleep());
  };
  if (process.argv.includes('--pieces')) { // every world's set piece, N times per profile: air hits (3 = caught)
    for (const name of (ONLY === 'all' ? Object.keys(PROFILES) : [ONLY])) {
      const line = [];
      for (let w = 0; w < 8; w++) {
        const hits = [];
        for (let i = 0; i < RUNS; i++) {
          await start({ version: 8, storySeen: true, runs: 12, story: { met: ['ivy'], beaten: ['matron'] }, tips: [] });
          const r = await page.evaluate(([run, brainSrc, cfg]) => (0, eval)('(' + run + ')')(window.__game.scene.getScene('play'), { ...cfg, brain: brainSrc }),
            [playRun.toString(), brain.toString(), { profile: PROFILES[name], seed: 77 + i * 131 + w, world: w }]);
          hits.push(r.flights[0] ? r.flights[0].hits + (r.flights[0].kinds.length ? '(' + r.flights[0].kinds.join('/') + ')' : '') : (r.cause || '?') + '@' + r.m);
        }
        line.push(`w${w + 1} ${hits.join(',')}`);
      }
      console.log(name.padEnd(8), line.join(' | '));
    }
    if (errors.length) console.log('PAGE ERRORS:', [...new Set(errors)].slice(0, 5));
    await browser.close(); server.close(); return;
  }
  const profiles = ONLY === 'all' ? Object.keys(PROFILES) : [ONLY];
  for (const name of profiles) {
    report[name] = [];
    for (let i = 0; i < RUNS; i++) {
      // a player some hours in: every system on, no safety net, a random amount of the unlock track
      const save = { version: 8, storySeen: true, runs: 12, story: { met: ['ivy'], beaten: ['matron'] }, candles: 0, best: 0, owned: ['survivor'], selected: 'survivor', tips: [], unlocks: { got: name === 'expert' ? 40 : 12, points: 0, fresh: 0 } };
      await page.goto('http://localhost:8123/');
      await page.evaluate((sv) => { localStorage.clear(); localStorage.setItem('ghostline-save', JSON.stringify(sv)); }, save);
      await page.reload();
      await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
      await page.evaluate(() => { const g = window.__game; g.scene.getScenes(true).forEach((sc) => sc.scene.key !== 'play' && sc.scene.stop()); g.scene.start('play'); });
      await page.waitForFunction(() => window.__game.scene.getScene('play')?.runner && window.__game.scene.isActive('play'));
      await page.evaluate(() => window.__game.loop.sleep());
      const r = await page.evaluate(([run, brainSrc, cfg]) => (0, eval)('(' + run + ')')(window.__game.scene.getScene('play'), { ...cfg, brain: brainSrc }),
        [playRun.toString(), brain.toString(), { profile: PROFILES[name], seed: 1000 + i * 7919 + name.length }]);
      report[name].push(r);
      if (!JSON_OUT) console.log(name.padEnd(8), `${String(r.m).padStart(5)}m  world ${r.zone + 1}  ${r.secs}s  ${(r.cause || r.finish || '?').padEnd(16)} tricks ${r.tricksBeat}/${r.tricksSeen.length} patterns ${r.patterns} kills ${r.kills} flights ${r.flights.map((f) => f.hits).join(',')}  stumbles ${r.stumbles.map((x) => x.kind + '@' + x.m).join(' ')}`);
    }
  }
  if (errors.length) console.log('PAGE ERRORS:', [...new Set(errors)].slice(0, 5));
  if (JSON_OUT) console.log(JSON.stringify({ report, errors }, null, 1));
  else for (const [name, rs] of Object.entries(report)) {
    const ms = rs.map((r) => r.m).sort((a, b) => a - b);
    const causes = {};
    rs.forEach((r) => { const c = r.cause || r.finish; causes[c] = (causes[c] || 0) + 1; });
    console.log(`${name}: median ${ms[Math.floor(ms.length / 2)]}m, best ${ms[ms.length - 1]}m, deaths ${JSON.stringify(causes)}`);
  }
  await browser.close(); server.close();
}
main();
