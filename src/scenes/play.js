// The run: flying, spawning, collisions, zones, death.
// physics-tuning: the simulation runs on a fixed 120 Hz step (step()); drawing happens once
// per frame (render()), offset by the leftover time so motion stays smooth at any refresh rate.
import {
  W, H, CEIL, FLOOR, PLAYER_X, PX_PER_METER, ZONE_LENGTH_M, CHARACTERS, ZONES,
} from '../data.js';
import { Save } from '../save.js';
import { Audio } from '../audio.js';
import { text } from '../ui.js';
import { createInput, prompt, Device } from '../input.js';
import {
  UNLOCK, difficulty, spawnTable, gapAfter, bansheeDelay, createIntroTracker, speedAt,
} from '../pacing.js';
import { Features, dailySeed } from '../run-features.js';

const STEP = 1 / 120;
const MAX_STEPS = 12;
const GRAVITY = 1500;
const PULL = 3100;
const TOP = CEIL + 16;
const BOTTOM = FLOOR - 16;
const PLAYER_R = 10;
const CLOSE_MARGIN = 14; // px of clearance that counts as a near miss

const SWING_INFO = {
  lamp: { off: 9, r: 14, glow: 0xfff2b0 },
  axe: { off: 17, r: 14, glow: null },
  hook: { off: 18, r: 10, glow: null },
};

