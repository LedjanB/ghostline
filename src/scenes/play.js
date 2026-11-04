// The run itself: flying, spawning, collisions, zones, death.
import {
  W, H, CEIL, FLOOR, PLAYER_X, PX_PER_METER, ZONE_LENGTH_M, CHARACTERS, ZONES,
} from '../data.js';
import { Save } from '../save.js';
import { Audio } from '../audio.js';
import { text, button } from '../ui.js';

const GRAVITY = 1500;
const PULL = 3100;
const TOP = CEIL + 16;
const BOTTOM = FLOOR - 16;
const PLAYER_R = 10;

const SWING_INFO = {
  lamp: { off: 9, r: 14, glow: 0xfff2b0 },
  axe: { off: 17, r: 14, glow: null },
  hook: { off: 18, r: 10, glow: null },
};

// One seeded random source per run (procedural-gen skill: own your randomness).
function makeRng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return {
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
  const cx = ax + dx * t, cy = ay + dy * t;
  return Math.hypot(px - cx, py - cy);
}

function circleRect(cx, cy, r, x1, y1, x2, y2) {
  const nx = Math.max(x1, Math.min(cx, x2));
  const ny = Math.max(y1, Math.min(cy, y2));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}

export class PlayScene extends Phaser.Scene {
  constructor() { super('play'); }

  // Reset all run state here, not in the constructor (phaser-core skill).
  init() {
    const save = Save.get();
    this.char = CHARACTERS.find((c) => c.id === save.selected) || CHARACTERS[0];
    this.rand = makeRng(Date.now());
    this.worldX = 0;
    this.speed = 230;
    this.light = 1;
    this.runCandles = 0;
    this.zoneIndex = 0;
    this.dead = false;
    this.ended = false;
    this.paused = false;
    this.hitStop = 0;
    this.shield = this.char.shield;
    this.invuln = 0;
    this.py = BOTTOM;
    this.vy = 0;
    this.grounded = true;
    this.spin = 0;
    this.wasHolding = false;
    this.lastFloatSfx = 0;
    this.started = false;
    this.clock = 0;
    this.nextSpawn = 520;
    this.nextBanshee = 14;
    this.transitioning = false;
    this.flickerUntil = 0;
    this.nextFlicker = 5;
    this.nextDrip = 0;
    this.bestPx = save.best * PX_PER_METER;
    this.bestMarker = null;
    this.passedBest = false;
    this.ghostX = PLAYER_X - 18;
    this.ghostY = BOTTOM - 40;

    this.beams = [];
    this.hands = [];
    this.swings = [];
    this.banshees = [];
    this.warnings = [];
    this.candles = [];
    this.drips = [];
  }

  create() {
    const zone = ZONES[0];
    this.far = this.add.tileSprite(0, 0, 320, 180, `${zone.id}_far`).setOrigin(0).setScale(2).setDepth(0);
    this.mid = this.add.tileSprite(0, 0, 320, 180, `${zone.id}_mid`).setOrigin(0).setScale(2).setDepth(1);
    this.edge = this.add.tileSprite(0, 0, 320, 180, `${zone.id}_edge`).setOrigin(0).setScale(2).setDepth(15);

    this.chainGfx = this.add.graphics().setDepth(6);
    this.beamGfx = this.add.graphics().setDepth(7);
    this.tendril = this.add.graphics().setDepth(8.5);
    this.fxGfx = this.add.graphics().setDepth(22);

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

    this.makeHud();
    this.makeInput();

    this.tutorial = text(this, W / 2, H / 2 - 30, 'HOLD TO FLOAT', 16, '#e6f0ff').setDepth(31).setStroke('#07060d', 4);
    this.tutorial2 = text(this, W / 2, H / 2 - 6, 'TAP / SPACE / MOUSE', 8, '#a99fd0').setDepth(31).setStroke('#07060d', 3);
    this.tweens.add({ targets: [this.tutorial, this.tutorial2], alpha: 0.35, duration: 500, yoyo: true, repeat: -1 });

    this.banner(zone.name);
    Audio.music(zone.song);
    Audio.duck(false);

    this.onHidden = () => { if (!this.dead) this.setPaused(true); };
    this.game.events.on('hidden', this.onHidden);
    this.events.once('shutdown', () => {
      this.game.events.off('hidden', this.onHidden);
      this.tweens.resumeAll();
      this.anims.resumeAll();
    });
  }

