// v6: the runner (docs/design-v6.md). Mixed into PlayScene like run-features and run-score.
// Milo runs on the ground, THE STRETCH chases him from the left, ground traps come at him,
// Boo grabs him for short flights (one chasm per world + a rare Boo orb) where the v5 air
// hazards come back, and a salt shotgun fires on its own.
// Skills: prototype-fast (tuning from prototypes/runner), physics-tuning (fixed 120 Hz step,
// coyote time + jump buffer), game-feel (squash, shake, hit-stop on caught), level-design
// (teach then test: each trap unlocks at a set distance, gaps scale with speed).
import { W, H, CEIL, FLOOR, PLAYER_X, PX_PER_METER, ZONE_LENGTH_M, zoneAt } from './data.js';
import { Audio } from './audio.js';
import { text } from './ui.js';
import { Features } from './run-features.js';
import { Device } from './input.js';

const TOP = CEIL + 16;
const BOTTOM = FLOOR - 16;   // Milo's centre when standing
// movement (scaled from prototype A: 2/3 of its 960x540 numbers)
const RUN_G = 1800;
const JUMP_V = 575;          // about 90 px high, 0.64 s in the air
const JUMP_CUT = 0.45;       // let go early = shorter jump
const COYOTE = 0.09, BUFFER = 0.13;
const SLIDE_T = 0.6;
const FAST_FALL = 2400;      // slide in the air = drop fast
// the chaser
export const RUN = {
  START_GAP: 118, MAX_GAP: 132, CAUGHT: 22,
  STUMBLE_COST: 40,          // px the creature gains per stumble
  CLEAN: 5,                  // px/s it falls back while you run clean
  CANDLE: 1.2, KILL: 8,
  LAND_GAP: 86, AIR_HIT: 30, // flight: it waits where you land; each air hit = closer
  ORB_TIME: 3.5,             // Boo orb flight (s): a short moment, not a level
  CHASM_S: 2.6,              // flight section width in seconds of running
  CHASM_AT_M: 220,           // one flight section per world, this far into it
};
const SALT = { ammo: 24, time: 16, cd: 0.32, range: 230, speed: 720 };
const BEAM_END = FLOOR - 26; // a ceiling beam stops here: slide under it

const kindsAt = (m) => [
  ['grave', 4],
  ['beam', m > 20 ? 3 : 0],
  ['hand', m > 50 ? 2.5 : 0],
  ['crate', m > 80 ? 2 : 0],
  ['ghoul', m > 110 ? 2.2 : 0],
  ['pit', m > 150 ? 2 : 0],
  ['swing', m > 260 ? 1.4 : 0],
];

// later in a run: it sits closer, each stumble costs more, it falls back slower (0 = start, 1 = hardest)
const late = (d) => Math.max(0, (d - 0.2) / 0.8);
const maxGap = (d) => RUN.MAX_GAP - 30 * late(d);
const stumbleCost = (d) => RUN.STUMBLE_COST + 16 * late(d);
const cleanRate = (d) => RUN.CLEAN * (1 - 0.6 * late(d));
// two stumbles inside this = caught: forgiving while you learn, stricter later
const comboWindow = (d) => 2.2 + 1.0 * Math.min(1, d / 0.6);