// One seeded random source per run (procedural-gen skill).
function makeRng(seed) {
  let s = seed >>> 0;
  const next = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  return {
    seed,
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => Math.floor(a + (b - a + 1) * next()),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    weighted(table) {
      const total = table.reduce((t, e) => t + e[1], 0);
      let roll = next() * total;
      for (const [v, w] of table) { roll -= w; if (roll <= 0) return v; }
      return table[table.length - 1][0];
    },
  };
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
// distance from a circle centre to a rectangle (0 when inside)
function distToRect(cx, cy, x1, y1, x2, y2) {
  const nx = Math.max(x1, Math.min(cx, x2));
  const ny = Math.max(y1, Math.min(cy, y2));
  return Math.hypot(cx - nx, cy - ny);
}
const easeOutBack = (t) => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
const easeIn = (t) => t * t;

// Simple object pool (performance-optimization skill: don't create/destroy in hot loops).
class Pool {
  constructor(make) { this.make = make; this.free = []; this.created = 0; }
  get() { const o = this.free.pop(); if (o) return o; this.created++; return this.make(); }
  put(o) { this.free.push(o); }
}

export class PlayScene extends Phaser.Scene {
  constructor() { super('play'); }

  init() {
    const save = Save.get();
    this.char = CHARACTERS.find((c) => c.id === save.selected) || CHARACTERS[0];
    this.settings = save.settings;
    this.rand = makeRng(save.mode === 'daily' ? dailySeed() : Date.now());
    this.intro = createIntroTracker();
    this.acc = 0;
    this.worldX = 0;
    this.scroll = 0;
    this.speed = 230;
    this.light = 1;
    this.runCandles = 0;
    this.combo = 0;
    this.lastCandleAt = -9;
    this.zoneIndex = 0;
    this.dead = false;
    this.ended = false;
    this.hitStop = 0;
    this.shield = this.char.shield;
    this.invuln = 0;
    this.py = BOTTOM;
    this.prevPy = BOTTOM;
    this.vy = 0;
    this.grounded = true;
    this.spin = 0;
    this.wasHolding = false;
    this.lastFloatSfx = 0;
    this.started = false;
    this.clock = 0;
    this.nextSpawn = 520;
    this.nextBanshee = 4;
    this.transitioning = false;
    this.flickerUntil = 0;
    this.nextFlicker = 5;
    this.nextDrip = 0;
    this.bestPx = save.best * PX_PER_METER;
    this.bestMarker = null;
    this.passedBest = false;
    this.ghostX = PLAYER_X - 18;
    this.ghostY = BOTTOM - 40;
    this.lastMeters = -1;
    this.lastLight = -1;
    this.lastBlink = null;
    this.nearMisses = 0;

    this.beams = [];
    this.hands = [];
    this.swings = [];
    this.banshees = [];
    this.warnings = [];
    this.candles = [];
    this.drips = [];

    // creative mode: infinite rebirths, the run continues from the saved checkpoint
    this.creative = save.mode === 'creative';
    this.rebirths = 0;
    this.savedCandles = 0;
    this.nextAutosave = 10;
    this.skipCheckpoint = false;
    if (this.creative) {
      this.worldX = save.creative.x;
      this.rebirths = save.creative.rebirths;
      this.zoneIndex = Math.floor(this.worldX / PX_PER_METER / ZONE_LENGTH_M);
      this.nextSpawn = this.worldX + 520;
      this.bestPx = 0; // records only count in normal mode
      if (this.worldX > 0) this.nextBanshee = 8;
    }
    this.featInit(save);
  }

  create() {
    const zone = ZONES[this.zoneIndex % ZONES.length];
    this.far = this.add.tileSprite(0, 0, 320, 180, `${zone.id}_far`).setOrigin(0).setScale(2).setDepth(0);
    this.mid = this.add.tileSprite(0, 0, 320, 180, `${zone.id}_mid`).setOrigin(0).setScale(2).setDepth(1);
    this.edge = this.add.tileSprite(0, 0, 320, 180, `${zone.id}_edge`).setOrigin(0).setScale(2).setDepth(15);

    this.chainGfx = this.add.graphics().setDepth(6);
    this.beamGfx = this.add.graphics().setDepth(7);
    this.tendril = this.add.graphics().setDepth(8.5);

    this.player = this.add.sprite(PLAYER_X, this.py, `${this.char.id}_run0`).setScale(2).setDepth(9);
    this.player.play(`${this.char.id}_run`);
    this.ghost = this.add.sprite(this.ghostX, this.ghostY, 'ghost0').setScale(2).setDepth(10).setAlpha(0.92);
    this.ghost.play('ghost_float');
    this.ghostGlow = this.add.image(this.ghostX, this.ghostY, 'glow').setScale(2.2).setDepth(21)
      .setBlendMode(Phaser.BlendModes.ADD).setTint(0x7fa8ff).setAlpha(0.35);
    this.shieldGlow = this.add.image(PLAYER_X, this.py, 'glow').setScale(1.3).setDepth(21)
      .setBlendMode(Phaser.BlendModes.ADD).setTint(0x4fa8ff).setAlpha(0.5).setVisible(this.shield);

    this.dark = this.add.image(PLAYER_X + 110, this.py, 'dark').setScale(2).setDepth(20);
    this.fader = this.add.rectangle(0, 0, W, H, 0x000000).setOrigin(0).setDepth(26).setAlpha(0);

    // pools for the objects spawned most often
    this.particlePool = new Pool(() => this.add.rectangle(0, 0, 3, 3, 0xffffff).setDepth(22));
    this.candlePool = new Pool(() => ({
      s: this.add.sprite(0, 0, 'candle0').setScale(2).setDepth(21.5),
      glow: this.add.image(0, 0, 'glow').setScale(0.9).setDepth(21)
        .setBlendMode(Phaser.BlendModes.ADD).setTint(0xffa040).setAlpha(0.55),
    }));

    this.inputMap = createInput(this);

    this.tutorial = text(this, W / 2, H / 2 - 30, prompt('float'), 16, '#e6f0ff').setDepth(31).setStroke('#07060d', 4);
    this.tutorial2 = text(this, W / 2, H / 2 - 4, 'TO FLOAT', 16, '#a99fd0').setDepth(31).setStroke('#07060d', 4);
    this.tweens.add({ targets: [this.tutorial, this.tutorial2], alpha: 0.35, duration: 500, yoyo: true, repeat: -1 });
    this.offDevice = Device.onChange(() => { if (!this.started && this.tutorial.active) this.tutorial.setText(prompt('float')); });

    this.banner(zone.name);
    Audio.music(zone.song);
    Audio.duck(false);
    Audio.danger(false);
    Audio.intensity(0.2);

    this.featCreate();
    this.scene.launch('hud');

    this.onHidden = () => this.requestPause();
    this.game.events.on('hidden', this.onHidden);
    this.events.once('shutdown', () => {
      this.game.events.off('hidden', this.onHidden);
      this.offDevice();
      Audio.danger(false);
      if (!this.skipCheckpoint) this.saveCheckpoint();
    });
    this.render(0);
  }

  requestPause() {
    if (this.dead || !this.scene.isActive()) return;
    this.saveCheckpoint();
    this.scene.pause();
    this.scene.launch('pause');
  }

  shake(ms, amount) { if (this.settings.shake) this.cameras.main.shake(ms, amount); }
  flash(ms, r, g, b) { if (this.settings.flicker) this.cameras.main.flash(ms, r, g, b); }

  // ---------------- frame ----------------
  update(time, deltaMs) {
    this.inputMap.update();
    if (!this.dead && this.inputMap.pressed('pause')) { this.requestPause(); return; }
    const real = Math.min(deltaMs / 1000, 0.1);
    if (this.hitStop > 0) { this.hitStop -= real; this.render(0); return; }
    const holding = !this.dead && this.inputMap.held('float');
    this.acc += real;
    let n = 0;
    while (this.acc >= STEP && n < MAX_STEPS) {
      this.step(STEP, holding);
      this.acc -= STEP;
      n++;
      if (this.hitStop > 0) { this.acc = 0; break; }
    }
    if (n === MAX_STEPS) this.acc = 0; // a long hitch: drop time instead of fast-forwarding
    this.render(this.acc);
  }

  // ---------------- simulation (fixed step) ----------------
  step(dt, holding) {
    this.clock += dt;
    holding = holding && this.openingDone;
    this.prevPy = this.py;

    if (holding && !this.started) {
      this.started = true;
      this.tweens.killTweensOf([this.tutorial, this.tutorial2]);
      this.tweens.add({ targets: [this.tutorial, this.tutorial2], alpha: 0, y: '-=20', duration: 400, onComplete: () => { this.tutorial.destroy(); this.tutorial2.destroy(); } });
    }

    const meters = this.worldX / PX_PER_METER;
    const pace = difficulty(meters);
    if (!this.dead) this.speed = speedAt(meters) * this.speedMul * Math.min(1, 0.3 + this.openingT * 0.9);
    const move = this.speed * dt;
    this.worldX += move;
    this.scroll += move;

    if (this.dead) this.stepDeath(dt);
    else this.stepPlayer(dt, holding);
    this.stepGhost(dt, holding);
    this.stepZones(meters);
    if (!this.dead) {
      this.spawner(meters, pace);
      this.bansheeTimer(dt, meters, pace.diff);
    }
    this.stepWorld(dt, move);
    this.featStep(dt, meters, pace, holding);
    if (!this.dead && this.openingDone) this.collide();
    this.stepLight(dt);
    this.stepZoneFx(dt);
    if (this.combo > 0 && this.clock - this.lastCandleAt > 0.6) { this.combo = 0; this.events.emit('combo', 0); }
    if (this.creative) {
      this.nextAutosave -= dt;
      if (this.nextAutosave <= 0) { this.nextAutosave = 10; this.saveCheckpoint(); }
    }
    this.emitHud(meters);
    Audio.intensity(this.dead ? 0 : 0.2 + pace.diff * 0.9);
    Audio.danger(!this.dead && this.warnings.length > 0);
  }

  stepPlayer(dt, holding) {
    if (holding && !this.wasHolding && this.clock - this.lastFloatSfx > 0.25) {
      Audio.sfx('float');
      this.lastFloatSfx = this.clock;
    }
    this.wasHolding = holding;
    this.vy += (GRAVITY - (holding ? PULL : 0)) * dt;
    this.vy = Phaser.Math.Clamp(this.vy, -480, 620);
    this.py += this.vy * dt;
    if (this.py < TOP) { this.py = TOP; if (this.vy < 0) this.vy = 0; }
    if (this.py >= BOTTOM) {
      if (!this.grounded && this.vy > 250) this.land();
      this.py = BOTTOM;
      this.vy = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }
    if (this.invuln > 0) this.invuln -= dt;
  }

  land() {
    this.tweens.add({ targets: this.player, scaleY: 1.6, scaleX: 2.4, duration: 60, yoyo: true, ease: 'Quad.easeOut' });
    this.burst(PLAYER_X, FLOOR - 2, 0x8a8a9a, 6, 30, 300);
  }

  stepGhost(dt, holding) {
    if (this.dead || !this.openingDone) return;
    let tx, ty;
    if (holding) { tx = PLAYER_X - 4; ty = this.py - 46 + Math.sin(this.clock * 9) * 2; }
    else { tx = PLAYER_X - 20; ty = this.py - 40 + Math.sin(this.clock * 3) * 4; }
    const k = 1 - Math.exp(-14 * dt);
    this.ghostX += (tx - this.ghostX) * k;
    this.ghostY += (ty - this.ghostY) * k;
    this.holding = holding;
  }

  // ---------------- spawning ----------------
  spawner(meters, pace) {
    if (this.worldX < this.nextSpawn) return;
    const toBoundary = ZONE_LENGTH_M - (meters % ZONE_LENGTH_M);
    const sinceBoundary = meters % ZONE_LENGTH_M;
    if (toBoundary < 28 || (meters > 100 && sinceBoundary < 10)) {
      this.nextSpawn = this.worldX + 120;
      return;
    }
    const r = this.rand;
    const kind = r.weighted(spawnTable(meters, pace.diff, pace.breather));
    const x0 = W + 60;
    const d = pace.diff;
    let length = 0;
    switch (kind) {
      case 'candles': length = this.spawnCandles(x0, pace.breather); break;
      case 'beam': length = this.intro.first('beam') ? this.introBeam(x0) : this.spawnBeam(x0, d); break;
      case 'beamPair': {
        const first = this.intro.first('beamPair');
        this.spawnBeam(x0, d, 0);
        const gap = first ? 260 : r.range(170, 230);
        this.spawnBeam(x0 + gap, d, Math.PI / 2);
        if (first) for (let i = 0; i < 6; i++) this.addCandle(x0 + gap / 2 - 50 + i * 20, H / 2);
        length = gap + 60;
        break;
      }
      case 'rotor': length = this.spawnBeam(x0, d, null, true, null, this.intro.first('rotor') ? 0.7 : null); break;
      case 'beamCandles': {
        const y = r.chance(0.5) ? CEIL + 70 : FLOOR - 70;
        this.spawnBeam(x0 + 90, d, 0, false, y);
        const cy = y < H / 2 ? y + 60 : y - 60;
        for (let i = 0; i < 9; i++) this.addCandle(x0 + i * 22, cy);
        length = 9 * 22;
        break;
      }
      case 'hands': length = this.spawnHands(x0, d, this.intro.first('hands')); break;
      case 'laser': length = this.spawnLaser(d); break;
      case 'movingBeam': {
        const first = this.intro.first('movingBeam');
        const amp = first ? 40 : r.range(45, 75);
        const len = r.range(70, 110);
        const vertical = r.chance(0.3);
        const hh = vertical ? len / 2 : 0;
        const y = r.range(TOP + 10 + hh + amp, BOTTOM - 10 - hh - amp);
        length = this.spawnBeam(x0, d, vertical ? Math.PI / 2 : 0, false, y, null, len);
        const b = this.beams[this.beams.length - 1];
        b.baseY = y;
        b.osc = { amp, w: first ? 1.4 : r.range(1.6, 2.4), ph: r.range(0, 6.28) };
        break;
      }
      case 'swing': length = this.spawnSwing(x0, this.intro.first('swing')); break;
    }
    this.nextSpawn = this.worldX + length + gapAfter(d, r);
  }

  spawnCandles(x0, breather) {
    const r = this.rand;
    const shape = r.pick(breather ? ['wave', 'arc', 'word', 'skull', 'heart', 'wave'] : ['line', 'wave', 'arc', 'grid', 'arrow', 'word']);
    if (['word', 'arrow', 'skull', 'heart'].includes(shape)) return this.spawnGlyphCandles(x0, shape);
    if (shape === 'line') {
      const n = r.int(8, 12), y = r.range(TOP + 10, BOTTOM - 10);
      for (let i = 0; i < n; i++) this.addCandle(x0 + i * 22, y);
      return n * 22;
    }
    if (shape === 'wave') {
      const n = breather ? 20 : 14, cy = r.range(TOP + 60, BOTTOM - 60);
      for (let i = 0; i < n; i++) this.addCandle(x0 + i * 22, cy + Math.sin(i * 0.55) * 50);
      return n * 22;
    }
    if (shape === 'arc') {
      const n = 11, base = r.range(BOTTOM - 40, BOTTOM - 10);
      for (let i = 0; i < n; i++) {
        const t = (i / (n - 1)) * 2 - 1;
        this.addCandle(x0 + i * 22, base - (1 - t * t) * 120);
      }
      return n * 22;
    }
    const cols = 6, rows = 3, y0 = r.range(TOP + 10, BOTTOM - 60);
    for (let c = 0; c < cols; c++) for (let rr = 0; rr < rows; rr++) this.addCandle(x0 + c * 22, y0 + rr * 24);
    return cols * 22;
  }

  addCandle(x, y) {
    y = Phaser.Math.Clamp(y, TOP, BOTTOM);
    const c = this.candlePool.get();
    c.s.setVisible(true).setScale(2).setAlpha(1);
    c.s.play({ key: 'candle_flicker', startFrame: Math.floor(Math.random() * 2) });
    c.glow.setVisible(true);
    c.x = x; c.y = y; c.dead = false;
    this.candles.push(c);
  }

  releaseCandle(c) {
    c.dead = true;
    c.s.setVisible(false); c.s.anims.stop();
    c.glow.setVisible(false);
    this.candlePool.put(c);
  }

  // Teach: first beam is short, horizontal, up high, with candles marking the safe line under it.
  introBeam(x0) {
    const y = TOP + 60;
    this.spawnBeam(x0 + 100, 0, 0, false, y, null, 80);
    for (let i = 0; i < 10; i++) this.addCandle(x0 + i * 22, BOTTOM - 30);
    return 240;
  }

  spawnBeam(x0, diff, forcedAng = null, rotor = false, forcedY = null, rotSpeed = null, forcedLen = null) {
    const r = this.rand;
    const len = forcedLen ?? (rotor ? 120 : r.range(80, 120 + 50 * diff));
    const ang = forcedAng ?? r.pick([0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4]);
    // validate: both ends stay inside the play area so a path always exists
    const hh = rotor ? len / 2 : (Math.abs(Math.sin(ang)) * len) / 2;
    const y = forcedY ?? r.range(TOP + 4 + hh, BOTTOM - 4 - hh);
    const nodes = [0, 1].map(() => this.add.image(0, 0, 'spirit').setScale(2).setDepth(7.5));
    const glows = [0, 1].map(() => this.add.image(0, 0, 'glow').setScale(1.1).setDepth(21)
      .setBlendMode(Phaser.BlendModes.ADD).setTint(0x4fe38a).setAlpha(0.45));
    const rot = rotor ? (r.chance(0.5) ? 1 : -1) * (rotSpeed ?? r.range(1.1, 1.6)) : 0;
    this.beams.push({ x: x0 + (Math.abs(Math.cos(ang)) * len) / 2, y, len, ang, nodes, glows, rot });
    return Math.abs(Math.cos(ang)) * len + 40;
  }

  spawnHands(x0, diff, first) {
    const r = this.rand;
    const n = first ? 1 : r.int(1, diff > 0.4 ? 3 : 2);
    let x = x0;
    for (let i = 0; i < n; i++) {
      const fromFloor = first ? true : r.chance(0.5);
      const reach = first ? 110 : r.range(115, 140 + 30 * diff);
      const s = this.add.image(x, 0, 'hand').setScale(2).setDepth(5);
      if (fromFloor) s.setOrigin(0.5, 0); else s.setOrigin(0.5, 1).setFlipY(true);
      const hidden = fromFloor ? FLOOR + 6 : CEIL - 6;
      this.hands.push({
        x, s, fromFloor, reach, state: 'wait', t: 0, y: hidden, hidden, from: hidden,
        trigger: first ? 320 : 230, riseTime: first ? 0.36 : 0.22,
      });
      if (first) for (let k = 0; k < 7; k++) this.addCandle(x - 66 + k * 22, FLOOR - reach - 50);
      x += r.range(150, 190);
    }
    return x - x0;
  }

  spawnSwing(x0, first) {
    const r = this.rand;
    const type = ZONES[this.zoneIndex % ZONES.length].swing;
    const len = first ? 110 : r.range(110, 165);
    const s = this.add.image(x0, CEIL, type).setScale(2).setOrigin(0.5, 0).setDepth(6);
    const info = SWING_INFO[type];
    const glow = info.glow ? this.add.image(x0, CEIL, 'glow').setScale(1.4).setDepth(21)
      .setBlendMode(Phaser.BlendModes.ADD).setTint(info.glow).setAlpha(0.4) : null;
    this.swings.push({
      x: x0, len, type, s, glow, info, th: 0,
      amp: first ? 0.6 : r.range(0.7, 1.0), w: first ? 1.6 : r.range(2.0, 2.8),
      phase: r.range(0, Math.PI * 2), lastSign: 0,
    });
    if (first) for (let k = 0; k < 8; k++) this.addCandle(x0 - 70 + k * 22, BOTTOM - 20);
    return 60;
  }

  bansheeTimer(dt, meters, diff) {
    if (this.transitioning || meters < UNLOCK.banshee) return;
    this.nextBanshee -= dt;
    if (this.nextBanshee > 0) return;
    const first = this.intro.first('banshee');
    this.nextBanshee = bansheeDelay(diff, this.rand);
    // Jetpack Joyride missile swarms: 5 at fixed heights in quick succession
    if (!first && meters > UNLOCK.swarm && this.rand.chance(0.25)) {
      const ys = [TOP + 20, TOP + 80, H / 2, BOTTOM - 80, BOTTOM - 20];
      Phaser.Utils.Array.Shuffle(ys).forEach((y, i) => this.addWarning(0, 1.0 + i * 0.3, y));
      this.nextBanshee += 3;
      return;
    }
    this.addWarning(0, first ? 1.9 : 1.1);
    if (!first && diff > 0.35 && this.rand.chance(0.35)) this.addWarning(this.rand.chance(0.5) ? 90 : -90, 1.1);
  }

  addWarning(offset, trackTime, fixedY = null) {
    const g = this.add.graphics().setDepth(29);
    const t = text(this, W - 26, 0, '!', 16, '#ffffff').setDepth(30);
    const y = fixedY ?? Phaser.Math.Clamp(this.py + offset, TOP, BOTTOM);
    this.warnings.push({ y, offset, t: 0, phase: 'track', trackTime, g, txt: t, fixed: fixedY !== null });
    Audio.sfx('warn');
  }

  spawnBanshee(y) {
    const s = this.add.image(W + 50, y, 'banshee').setScale(2).setDepth(12);
    const eyes = this.add.image(W + 50, y, 'glow').setScale(0.7).setDepth(21)
      .setBlendMode(Phaser.BlendModes.ADD).setTint(0xff2244).setAlpha(0.8);
    const diffNow = difficulty(this.worldX / PX_PER_METER).diff;
    this.banshees.push({ x: W + 50, y, s, eyes, vx: 650 + 350 * diffNow });
    Audio.sfx('scream');
  }

  // ---------------- world movement (fixed step) ----------------
  stepWorld(dt, move) {
    for (const c of this.candles) {
      if (c.dead) continue;
      c.x -= move;
      if (c.x < -40) this.releaseCandle(c);
    }
    this.candles = this.candles.filter((c) => !c.dead);

    for (const b of this.beams) {
      b.x -= move;
      b.ang += b.rot * dt;
      if (b.osc) b.y = b.baseY + Math.sin(this.clock * b.osc.w + b.osc.ph) * b.osc.amp;
      const dx = (Math.cos(b.ang) * b.len) / 2, dy = (Math.sin(b.ang) * b.len) / 2;
      b.ax = b.x - dx; b.ay = b.y - dy; b.bx = b.x + dx; b.by = b.y + dy;
      if (b.x < -b.len) { b.dead = true; b.nodes.forEach((n) => n.destroy()); b.glows.forEach((n) => n.destroy()); }
    }
    this.beams = this.beams.filter((b) => !b.dead);

    for (const h of this.hands) {
      h.x -= move;
      const near = h.x - PLAYER_X;
      if (h.state === 'wait') {
        if (h.x < W - 10) {
          // telegraph: fingertips peek out and twitch
          const peek = 10 + Math.sin(this.clock * 20) * 2;
          h.y = h.fromFloor ? FLOOR - peek : CEIL + peek;
        }
        if (near < h.trigger) {
          h.state = 'rise'; h.t = 0; h.from = h.y;
          Audio.sfx('hand');
          this.shake(60, 0.003);
          this.burst(h.x, h.fromFloor ? FLOOR : CEIL, 0x6a6a72, 8, 40, 350);
        }
      } else if (h.state === 'rise') {
        h.t = Math.min(1, h.t + dt / h.riseTime);
        const target = h.fromFloor ? FLOOR - h.reach : CEIL + h.reach;
        h.y = h.from + (target - h.from) * easeOutBack(h.t);
        if (near < -90) { h.state = 'drop'; h.t = 0; h.from = h.y; }
      } else if (h.state === 'drop') {
        h.t = Math.min(1, h.t + dt / 0.5);
        h.y = h.from + (h.hidden - h.from) * easeIn(h.t);
      }
      if (h.x < -40) { h.dead = true; h.s.destroy(); }
    }
    this.hands = this.hands.filter((h) => !h.dead);

    for (const s of this.swings) {
      s.x -= move;
      s.th = s.amp * Math.sin(this.clock * s.w + s.phase);
      s.ex = s.x + Math.sin(s.th) * s.len;
      s.ey = CEIL - 4 + Math.cos(s.th) * s.len;
      s.hx = s.ex + Math.sin(s.th) * s.info.off;
      s.hy = s.ey + Math.cos(s.th) * s.info.off;
      const sign = Math.sign(s.th);
      if (sign !== s.lastSign && s.x < W && s.x > 0) Audio.sfx('swoosh');
      s.lastSign = sign;
      if (s.x < -s.len - 30) { s.dead = true; s.s.destroy(); if (s.glow) s.glow.destroy(); }
    }
    this.swings = this.swings.filter((s) => !s.dead);

    for (const w of this.warnings) {
      w.t += dt;
      if (w.phase === 'track' && w.fixed) {
        if (w.t > w.trackTime) { w.phase = 'lock'; w.t = 0; }
      } else if (w.phase === 'track') {
        const target = Phaser.Math.Clamp(this.py + w.offset, TOP, BOTTOM);
        w.y += (target - w.y) * (1 - Math.exp(-5 * dt));
        if (w.t > w.trackTime) { w.phase = 'lock'; w.t = 0; Audio.sfx('warn'); Audio.hush(0.5); }
      } else if (w.phase === 'lock' && w.t > 0.45) {
        w.dead = true;
        this.spawnBanshee(w.y);
      }
      if (w.dead || this.dead) { w.dead = true; w.g.destroy(); w.txt.destroy(); }
    }
    this.warnings = this.warnings.filter((w) => !w.dead);

    for (const b of this.banshees) {
      b.x -= this.dead ? move : move + b.vx * dt;
      if (!b.passed && b.x < PLAYER_X - 40 && !this.dead) { b.passed = true; this.tracker?.add('banshees', 1); }
      if (b.x < -80) { b.dead = true; b.s.destroy(); b.eyes.destroy(); }
    }
    this.banshees = this.banshees.filter((b) => !b.dead);
  }

  // ---------------- collisions + near misses ----------------
  collide() {
    const px = PLAYER_X, py = this.py;
    for (const c of this.candles) {
      if (!c.dead && Math.hypot(c.x - px, c.y - py) < 22) this.collect(c);
    }
    if (this.invuln > 0) return;
    if (this.laserHits(py)) { this.hit(); return; }
    // each check returns clearance in px (<= 0 means a hit)
    const test = (obj, clearance) => {
      if (clearance <= 0) { this.hit(); return true; }
      if (clearance < CLOSE_MARGIN && !obj.close) { obj.close = true; this.nearMiss(); }
      return false;
    };
    for (const b of this.beams) {
      const c = Math.min(
        distToSegment(px, py, b.ax, b.ay, b.bx, b.by) - (PLAYER_R + 5),
        Math.hypot(px - b.ax, py - b.ay) - (PLAYER_R + 11),
        Math.hypot(px - b.bx, py - b.by) - (PLAYER_R + 11),
      );
      if (test(b, c)) return;
    }
    for (const h of this.hands) {
      if (h.state === 'wait') continue;
      const c = h.fromFloor
        ? distToRect(px, py, h.x - 12, h.y + 6, h.x + 12, FLOOR) - PLAYER_R
        : distToRect(px, py, h.x - 12, CEIL, h.x + 12, h.y - 6) - PLAYER_R;
      if (test(h, c)) return;
    }
    for (const s of this.swings) {
      if (s.hx !== undefined && test(s, Math.hypot(px - s.hx, py - s.hy) - (PLAYER_R + s.info.r))) return;
    }
    for (const b of this.banshees) {
      if (test(b, Math.hypot(px - (b.x - 6), py - b.y) - (PLAYER_R + 16))) return;
    }
  }

  nearMiss() {
    // small-tier feedback: popup + sound + a sliver of light
    this.nearMisses++;
    this.tracker?.add('near', 1);
    this.light = Math.min(1, this.light + 0.03);
    Audio.sfx('close');
    const t = text(this, PLAYER_X + 30, this.py - 34, 'CLOSE!', 16, '#9ff0ff').setDepth(31).setStroke('#07060d', 4);
    this.tweens.add({ targets: t, y: '-=26', alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  collect(c) {
    this.combo = this.clock - this.lastCandleAt < 0.45 ? this.combo + 1 : 1;
    this.lastCandleAt = this.clock;
    this.runCandles += this.char.candleMul;
    this.lastCandleX = this.worldX;
    this.tracker?.add('candles', this.char.candleMul);
    this.light = Math.min(1, this.light + 0.07);
    Audio.sfx('candle', { combo: this.combo });
    this.events.emit('candles', this.runCandles);
    this.events.emit('combo', this.combo);
    c.dead = true;
    c.glow.setVisible(false);
    this.tweens.add({
      targets: c.s, x: 176, y: 18, scaleX: 1, scaleY: 1, duration: 320, ease: 'Cubic.easeIn',
      onComplete: () => { c.s.setVisible(false); c.s.anims.stop(); this.candlePool.put(c); },
    });
  }

  // save-systems: a separate creative checkpoint, written on safe moments
  // (every 10 s, on rebirth, pause, zone change, leaving the run, app going to background)
  saveCheckpoint() {
    if (!this.creative || this.dead) return;
    const gain = this.runCandles - this.savedCandles;
    this.savedCandles = this.runCandles;
    const x = Math.floor(this.worldX);
    const rebirths = this.rebirths;
    Save.update((s) => { s.creative.x = x; s.creative.rebirths = rebirths; s.candles += gain; });
  }

  // creative mode: instead of dying, the ghost pulls you back and clears the way
  rebirth() {
    this.rebirths++;
    this.invuln = 2;
    this.light = Math.max(this.light, 0.5);
    Audio.sfx('rebirth');
    this.shake(160, 0.006);
    this.flash(160, 160, 200, 255);
    this.burst(PLAYER_X, this.py, 0xcfe0ff, 18, 70, 600);
    this.clearAround(280);
    this.events.emit('rebirths', this.rebirths);
    const t = text(this, PLAYER_X + 40, this.py - 40, 'REBORN!', 16, '#cfe0ff').setDepth(31).setStroke('#07060d', 4);
    this.tweens.add({ targets: t, y: '-=36', alpha: 0, duration: 1000, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
    this.saveCheckpoint();
  }

  hit() {
    if (this.creative && !this.shield) { this.rebirth(); return; }
    if (this.shield) {
      this.shield = false;
      this.invuln = 1.4;
      this.events.emit('shield', false);
      Audio.sfx('shield');
      this.shake(160, 0.006);
      this.flash(120, 80, 160, 255);
      this.burst(PLAYER_X, this.py, 0x4fa8ff, 14, 60, 450);
      return;
    }
    this.die();
  }

  die() {
    this.dead = true;
    this.deathSpeed = this.speed;
    this.deathM = Math.floor(this.worldX / PX_PER_METER);
    this.tracker?.death(this.deathM);
    if (this.power) { this.power = null; this.events.emit('power', null); }
    this.hitStop = 0.09;
    this.shake(280, 0.012);
    this.flash(140, 255, 60, 90);
    Audio.sfx('hit');
    Audio.duck(true);
    this.burst(PLAYER_X, this.py, 0xcfe0ff, 16, 70, 600);
    this.player.anims.stop();
    this.player.setTexture(`${this.char.id}_fly`).setAlpha(1);
    this.vy = -280;
    this.spin = 9;
    this.deathFloorHits = 0;
    this.tweens.add({ targets: [this.ghost, this.ghostGlow], y: -80, x: '+=60', alpha: 0, duration: 800, ease: 'Cubic.easeIn' });
    this.tendril.clear();
  }

  stepDeath(dt) {
    this.vy += GRAVITY * dt;
    this.py += this.vy * dt;
    this.player.rotation += this.spin * dt;
    if (this.py >= BOTTOM + 4) {
      this.py = BOTTOM + 4;
      if (this.vy > 140) {
        this.vy = -this.vy * (this.charm.bouncy ? 0.72 : 0.45);
        this.spin *= 0.6;
        this.deathFloorHits++;
        Audio.sfx('bounce');
        this.burst(PLAYER_X, FLOOR - 2, 0x8a8a9a, 6, 40, 300);
      } else {
        this.vy = 0;
        this.spin = 0;
        this.player.rotation = Phaser.Math.Angle.RotateTo(this.player.rotation, -Math.PI / 2, 0.1);
      }
    }
    if (this.deathFloorHits > 0) {
      this.speed *= Math.exp(-(this.charm.bouncy ? 1.0 : 1.7) * dt);
      if (this.speed < 12) this.speed = 0;
    }
    if (this.speed === 0 && this.vy === 0 && !this.ended) {
      this.ended = true;
      this.time.delayedCall(600, () => this.afterDeath());
    }
  }

  stepLight(dt) {
    if (!this.dead && this.started) this.light = Math.max(0, this.light - 0.035 * this.char.drainMul * (this.charm.nightlight ? 0.75 : 1) * dt);
  }

  stepZoneFx(dt) {
    const zone = ZONES[this.zoneIndex % ZONES.length].id;
    if (zone === 'hospital' && this.settings.flicker) {
      this.nextFlicker -= dt;
      if (this.nextFlicker <= 0) { this.flickerUntil = this.clock + 0.3; this.nextFlicker = 4 + Math.random() * 6; }
    }
    if (zone === 'sewer') {
      this.nextDrip -= dt;
      if (this.nextDrip <= 0) {
        this.nextDrip = 0.15 + Math.random() * 0.35;
        const p = this.particlePool.get();
        p.setPosition(Math.random() * W, CEIL).setSize(2, 4).setFillStyle(0x7ab0a0).setAlpha(1).setVisible(true).setDepth(14);
        this.drips.push({ p, vy: 0 });
      }
    }
    for (const d of this.drips) {
      d.vy += 900 * dt;
      d.p.y += d.vy * dt;
      d.p.x -= this.speed * dt * 0.6;
      if (d.p.y > FLOOR) {
        d.dead = true;
        d.p.setVisible(false).setDepth(22);
        this.particlePool.put(d.p);
        this.burst(d.p.x, FLOOR - 2, 0x7ab0a0, 3, 15, 200, 2);
      }
    }
    this.drips = this.drips.filter((d) => !d.dead);
  }

  stepZones(meters) {
    const idx = Math.floor(meters / ZONE_LENGTH_M);
    if (idx === this.zoneIndex || this.transitioning || this.dead) return;
    this.transitioning = true;
    const zone = ZONES[idx % ZONES.length];
    Audio.sfx('zone');
    this.tweens.add({
      targets: this.fader, alpha: 1, duration: 260, ease: 'Quad.easeIn',
      onComplete: () => {
        this.zoneIndex = idx;
        this.saveCheckpoint();
        this.far.setTexture(`${zone.id}_far`);
        this.mid.setTexture(`${zone.id}_mid`);
        this.edge.setTexture(`${zone.id}_edge`);
        Audio.music(zone.song);
        this.setWeather(zone.id);
        this.banner(zone.name);
        this.tweens.add({ targets: this.fader, alpha: 0, duration: 450, ease: 'Quad.easeOut', onComplete: () => { this.transitioning = false; } });
      },
    });
  }

  emitHud(meters) {
    const m = Math.floor(meters);
    if (m !== this.lastMeters) { this.lastMeters = m; this.events.emit('meters', m); }
    const l = Math.round(this.light * 100) / 100;
    if (l !== this.lastLight) { this.lastLight = l; this.events.emit('light', l); }
    const blink = this.light < 0.25 && Math.floor(this.clock * 4) % 2 === 1;
    if (blink !== this.lastBlink) { this.lastBlink = blink; this.events.emit('lightLow', blink); }
  }

  banner(name) {
    const t = text(this, W / 2, H / 2 + 40, name, 16, '#cfe0ff').setDepth(31).setStroke('#07060d', 4).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 300, yoyo: true, hold: 1200, onComplete: () => t.destroy() });
  }

  // ---------------- drawing (once per frame) ----------------
  render(acc) {
    const lead = this.speed * acc; // how far the world moved since the last step
    const a = acc / STEP;
    const py = this.prevPy + (this.py - this.prevPy) * Math.min(1, a);
    const s = this.scroll + lead;
    this.far.tilePositionX = (s / 2) * 0.2;
    this.mid.tilePositionX = (s / 2) * 0.55;
    this.edge.tilePositionX = s / 2;

    // player
    if (!this.dead) {
      const key = this.grounded ? `${this.char.id}_run` : `${this.char.id}_flyA`;
      if (this.player.anims.currentAnim?.key !== key) this.player.play(key);
      this.player.rotation = this.grounded ? 0 : Phaser.Math.Clamp(this.vy / 2200, -0.15, 0.25);
      this.player.setAlpha(this.invuln > 0 && Math.floor(this.invuln * 16) % 2 ? 0.3 : 1);
    }
    this.player.setPosition(PLAYER_X, py);
    this.shieldGlow.setPosition(PLAYER_X, py).setVisible(this.shield && !this.dead)
      .setAlpha(0.35 + Math.sin(this.clock * 6) * 0.12);

    // ghost + tendril
    this.tendril.clear();
    if (!this.dead) {
      this.ghost.setPosition(this.ghostX, this.ghostY).setAlpha(this.invuln > 0 ? 0.5 : 0.92);
      this.ghostGlow.setPosition(this.ghostX, this.ghostY).setAlpha(this.holding ? 0.5 : 0.28);
      const ax = this.ghostX, ay = this.ghostY + 12, bx = PLAYER_X - 3, by = py - 8;
      this.tendril.fillStyle(0xcfe0ff, this.holding ? 0.85 : 0.35);
      for (let i = 0; i <= 9; i++) {
        const t = i / 9;
        const wob = Math.sin(this.clock * 12 + t * 6) * 3 * Math.sin(t * Math.PI);
        this.tendril.fillRect(Math.round(ax + (bx - ax) * t + wob) - 2, Math.round(ay + (by - ay) * t) - 2, 4, 4);
      }
    }

    for (const c of this.candles) {
      if (c.dead) continue;
      c.s.setPosition(c.x - lead, c.y);
      c.glow.setPosition(c.x - lead, c.y - 10);
    }

    this.beamGfx.clear();
    for (const b of this.beams) {
      const ax = b.ax - lead, bx = b.bx - lead;
      const flick = Math.random() < 0.5 ? 0 : 2;
      this.beamGfx.lineStyle(14 + flick, 0x4fe38a, 0.25);
      this.beamGfx.lineBetween(ax, b.ay, bx, b.by);
      this.beamGfx.lineStyle(6, 0xb8ffd2, 0.9);
      this.beamGfx.lineBetween(ax, b.ay, bx, b.by);
      b.nodes[0].setPosition(ax, b.ay); b.nodes[1].setPosition(bx, b.by);
      b.glows[0].setPosition(ax, b.ay); b.glows[1].setPosition(bx, b.by);
    }

    for (const h of this.hands) h.s.setPosition(h.x - lead, h.y);

    this.chainGfx.clear();
    this.chainGfx.fillStyle(0x6a6a78, 1);
    for (const sw of this.swings) {
      if (sw.ex === undefined) continue;
      const x = sw.x - lead;
      for (let d = 0; d < sw.len; d += 8) {
        this.chainGfx.fillRect(Math.round(x + Math.sin(sw.th) * d) - 1, Math.round(CEIL - 4 + Math.cos(sw.th) * d) - 1, 3, 4);
      }
      sw.s.setPosition(sw.ex - lead, sw.ey).setRotation(-sw.th);
      if (sw.glow) sw.glow.setPosition(sw.hx - lead, sw.hy);
    }

    for (const w of this.warnings) {
      const blink = w.phase === 'lock' ? Math.floor(w.t * 16) % 2 : Math.floor(w.t * 5) % 2;
      w.g.clear();
      w.g.fillStyle(0xff2244, blink ? 1 : 0.55);
      w.g.fillCircle(W - 26, w.y, 13);
      w.g.lineStyle(2, 0x07060d, 1);
      w.g.strokeCircle(W - 26, w.y, 13);
      w.txt.setY(w.y + 1);
    }

    for (const b of this.banshees) {
      const x = b.x - lead;
      b.s.setPosition(x, b.y + Math.sin(this.clock * 25) * 2);
      b.eyes.setPosition(x - 14, b.y - 18);
    }

    this.renderBest(lead, py);
    this.renderFeatures(lead, py);

    let flick = 0;
    if (this.clock < this.flickerUntil) flick = (Math.floor(this.clock * 30) % 2) * 0.3;
    const alpha = Math.min(0.9, 0.08 + (1 - this.light) * 0.64 + flick);
    this.dark.setPosition(PLAYER_X + 110, py).setAlpha(alpha);
  }

  renderBest(lead, py) {
    if (this.bestPx <= 0 || this.passedBest) return;
    const x = PLAYER_X + (this.bestPx - this.worldX) - lead;
    if (!this.bestMarker && x < W + 40) {
      const g = this.add.graphics().setDepth(14);
      g.fillStyle(0xffd75e, 0.5);
      for (let y = CEIL; y < FLOOR; y += 12) g.fillRect(-2, y, 4, 6);
      const t = text(this, 0, CEIL + 14, 'BEST', 8, '#ffd75e').setDepth(14);
      this.bestMarker = { g, t };
    }
    if (!this.bestMarker) return;
    this.bestMarker.g.x = x;
    this.bestMarker.t.x = x;
    if (x < PLAYER_X && !this.dead) {
      this.passedBest = true;
      Audio.sfx('best');
      const pop = text(this, PLAYER_X + 40, py - 40, 'NEW BEST!', 16, '#ffd75e').setDepth(31).setStroke('#07060d', 4);
      this.tweens.add({ targets: pop, y: '-=40', alpha: 0, duration: 1200, ease: 'Quad.easeOut', onComplete: () => pop.destroy() });
      const m = this.bestMarker;
      this.tweens.add({ targets: [m.g, m.t], alpha: 0, duration: 800, onComplete: () => { m.g.destroy(); m.t.destroy(); } });
    }
  }

  // pooled particles
  burst(x, y, color, n, dist, life, size = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = dist * (0.4 + Math.random() * 0.6);
      const p = this.particlePool.get();
      p.setPosition(x, y).setSize(size, size).setFillStyle(color).setAlpha(1).setVisible(true).setDepth(22);
      this.tweens.add({
        targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d - 10, alpha: 0,
        duration: life, ease: 'Quad.easeOut', onComplete: () => { p.setVisible(false); this.particlePool.put(p); },
      });
    }
  }
}

Object.assign(PlayScene.prototype, Features);