  // ---------------- HUD & input ----------------
  makeHud() {
    const d = 30;
    this.distText = text(this, 14, 18, '0M', 16, '#e6f0ff', 0).setDepth(d).setStroke('#07060d', 4);
    this.add.image(176, 18, 'candle0').setScale(1.5).setDepth(d);
    this.candleText = text(this, 190, 18, '0', 16, '#ffd75e', 0).setDepth(d).setStroke('#07060d', 4);
    text(this, 296, 18, 'LIGHT', 8, '#ffb060', 0).setDepth(d).setStroke('#07060d', 3);
    this.lightBar = this.add.graphics().setDepth(d);
    this.shieldIcon = this.add.image(500, 18, 'glow').setScale(0.35).setDepth(d).setTint(0x4fa8ff)
      .setBlendMode(Phaser.BlendModes.ADD).setVisible(this.shield);
    this.pauseBtn = button(this, W - 24, 18, 'II', () => this.setPaused(!this.paused), { w: 30, h: 26, size: 8 });
    this.pauseBtn.setDepth(d);
    this.pauseBtn.bg.on('pointerdown', (p) => { p.__ui = true; });
  }

  makeInput() {
    this.keys = this.input.keyboard.addKeys('SPACE,UP,W,P,ESC');
    this.input.on('pointerup', (p) => { p.__ui = false; });
    this.input.keyboard.on('keydown-P', () => { if (!this.dead) this.setPaused(!this.paused); });
    this.input.keyboard.on('keydown-ESC', () => { if (!this.dead) this.setPaused(!this.paused); });
  }

  isHolding() {
    if (this.keys.SPACE.isDown || this.keys.UP.isDown || this.keys.W.isDown) return true;
    return this.input.manager.pointers.some((p) => p.isDown && !p.__ui);
  }

  setPaused(on) {
    if (on === this.paused) return;
    this.paused = on;
    if (on) {
      this.tweens.pauseAll();
      Audio.duck(true);
      this.pauseLayer = [
        this.add.rectangle(0, 0, W, H, 0x07060d).setOrigin(0).setAlpha(0.88).setDepth(50).setInteractive(),
        text(this, W / 2, 120, 'PAUSED', 24, '#cfe0ff').setDepth(51),
      ];
      this.resumeBtn = button(this, W / 2, 190, 'RESUME', () => this.setPaused(false)).setDepth(52);
      this.menuBtn = button(this, W / 2, 244, 'MENU', () => {
        this.scene.start('menu');
      }).setDepth(52);
    } else {
      this.tweens.resumeAll();
      Audio.duck(false);
      this.pauseLayer.forEach((o) => o.destroy());
      this.resumeBtn.destroy();
      this.menuBtn.destroy();
      this.input.manager.pointers.forEach((p) => { if (p.isDown) p.__ui = true; });
    }
  }

  // ---------------- main loop ----------------
  update(time, deltaMs) {
    const realDt = Math.min(deltaMs / 1000, 0.05);
    if (this.paused) return;
    if (this.hitStop > 0) { this.hitStop -= realDt; return; }
    const dt = realDt;
    this.clock += dt;
    const holding = !this.dead && this.isHolding();

    if (holding && !this.started) {
      this.started = true;
      this.tweens.killTweensOf([this.tutorial, this.tutorial2]);
      this.tweens.add({ targets: [this.tutorial, this.tutorial2], alpha: 0, y: '-=20', duration: 400, onComplete: () => { this.tutorial.destroy(); this.tutorial2.destroy(); } });
    }

    // world speed
    const meters = this.worldX / PX_PER_METER;
    const diff = Math.min(1, meters / 2500);
    if (!this.dead) this.speed = 230 + 290 * diff;
    this.worldX += this.speed * dt;
    const move = this.speed * dt;

    this.far.tilePositionX += (move / 2) * 0.2;
    this.mid.tilePositionX += (move / 2) * 0.55;
    this.edge.tilePositionX += move / 2;

    if (this.dead) this.updateDeath(dt);
    else this.updatePlayer(dt, holding);

    this.updateGhost(dt, holding);
    this.updateZones(meters);
    if (!this.dead) {
      this.spawner(meters, diff);
      this.bansheeTimer(dt, diff);
    }
    this.updateBest();
    this.moveWorld(dt, move);
    if (!this.dead) this.collide();
    this.updateLight(dt);
    this.updateZoneFx(dt);
    this.updateHud(meters);
  }