export const RunnerFeatures = {
  runnerInit() {
    this.runner = true;
    this.flying = false; this.flyKind = ''; this.flyT = 0;
    this.landingGap = RUN.LAND_GAP; this.airHits = 0; this.flights = 0;
    this.gap = RUN.START_GAP; this.gapVis = RUN.START_GAP;
    this.lastStumble = -99; this.stumbles = 0; this.runSlow = 1; this.slowT = 9;
    this.jumpLatch = false; this.slideLatch = false;
    this.buffer = 0; this.coyote = 0; this.slide = 0;
    this.traps = []; this.runPickups = []; this.pellets = [];
    this.weapon = null; this.kills = 0;
    this.nextTrapX = this.worldX + 700;
    this.lastKinds = [];
    this.runDiff = 0;
    this.chasmZones = new Set(); this.chasm = null;
    this.nextOrbX = this.worldX + 420 * PX_PER_METER;
    this.nextSaltX = this.worldX + 90 * PX_PER_METER;
    this.crFlyT = 0; this.crFlyX = 0; this.crEnter = 1; this.catchUpT = 0;
    this.caughtBy = false;
    // v5 systems the runner replaces or doesn't use
    this.nextRushX = Infinity;   // Spirit Rush: off (flying is the rare treat now)
    this.nextGhoul = Infinity;   // v5 floor ghouls: replaced by runner ghouls you shoot
  },

  runnerCreate() {
    this.pitGfx = this.add.graphics().setDepth(15.2);  // over the floor band: pits are holes in it
    this.trapGfx = this.add.graphics().setDepth(7);
    this.shotGfx = this.add.graphics().setDepth(21.7);
    this.stretch = this.add.sprite(PLAYER_X - this.gap, FLOOR + 2, 'stretch_walk0').setScale(2).setOrigin(0.5, 1).setDepth(9.4);
    this.stretch.play('stretch_walk');
    this.gunImg = this.add.image(PLAYER_X, BOTTOM, 'salt_gun').setScale(1.5).setDepth(9.1).setVisible(false);
    this.tutorial.setText(`${prompt2('jump')} TO JUMP`);
    this.tutorial2.setText(`${prompt2('slide')} TO SLIDE`);
    this.events.once('shutdown', () => { this.traps.forEach((t) => this.dropTrap(t)); });
  },

  // presses are latched per frame and used by the next sim step (a short tap is never lost)
  runnerInput(input) {
    if (input.pressed('float')) this.jumpLatch = true;
    if (input.pressed('slide')) this.slideLatch = true;
  },

  sx(wx) { return PLAYER_X + (wx - this.worldX); },

  // ---------------- Milo on the ground ----------------
  stepRun(dt, holding) {
    const jump = this.jumpLatch, slide = this.slideLatch;
    this.jumpLatch = false; this.slideLatch = false;
    if (!this.started && (jump || slide) && this.openingDone) this.startRun();
    if (!this.openingDone) return;
    // the flight section: at the chasm edge Boo grabs him, every time
    if (this.chasm && this.sx(this.chasm.wx) < PLAYER_X + 24) { this.startFlight('section'); return; }
    if (jump) this.buffer = BUFFER; else this.buffer = Math.max(0, this.buffer - dt);
    this.coyote = this.grounded ? COYOTE : Math.max(0, this.coyote - dt);
    if (slide) {
      if (this.slide <= 0) Audio.sfx('slide');
      this.slide = SLIDE_T; this.buffer = 0;
      if (!this.grounded) this.vy = Math.max(this.vy, 260);
    }
    if (this.slide > 0) this.slide = Math.max(0, this.slide - dt);
    if (this.buffer > 0 && this.coyote > 0) {
      this.vy = -JUMP_V; this.grounded = false; this.coyote = 0; this.buffer = 0; this.slide = 0;
      Audio.sfx('jump');
      this.tweens.add({ targets: this.player, scaleX: 1.7, scaleY: 2.4, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
    }
    if (!holding && this.vy < 0) this.vy *= Math.pow(JUMP_CUT, dt * 20);
    const over = this.pitUnder();
    if (this.grounded && over && this.invuln <= 0) this.grounded = false;
    if (!this.grounded) {
      this.vy += (RUN_G + (this.slide > 0 ? FAST_FALL : 0)) * dt;
      this.py += this.vy * dt;
    }
    if (this.py >= BOTTOM && (!over || this.invuln > 0)) {
      if (!this.grounded && this.vy > 250) this.land();
      this.py = BOTTOM; this.vy = 0; this.grounded = true;
    }
    if (this.py > BOTTOM + 44) { this.caught('pit'); return; }
    if (this.invuln > 0) this.invuln -= dt;
  },

  startRun() {
    this.started = true;
    this.tweens.killTweensOf([this.tutorial, this.tutorial2]);
    this.tweens.add({ targets: [this.tutorial, this.tutorial2], alpha: 0, y: '-=20', duration: 400, onComplete: () => { this.tutorial.destroy(); this.tutorial2.destroy(); } });
  },

  pitUnder() {
    const l = PLAYER_X - 4, r = PLAYER_X + 4;
    for (const t of this.traps) {
      if (t.kind !== 'pit' && t.kind !== 'chasm') continue;
      const x = this.sx(t.wx);
      if (l > x && r < x + t.w) return true;
    }
    return false;
  },

  // ---------------- the chaser ----------------
  stepChaser(dt) {
    if (this.dead) return;
    this.slowT += dt;
    this.runSlow = this.slowT < 0.9 ? 0.72 + 0.28 * (this.slowT / 0.9) : 1;
    if (!this.flying) {
      this.catchUpT = Math.max(0, this.catchUpT - dt);
      this.crEnter = Math.min(1, this.crEnter + dt * 1.7);
      if (this.clock - this.lastStumble > 3 && this.catchUpT <= 0 && this.started && this.gap < maxGap(this.runDiff)) this.gap = Math.min(maxGap(this.runDiff), this.gap + cleanRate(this.runDiff) * dt);
      // it sprints for a moment after you land, but the sprint alone never catches you
      if (this.catchUpT > 0 && this.gap > RUN.CAUGHT + 24) this.gap = Math.max(RUN.CAUGHT + 24, this.gap - 12 * dt);
      if (this.gap <= RUN.CAUGHT && this.openingDone) { this.caught('caught'); return; }
    } else {
      this.crFlyT += dt;
    }
    this.gapVis += ((this.flying ? this.landingGap : this.gap) - this.gapVis) * Math.min(1, dt * 6);
    // the meter that used to be LIGHT now shows how close it is; the world darkens as it gets closer
    const g = this.flying ? this.landingGap : this.gap;
    this.light = Phaser.Math.Clamp((g - RUN.CAUGHT) / (RUN.START_GAP - RUN.CAUGHT), 0, 1);
  },

  stumble(kind) {
    if (this.invuln > 0 || this.dead) return;
    this.buzz(120);
    if (this.shield) {
      this.breakCombo(); this.shield = false; this.invuln = 1.4;
      this.events.emit('shield', false);
      Audio.sfx('shield'); this.shake(160, 0.006); this.flash(120, 80, 160, 255);
      this.burst(PLAYER_X, this.py, 0x4fa8ff, 14, 60, 450);
      return;
    }
    if (this.clock - this.lastStumble < comboWindow(this.runDiff)) { this.caught('caught'); return; }
    this.lastStumble = this.clock; this.stumbles++;
    this.gap -= stumbleCost(this.runDiff);
    this.slowT = 0; this.invuln = 0.6;
    this.breakCombo();
    this.deathCause = kind;
    Audio.sfx('stumble');
    this.shake(160, 0.008);
    this.flash(90, 255, 60, 90);
    this.burst(PLAYER_X + 8, FLOOR - 6, 0x8a8a9a, 8, 30, 300);
    this.popup(this.gap - RUN.CAUGHT < 45 ? 'IT\'S RIGHT BEHIND YOU' : 'STUMBLE!', '#ff8a9a');
    this.tweens.add({ targets: this.player, angle: 18, duration: 90, yoyo: true });
    if (this.gap <= RUN.CAUGHT) this.caught('caught');
  },

  caught(cause) {
    if (this.dead) return;
    if (this.creative) { // creative: Boo pulls you free, the creature is shoved back
      this.rebirth();
      this.gap = RUN.START_GAP; this.landingGap = RUN.LAND_GAP;
      if (this.py > BOTTOM) { this.py = BOTTOM; this.vy = 0; this.grounded = true; }
      return;
    }
    this.deathCause = cause === 'pit' ? 'pit' : 'caught';
    this.caughtBy = cause !== 'pit';
    if (this.caughtBy) {
      this.stretch.play('stretch_crawl');
      this.tweens.add({ targets: this, gapVis: 6, duration: 160, ease: 'Quad.easeIn' });
      Audio.sfx('scream');
    }
    this.die();
  },

  // candles push it back a little (in the air: it'll be a little further back when you land)
  candlePush() {
    if (this.flying) this.landingGap = Math.min(RUN.START_GAP, this.landingGap + RUN.CANDLE);
    else this.gap = Math.min(RUN.MAX_GAP, this.gap + RUN.CANDLE);
  },

  // ---------------- Boo's flights ----------------
  startFlight(kind) {
    this.flying = true; this.flyKind = kind; this.flights++;
    this.flyT = RUN.ORB_TIME; this.landingGap = RUN.LAND_GAP; this.airHits = 0;
    this.grounded = false; this.slide = 0;
    this.vy = -360;
    this.crFlyT = 0; this.crFlyX = PLAYER_X - this.gapVis;
    this.stretch.anims.stop(); this.stretch.setTexture('stretch_reach');
    // ground traps ahead fade out: the air is the game now
    for (const t of this.traps) {
      if (t.kind === 'chasm') continue;
      const x = this.sx(t.wx);
      if (x > PLAYER_X - 20) { this.burst(x + t.w / 2, FLOOR - 16, 0x9fb8e8, 8, 30, 400); t.gone = true; }
    }
    for (const sw of this.swings) if (sw.x > PLAYER_X - 20) { if (sw.hx !== undefined) this.burst(sw.hx, sw.hy, 0x9fb8e8, 8, 30, 400); sw.x = -1e5; }
    this.nextSpawn = this.worldX + this.speed * 0.9;
    this.nextBanshee = 1.6;
    Audio.sfx('grab'); Audio.thrust(true);
    this.shake(140, 0.006); this.flash(120, 200, 220, 255);
    this.addCombo('power', PLAYER_X + 40, this.py - 40);
    this.flyPop(kind === 'orb' ? 'BOO!' : 'HOLD ON!');
    this.quip('grab', true);
  },

  stepRunnerFlight(dt) {
    if (!this.flying || this.dead) return;
    this.jumpLatch = false; this.slideLatch = false; // presses in the air don't carry over to the landing
    // Boo never lets you drop into a chasm
    if (this.pitUnder() && this.py > BOTTOM - 26) { this.py = BOTTOM - 26; if (this.vy > 0) this.vy = 0; this.grounded = false; }
    if (this.flyKind === 'orb') {
      this.flyT -= dt;
      if (this.chasm && this.sx(this.chasm.wx) < PLAYER_X + 30) this.flyKind = 'section';
      else if (this.flyT <= 0 && !this.pitUnder()) this.endFlight();
    } else if (!this.chasm || this.sx(this.chasm.wx + this.chasm.w) < PLAYER_X - 30) {
      this.endFlight();
    }
  },

  endFlight() {
    this.flying = false; this.flyKind = '';
    this.clearAround(W + 400); // the air hazards go away with Boo
    this.gap = this.landingGap; this.gapVis = -30;
    this.crEnter = 0; this.catchUpT = 1.4;
    this.stretch.play('stretch_crawl');
    this.nextTrapX = this.worldX + this.speed * 1.1;
    this.slide = 0; this.buffer = 0;
    if (this.chasm && this.sx(this.chasm.wx + this.chasm.w) < PLAYER_X) this.chasm = null;
    Audio.thrust(false);
    if (this.gap <= RUN.CAUGHT) { this.caught('caught'); return; }
    this.flyPop(this.gap - RUN.CAUGHT < 40 ? 'IT\'S RIGHT THERE' : 'IT\'S COMING');
    this.quip('landed');
  },

  airHit(kind) {
    if (this.invuln > 0 || this.dead) return;
    this.buzz(120);
    if (this.shield) { this.stumble(kind); return; } // the shield code path is shared
    this.airHits++;
    this.landingGap -= RUN.AIR_HIT;
    this.flyT -= 1;
    this.invuln = 1.0;
    this.breakCombo();
    this.deathCause = kind;
    Audio.sfx('stumble');
    this.shake(160, 0.008); this.flash(90, 255, 60, 90);
    this.burst(PLAYER_X, this.py, 0xcfe0ff, 10, 40, 400);
    const left = this.landingGap - RUN.CAUGHT;
    this.popup(left <= 0 ? 'IT WILL CATCH YOU' : left < 40 ? 'CAREFUL!' : 'OUCH!', '#ff8a9a');
  },

  // every hit goes through here (v5 collide in the air, tests, the ground traps)
  runnerHit(kind) {
    if (this.flying) this.airHit(kind); else this.stumble(kind);
  },

  flyPop(str) {
    const t = text(this, W / 2, 110, str, 24, '#e6f0ff').setDepth(31).setStroke('#07060d', 6).setScale(0.6);
    this.tweens.add({ targets: t, scaleX: 1, scaleY: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 650, duration: 300, onComplete: () => t.destroy() });
  },

  // ---------------- ground spawning ----------------
  runnerSpawner(meters, pace) {
    const v = this.speed;
    this.runDiff = pace.diff;
    const spawnWX = this.worldX + (W + 40 - PLAYER_X);
    const zoneM = meters % ZONE_LENGTH_M;
    // one flight section per world (a gap Boo carries you over)
    if (!this.chasm && !this.chasmZones.has(this.zoneIndex) && zoneM >= RUN.CHASM_AT_M && zoneM < RUN.CHASM_AT_M + 60 && !this.gate) {
      this.chasmZones.add(this.zoneIndex);
      const w = v * RUN.CHASM_S;
      this.chasm = this.addTrap('chasm', spawnWX, { w });
      this.nextTrapX = spawnWX + w + v * 0.9;
      // candles lead the eye to the edge
      for (let i = 0; i < 6; i++) this.addCandle(W + 40 - 150 + i * 22, BOTTOM - 4);
      return;
    }
    const runway = !this.chasm && !this.chasmZones.has(this.zoneIndex) && zoneM > RUN.CHASM_AT_M - v * 1.4 / PX_PER_METER && zoneM < RUN.CHASM_AT_M;
    if (this.chasm || runway) return;
    const toGate = ZONE_LENGTH_M - zoneM;
    if (this.gate || toGate < 22) return; // gates stay clear

    // pickups: the salt shotgun and the (rare) Boo orb
    if (this.worldX >= this.nextSaltX && !this.weapon) {
      this.runPickups.push(this.makePickup('salt', spawnWX + 60, BOTTOM - 4));
      this.nextSaltX = Infinity; // the next one is scheduled when this weapon breaks
    }
    if (this.worldX >= this.nextOrbX) {
      this.runPickups.push(this.makePickup('orb', spawnWX + 30, BOTTOM - 62));
      this.nextOrbX = this.worldX + this.rand.range(800, 1100) * PX_PER_METER;
    }

    if (this.worldX < this.nextTrapX) return;
    if (pace.breather) { // a candle-only breather at the start of each segment
      const n = this.rand.int(6, 10);
      for (let i = 0; i < n; i++) this.addCandle(W + 40 + i * 22, BOTTOM - 4);
      this.tip('candle');
      this.nextTrapX = this.worldX + n * 22 + v * 0.8;
      return;
    }
    const table = kindsAt(meters).map(([k, w]) => [k, w]);
    if (this.lastKinds.length === 2 && this.lastKinds[0] === this.lastKinds[1]) {
      for (const e of table) if (e[0] === this.lastKinds[0]) e[1] = 0;
    }
    const kind = this.rand.weighted(table.filter((e) => e[1] > 0));
    this.lastKinds = [...this.lastKinds, kind].slice(-2);
    let w = 28;
    if (kind === 'swing') { this.spawnGroundSwing(W + 60); w = 60; }
    else {
      const t = this.addTrap(kind, spawnWX, kind === 'pit' ? { w: this.pitWidth(v) } : {});
      w = t.w;
      // candles arc over jump traps and line up under beams
      if ((kind === 'grave' || kind === 'pit' || kind === 'crate') && this.rand.chance(0.35)) {
        for (let i = 0; i < 7; i++) this.addCandle(W + 40 + w / 2 - 66 + i * 22, BOTTOM - 8 - Math.sin((i / 6) * Math.PI) * 70);
      } else if (kind === 'beam' && this.rand.chance(0.45)) {
        for (let i = 0; i < 5; i++) this.addCandle(W + 40 - 44 + i * 22, BOTTOM + 6);
      }
    }
    // gaps scale with speed so the reaction time stays fair; they tighten as difficulty rises
    const d = pace.diff;
    // later on, short combos: you must chain two actions without a breath
    if (meters > 300 && kind !== 'swing' && this.rand.chance(0.15 + 0.25 * d)) w += this.spawnCombo(spawnWX + w, v, d);
    const lo = Phaser.Math.Linear(1.05, 0.62, d), hi = Phaser.Math.Linear(1.6, 1.1, d);
    let gap = v * this.rand.range(lo, hi) + w;
    if (meters > 120 && this.rand.chance(0.25 + d * 0.2)) gap = v * (0.8 - 0.12 * d) + w; // a quick double
    this.nextTrapX = this.worldX + gap;
  },

  // pits keep growing with speed, so they stay a real jump at 500 px/s
  pitWidth(v) { return Phaser.Math.Clamp(v * 0.3, 60, 150); },

  // a follow-up right after the trap that was just placed; returns the extra length it adds
  spawnCombo(wx, v, d) {
    const prev = this.lastKinds[this.lastKinds.length - 1];
    const step = v * (0.62 - 0.08 * d);
    const jumpy = prev === 'grave' || prev === 'crate' || prev === 'pit' || prev === 'hand';
    let kind;
    if (jumpy) kind = this.rand.pick(['beam', 'grave', prev === 'pit' ? 'grave' : 'pit']); // jump then slide, or jump-jump
    else kind = this.rand.pick(['grave', 'hand']);                                         // slide then jump
    const t = this.addTrap(kind, wx + step, kind === 'pit' ? { w: this.pitWidth(v) } : {});
    if (prev === 'hand' && kind !== 'beam' && this.rand.chance(0.5)) { // three hands in a row
      this.addTrap('hand', wx + step * 2);
      return step * 2 + 24;
    }
    return step + t.w;
  },

  addTrap(kind, wx, opts = {}) {
    const t = { kind, wx, w: 28, h: 0, hit: false, gone: false, passed: false, ...opts };
    if (kind === 'grave') { t.w = 28; t.h = 36; t.s = this.add.image(0, FLOOR, 'grave').setScale(2).setOrigin(0, 1).setDepth(8); }
    if (kind === 'crate') { t.w = 32; t.h = 32; t.hp = 2; t.s = this.add.image(0, FLOOR, 'crate').setScale(2).setOrigin(0, 1).setDepth(8); }
    if (kind === 'hand') {
      t.w = 24; t.reach = 46; t.y = FLOOR + 6; t.state = 'wait'; t.t = 0;
      t.s = this.add.image(0, t.y, 'hand').setScale(2).setOrigin(0.5, 0).setDepth(5);
    }
    if (kind === 'beam') {
      t.w = 14;
      t.nodes = [this.add.image(0, BEAM_END, 'spirit').setScale(2).setDepth(7.5).setTint(this.hz.node)];
      t.glow = this.add.image(0, BEAM_END, 'glow').setScale(1.1).setDepth(21).setBlendMode(Phaser.BlendModes.ADD).setTint(0x4fe38a).setAlpha(0.45);
    }
    if (kind === 'ghoul') {
      t.w = 20; t.h = 30; t.hp = 2; t.walk = 45;
      t.s = this.add.sprite(0, FLOOR - 15, 'ghoul0').setScale(2).setDepth(8.8).setTint(zoneAt(this.zoneIndex).ghoul).setFlipX(true);
      t.s.play('ghoul_walk');
    }
    if (kind === 'pit' || kind === 'chasm') t.seed = Math.floor(wx) % 97;
    this.traps.push(t);
    return t;
  },

  dropTrap(t) {
    t.gone = true;
    if (t.s) t.s.destroy();
    if (t.nodes) t.nodes.forEach((n) => n.destroy());
    if (t.glow) t.glow.destroy();
    t.s = null; t.nodes = null; t.glow = null;
  },

  // a v5 swing hung low enough to sweep through running height: time it, or slide at the right moment
  spawnGroundSwing(x0) {
    const type = zoneAt(this.zoneIndex).swing;
    const s = this.add.image(x0, CEIL, type).setScale(2).setOrigin(0.5, 0).setDepth(6);
    const info = { lamp: { off: 9, r: 14, glow: 0xfff2b0 }, axe: { off: 17, r: 14, glow: null }, hook: { off: 18, r: 10, glow: null } }[type];
    const glow = info.glow ? this.add.image(x0, CEIL, 'glow').setScale(1.4).setDepth(21).setBlendMode(Phaser.BlendModes.ADD).setTint(info.glow).setAlpha(0.4) : null;
    const len = FLOOR - CEIL - 26 - info.off - info.r;
    this.swings.push({ x: x0, len, type, s, glow, info, th: 0, amp: this.rand.range(0.55, 0.75), w: this.rand.range(2.2, 2.8), phase: this.rand.range(0, Math.PI * 2), lastSign: 0, ground: true });
  },

  makePickup(kind, wx, y) {
    const s = kind === 'orb'
      ? this.add.sprite(0, y, 'ghost0').setScale(1.6).setDepth(21.6).play('ghost_float')
      : this.add.image(0, y, 'salt_gun').setScale(2).setDepth(21.6);
    const glow = this.add.image(0, y, 'glow').setScale(kind === 'orb' ? 1.6 : 1.1).setDepth(21)
      .setBlendMode(Phaser.BlendModes.ADD).setTint(kind === 'orb' ? 0x9fe8ff : 0xffffff).setAlpha(0.55);
    return { kind, wx, y, baseY: y, s, glow, t: 0 };
  },

  // ---------------- world: traps, monsters, pickups, the salt shotgun ----------------
  stepRunnerWorld(dt) {
    for (const t of this.traps) {
      if (t.gone) continue;
      if (t.kind === 'ghoul') t.wx -= t.walk * dt;
      const x = this.sx(t.wx);
      if (t.kind === 'hand') {
        const near = x - PLAYER_X;
        if (t.state === 'wait') {
          if (x < W - 10) t.y = FLOOR - (8 + Math.sin(this.clock * 20) * 2); // fingertips twitch: a tell
          if (near < 190) { t.state = 'rise'; t.t = 0; t.from = t.y; Audio.sfx('hand'); this.burst(x, FLOOR, 0x6a6a72, 8, 36, 350); }
        } else if (t.state === 'rise') {
          t.t = Math.min(1, t.t + dt / 0.2);
          const k = t.t, c = 1.7;
          const e = 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2;
          t.y = t.from + (FLOOR - t.reach - t.from) * e;
        }
      }
      // cleared it clean: that's worth something
      if (!t.passed && x + t.w < PLAYER_X - 12) {
        t.passed = true;
        if (!t.hit && t.kind !== 'chasm' && !this.dead) this.addCombo('dodge', PLAYER_X, this.py - 30);
      }
      if (x + t.w < -80) this.dropTrap(t);
    }
    this.traps = this.traps.filter((t) => !t.gone);
    if (this.chasm && this.chasm.gone) this.chasm = null;

    for (const p of this.runPickups) {
      p.t += dt;
      p.y = p.baseY + Math.sin(p.t * 3) * (p.kind === 'orb' ? 6 : 3);
      const x = this.sx(p.wx);
      if (!this.dead && Math.hypot(x - PLAYER_X, p.y - this.py) < (p.kind === 'orb' ? 28 : 26)) {
        p.dead = true;
        this.burst(x, p.y, p.kind === 'orb' ? 0x9fe8ff : 0xffffff, 12, 40, 400);
        if (p.kind === 'orb') { if (!this.flying) this.startFlight('orb'); }
        else this.armSalt();
      }
      if (x < -40) p.dead = true;
      if (p.dead) { p.s.destroy(); p.glow.destroy(); }
    }
    this.runPickups = this.runPickups.filter((p) => !p.dead);
    this.stepSalt(dt);
  },

  armSalt() {
    this.weapon = { ammo: SALT.ammo, t: SALT.time, cd: 0 };
    Audio.sfx('powerup');
    this.popup('SALT SHOTGUN!', '#ffffff');
    this.addCombo('power', PLAYER_X + 40, this.py - 40);
    this.events.emit('power', { kind: 'salt', left: 1 });
  },

  // aims at the nearest target ahead and fires on its own: you only steer
  stepSalt(dt) {
    for (const p of this.pellets) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    this.pellets = this.pellets.filter((p) => p.life > 0 && !p.dead);
    this.collidePellets();
    const wp = this.weapon;
    if (!wp || this.dead) return;
    wp.t -= dt; wp.cd -= dt;
    if (!this.power) this.events.emit('power', { kind: 'salt', left: Math.max(0, Math.min(wp.t / SALT.time, wp.ammo / SALT.ammo)) });
    if (wp.t <= 0 || wp.ammo <= 0) {
      this.weapon = null;
      this.events.emit('power', null);
      Audio.sfx('powerdown');
      this.popup('OUT OF SALT', '#c8c8d8');
      this.nextSaltX = this.worldX + this.rand.range(240, 380) * PX_PER_METER;
      return;
    }
    if (wp.cd > 0) return;
    const mx = PLAYER_X + 12, my = this.py - 2;
    let best = null, bestD = SALT.range;
    const consider = (cx, cy) => { const d = Math.hypot(cx - mx, cy - my); if (cx > mx && d < bestD) { bestD = d; best = { cx, cy }; } };
    for (const t of this.traps) if (t.hp > 0 && !t.gone) consider(this.sx(t.wx) + t.w / 2, FLOOR - t.h / 2);
    for (const b of this.banshees) consider(b.x - 6, b.y);
    if (!best) return;
    const a = Math.atan2(best.cy - my, best.cx - mx);
    for (const s of [-0.12, 0, 0.12]) this.pellets.push({ x: mx, y: my, vx: Math.cos(a + s) * SALT.speed, vy: Math.sin(a + s) * SALT.speed, life: SALT.range / SALT.speed + 0.05 });
    wp.cd = SALT.cd; wp.ammo--;
    Audio.sfx('salt');
    this.burst(mx + 6, my, 0xffffff, 3, 12, 150, 2);
  },

  collidePellets() {
    for (const p of this.pellets) {
      for (const t of this.traps) {
        if (!(t.hp > 0) || t.gone) continue;
        const x = this.sx(t.wx);
        if (p.x > x && p.x < x + t.w && p.y > FLOOR - t.h - 4 && p.y < FLOOR) {
          p.dead = true; t.hp--;
          if (t.s) this.tweens.add({ targets: t.s, alpha: 0.4, duration: 40, yoyo: true });
          if (t.hp <= 0) this.smash(t, x);
          break;
        }
      }
      if (p.dead) continue;
      // banshees don't die: salt knocks them back (some monsters you only shove away)
      for (const b of this.banshees) {
        if (Math.hypot(p.x - (b.x - 6), p.y - b.y) < 18) {
          p.dead = true; b.x += 26; b.vx *= 0.82;
          this.burst(b.x - 10, b.y, 0xcfe0ff, 4, 16, 200, 2);
          if (!b.salted) { b.salted = true; this.addCombo('near', b.x, b.y - 20); }
          break;
        }
      }
    }
  },

  smash(t, x) {
    const cx = x + t.w / 2, cy = FLOOR - t.h / 2;
    this.burst(cx, cy, t.kind === 'crate' ? 0xb07a3a : 0xc8ffc0, 12, 36, 420);
    this.kills++;
    this.gap = Math.min(RUN.MAX_GAP, this.gap + RUN.KILL);
    // monsters go poof into candles
    const n = t.kind === 'ghoul' ? 3 : 2;
    for (let i = 0; i < n; i++) this.addCandle(cx - 14 + i * 14, cy - 10 - i * 8);
    if (t.kind === 'ghoul') { Audio.sfx('ghoul'); this.tracker?.add('ghouls', 1); this.popup('POOF!', '#c8ffc0', cy - 30); }
    else { Audio.sfx('bounce'); this.popup('SMASH!', '#ffd0a0', cy - 30); }
    this.addCombo(t.kind === 'ghoul' ? 'ghoul' : 'splat', cx, cy - 40);
    this.dropTrap(t);
  },

  // ---------------- ground collisions ----------------
  miloBox() {
    const sliding = this.slide > 0;
    const top = sliding ? (this.grounded ? this.py + 4 : this.py - 4) : this.py - 14;
    return { l: PLAYER_X - 7, r: PLAYER_X + 7, t: top, b: this.py + 16 };
  },

  runnerCollide() {
    const px = PLAYER_X, py = this.py;
    for (const c of this.candles) if (!c.dead && Math.hypot(c.x - px, c.y - py) < 24) this.collect(c);
    if (this.invuln > 0) return;
    const m = this.miloBox();
    const hits = (l, r, t, b) => m.r > l && m.l < r && m.b > t && m.t < b;
    for (const t of this.traps) {
      if (t.hit || t.gone) continue;
      const x = this.sx(t.wx);
      let hit = false;
      if (t.kind === 'grave') hit = hits(x + 4, x + t.w - 4, FLOOR - t.h + 6, FLOOR);
      else if (t.kind === 'crate') hit = hits(x + 3, x + t.w - 3, FLOOR - t.h + 3, FLOOR);
      else if (t.kind === 'hand') hit = t.state !== 'wait' && hits(x - 9, x + 9, t.y + 6, FLOOR);
      else if (t.kind === 'beam') hit = hits(x - 5, x + 5, CEIL, BEAM_END + 4);
      else if (t.kind === 'ghoul') hit = hits(x - 8, x + 8, FLOOR - 28, FLOOR);
      if (hit) { t.hit = true; this.stumble(t.kind); return; }
    }
    for (const s of this.swings) {
      if (!s.ground || s.hx === undefined || s.hitDone) continue;
      const nx = Phaser.Math.Clamp(s.hx, m.l, m.r), ny = Phaser.Math.Clamp(s.hy, m.t, m.b);
      if (Math.hypot(s.hx - nx, s.hy - ny) < s.info.r - 2) { s.hitDone = true; this.stumble('swing'); return; }
    }
  },

  // ---------------- second chance / clearing ----------------
  clearAround(range = 280) {
    Features.clearAround.call(this, range);
    const clearX = PLAYER_X + range;
    for (const t of this.traps) {
      if (t.kind === 'chasm') continue;
      const x = this.sx(t.wx);
      if (x < clearX && x > -60) { this.burst(x + t.w / 2, FLOOR - 16, 0x9fb8e8, 8, 30, 400); this.dropTrap(t); }
    }
    this.traps = this.traps.filter((t) => !t.gone);
  },

  revive() {
    this.dead = false; this.ended = false;
    this.speed = this.deathSpeed;
    this.py = BOTTOM; this.prevPy = this.py; this.vy = 0; this.grounded = true;
    this.spin = 0; this.invuln = 2.5; this.player.rotation = 0;
    this.flying = false; this.flyKind = '';
    this.gap = RUN.START_GAP; this.gapVis = -30; this.crEnter = 0;
    this.stretch.play('stretch_walk');
    this.clearAround(500);
    if (this.chasm) { this.dropTrap(this.chasm); this.chasm = null; }
    this.nextTrapX = this.worldX + this.speed * 1.2;
    this.ghost.setAlpha(0.92); this.ghostGlow.setAlpha(0.35);
    this.ghostX = PLAYER_X - 4; this.ghostY = -40;
    Audio.duck(false); Audio.sfx('rebirth');
    this.flash(200, 160, 200, 255);
    this.popup('SECOND CHANCE!', '#ffd75e');
    this.tracker?.add('revives', 1);
  },

  // ---------------- drawing ----------------
  renderRunner(lead, py) {
    // pits and the flight-section chasm: holes in the floor band
    const pg = this.pitGfx;
    pg.clear();
    const tg = this.trapGfx;
    tg.clear();
    for (const t of this.traps) {
      if (t.gone) continue;
      const x = Math.round(this.sx(t.wx) - lead);
      if (t.kind === 'pit' || t.kind === 'chasm') {
        pg.fillStyle(0x07060d, 1); pg.fillRect(x, FLOOR - 1, t.w, H - FLOOR + 1);
        pg.fillStyle(0x140f24, 1);
        for (let i = 0; i < t.w; i += 6) pg.fillRect(x + i, FLOOR - 1, 3, ((i + t.seed) % 3) + 2); // crumbling lip
        pg.fillStyle(0x0b0918, 1); pg.fillRect(x - 2, FLOOR - 1, 2, H - FLOOR + 1); pg.fillRect(x + t.w, FLOOR - 1, 2, H - FLOOR + 1);
        if (t.kind === 'chasm') { // a far ledge you can see, so you know Boo will get you there
          pg.fillStyle(0x8f7fbf, 0.5); pg.fillRect(x + t.w, FLOOR - 1, 3, 10);
        }
        continue;
      }
      if (t.kind === 'beam') {
        const flick = Math.random() < 0.5 ? 0 : 2;
        tg.lineStyle(14 + flick, this.hz.glow, 0.25); tg.lineBetween(x, CEIL - 4, x, BEAM_END);
        tg.lineStyle(6, this.hz.core, 0.9); tg.lineBetween(x, CEIL - 4, x, BEAM_END);
        t.nodes[0].setPosition(x, BEAM_END); t.glow.setPosition(x, BEAM_END);
        continue;
      }
      if (t.kind === 'hand') { t.s.setPosition(x, t.y); continue; }
      if (t.kind === 'ghoul') { t.s.setPosition(x + t.w / 2, FLOOR - 15 + Math.sin(this.clock * 12 + t.wx) * 1.5); continue; }
      if (t.s) t.s.setPosition(x, FLOOR);
    }
    for (const p of this.runPickups) {
      const x = this.sx(p.wx) - lead;
      p.s.setPosition(x, p.y); p.glow.setPosition(x, p.y);
    }
    // salt pellets
    const sg = this.shotGfx;
    sg.clear();
    sg.fillStyle(0xf4f4ff, 1);
    for (const p of this.pellets) sg.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 3);

    // Milo's pose: slide = lean back low, jump = the fly frame
    if (!this.dead && !this.flying) {
      const sliding = this.slide > 0 && this.grounded;
      const key = this.grounded && !sliding ? `${this.char.id}_run` : `${this.char.id}_flyA`;
      if (this.player.anims.currentAnim?.key !== key) this.player.play(key);
      this.player.rotation = sliding ? -1.25 : this.grounded ? 0 : Phaser.Math.Clamp(this.vy / 2400, -0.2, 0.25);
      this.player.setPosition(PLAYER_X, sliding ? FLOOR - 12 : py);
    }
    this.gunImg.setVisible(!!this.weapon && !this.dead)
      .setPosition(PLAYER_X + 12, (this.slide > 0 && this.grounded ? FLOOR - 14 : py + 2));

    this.renderStretch();
  },

  renderStretch() {
    const s = this.stretch;
    if (this.flying) {
      // it can't follow: it jumps and reaches up with its long arms, then falls behind
      const t = this.crFlyT;
      const x = this.crFlyX + Math.min(t, 0.4) * 60 - Math.max(0, t - 1.1) * 220;
      const hop = t < 1.1 ? Math.abs(Math.sin(t * Math.PI / 0.55)) * 46 : 0;
      s.setPosition(x, FLOOR + 2 - hop).setVisible(x > -40);
      return;
    }
    const near = 1 - this.light;
    const fast = this.catchUpT > 0 || this.clock - this.lastStumble < 1.2 || near > 0.6 || this.dead;
    const want = fast ? 'stretch_crawl' : 'stretch_walk';
    if (!this.dead || this.caughtBy) { if (s.anims.currentAnim?.key !== want) s.play(want); }
    const target = PLAYER_X - this.gapVis;
    const enter = Phaser.Math.Easing.Cubic.Out(this.crEnter);
    const x = Phaser.Math.Linear(-50, target, enter);
    s.setVisible(true).setPosition(Math.round(fast ? x + 8 : x), FLOOR + 2 + (fast ? 0 : Math.sin(this.clock * 14) * 1.5));
    s.setScale(2, fast ? 2 : 2 + Math.sin(this.clock * 7) * 0.04); // a slight, wrong breathing stretch
  },
};

// short prompts for the run (input.js keeps the menu prompts)
function prompt2(action) {
  const d = Device.get();
  if (action === 'jump') return d === 'touch' ? 'TAP' : d === 'gamepad' ? 'A' : d === 'mouse' ? 'CLICK' : 'SPACE';
  return d === 'touch' ? 'SWIPE DOWN' : d === 'gamepad' ? 'B' : 'DOWN';
}