  updatePlayer(dt, holding) {
    if (holding && !this.wasHolding && this.clock - this.lastFloatSfx > 0.25) {
      Audio.sfx('float');
      this.lastFloatSfx = this.clock;
    }
    this.wasHolding = holding;

    this.vy += (GRAVITY - (holding ? PULL : 0)) * dt;
    this.vy = Phaser.Math.Clamp(this.vy, -480, 620);
    this.py += this.vy * dt;
    if (this.py < TOP) { this.py = TOP; if (this.vy < 0) this.vy = 0; }
    const wasGrounded = this.grounded;
    if (this.py >= BOTTOM) {
      if (!wasGrounded && this.vy > 250) this.land();
      this.py = BOTTOM;
      this.vy = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    const key = this.grounded ? `${this.char.id}_run` : `${this.char.id}_flyA`;
    if (this.player.anims.currentAnim?.key !== key) this.player.play(key);
    this.player.setPosition(PLAYER_X, this.py);
    this.player.rotation = this.grounded ? 0 : Phaser.Math.Clamp(this.vy / 2200, -0.15, 0.25);

    if (this.invuln > 0) {
      this.invuln -= dt;
      this.player.setAlpha(Math.floor(this.invuln * 16) % 2 ? 0.3 : 1);
      if (this.invuln <= 0) this.player.setAlpha(1);
    }
    this.shieldGlow.setPosition(PLAYER_X, this.py).setVisible(this.shield)
      .setAlpha(0.35 + Math.sin(this.clock * 6) * 0.12);
  }

  land() {
    // small-tier feedback: squash + dust
    this.tweens.add({ targets: this.player, scaleY: 1.6, scaleX: 2.4, duration: 60, yoyo: true, ease: 'Quad.easeOut' });
    this.burst(PLAYER_X, FLOOR - 2, 0x8a8a9a, 6, 30, 300);
  }

  updateGhost(dt, holding) {
    let tx, ty;
    if (this.dead) return this.tendril.clear();
    if (holding) { tx = PLAYER_X - 4; ty = this.py - 46 + Math.sin(this.clock * 9) * 2; }
    else { tx = PLAYER_X - 20; ty = this.py - 40 + Math.sin(this.clock * 3) * 4; }
    const k = 1 - Math.exp(-14 * dt);
    this.ghostX += (tx - this.ghostX) * k;
    this.ghostY += (ty - this.ghostY) * k;
    this.ghost.setPosition(this.ghostX, this.ghostY);
    this.ghost.setAlpha(this.invuln > 0 ? 0.5 : 0.92);
    this.ghostGlow.setPosition(this.ghostX, this.ghostY).setAlpha(holding ? 0.5 : 0.28);

    // ectoplasm tendril from ghost to the player's back
    this.tendril.clear();
    const ax = this.ghostX, ay = this.ghostY + 12;
    const bx = PLAYER_X - 3, by = this.py - 8;
    this.tendril.fillStyle(0xcfe0ff, holding ? 0.85 : 0.35);
    const steps = 9;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const wob = Math.sin(this.clock * 12 + t * 6) * 3 * Math.sin(t * Math.PI);
      const x = ax + (bx - ax) * t + wob;
      const y = ay + (by - ay) * t;
      this.tendril.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
    }
  }

  // ---------------- spawning ----------------
  spawner(meters, diff) {
    if (this.worldX < this.nextSpawn) return;
    const toBoundary = ZONE_LENGTH_M - (meters % ZONE_LENGTH_M);
    const sinceBoundary = meters % ZONE_LENGTH_M;
    if (toBoundary < 28 || (meters > 100 && sinceBoundary < 10)) {
      this.nextSpawn = this.worldX + 120;
      return;
    }
    const r = this.rand;
    const table = [
      ['candles', 30],
      ['beam', 26],
      ['swing', 12],
      ['beamCandles', 10],
    ];
    if (meters > 60) table.push(['hands', 16]);
    if (diff > 0.15) table.push(['beamPair', 10]);
    if (diff > 0.3) table.push(['rotor', 9]);
    const kind = r.weighted(table);
    const x0 = W + 60;
    let length = 0;
    switch (kind) {
      case 'candles': length = this.spawnCandles(x0); break;
      case 'beam': length = this.spawnBeam(x0, diff); break;
      case 'beamPair': {
        this.spawnBeam(x0, diff, 0);
        const gap = r.range(170, 230);
        this.spawnBeam(x0 + gap, diff, Math.PI / 2);
        length = gap + 60;
        break;
      }
      case 'rotor': length = this.spawnBeam(x0, diff, null, true); break;
      case 'beamCandles': {
        const y = this.rand.chance(0.5) ? CEIL + 70 : FLOOR - 70;
        this.spawnBeam(x0 + 90, diff, 0, false, y);
        const cy = y < H / 2 ? y + 60 : y - 60;
        for (let i = 0; i < 9; i++) this.addCandle(x0 + i * 22, cy);
        length = 9 * 22;
        break;
      }
      case 'hands': length = this.spawnHands(x0, diff); break;
      case 'swing': length = this.spawnSwing(x0); break;
    }
    const gap = Phaser.Math.Linear(330, 170, diff) + r.range(0, 90);
    this.nextSpawn = this.worldX + length + gap;
  }

  spawnCandles(x0) {
    const r = this.rand;
    const shape = r.pick(['line', 'wave', 'arc', 'grid']);
    if (shape === 'line') {
      const n = r.int(8, 12), y = r.range(TOP + 10, BOTTOM - 10);
      for (let i = 0; i < n; i++) this.addCandle(x0 + i * 22, y);
      return n * 22;
    }
    if (shape === 'wave') {
      const n = 14, cy = r.range(TOP + 60, BOTTOM - 60);
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
    const s = this.add.sprite(x, y, 'candle0').setScale(2).setDepth(21.5);
    s.play({ key: 'candle_flicker', startFrame: Math.floor(Math.random() * 2) });
    const glow = this.add.image(x, y - 10, 'glow').setScale(0.9).setDepth(21)
      .setBlendMode(Phaser.BlendModes.ADD).setTint(0xffa040).setAlpha(0.55);
    this.candles.push({ x, y, s, glow });
  }

  spawnBeam(x0, diff, forcedAng = null, rotor = false, forcedY = null) {
    const r = this.rand;
    const len = rotor ? 120 : r.range(80, 120 + 50 * diff);
    let ang = forcedAng ?? r.pick([0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4]);
    // keep both ends inside the play area (validate the layout)
    const hh = rotor ? len / 2 : Math.abs(Math.sin(ang)) * len / 2;
    const y = forcedY ?? r.range(TOP + 4 + hh, BOTTOM - 4 - hh);
    const nodes = [0, 1].map(() => this.add.image(0, 0, 'spirit').setScale(2).setDepth(7.5));
    const glows = [0, 1].map(() => this.add.image(0, 0, 'glow').setScale(1.1).setDepth(21)
      .setBlendMode(Phaser.BlendModes.ADD).setTint(0x4fe38a).setAlpha(0.45));
    this.beams.push({
      x: x0 + (Math.abs(Math.cos(ang)) * len) / 2, y, len, ang, nodes, glows,
      rot: rotor ? (r.chance(0.5) ? 1 : -1) * r.range(1.1, 1.6) : 0,
    });
    return Math.abs(Math.cos(ang)) * len + 40;
  }

  spawnHands(x0, diff) {
    const r = this.rand;
    const n = r.int(1, diff > 0.4 ? 3 : 2);
    let x = x0;
    for (let i = 0; i < n; i++) {
      const fromFloor = r.chance(0.5);
      const reach = r.range(115, 140 + 30 * diff);
      const s = this.add.image(x, 0, 'hand').setScale(2).setDepth(5);
      if (fromFloor) s.setOrigin(0.5, 0).setY(FLOOR + 6);
      else s.setOrigin(0.5, 1).setFlipY(true).setY(CEIL - 6);
      this.hands.push({ x, s, fromFloor, reach, state: 'wait', t: 0 });
      x += r.range(150, 190);
    }
    return x - x0;
  }

  spawnSwing(x0) {
    const r = this.rand;
    const type = ZONES[this.zoneIndex % ZONES.length].swing;
    const len = r.range(110, 165);
    const s = this.add.image(x0, CEIL, type).setScale(2).setOrigin(0.5, 0).setDepth(6);
    const info = SWING_INFO[type];
    const glow = info.glow ? this.add.image(x0, CEIL, 'glow').setScale(1.4).setDepth(21)
      .setBlendMode(Phaser.BlendModes.ADD).setTint(info.glow).setAlpha(0.4) : null;
    this.swings.push({
      x: x0, len, type, s, glow, info,
      amp: r.range(0.7, 1.0), w: r.range(2.0, 2.8), phase: r.range(0, Math.PI * 2), lastSign: 0,
    });
    return 60;
  }

  bansheeTimer(dt, diff) {
    if (this.transitioning) return;
    this.nextBanshee -= dt;
    if (this.nextBanshee > 0) return;
    this.nextBanshee = Phaser.Math.Linear(9, 3.5, diff) + this.rand.range(0, 4);
    this.addWarning(0);
    if (diff > 0.35 && this.rand.chance(0.35)) this.addWarning(this.rand.chance(0.5) ? 90 : -90);
  }

  addWarning(offset) {
    const g = this.add.graphics().setDepth(29);
    const t = text(this, W - 26, 0, '!', 16, '#ffffff').setDepth(30);
    this.warnings.push({ y: this.py + offset, offset, t: 0, phase: 'track', g, txt: t });
    Audio.sfx('warn');
  }

  // ---------------- moving everything ----------------
  moveWorld(dt, move) {
    // candles
    for (const c of this.candles) {
      if (c.dead) continue;
      c.x -= move;
      c.s.x = c.x; c.glow.x = c.x;
      if (c.x < -40) this.killCandle(c);
    }
    this.candles = this.candles.filter((c) => !c.dead);

    // beams
    this.beamGfx.clear();
    for (const b of this.beams) {
      b.x -= move;
      b.ang += b.rot * dt;
      const dx = Math.cos(b.ang) * b.len / 2, dy = Math.sin(b.ang) * b.len / 2;
      b.ax = b.x - dx; b.ay = b.y - dy; b.bx = b.x + dx; b.by = b.y + dy;
      const flick = Math.random() < 0.5 ? 0 : 2;
      this.beamGfx.lineStyle(14 + flick, 0x4fe38a, 0.25);
      this.beamGfx.lineBetween(b.ax, b.ay, b.bx, b.by);
      this.beamGfx.lineStyle(6, 0xb8ffd2, 0.9);
      this.beamGfx.lineBetween(b.ax, b.ay, b.bx, b.by);
      b.nodes[0].setPosition(b.ax, b.ay); b.nodes[1].setPosition(b.bx, b.by);
      b.glows[0].setPosition(b.ax, b.ay); b.glows[1].setPosition(b.bx, b.by);
      if (b.x < -b.len) { b.dead = true; b.nodes.forEach((n) => n.destroy()); b.glows.forEach((n) => n.destroy()); }
    }
    this.beams = this.beams.filter((b) => !b.dead);

    // hands
    for (const h of this.hands) {
      h.x -= move;
      h.s.x = h.x;
      const near = h.x - PLAYER_X;
      if (h.state === 'wait') {
        if (h.x < W - 10) {
          // telegraph: fingertips peek out and twitch
          const peek = 10 + Math.sin(this.clock * 20) * 2;
          h.s.y = h.fromFloor ? FLOOR - peek : CEIL + peek;
        }
        if (near < 230) {
          h.state = 'rise';
          Audio.sfx('hand');
          this.cameras.main.shake(60, 0.003);
          this.burst(h.x, h.fromFloor ? FLOOR : CEIL, 0x6a6a72, 8, 40, 350);
          const target = h.fromFloor ? FLOOR - h.reach : CEIL + h.reach;
          this.tweens.add({ targets: h.s, y: target, duration: 220, ease: 'Back.easeOut' });
        }
      } else if (h.state === 'rise' && near < -90) {
        h.state = 'drop';
        this.tweens.add({ targets: h.s, y: h.fromFloor ? FLOOR + 6 : CEIL - 6, duration: 500, ease: 'Quad.easeIn' });
      }
      if (h.x < -40) { h.dead = true; this.tweens.killTweensOf(h.s); h.s.destroy(); }
    }
    this.hands = this.hands.filter((h) => !h.dead);

    // swings
    this.chainGfx.clear();
    for (const s of this.swings) {
      s.x -= move;
      const th = s.amp * Math.sin(this.clock * s.w + s.phase);
      const ex = s.x + Math.sin(th) * s.len;
      const ey = CEIL - 4 + Math.cos(th) * s.len;
      this.chainGfx.fillStyle(0x6a6a78, 1);
      for (let d = 0; d < s.len; d += 8) {
        this.chainGfx.fillRect(Math.round(s.x + Math.sin(th) * d) - 1, Math.round(CEIL - 4 + Math.cos(th) * d) - 1, 3, 4);
      }
      s.s.setPosition(ex, ey).setRotation(-th);
      s.hx = ex + Math.sin(th) * s.info.off;
      s.hy = ey + Math.cos(th) * s.info.off;
      if (s.glow) s.glow.setPosition(s.hx, s.hy);
      const sign = Math.sign(th);
      if (sign !== s.lastSign && s.x < W && s.x > 0) Audio.sfx('swoosh');
      s.lastSign = sign;
      if (s.x < -s.len - 30) { s.dead = true; s.s.destroy(); if (s.glow) s.glow.destroy(); }
    }
    this.swings = this.swings.filter((s) => !s.dead);

    // warnings -> banshees
    for (const w of this.warnings) {
      w.t += dt;
      if (w.phase === 'track') {
        const target = Phaser.Math.Clamp(this.py + w.offset, TOP, BOTTOM);
        w.y += (target - w.y) * (1 - Math.exp(-5 * dt));
        if (w.t > 1.1) { w.phase = 'lock'; w.t = 0; Audio.sfx('warn'); }
      } else if (w.phase === 'lock' && w.t > 0.45) {
        w.dead = true;
        this.spawnBanshee(w.y);
      }
      const blink = w.phase === 'lock' ? Math.floor(w.t * 16) % 2 : Math.floor(w.t * 5) % 2;
      w.g.clear();
      w.g.fillStyle(0xff2244, blink ? 1 : 0.55);
      w.g.fillCircle(W - 26, w.y, 13);
      w.g.lineStyle(2, 0x07060d, 1);
      w.g.strokeCircle(W - 26, w.y, 13);
      w.txt.setY(w.y + 1);
      if (w.dead || this.dead) { w.dead = true; w.g.destroy(); w.txt.destroy(); }
    }
    this.warnings = this.warnings.filter((w) => !w.dead);

    for (const b of this.banshees) {
      b.x -= (this.dead ? move : this.speed * dt + 650 * dt);
      b.s.setPosition(b.x, b.y + Math.sin(this.clock * 25) * 2);
      b.eyes.setPosition(b.x - 14, b.y - 18);
      if (b.x < -80) { b.dead = true; b.s.destroy(); b.eyes.destroy(); }
    }
    this.banshees = this.banshees.filter((b) => !b.dead);
  }

  spawnBanshee(y) {
    const s = this.add.image(W + 50, y, 'banshee').setScale(2).setDepth(12);
    const eyes = this.add.image(W + 50, y, 'glow').setScale(0.7).setDepth(21)
      .setBlendMode(Phaser.BlendModes.ADD).setTint(0xff2244).setAlpha(0.8);
    this.banshees.push({ x: W + 50, y, s, eyes });
    Audio.sfx('scream');
  }

  // ---------------- collisions ----------------
  collide() {
    const px = PLAYER_X, py = this.py;
    // candles
    for (const c of this.candles) {
      if (c.dead) continue;
      if (Math.hypot(c.x - px, c.y - py) < 22) this.collect(c);
    }
    if (this.invuln > 0) return;
    for (const b of this.beams) {
      if (distToSegment(px, py, b.ax, b.ay, b.bx, b.by) < PLAYER_R + 5) return this.hit();
      if (Math.hypot(px - b.ax, py - b.ay) < PLAYER_R + 11 || Math.hypot(px - b.bx, py - b.by) < PLAYER_R + 11) return this.hit();
    }
    for (const h of this.hands) {
      if (h.state === 'wait') continue;
      if (h.fromFloor) {
        if (circleRect(px, py, PLAYER_R, h.x - 12, h.s.y + 6, h.x + 12, FLOOR)) return this.hit();
      } else if (circleRect(px, py, PLAYER_R, h.x - 12, CEIL, h.x + 12, h.s.y - 6)) return this.hit();
    }
    for (const s of this.swings) {
      if (s.hx !== undefined && Math.hypot(px - s.hx, py - s.hy) < PLAYER_R + s.info.r) return this.hit();
    }
    for (const b of this.banshees) {
      if (Math.hypot(px - (b.x - 6), py - b.y) < PLAYER_R + 16) return this.hit();
    }
  }

  collect(c) {
    const gain = this.char.candleMul;
    this.runCandles += gain;
    this.light = Math.min(1, this.light + 0.07);
    Audio.sfx('candle');
    c.dead = true;
    c.glow.destroy();
    // small-tier feedback: pop and fly to the HUD counter
    this.tweens.add({
      targets: c.s, x: 176, y: 18, scaleX: 1, scaleY: 1, duration: 320, ease: 'Cubic.easeIn',
      onComplete: () => {
        c.s.destroy();
        this.tweens.add({ targets: this.candleText, scaleX: 1.3, scaleY: 1.3, duration: 60, yoyo: true });
      },
    });
  }

  killCandle(c) { c.dead = true; c.s.destroy(); c.glow.destroy(); }

  hit() {
    if (this.shield) {
      // medium-tier feedback
      this.shield = false;
      this.invuln = 1.4;
      this.shieldIcon.setVisible(false);
      this.shieldGlow.setVisible(false);
      Audio.sfx('shield');
      this.cameras.main.shake(160, 0.006);
      this.cameras.main.flash(120, 80, 160, 255);
      this.burst(PLAYER_X, this.py, 0x4fa8ff, 14, 60, 450);
      return;
    }
    this.die();
  }

  die() {
    // large-tier feedback: hit-stop + shake + flash
    this.dead = true;
    this.hitStop = 0.09;
    this.cameras.main.shake(280, 0.012);
    this.cameras.main.flash(140, 255, 60, 90);
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

  updateDeath(dt) {
    this.vy += GRAVITY * dt;
    this.py += this.vy * dt;
    this.player.rotation += this.spin * dt;
    if (this.py >= BOTTOM + 4) {
      this.py = BOTTOM + 4;
      if (this.vy > 140) {
        this.vy = -this.vy * 0.45;
        this.spin *= 0.6;
        this.deathFloorHits++;
        Audio.sfx('bounce');
        this.burst(PLAYER_X, FLOOR - 2, 0x8a8a9a, 6, 40, 300);
      } else {
        this.vy = 0;
        this.spin = 0;
        this.player.rotation = Phaser.Math.Angle.RotateTo(this.player.rotation, -Math.PI / 2, 0.2);
      }
    }
    if (this.deathFloorHits > 0) {
      this.speed *= Math.exp(-1.7 * dt);
      if (this.speed < 12) this.speed = 0;
    }
    this.player.setPosition(PLAYER_X, this.py);
    if (this.speed === 0 && this.vy === 0 && !this.ended) {
      this.ended = true;
      this.time.delayedCall(600, () => this.endRun());
    }
  }

  endRun() {
    const meters = Math.floor(this.worldX / PX_PER_METER);
    const before = Save.get();
    const prevBest = before.best;
    const isBest = meters > prevBest;
    Save.update((s) => {
      s.candles += this.runCandles;
      s.best = Math.max(s.best, meters);
      s.runs += 1;
    });
    this.scene.launch('over', { meters, candles: this.runCandles, isBest, best: Math.max(prevBest, meters) });
  }

  // ---------------- best-distance marker ----------------
  updateBest() {
    if (this.bestPx <= 0 || this.passedBest) return;
    const x = PLAYER_X + (this.bestPx - this.worldX);
    if (!this.bestMarker && x < W + 40) {
      const g = this.add.graphics().setDepth(14);
      g.fillStyle(0xffd75e, 0.5);
      for (let y = CEIL; y < FLOOR; y += 12) g.fillRect(-2, y, 4, 6);
      const t = text(this, 0, CEIL + 14, 'BEST', 8, '#ffd75e').setDepth(14);
      this.bestMarker = { g, t };
    }
    if (this.bestMarker) {
      this.bestMarker.g.x = x;
      this.bestMarker.t.x = x;
      if (x < PLAYER_X && !this.dead) {
        this.passedBest = true;
        Audio.sfx('best');
        const pop = text(this, PLAYER_X + 40, this.py - 40, 'NEW BEST!', 16, '#ffd75e').setDepth(31).setStroke('#07060d', 4);
        this.tweens.add({ targets: pop, y: '-=40', alpha: 0, duration: 1200, ease: 'Quad.easeOut', onComplete: () => pop.destroy() });
        const m = this.bestMarker;
        this.tweens.add({ targets: [m.g, m.t], alpha: 0, duration: 800, onComplete: () => { m.g.destroy(); m.t.destroy(); } });
      }
    }
  }

  // ---------------- light / darkness ----------------
  updateLight(dt) {
    if (!this.dead && this.started) this.light = Math.max(0, this.light - 0.035 * this.char.drainMul * dt);
    let flick = 0;
    if (this.clock < this.flickerUntil) flick = (Math.floor(this.clock * 30) % 2) * 0.3;
    const alpha = Math.min(0.9, 0.08 + (1 - this.light) * 0.64 + flick);
    this.dark.setPosition(PLAYER_X + 110, this.py).setAlpha(alpha);
  }

  updateZoneFx(dt) {
    const zone = ZONES[this.zoneIndex % ZONES.length].id;
    if (zone === 'hospital') {
      this.nextFlicker -= dt;
      if (this.nextFlicker <= 0) {
        this.flickerUntil = this.clock + 0.3;
        this.nextFlicker = 4 + Math.random() * 6;
      }
    }
    if (zone === 'sewer') {
      this.nextDrip -= dt;
      if (this.nextDrip <= 0) {
        this.nextDrip = 0.15 + Math.random() * 0.35;
        const r = this.add.rectangle(Math.random() * W, CEIL, 2, 4, 0x7ab0a0).setDepth(14);
        this.drips.push({ r, vy: 0 });
      }
    }
    for (const d of this.drips) {
      d.vy += 900 * dt;
      d.r.y += d.vy * dt;
      d.r.x -= this.speed * dt * 0.6;
      if (d.r.y > FLOOR) {
        d.dead = true;
        this.burst(d.r.x, FLOOR - 2, 0x7ab0a0, 3, 15, 200, 2);
        d.r.destroy();
      }
    }
    this.drips = this.drips.filter((d) => !d.dead);
  }

  // ---------------- zones ----------------
  updateZones(meters) {
    const idx = Math.floor(meters / ZONE_LENGTH_M);
    if (idx === this.zoneIndex || this.transitioning || this.dead) return;
    this.transitioning = true;
    const zone = ZONES[idx % ZONES.length];
    Audio.sfx('zone');
    this.tweens.add({
      targets: this.fader, alpha: 1, duration: 260, ease: 'Quad.easeIn',
      onComplete: () => {
        this.zoneIndex = idx;
        this.far.setTexture(`${zone.id}_far`);
        this.mid.setTexture(`${zone.id}_mid`);
        this.edge.setTexture(`${zone.id}_edge`);
        Audio.music(zone.song);
        this.banner(zone.name);
        this.tweens.add({ targets: this.fader, alpha: 0, duration: 450, ease: 'Quad.easeOut', onComplete: () => { this.transitioning = false; } });
      },
    });
  }

  banner(name) {
    const t = text(this, W / 2, H / 2 + 40, name, 16, '#cfe0ff').setDepth(31).setStroke('#07060d', 4).setAlpha(0);
    this.tweens.add({
      targets: t, alpha: 1, duration: 300, yoyo: true, hold: 1200,
      onComplete: () => t.destroy(),
    });
  }

  // ---------------- HUD ----------------
  updateHud(meters) {
    this.distText.setText(`${Math.floor(meters)}M`);
    this.candleText.setText(`${this.runCandles}`);
    const g = this.lightBar;
    g.clear();
    g.fillStyle(0x07060d, 1); g.fillRect(340, 11, 124, 14);
    g.fillStyle(0x3a2a1a, 1); g.fillRect(342, 13, 120, 10);
    const low = this.light < 0.25 && Math.floor(this.clock * 4) % 2;
    g.fillStyle(low ? 0xff4040 : 0xffb040, 1); g.fillRect(342, 13, Math.round(120 * this.light), 10);
    g.fillStyle(0xffe0a0, 1); g.fillRect(342, 13, Math.round(120 * this.light), 2);
  }

  // ---------------- particles ----------------
  burst(x, y, color, n, dist, life, size = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = dist * (0.4 + Math.random() * 0.6);
      const p = this.add.rectangle(x, y, size, size, color).setDepth(22);
      this.tweens.add({
        targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d - 10, alpha: 0,
        duration: life, ease: 'Quad.easeOut', onComplete: () => p.destroy(),
      });
    }
  }
}
