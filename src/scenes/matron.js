// v8 world 1 boss, rebuilt: THE NIGHT MATRON (Sister Agathe) in three acts, in a building taller than the screen.
// Its methods are mixed into BossScene at init (boss.js), so the input, pause, retry and give-up stay shared.
//
//   ACT 1  Ward 4.          Teaches the fight: she CHARGES (jump over / dodge through) and slams the wall = GOLD,
//                           then CURTAIN sweeps (jump, or stand on a bed). Beds are low platforms.
//   ACT 2  The ward below.  The floor gives way; the beds fall with you and become platforms on three heights.
//                           New: she climbs the old rail and DROPS on the spot you stand on (move off it).
//   ACT 3  The stairwell.   She bursts through the wall and climbs; the camera follows you up 12 landings.
//                           New: she shoves GURNEYS down the stairs (jump them). Hit her and she flees higher
//                           and kills the lamps: only your light and the Penlight burn through the dark.
//   Every act ends the same way: she CRACKS and kneels, and only Ivy's PENLIGHT finishes the act.
//
// Where the ideas come from:
//   Cuphead: the arena changes between phases; one new threat per phase, later phases combine old ones;
//            a perfect dodge charges the super (the Penlight); lose = how close you were.
//   Hollow Knight: a room taller than the screen with a camera that looks ahead; a boss that staggers
//            into a punish window (False Knight slams the wall); she retreats upward when you hurt her.
//   Donkey Kong: gurneys zig-zag down the landings, every one jumpable.
//   Celeste / Hollow Knight: coyote time, jump buffer, short hops; retry starts at the act you reached.
//   Zelda (light arrows on Ganon): the final blow of each act is the light, not the sword.
// Colors: red = it hurts, gold = hit her now, pale blue = magic light (your lantern, the Penlight, Boo).
import { W, H } from '../data.js';
import { Audio } from '../audio.js';
import { text } from '../ui.js';
import { Device } from '../input.js';
import { MILO_SCALE, MOVE, GRAV, DODGE_T, HEARTS, POWER_BTN } from './boss.js';

const MILO_W = 18, MILO_H = 44;
const ACCEL = 1700, AIR_ACCEL = 1100, JUMP_V = 575, JUMP_CUT = 0.45, COYOTE = 0.1, BUFFER = 0.14;
const DODGE_V = 470, DODGE_CD = 0.55;
const HIT_T = 0.13, HIT_CD = 0.3, HIT_RANGE = 46;
const HURT_INV = 1.1, KNOCK = 250;
const RED = 0xff2244, GOLD = 0xffd75e, BLUE = 0xbfe4ff, INK = 0x150c22;

// the building (world px, y down)
const F1 = 1000, F2 = 1360;            // Ward 4's floor, the ward below's floor
const C1 = F1 - 290, C2 = F1 + 18;     // their ceilings
const WL = 24, WR = 876;               // inside the ward walls
const SL = 932, SR = 1540;             // inside the stairwell
const LAND = 84, TOP = 12;             // landings 84 px apart (a jump is 92), 12 of them
const landY = (k) => F2 - k * LAND;
const landSpan = (k) => (k === 0 ? [SL, SR] : k % 2 ? [SL + 96, SR] : [SL, SR - 96]);
const home = (k) => (k % 2 ? SR - 120 : SL + 120); // where she stands on a landing (the open end is the other way)
const RAIL1 = C1 + 40, RAIL2 = C2 + 52;
const BEDS1 = [170, 360, 540, 730];
const BEDS2 = [[140, F2], [300, F2 - 27], [470, F2], [640, F2 - 27]]; // where Ward 4's beds land
const OLD_BEDS = [[300, F2], [640, F2], [790, F2]];                     // the beds that were already down there
const SLAB = { l: 384, r: 556, y: F2 - 122 };                          // a piece of Ward 4's floor caught on the pipes
const MOON = { x: SL + 190, y: landY(TOP) - 150 };
const BED_TOP = 20;
const BW = 40, BH = 75, ROLL_H = 44, SC = 2.9;
const ACT_TOP = [0, 30, 20, 10];       // her health at the start of each act (30 = full)
const ACT_END = [0, 20, 10, 0];
const FLEE_AT = [7, 4];                // act 3: she runs higher up the stairs at these
const SPEED = { roll: [0, 380, 430, 460], curtain: [0, 360, 400, 380], idle: [0, 0.75, 0.6, 0.55] };
const NONE = { left: false, right: false, jumpHeld: false, jump: false, dodge: false, dodgeDir: 0, power: false, cancelJump: false };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, k) => a + (b - a) * k;
const overlap = (a, b) => a.r > b.l && a.l < b.r && a.b > b.t && a.t < b.b;
const rnd = (a, b) => a + Math.random() * (b - a);

export const MATRON_FIGHT = {
  mInit(data) {
    this.phase = [1, 2, 3].includes(data.phase) ? data.phase : 1;
    this.hp = ACT_TOP[this.phase];
    this.parts = []; this.cracks = []; this.gurneys = []; this.toSpawn = []; this.curtain = null; this.curtainSpec = null;
    this.grey = 0; this.greyWant = 0; this.slow = 1; this.flashW = 0; this.floorCrack = 0;
    this.floorBroken = this.phase >= 2; this.wallBroken = this.phase >= 3; this.walkIn = false;
    this.area = this.phase === 1 ? 'ward4' : this.phase === 2 ? 'below' : 'stair';
    this.ground = null; this.dropT = 0; this.dropFrom = null; this.airT = 0; this.booY = 0;
    this.bvy = 0; this.bsurf = null; this.leap = null; this.dropTarget = null; this.leapTarget = null;
    this.kb = 3; this.fleeTo = 3; this.fleeDark = false; this.crackPending = false; this.tr = null; this.beam = null;
    this.diveRoll = false; this.grazed = new WeakSet(); this.bedFall = null; this.roomDirty = true; this.camInit = false;
    this.darkWant = this.phase === 2 ? 0.28 : 0; this.dark = this.darkWant;
    this.charge = 0.35; this.lineHint = '';
    for (let i = 0; i < (this.phase - 1) * 5; i++) this.addCrack(); // the cracks of the acts she already lost
    this.mPlace();
  },

  // where everyone stands when an act starts (also after TRY AGAIN)
  mPlace() {
    const p = this.phase;
    if (p === 1) { this.x = 150; this.y = F1; this.bx = 700; this.by = F1; this.room = { l: WL, r: WR }; this.queue = ['roll', 'curtain']; }
    if (p === 2) { this.x = 210; this.y = F2; this.bx = 720; this.by = F2; this.room = { l: WL, r: WR }; this.queue = ['dive', 'roll']; }
    if (p === 3) { this.x = SL + 70; this.y = F2; this.kb = 3; this.bx = home(3); this.by = landY(3); this.room = { l: SL, r: SR }; this.queue = ['gurney', 'dive']; }
    this.face = 1; this.bDir = -1; this.vx = 0; this.vy = 0; this.bstate = 'idle'; this.bt = 1.0;
    this.mBuild();
    this.ground = this.surfAt(this.x, this.y); this.grounded = !!this.ground;
    this.bsurf = this.surfAt(this.bx, this.by);
  },

  // what can be stood on, for the part of the building we're in
  mBuild() {
    const s = [];
    if (this.area === 'ward4') {
      s.push({ l: WL, r: WR, y: F1, solid: true });
      for (const x of BEDS1) s.push({ l: x - 33, r: x + 33, y: F1 - BED_TOP, bed: true });
    } else if (this.area === 'below') {
      s.push({ l: WL, r: this.wallBroken ? SR : WR, y: F2, solid: true, k: 0 });
      for (const [x, y] of [[140, F2], [300, F2 - 27], [470, F2], [640, F2 - 27], [790, F2]]) s.push({ l: x - 33, r: x + 33, y: y - BED_TOP, bed: true });
      s.push({ ...SLAB });
    } else {
      s.push({ l: SL, r: SR, y: F2, solid: true, k: 0 });
      for (let k = 1; k <= TOP; k++) { const [l, r] = landSpan(k); s.push({ l, r, y: landY(k), k }); }
    }
    this.surfs = s;
    const same = (a) => a && s.find((b) => b.y === a.y && b.l === a.l && b.r === a.r);
    if (this.ground) { this.ground = same(this.ground); if (!this.ground) this.grounded = false; }
    if (this.bsurf) this.bsurf = same(this.bsurf) || this.surfUnder(this.bx, this.by - 2);
  },
  surfAt(x, y) { return this.surfs.find((s) => x >= s.l - 2 && x <= s.r + 2 && Math.abs(s.y - y) < 2) || null; },
  surfUnder(x, y) { // the highest thing to stand on at x, at or below y
    let best = null;
    for (const s of this.surfs) if (x >= s.l - 2 && x <= s.r + 2 && s.y >= y - 1 && (!best || s.y < best.y)) best = s;
    return best || this.surfs[0];
  },
  floorSurf() { return this.surfs[0]; },
  landingOf(y) { return clamp(Math.round((F2 - y) / LAND), 0, TOP); },
  miloLanding() { return this.area === 'stair' ? this.landingOf(this.grounded ? this.y : this.surfUnder(this.x, this.y).y) : 0; },

  miloBox() { const h = this.dodgeT > 0 ? 20 : MILO_H; return { l: this.x - MILO_W / 2, r: this.x + MILO_W / 2, t: this.y - h, b: this.y }; },
  bossH() {
    const s = this.bstate;
    if (s === 'roll') return ROLL_H;
    if (s === 'cracked' || s === 'sit') return BH * 0.68;
    if (this.isOpen()) return BH * 0.8;
    return BH;
  },
  bossBox() { const h = this.bossH(); return { l: this.bx - BW / 2, r: this.bx + BW / 2, t: this.by - h, b: this.by }; },
  bossCenter() { return { x: this.bx, y: this.by - this.bossH() / 2 }; },
  isOpen() { return ['check', 'wallStun', 'stuck', 'stunned'].includes(this.bstate); },
  unseen() { return false; },

  // ---------------- scene objects ----------------
  create() {
    this.setupCommon();
    const sf0 = (o) => o.setScrollFactor(0);
    this.roomG = this.add.graphics().setVisible(false);
    this.roomImg = this.add.image(0, 0, '__WHITE').setOrigin(0).setDepth(1).setVisible(false);
    this.decoG = this.add.graphics().setDepth(1.5);
    this.bedImgs = [...OLD_BEDS, ...BEDS1.map((x) => [x, F1])].map(([x, y]) => this.add.image(x, y + 1, 'bed').setOrigin(0.5, 1).setScale(3).setDepth(3));
    if (this.floorBroken) BEDS2.forEach(([x, y], i) => this.bedImgs[3 + i].setPosition(x, y + 1));
    this.hazG = this.add.graphics().setDepth(5);
    this.boss = this.add.image(this.bx, this.by, 'matron').setOrigin(0.5, 1).setScale(SC).setDepth(6);
    this.crackG = this.add.graphics().setDepth(6.1);
    this.milo = this.add.sprite(this.x, this.y, `${this.char}_run0`).setOrigin(0.5, 1).setScale(MILO_SCALE).setDepth(7);
    this.boo = this.add.image(0, 0, 'ghost0').setScale(2.4).setDepth(7.5).setVisible(false);
    this.fx = this.add.graphics().setDepth(8);
    this.darkG = sf0(this.add.graphics().setDepth(9));
    this.glowG = this.add.graphics().setDepth(9.2).setBlendMode(Phaser.BlendModes.ADD);
    this.partG = this.add.graphics().setDepth(9.25);
    this.bossEyes = this.add.image(0, 0, 'matron_eyes').setScale(SC).setDepth(9.3).setVisible(false);
    this.greyG = sf0(this.add.graphics().setDepth(9.5));
    this.ui = sf0(this.add.graphics().setDepth(20));
    const T = (x, y, s, size, col, st = 0) => { const o = sf0(text(this, x, y, s, size, col).setDepth(21)); if (st) o.setStroke('#07060d', st); return o; };
    this.nameText = T(W / 2, 10, this.def.name, 8, '#d9d0a8');
    this.lineText = T(W / 2, 58, '', 12, '#e6f0ff', 5);
    this.noteText = T(W / 2, 84, '', 8, '#a99fd0', 4);
    this.bigText = T(W / 2, 130, '', 16, '#e6f0ff', 6);
    this.subText = T(W / 2, 160, '', 10, '#a99fd0', 4);
    this.powerLabel = T(POWER_BTN.x, POWER_BTN.y, 'LIGHT', 6, '#10233a').setDepth(22).setVisible(false);
    this.promptText = T(W / 2, 108, '', 12, '#ffd75e', 5);
    this.bangText = text(this, 0, 0, '!', 16, '#ff5a3a').setDepth(21).setStroke('#07060d', 5).setVisible(false);
    this.retryText = T(W / 2 - 90, 250, 'TRY AGAIN', 10, '#07060d').setDepth(23).setVisible(false);
    this.quitText = T(W / 2 + 90, 250, 'GIVE UP', 10, '#e6f0ff').setDepth(23).setVisible(false);
    this.pauseText = T(W / 2, H / 2, 'PAUSED', 16, '#e6f0ff', 6).setDepth(30).setVisible(false);
    this.actText = T(W / 2, 40, ['', 'I. WARD 4', 'II. THE WARD BELOW', 'III. THE STAIRS'][this.phase], 8, '#bfe4ff', 4).setAlpha(0);
    this.touch = Device.get() === 'touch';
    this.bindTouch();
    this.mCamera(1, true);
    this.cameras.main.fadeIn(350, 7, 6, 13);
    Audio.sfx('sting');
    this.talk(this.phase === 1 ? this.def.lines.start : this.phase === 2 ? this.def.lines.p2 : this.def.lines.p3, 2.0);
    this.actT = 2.4;
    window.__boss = this;
  },

  // ---------------- simulation ----------------
  step(dt0) {
    this.say.t = Math.max(0, this.say.t - dt0);
    this.prompt.t = Math.max(0, this.prompt.t - dt0); this.bangT = Math.max(0, this.bangT - dt0);
    this.trauma = Math.max(0, this.trauma - dt0 * 2.2);
    this.redEdge = Math.max(0, this.redEdge - dt0 * 2.5);
    this.flashW = Math.max(0, this.flashW - dt0 * 2.5);
    this.actT = Math.max(0, (this.actT || 0) - dt0);
    this.t += dt0;
    this.grey += (this.greyWant - this.grey) * Math.min(1, dt0 * 3);
    const dt = dt0 * this.slow;
    this.mStepParts(dt);
    if (this.state === 'intro') {
      this.introT += dt0;
      if (this.introT > 1.6) { this.state = 'fight'; this.note(this.hint(), 4.5); }
      return;
    }
    if (this.state === 'won' || this.state === 'lost') { this.stepEnd(dt0); return; }
    if (this.freeze > 0) { this.freeze -= dt0; return; } // hit-stop
    this.dark += (this.darkWant - this.dark) * Math.min(1, dt * 4);
    if (this.state === 'trans') { this.flashB = Math.max(0, this.flashB - dt0); this.tr.t += dt0; this.mStepTrans(dt); return; }
    this.stats.time += dt;
    if (this.noteUntil && this.t > this.noteUntil) { this.noteText.setText(''); this.noteUntil = 0; }
    this.mStepMilo(dt, true);
    this.mStepBoss(dt);
    this.mStepHazards(dt);
    if (this.walkIn && this.x > SL + 24) this.mStartAct3();
  },

  mStepMilo(dt, ctrl) {
    const a = ctrl ? this.act : NONE;
    this.inv = Math.max(0, this.inv - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.hitCd = Math.max(0, this.hitCd - dt);
    this.dropT = Math.max(0, this.dropT - dt);
    if (this.booT > 0) { // Boo lifts Milo out of the way
      this.booT -= dt;
      this.x += (this.booX - this.x) * Math.min(1, dt * 4); this.y += (this.booY - this.y) * Math.min(1, dt * 4);
      this.vx = 0; this.vy = 0;
      if (this.booT <= 0) { this.grounded = false; this.ground = null; }
      return;
    }
    const dir = (a.right ? 1 : 0) - (a.left ? 1 : 0);
    if (dir && this.dodgeT <= 0) this.face = dir;
    if (a.dodge && this.dodgeCd <= 0 && this.dodgeT <= 0) {
      const onPlat = this.grounded && this.ground && !this.ground.solid;
      if (onPlat && !a.dodgeDir && !dir) { // a dodge in place on a bed or a landing = drop through it
        this.dropFrom = this.ground; this.dropT = 0.25; this.grounded = false; this.ground = null; this.vy = 140;
        this.dodgeT = 0.2; this.dodgeDir = 0; this.dodgeCd = 0.45;
      } else {
        this.dodgeT = DODGE_T; this.dodgeCd = DODGE_CD + DODGE_T; this.dodgeDir = a.dodgeDir || dir || this.face; this.face = this.dodgeDir;
        if (a.cancelJump && !this.grounded && this.vy < 0 && this.airT < 0.15) this.vy = Math.max(this.vy, -60); // a swipe that began as a tap stays a roll
      }
      this.stats.dodges++; Audio.sfx('slide');
    }
    if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      this.vx = this.dodgeDir * DODGE_V;
      if (!this.grounded && this.dodgeDir) this.vy = Math.min(this.vy, 60); // an air dodge holds you up a little
    } else {
      const acc = this.grounded ? ACCEL : AIR_ACCEL;
      this.vx += clamp(dir * MOVE - this.vx, -acc * dt, acc * dt);
    }
    this.buffer = a.jump ? BUFFER : Math.max(0, this.buffer - dt);
    this.coyote = this.grounded ? COYOTE : Math.max(0, this.coyote - dt);
    if (this.buffer > 0 && this.coyote > 0 && this.dodgeT <= 0) {
      this.vy = -JUMP_V; this.grounded = false; this.ground = null; this.buffer = 0; this.coyote = 0; this.airT = 0; Audio.sfx('jump');
    }
    if (!a.jumpHeld && this.vy < 0 && !this.grounded) this.vy *= Math.pow(JUMP_CUT, dt * 20);
    this.x = clamp(this.x + this.vx * dt, this.room.l + MILO_W / 2, this.room.r - MILO_W / 2);
    this.mFall(dt);
    // the lantern swings by itself when she's GOLD and in reach
    if (this.power) this.charge = Math.min(1, this.charge + dt / 24);
    if (this.charge >= 1 && !this.taught.has('ready') && this.bstate !== 'cracked') {
      this.taught.add('ready'); this.prompt = { text: `YOUR LIGHT IS READY: ${this.lightKey()}`, t: 2.4 };
    }
    if (ctrl && this.isOpen() && this.hitCd <= 0 && this.dodgeT <= 0) {
      const m = this.miloBox(), reach = { l: this.x - HIT_RANGE, r: this.x + HIT_RANGE, t: m.t - 16, b: m.b + 10 };
      if (overlap(reach, this.bossBox())) {
        this.face = Math.sign(this.bx - this.x) || this.face;
        this.hitT = HIT_T; this.hitCd = HIT_CD; this.hitDone = false; Audio.sfx('swoosh');
      }
    }
    if (this.hitT > 0) {
      this.hitT -= dt;
      const k = 1 - this.hitT / HIT_T, ang = (this.face > 0 ? -1.2 : Math.PI + 1.2) + this.face * 2.4 * k;
      for (let i = 0; i < 3; i++) this.part('ember', this.x + Math.cos(ang) * HIT_RANGE * rnd(0.6, 1), this.y - 26 + Math.sin(ang) * HIT_RANGE * rnd(0.6, 1), rnd(-30, 30), rnd(-60, -10));
      if (!this.hitDone) {
        const m = this.miloBox();
        const hb = this.face > 0 ? { l: this.x, r: this.x + HIT_RANGE, t: m.t - 16, b: m.b + 10 } : { l: this.x - HIT_RANGE, r: this.x, t: m.t - 16, b: m.b + 10 };
        if (overlap(hb, this.bossBox()) && this.isOpen()) { this.hitDone = true; this.damageBoss(); }
      }
    }
    if (this.beam) { this.beam.t -= dt; if (this.beam.t <= 0) this.beam = null; }
    if (a.power) this.usePower();
  },

  // gravity, one-way beds and landings, the floor
  mFall(dt) {
    if (this.grounded && this.ground && (this.x < this.ground.l - 3 || this.x > this.ground.r + 3)) { this.grounded = false; this.ground = null; }
    if (this.grounded) { this.airT = 0; return; }
    this.airT += dt;
    this.vy = Math.min(this.vy + GRAV * dt, 900);
    const prev = this.y;
    this.y += this.vy * dt;
    if (this.vy < 0) return;
    let best = null;
    for (const s of this.surfs) {
      if (s === this.dropFrom && this.dropT > 0) continue;
      if (this.x >= s.l - 2 && this.x <= s.r + 2 && prev <= s.y + 0.5 && this.y >= s.y && (!best || s.y < best.y)) best = s;
    }
    if (best) {
      if (this.vy > 520) { this.dust(this.x, best.y, 4); if (this.vy > 700) this.trauma = Math.max(this.trauma, 0.25); }
      this.y = best.y; this.vy = 0; this.grounded = true; this.ground = best; this.dropFrom = null;
    }
  },

  lightKey() { return this.touch ? 'TAP LIGHT' : Device.get() === 'gamepad' ? 'X' : 'E'; },

  usePower() {
    if (!this.power || this.charge < 1 || this.state !== 'fight') return;
    const c = this.bossCenter(), mx = this.x, my = this.y - 26, d = Math.hypot(c.x - mx, c.y - my);
    if (this.bstate === 'cracked' && d > 420) { this.prompt = { text: 'GET CLOSER', t: 1.2 }; return; }
    this.charge = 0; this.stats.lights++;
    const ang = d < 580 ? Math.atan2(c.y - my, c.x - mx) : (this.face > 0 ? 0 : Math.PI);
    this.beam = { t: 0.6, ang, x: mx, y: my, len: 560 };
    this.face = Math.cos(ang) >= 0 ? 1 : -1;
    this.trauma = Math.max(this.trauma, 0.35); this.freeze = 0.05;
    Audio.sfx('holy');
    this.darkWant = this.area === 'below' ? 0.28 : 0; // the light burns the dark away
    if (d >= 580) return;
    if (this.bstate === 'cracked') { this.mStartTrans(); return; }
    if (!this.isOpen() && this.bstate !== 'flee' && this.bstate !== 'perch') {
      this.ashHazards();
      this.bstate = 'stunned'; this.bt = 2.2; this.checkHits = 0; this.flashB = 0.25; this.leap = null;
      this.talk(this.def.lines.stun, 1.0);
    }
  },

  damageBoss() {
    const bright = this.bstate === 'stunned';
    const before = this.hp, floor = ACT_END[this.phase];
    this.hp = Math.max(floor, this.hp - (bright ? 2 : 1));
    this.checkHits++; this.stats.hits++;
    this.flashB = 0.12; this.freeze = bright ? 0.08 : 0.06; this.trauma = Math.max(this.trauma, bright ? 0.45 : 0.32);
    this.addCrack(); if (bright) this.addCrack();
    const c = this.bossCenter(), hx = c.x - this.face * 10;
    for (let i = 0; i < 7; i++) this.part('shard', hx, c.y + rnd(-14, 10), this.face * rnd(60, 220), rnd(-260, -60));
    for (let i = 0; i < 9; i++) this.part('ink', hx, c.y + rnd(-10, 10), this.face * rnd(20, 160), rnd(-160, 40));
    this.bx = clamp(this.bx + this.face * 4, this.room.l + BW / 2, this.room.r - BW / 2);
    Audio.sfx('crack'); if (bright) Audio.sfx('hit');
    if (this.hp <= floor) { this.mCrack(); return; }
    if (this.phase === 3 && FLEE_AT.some((f) => before > f && this.hp <= f)) { this.mFlee(Math.min(TOP, this.kb + 3), true); return; }
    if (this.checkHits >= 3) this.shove();
  },

  // back to her place between attacks: off a bed in act 2, back up to her landing in act 3
  toIdle(bt) {
    if (this.area === 'below' && this.bsurf && !this.bsurf.solid) { this.bstate = 'hop'; this.bvy = -200; return; }
    if (this.area === 'stair' && this.landingOf(this.by) !== this.kb) { this.bstate = 'leapBack'; this.startLeap(home(this.kb), landY(this.kb), 0.5); return; }
    this.bstate = 'idle'; this.bt = bt;
  },

  shove() {
    this.toIdle(0.5); this.flashB = 0.2;
    if (this.dodgeT <= 0) { this.vx = (this.x < this.bx ? -1 : 1) * 340; this.vy = -200; this.grounded = false; this.ground = null; }
    this.talk(this.def.lines.shove, 0.9);
  },

  hurt(fromX, light = false) {
    if (this.inv > 0 || this.booT > 0 || this.state !== 'fight') return false;
    if (!light && this.dodgeT > 0) return false;
    this.cleanAttack = false;
    if (this.hearts === 1 && !this.booUsed) { // Boo comes once a fight, and only when it would end you
      this.booUsed = true; this.booT = 1.0; this.inv = 1.6;
      this.booX = clamp(fromX > this.x ? this.x - 170 : this.x + 170, this.room.l + 30, this.room.r - 30); this.booY = this.y - 50;
      this.talk('GOT YOU.', 1.0); Audio.sfx('boo');
      return true;
    }
    this.hearts--; this.stats.taken++;
    this.inv = HURT_INV; this.redEdge = 1; this.trauma = 0.55; this.freeze = 0.07;
    this.vx = (this.x < fromX ? -1 : 1) * KNOCK; this.vy = -260; this.grounded = false; this.ground = null;
    Audio.sfx('stumble');
    if (this.hearts <= 0) this.lose();
    return true;
  },
  // a dodge right through an attack charges the Penlight (Cuphead's parry, Hollow Knight's soul)
  graze(obj, x, y) {
    if (this.dodgeT <= 0 || this.grazed.has(obj)) return;
    this.grazed.add(obj);
    if (this.power) this.charge = Math.min(1, this.charge + 0.25);
    for (let i = 0; i < 10; i++) this.part('spark', x, y, rnd(-120, 120), rnd(-120, 60));
    Audio.sfx('close');
    if (!this.taught.has('graze')) { this.taught.add('graze'); this.note('DODGING THROUGH CHARGES YOUR LIGHT', 2.5); }
  },
  touchHazard(box, obj, fromX) {
    if (!overlap(this.miloBox(), box)) return;
    if (this.dodgeT > 0) this.graze(obj, this.x, this.y - 20); else this.hurt(fromX);
  },

  // ---------------- her ----------------
  mStepBoss(dt) {
    this.flashB = Math.max(0, this.flashB - dt);
    this.bt -= dt;
    const s = this.bstate, P = this.phase;
    if (!['roll', 'stuck', 'cracked', 'wallStun', 'leap', 'flee', 'drop', 'rail', 'lock'].includes(s) && !this.isOpen()) this.bDir = Math.sign(this.x - this.bx) || this.bDir;
    if (s === 'idle' && this.bt <= 0) this.nextAttack();
    else if (s === 'tellRoll' && this.bt <= 0) { this.bstate = 'roll'; Audio.sfx('drawer'); }
    else if (s === 'roll') {
      this.bx += this.bDir * SPEED.roll[P] * dt;
      if (Math.floor(this.t * 20) % 2) this.dust(this.bx - this.bDir * 18, this.by, 1);
      this.touchHazard(this.bossBox(), this.rollObj, this.bx);
      if (this.bDir * (this.bx - this.rollEnd) >= 0) {
        this.bx = this.rollEnd;
        if (this.rollWall) { // she slams the wall and sees stars (moths): GOLD
          this.bstate = 'wallStun'; this.bt = P === 1 ? 1.8 : 1.5; this.checkHits = 0;
          this.trauma = Math.max(this.trauma, 0.55); this.dust(this.bx + this.bDir * 20, this.by, 10); Audio.sfx('hit');
          this.openTeach();
        } else this.check();
      }
    } else if (s === 'tellCurtain' && this.bt <= 0) { this.spawnCurtain(); this.bstate = 'curtain'; }
    else if (s === 'curtain' && !this.curtain) this.check();
    else if (s === 'rise') { // up to the old rail
      const k = clamp(1 - this.bt / 0.35, 0, 1);
      this.by = lerp(this.riseFrom, RAIL2 + 80, 1 - Math.pow(1 - k, 3));
      if (this.bt <= 0) { this.bstate = 'rail'; this.bt = 0.75; }
    } else if (s === 'rail') {
      const tx = clamp(this.x, WL + 30, WR - 30);
      this.bx += clamp(tx - this.bx, -300 * dt, 300 * dt);
      this.dropTarget = this.surfUnder(this.bx, this.by + 1);
      if (this.bt <= 0) { this.bstate = 'lock'; this.bt = 0.5 * this.slowTell; Audio.sfx('warn'); }
    } else if (s === 'lock' && this.bt <= 0) { this.bstate = 'drop'; this.bvy = 0; }
    else if (s === 'drop') {
      this.bvy += 3400 * dt; this.by += this.bvy * dt;
      this.touchHazard(this.bossBox(), this.dropObj, this.bx);
      if (this.by >= this.dropTarget.y) this.land(this.dropTarget);
    } else if (s === 'tellLeap') {
      if (this.bt > 0.4) { // she watches where you stand, then locks it
        const ms = this.grounded ? this.ground : this.surfUnder(this.x, this.y);
        this.leapTarget = { s: ms, x: clamp(this.x, ms.l + 24, ms.r - 24) };
      } else if (!this.lockedSfx) { this.lockedSfx = true; Audio.sfx('warn'); }
      if (this.bt <= 0) { this.startLeap(this.leapTarget.x, this.leapTarget.s.y, 0.6); this.bstate = 'leap'; }
    } else if (s === 'leap' || s === 'leapBack' || s === 'flee') {
      if (this.leap) {
        const L = this.leap; L.t += dt;
        const k = Math.min(1, L.t / L.T);
        this.bx = lerp(L.x0, L.x1, k); this.by = lerp(L.y0, L.y1, k) - L.h * Math.sin(Math.PI * k);
        if (s === 'leap') this.touchHazard(this.bossBox(), this.dropObj, this.bx);
        if (k >= 1) {
          this.leap = null;
          if (s === 'leap') this.land(this.leapTarget.s);
          else if (s === 'leapBack') { this.bsurf = this.surfAt(this.bx, this.by); this.bstate = 'idle'; this.bt = SPEED.idle[P]; }
          else { this.kb++; this.bsurf = this.surfAt(this.bx, this.by); Audio.sfx('bounce'); }
        }
      } else if (s === 'flee') {
        if (this.kb >= this.fleeTo) this.afterFlee();
        else { const k = this.kb + 1; this.startLeap(home(k), landY(k), 0.3, 40); }
      }
    } else if (s === 'stuck' && this.bt <= 0) this.toIdle(SPEED.idle[P]); else if (s === 'hop') {
      if (this.settle(dt, true)) { this.bstate = this.crackPending ? 'cracked' : 'idle'; this.bt = 0.5; this.crackPending = false; }
    } else if (s === 'tellGurney' && this.bt <= 0) {
      this.bstate = 'gurney'; this.gT = 0;
      this.toSpawn = [0, 1.15, 2.3].slice(0, this.gurneyN);
      if (this.withCurtain) this.spawnCurtain();
    } else if (s === 'gurney') {
      this.gT += dt;
      while (this.toSpawn.length && this.toSpawn[0] <= this.gT) { this.toSpawn.shift(); this.spawnGurney(); }
      if (this.thenLeap && !this.toSpawn.length && this.gT > 0.6) { this.thenLeap = false; this.queue.unshift('dive'); this.bstate = 'idle'; this.bt = 0; } // a gurney, then she jumps at you
      else if (!this.toSpawn.length && this.gT > (this.gurneyN - 1) * 1.15 + 1.0 && !this.curtain) this.check();
    } else if (s === 'stunned') {
      this.settle(dt, false);
      if (this.bt <= 0) this.toIdle(0.45);
    } else if ((s === 'check' || s === 'wallStun') && this.bt <= 0) this.toIdle(SPEED.idle[P]);
    else if (s === 'cracked') this.settle(dt, false);
  },

  // she falls onto whatever is under her (through beds when told to)
  settle(dt, toFloor) {
    const target = toFloor ? this.floorSurf() : this.surfUnder(this.bx, this.by - 1);
    if (this.by >= target.y - 0.5) { this.by = target.y; this.bsurf = target; this.bvy = 0; return true; }
    this.bvy += GRAV * dt; this.by = Math.min(target.y, this.by + this.bvy * dt);
    if (this.by >= target.y) { this.bsurf = target; this.bvy = 0; this.dust(this.bx, this.by, 4); if (this.area === 'stair') this.kb = this.landingOf(this.by); return true; }
    return false;
  },

  startLeap(x1, y1, T, h = 80) { this.leap = { x0: this.bx, y0: this.by, x1, y1, t: 0, T, h }; this.bDir = Math.sign(x1 - this.bx) || this.bDir; Audio.sfx('swoosh'); },

  land(s) {
    this.by = s.y; this.bsurf = s; this.bvy = 0;
    this.trauma = Math.max(this.trauma, 0.6); Audio.sfx('hit');
    this.dust(this.bx - 20, s.y, 6); this.dust(this.bx + 20, s.y, 6);
    // the impact: everything on that surface within reach
    if (this.grounded && this.ground === s && Math.abs(this.x - this.bx) < 52) this.touchHazard(this.miloBox(), this.dropObj, this.bx);
    if (this.diveRoll && s.solid) { this.diveRoll = false; this.startRoll(0.45); return; }
    this.bstate = 'stuck'; this.bt = 1.5; this.checkHits = 0;
    this.openTeach();
  },

  startRoll(tell) {
    const s = this.bsurf || this.floorSurf();
    this.bDir = Math.sign(this.x - this.bx) || -this.bDir || 1;
    this.rollEnd = this.bDir > 0 ? s.r - 22 : s.l + 22;
    this.rollWall = this.bDir > 0 ? s.r >= this.room.r - 1 : s.l <= this.room.l + 1;
    this.rollObj = {};
    this.bstate = 'tellRoll'; this.bt = tell * this.teach('roll', 'SHE CHARGES. JUMP OVER OR DODGE THROUGH');
    Audio.sfx('creak');
  },

  nextAttack() {
    const P = this.phase;
    if (P === 3) { // you climbed past her: she goes higher first
      const km = this.miloLanding();
      if (km >= this.kb && this.kb < TOP) { this.mFlee(Math.min(TOP, km + 2), false); return; }
    }
    let a = this.queue.shift();
    if (!a) {
      const pool = P === 1 ? ['roll', 'curtain', this.hp <= 25 ? 'curtain2' : 'roll'] : P === 2 ? ['dive', 'roll', 'curtain', 'diveRoll'] : ['gurney', 'dive', 'curtainGurney', 'gurney2', 'gurneyDive'];
      const ok = pool.filter((x) => x !== this.lastAttack);
      a = ok[Math.floor(Math.random() * ok.length)] || pool[0];
    }
    this.lastAttack = a; this.cleanAttack = true; this.dropObj = {}; this.lockedSfx = false;
    if (a === 'roll') this.startRoll([0, 0.75, 0.6, 0.55][P]);
    else if (a === 'curtain' || a === 'curtain2') {
      this.bstate = 'tellCurtain'; this.bt = [0, 0.8, 0.7, 0.65][P] * this.teach('curtain', 'A CURTAIN. JUMP IT, OR STAND ON A BED');
      this.curtainSpec = this.curtainFrom(a === 'curtain2'); Audio.sfx('warn');
    } else if (a === 'dive' || a === 'diveRoll') {
      this.diveRoll = a === 'diveRoll';
      this.slowTell = this.teach('dive', 'SHE DROPS WHERE YOU STAND. MOVE!');
      if (this.area === 'stair') { this.bstate = 'tellLeap'; this.bt = 0.85 * this.slowTell; Audio.sfx('creak'); }
      else { this.bstate = 'rise'; this.bt = 0.35; this.riseFrom = this.by; Audio.sfx('swoosh'); }
    } else {
      this.gurneyN = a === 'gurney2' ? (this.hp <= 4 ? 3 : 2) : 1; this.withCurtain = a === 'curtainGurney'; this.thenLeap = a === 'gurneyDive';
      this.bstate = 'tellGurney'; this.bt = 0.75 * this.teach('gurney', 'BEDS DOWN THE STAIRS. JUMP THEM');
      if (this.withCurtain) this.curtainSpec = this.curtainFrom(false);
      Audio.sfx('creak');
    }
  },

  check() {
    if (this.power && this.cleanAttack) this.charge = Math.min(1, this.charge + 0.12);
    this.bstate = 'check'; this.checkHits = 0;
    this.bt = [0, 1.6, 1.4, 1.4][this.phase];
    if (this.area === 'stair') this.bt += 0.5 * Math.max(0, this.kb - this.miloLanding());
    this.openTeach();
  },
  openTeach() {
    if (this.taught.has('open')) return;
    this.taught.add('open'); this.prompt = { text: 'GOLD = OPEN. GET CLOSE TO HIT', t: 2.6 }; this.bt += 1.0;
  },

  mFlee(to, dark) {
    this.bstate = 'flee'; this.fleeTo = to; this.fleeDark = dark; this.leap = null; this.ashHazards();
    if (dark) this.talk(this.def.lines.dark, 1.2);
  },
  afterFlee() {
    this.bsurf = this.surfAt(this.bx, this.by) || this.bsurf;
    if (this.crackPending) { this.crackPending = false; this.bstate = 'cracked'; return; }
    this.bstate = 'idle'; this.bt = 0.9;
    if (this.fleeDark) {
      this.fleeDark = false; this.darkWant = 0.86; Audio.sfx('close');
      if (!this.taught.has('dark')) { this.taught.add('dark'); this.prompt = { text: 'LIGHTS OUT. YOUR LIGHT BURNS IT AWAY', t: 2.6 }; this.bt += 0.8; }
    }
  },

  // the end of an act: she kneels, cracked, and only the light finishes it
  mCrack() {
    this.ashHazards(); this.leap = null;
    this.charge = 1; this.flashB = 0.3; this.trauma = 0.6;
    Audio.sfx('shatter');
    this.talk(this.def.lines.crack, 1.4);
    this.prompt = { text: `LIGHT HER!  ${this.lightKey()}`, t: 99 };
    if (this.area === 'stair' && this.kb < TOP) { this.crackPending = true; this.mFlee(TOP, false); return; }
    if (this.bsurf && !this.bsurf.solid && this.area === 'below') { this.crackPending = true; this.bstate = 'hop'; this.bvy = -150; return; }
    this.bstate = 'cracked';
  },

  ashHazards() {
    const burn = (x, y) => { for (let i = 0; i < 6; i++) this.part('ink', x + rnd(-16, 16), y - rnd(0, 18), rnd(-40, 40), rnd(-120, -20)); };
    if (this.curtain) burn(this.curtain.x, this.curtain.y);
    for (const g of this.gurneys) burn(g.x, g.y);
    this.curtain = null; this.gurneys = []; this.toSpawn = []; this.curtainSpec = null;
  },

  // ---------------- hazards ----------------
  curtainFrom(back) {
    if (this.area === 'stair') {
      const ms = this.grounded ? this.ground : this.surfUnder(this.x, this.y), k = ms.k || 0;
      const fromLeft = k === 0 ? this.x > (SL + SR) / 2 : k % 2 === 0;
      return { y: ms.y, top: ms.y - 70, l: ms.l, r: ms.r, fromLeft, back: false };
    }
    const fl = this.floorSurf(), fromLeft = this.bx < (this.room.l + this.room.r) / 2;
    return { y: fl.y, top: this.area === 'ward4' ? RAIL1 : RAIL2, l: this.room.l, r: Math.min(this.room.r, WR), fromLeft, back };
  },
  spawnCurtain() {
    const c = this.curtainSpec || this.curtainFrom(false);
    this.curtain = { ...c, x: c.fromLeft ? c.l : c.r, dir: c.fromLeft ? 1 : -1, v: SPEED.curtain[this.phase], len: 90 };
    this.curtainSpec = null; Audio.sfx('swoosh');
  },
  spawnGurney() {
    const dir = this.kb % 2 === 0 ? 1 : -1;
    this.gurneys.push({ x: this.bx + dir * 30, y: this.by, k: this.kb, dir, v: 200, vy: 0, air: false });
    Audio.sfx('drawer');
  },

  mStepHazards(dt) {
    const c = this.curtain;
    if (c) {
      c.x += c.dir * c.v * dt;
      this.touchHazard({ l: Math.min(c.x, c.x - c.dir * c.len), r: Math.max(c.x, c.x - c.dir * c.len), t: c.y - 16, b: c.y }, c, c.x);
      if (c.dir > 0 ? c.x - c.len > c.r : c.x + c.len < c.l) {
        this.curtain = c.back ? { ...c, back: false, dir: -c.dir, x: c.dir > 0 ? c.r : c.l, v: c.v * 1.1 } : null;
        if (this.curtain) this.grazed.delete(c);
      }
    }
    for (const g of this.gurneys) {
      if (g.air) {
        g.vy += GRAV * dt; g.y += g.vy * dt; g.x += g.dir * g.v * 0.5 * dt;
        const below = g.k - 1;
        if (below >= 0 && g.y >= landY(below)) { // it lands one landing down and turns around (Donkey Kong)
          g.y = landY(below); g.k = below; g.air = false; g.vy = 0; g.dir = -g.dir;
          this.dust(g.x, g.y, 3); Audio.sfx('bounce');
        }
      } else {
        g.x += g.dir * g.v * dt;
        const [l, r] = landSpan(g.k);
        if (g.k === 0 && (g.x < l + 20 || g.x > r - 20)) { g.gone = true; this.dust(g.x, g.y, 8); Audio.sfx('bounce'); continue; }
        if (g.x < l - 4 || g.x > r + 4) g.air = true;
      }
      this.touchHazard({ l: g.x - 20, r: g.x + 20, t: g.y - 22, b: g.y }, g, g.x);
      if (g.y > this.camY + H + 200) g.gone = true;
    }
    this.gurneys = this.gurneys.filter((g) => !g.gone);
  },

  // ---------------- the acts in between ----------------
  mStartTrans() {
    this.state = 'trans'; this.tr = { n: this.phase, t: 0 }; this.beamHold = 0.6;
    this.flashW = 1; this.freeze = 0.14; this.trauma = 0.5; this.inv = 99;
    this.prompt = { text: '', t: 0 }; this.thumbs = { move: null, act: null };
    Audio.hush(3); Audio.sfx('shatter');
    for (let i = 0; i < 24; i++) this.part('ink', this.bx + rnd(-18, 18), this.by - rnd(10, 70), rnd(-200, 200), rnd(-260, 0));
    if (this.phase === 3) { this.win(); return; }
  },

  mStepTrans(dt) {
    const tr = this.tr, t = tr.t;
    if (tr.n === 1) {
      if (t < 1.4) { // silence, grey, the floor cracks under her
        this.slow = 0.5; this.greyWant = 1; this.floorCrack = Math.min(1, t / 1.25);
        if (Math.random() < 0.3) this.part('ink', this.bx + rnd(-15, 15), this.by - rnd(20, 60), rnd(-20, 20), rnd(-40, 10));
        this.mStepMilo(dt, false);
      } else {
        if (!tr.broke) this.breakFloor();
        this.slow = 1; this.greyWant = 0;
        this.mStepMilo(dt, false);
        this.settle(dt, true);
        const k = clamp((t - 1.4) / 0.55, 0, 1);
        BEDS2.forEach(([x, y], i) => {
          const im = this.bedImgs[3 + i], x0 = BEDS1[i];
          im.setPosition(lerp(x0, x, k), lerp(F1 + 1, y + 1, k * k)).setRotation(k < 1 ? Math.sin(k * Math.PI) * 0.35 * (i % 2 ? 1 : -1) : 0);
        });
        if (k >= 1 && !tr.bedsDown) { tr.bedsDown = true; Audio.sfx('bounce'); BEDS2.forEach(([x, y]) => this.dust(x, y, 5)); }
      }
      if (t > 3.1) this.beginAct(2);
    } else if (tr.n === 2) {
      this.mStepMilo(dt, false);
      if (t < 1.2) { this.slow = 0.5; this.greyWant = 1; this.settle(dt, true); return; }
      this.slow = 1; this.greyWant = 0;
      if (!tr.leapt) { // she runs at the wall, through it, and up the stairs
        if (this.bstate !== 'roll') { this.bstate = 'roll'; this.bDir = 1; Audio.sfx('drawer'); }
        this.bx += 640 * dt;
        if (this.bx >= WR - 14 && !this.wallBroken) this.breakWall();
        if (this.bx >= SL + 70) { tr.leapt = true; this.bstate = 'flee'; this.kb = 0; this.fleeTo = 3; this.leap = null; }
      } else if (this.bstate === 'flee') {
        this.mStepBoss(dt);
        if (this.bstate !== 'flee') this.bstate = 'perch';
      }
      if (t > 2.8 && this.bstate === 'perch') {
        this.state = 'fight'; this.walkIn = true; this.inv = 0.4;
        this.room = { l: WL, r: SR };
        this.prompt = { text: 'AFTER HER  >', t: 99 };
      }
    }
  },

  breakFloor() {
    this.tr.broke = true; this.floorBroken = true; this.roomDirty = true; this.floorCrack = 0;
    this.area = 'below'; this.mBuild();
    this.grounded = false; this.ground = null; this.vy = 60;
    this.trauma = 0.9; Audio.sfx('rumble'); Audio.sfx('crack');
    for (let x = WL; x < WR; x += 22) this.part('tile', x + 11, F1 + 8, rnd(-50, 50), rnd(-140, 20));
  },
  breakWall() {
    this.wallBroken = true; this.roomDirty = true; this.mBuild();
    this.trauma = 0.85; Audio.sfx('hit'); Audio.sfx('rumble');
    for (let i = 0; i < 34; i++) this.part('brick', rnd(WR, SL), F2 - rnd(0, 84), rnd(60, 360), rnd(-300, -40));
  },

  beginAct(n) {
    this.phase = n; this.state = 'fight'; this.tr = null; this.inv = 0.6; this.greyWant = 0; this.slow = 1;
    this.bstate = 'idle'; this.bt = 1.1; this.leap = null; this.checkHits = 0;
    this.prompt = { text: '', t: 0 };
    if (n === 2) { this.queue = ['dive', 'roll']; this.talk(this.def.lines.p2, 2.0); this.darkWant = 0.28; }
    if (n === 3) { this.queue = ['gurney', 'dive']; this.talk(this.def.lines.p3, 2.0); this.darkWant = 0; }
    this.actText.setText(['', 'I. WARD 4', 'II. THE WARD BELOW', 'III. THE STAIRS'][n]); this.actT = 2.4;
    Audio.sfx('sting');
  },
  mStartAct3() {
    this.walkIn = false; this.area = 'stair'; this.room = { l: SL, r: SR }; this.mBuild();
    this.bsurf = this.surfAt(this.bx, this.by);
    this.beginAct(3);
  },

  win() {
    this.state = 'won'; this.endT = 0; this.ashHazards(); this.darkWant = 0; this.leap = null;
    this.bstate = 'sit'; this.thumbs = { move: null, act: null };
    this.prompt = { text: '', t: 0 }; this.noteText.setText('');
    this.greyWant = 1; this.slow = 1; this.hp = 0; this.mothT = 0;
    Audio.hush(5);
  },

  lose() {
    this.state = 'lost'; this.endT = 0;
    this.thumbs = { move: null, act: null };
    Audio.sfx('lose');
    this.noteText.setText(''); this.prompt = { text: '', t: 0 };
    this.darkWant = 0.9;
  },

  stepEnd(dt) {
    if (this.state === 'lost') { Object.getPrototypeOf(this).stepEnd.call(this, dt); return; }
    this.endT += dt;
    this.dark += (this.darkWant - this.dark) * Math.min(1, dt * 2);
    if (this.endT > 1.8) this.greyWant = 0;
    // she sits, folds her hands, and comes apart into moths that fly to the light
    if (this.endT > 1.2 && this.endT < 2.8) {
      this.mothT -= dt;
      while (this.mothT <= 0) {
        this.mothT += 0.025;
        const to = this.area === 'stair' ? MOON : { x: this.bx - 120, y: this.by - 340 };
        const toMilo = Math.random() < 0.25;
        this.part('moth', this.bx + rnd(-18, 18), this.by - rnd(4, BH * 0.7), rnd(-40, 40), rnd(-80, -10), toMilo ? { x: this.x, y: this.y - 30 } : { x: to.x + rnd(-40, 40), y: to.y + rnd(-30, 30) });
      }
      if (Math.random() < dt * 4) Audio.sfx('moth');
    }
    this.bossAlpha = this.endT < 1.4 ? 1 : Math.max(0, 1 - (this.endT - 1.4) / 1.3);
    if (this.endT > 0.4 && !this.winSfx) { this.winSfx = true; Audio.sfx('win'); }
    const [a, b] = this.def.lines.win;
    if (this.endT > 2.6 && !this.bigText.text) this.bigText.setText(a);
    if (this.endT > 3.5 && !this.subText.text) this.subText.setText(b);
    if (this.endT > 5.6 && !this.done) this.finish(true);
  },

  // ---------------- effects ----------------
  part(kind, x, y, vx, vy, to) {
    if (this.parts.length > 520) this.parts.shift();
    const life = { ember: 0.5, spark: 0.4, mote: 0.9, ink: 1.1, shard: 0.9, dust: 0.5, tile: 1.6, brick: 1.4, moth: 4.5 }[kind] || 1;
    this.parts.push({ kind, x, y, vx, vy, to, life, max: life, ph: Math.random() * 6 });
  },
  dust(x, y, n) { for (let i = 0; i < n; i++) this.part('dust', x + rnd(-8, 8), y - 2, rnd(-70, 70), rnd(-60, -10)); },
  mStepParts(dt) {
    for (const p of this.parts) {
      p.life -= dt; p.ph += dt * 18;
      const g = { ember: -40, spark: 200, mote: -6, ink: 520, shard: 760, dust: 60, tile: 1300, brick: 1100, moth: 0 }[p.kind] ?? 0;
      if (p.kind === 'moth') { // flutter toward the light
        const dx = p.to.x - p.x, dy = p.to.y - p.y, d = Math.hypot(dx, dy) || 1;
        p.vx += ((dx / d) * 130 - p.vx) * Math.min(1, dt * 2) + Math.sin(p.ph * 0.7) * 30 * dt * 10;
        p.vy += ((dy / d) * 130 - p.vy) * Math.min(1, dt * 2) + Math.cos(p.ph * 0.5) * 30 * dt * 10;
        if (d < 14) p.life = Math.min(p.life, 0.25);
      } else if (p.kind === 'ember' || p.kind === 'mote') { p.vx *= 1 - dt * 2; }
      p.vy += g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if ((p.kind === 'tile' || p.kind === 'brick') && p.y > F2 - 4 && this.floorBroken) { p.y = F2 - 4; p.vy *= -0.25; p.vx *= 0.6; }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    // ink leaks from her cracks
    if (this.state !== 'won' && this.cracks.length && Math.random() < dt * Math.min(6, this.cracks.length * 0.5)) {
      const c = this.cracks[Math.floor(Math.random() * this.cracks.length)], e = c[c.length - 1], w = this.toWorld(e[0], e[1]);
      this.part('ink', w.x, w.y, rnd(-10, 10), rnd(0, 30));
    }
  },
  addCrack() {
    let x = rnd(4, 13), y = rnd(3, 24);
    const pts = [[x, y]];
    let ang = rnd(0, Math.PI * 2);
    for (let i = 0; i < 3; i++) { ang += rnd(-1, 1); x = clamp(x + Math.cos(ang) * rnd(1.5, 3.5), 2, 15); y = clamp(y + Math.sin(ang) * rnd(1.5, 3.5), 1, 26); pts.push([x, y]); }
    this.cracks.push(pts);
    if (this.cracks.length > 22) this.cracks.shift();
  },
  // a point on her sprite (texture px) to the world
  toWorld(lx, ly) {
    const p = this.pose || { x: this.bx, y: this.by, sx: SC, sy: SC, rot: 0, flip: false };
    const dx = (p.flip ? 9 - lx : lx - 9) * p.sx, dy = (ly - 28) * p.sy, c = Math.cos(p.rot), s = Math.sin(p.rot);
    return { x: p.x + dx * c - dy * s, y: p.y + dx * s + dy * c };
  },

  // ---------------- drawing ----------------
  mCamera(dt, snap) {
    let tx, ty;
    const look = this.face * 46;
    // frame Milo and her together when they fit, else Milo with room to see ahead (Hollow Knight's boss rooms)
    const both = this.state === 'fight' && !this.walkIn && Math.abs(this.bx - this.x) < W - 40;
    const fx = both ? clamp((this.x + this.bx) / 2 - W / 2, this.x - W + 70, this.x - 70) : this.x + look - W / 2;
    if (this.area === 'ward4') { tx = clamp(fx, 0, 900 - W); ty = F1 - 310; }
    else if (this.area === 'below') {
      tx = clamp(fx, 0, (this.walkIn ? SR + 16 : 900) - W);
      ty = this.state === 'trans' ? clamp(this.y - 270, F1 - 310, F2 - 340) : clamp(this.y - 270, F2 - 352, F2 - 330);
    } else { // the stairs: look up at her when she's above, but keep Milo on the screen
      tx = SL - 16;
      const want = this.state === 'fight' && this.by < this.y ? Math.min(this.y - 230, this.by - BH - 24) : this.y - 230;
      ty = clamp(Math.max(this.y - H + 34, want), landY(TOP) - 236, F2 + 36 - H);
    }
    if (snap || !this.camInit) { this.camX = tx; this.camY = ty; this.camInit = true; }
    this.camX += (tx - this.camX) * Math.min(1, dt * 5);
    this.camY += (ty - this.camY) * Math.min(1, dt * (this.state === 'trans' ? 7 : 4));
    const sh = this.shakeOn ? this.trauma * this.trauma * 8 : 0;
    this.cameras.main.setScroll(Math.round(this.camX + (sh ? Math.sin(this.t * 61) * sh : 0)), Math.round(this.camY + (sh ? Math.cos(this.t * 47) * sh * 0.6 : 0)));
  },

  render() {
    const dt = Math.min(0.05, (this.game.loop.delta || 16) / 1000);
    this.mCamera(dt, false);
    if (this.roomDirty) { // the building is baked into one texture (thousands of bricks would be redrawn every frame)
      this.roomDirty = false;
      this.drawRoom();
      if (this.textures.exists('matron_room')) { this.roomImg.setTexture('__WHITE'); this.textures.remove('matron_room'); }
      this.roomG.generateTexture('matron_room', 1560, 1420); this.roomG.clear();
      this.roomImg.setTexture('matron_room').setVisible(true);
    }
    this.drawDeco();
    this.hazG.clear(); this.fx.clear(); this.glowG.clear(); this.partG.clear(); this.crackG.clear();
    this.drawHazards();
    this.drawBoss();
    this.drawMilo();
    this.drawParts();
    this.drawDark();
    this.drawGlow();
    const gg = this.greyG; gg.clear();
    if (this.grey > 0.01) { gg.fillStyle(0x8e8c9c, this.grey * 0.38); gg.fillRect(0, 0, W, H); gg.fillStyle(0x07060d, this.grey * 0.35); gg.fillRect(0, 0, W, 26); gg.fillRect(0, H - 26, W, 26); }
    if (this.flashW > 0) { gg.fillStyle(0xe6f4ff, this.flashW * 0.7); gg.fillRect(0, 0, W, H); }
    if (this.redEdge > 0) { gg.lineStyle(14, RED, this.redEdge * 0.55); gg.strokeRect(7, 7, W - 14, H - 14); }
    this.renderUI();
  },

  drawRoom() {
    const g = this.roomG; g.clear();
    const R = (c, x, y, w, h, a = 1) => { g.fillStyle(c, a); g.fillRect(x, y, w, h); };
    // ---- Ward 4: lilac walls, tall windows with rain, a curtain rail, a tiled floor
    R(0x221d36, 0, C1 - 60, 900, F1 - C1 + 60);
    R(0x2e2846, 0, F1 - 70, 900, 70); R(0x4a4260, 0, F1 - 72, 900, 3);
    for (const wx of [110, 330, 570, 790]) {
      R(0x3a3352, wx - 38, C1 + 62, 76, 134); R(0x0e1830, wx - 33, C1 + 67, 66, 124);
      R(0x1a2a4c, wx - 33, C1 + 67, 66, 40); R(0x3a3352, wx - 1, C1 + 67, 2, 124); R(0x3a3352, wx - 33, C1 + 126, 66, 2);
      R(0x2a2440, wx - 42, C1 + 196, 84, 6);
    }
    R(0x141020, 0, C1 - 60, 900, 60); R(0x4a4558, WL, RAIL1, WR - WL, 3);
    for (const lx of [200, 450, 700]) { R(0x4a4558, lx - 1, C1, 2, 18); R(0x6d6680, lx - 14, C1 + 18, 28, 7); }
    if (!this.floorBroken) {
      for (let x = 0; x < 900; x += 24) R((x / 24) % 2 ? 0x403b55 : 0x4a4560, x, F1, 24, 18);
      R(0x6d6680, 0, F1, 900, 2);
    } else { // only jagged teeth of the floor are left at the walls
      for (let x = 0; x < WL + 26; x += 6) R(0x4a4560, x, F1, 6, 10 + ((x * 7) % 9));
      for (let x = WR - 26; x < 900; x += 6) R(0x4a4560, x, F1, 6, 10 + ((x * 5) % 9));
    }
    // ---- the ward below: older, darker, boarded windows, pipes, a hole in the ceiling
    R(0x17132a, 0, C2, 900, F2 - C2); R(0x201b33, 0, F2 - 60, 900, 60); R(0x2e2846, 0, F2 - 62, 900, 2);
    for (const [sx, sy, sw, sh] of [[90, 60, 40, 90], [400, 30, 26, 140], [610, 80, 50, 60], [820, 40, 20, 120]]) R(0x120f22, sx, C2 + sy, sw, sh);
    for (const wx of [210, 690]) {
      R(0x2a2440, wx - 36, C2 + 90, 72, 110); R(0x0a0f1e, wx - 31, C2 + 95, 62, 100);
      g.fillStyle(0x4a3a30, 1); for (let i = 0; i < 3; i++) { g.fillRect(wx - 38, C2 + 110 + i * 32, 76, 9); }
    }
    R(0x2e2a3a, 0, C2 + 10, 900, 7); R(0x3a3448, 0, C2 + 26, 900, 4); R(0x4a4558, WL, RAIL2, WR - WL, 3);
    R(0x0c0a16, 0, C1 - 60, WL, F2 - C1 + 100); R(0x0c0a16, WR, C1 - 60, SL - WR, F2 - C1 + 100);
    for (let x = 0; x < 900; x += 24) R((x / 24) % 2 ? 0x29253a : 0x2e2a40, x, F2, 24, 40);
    R(0x4a4558, 0, F2, 900, 2);
    if (this.floorBroken) { // the slab caught on the pipes, on two chains
      R(0x4a4558, SLAB.l + 10, C2 + 17, 2, SLAB.y - C2 - 17); R(0x4a4558, SLAB.r - 12, C2 + 17, 2, SLAB.y - C2 - 17);
      for (let x = SLAB.l; x < SLAB.r; x += 24) R((x / 24) % 2 ? 0x403b55 : 0x4a4560, x, SLAB.y, Math.min(24, SLAB.r - x), 12);
      R(0x6d6680, SLAB.l, SLAB.y, SLAB.r - SLAB.l, 2);
    }
    if (this.wallBroken) { R(0x17132a, WR, F2 - 92, SL - WR, 92); for (let y = F2 - 100; y < F2 - 84; y += 4) R(0x0c0a16, WR + ((y * 3) % 11), y, SL - WR - 18, 4); }
    // ---- the stairwell: brick, concrete landings with rails, a lamp on each, the moon window at the top
    const top = landY(TOP) - 260;
    R(0x1d1828, SL - 16, top, SR - SL + 32, F2 - top);
    for (let y = top; y < F2; y += 12) R(0x241e32, SL, y, SR - SL, 1);
    for (let y = top, row = 0; y < F2; y += 12, row++) for (let x = SL + (row % 2) * 12; x < SR; x += 48) R(0x221c30, x, y + 1, 1, 11);
    R(0x0c0a16, SR, top, 40, F2 - top + 40); R(0x0c0a16, SL - 16, top, 16, F2 - top - 92);
    g.fillStyle(0x2a3c66, 1); g.fillCircle(MOON.x, MOON.y, 74); g.fillStyle(0x0f1a30, 1); g.fillCircle(MOON.x, MOON.y, 66);
    g.fillStyle(0xdfefff, 1); g.fillCircle(MOON.x + 22, MOON.y - 18, 16);
    R(0x2a3c66, MOON.x - 2, MOON.y - 66, 4, 132); R(0x2a3c66, MOON.x - 66, MOON.y - 2, 132, 4);
    for (let k = 1; k <= TOP; k++) {
      const [l, r] = landSpan(k), y = landY(k), open = k % 2 ? l : r;
      R(0x5a5470, l, y, r - l, 9); R(0x3a3450, l, y + 9, r - l, 4); R(0x7a7490, l, y, r - l, 2);
      R(0x6d6680, open - 1, y - 30, 3, 30); R(0x6d6680, k % 2 ? open : open - 60, y - 30, 60, 3); // the banister at the open end
      const lx = k % 2 ? SR - 40 : SL + 40; R(0x4a4558, lx - 5, y - 64, 10, 8);
      R(0x2a2338, k % 2 ? l - 96 : r, y + 13, 96, LAND - 13 - 9, 0.5); // the flight of stairs behind, in shadow
      for (let i = 0; i < 6; i++) R(0x332b44, k % 2 ? l - 16 * (i + 1) : r + 16 * i, y + 10 + i * 12, 16, 3);
    }
    R(0x5a5470, SL, F2, SR - SL, 2);
  },

  drawDeco() {
    const g = this.decoG; g.clear();
    const t = this.t, cx = this.camX, cy = this.camY;
    const vis = (x, y, w, h) => x + w > cx - 20 && x < cx + W + 20 && y + h > cy - 20 && y < cy + H + 20;
    const flick = (i) => (this.reduce ? 1 : Math.sin(t * 17 + i * 3) > 0.96 ? 0.5 : 1);
    if (vis(0, C1, 900, F1 - C1)) { // Ward 4: rain on the glass, three lamps
      g.fillStyle(0x6a86b8, 0.35);
      for (const wx of [110, 330, 570, 790]) for (let i = 0; i < 7; i++) g.fillRect(wx - 30 + i * 9, C1 + 67 + ((t * 170 + i * 41) % 116), 1, 8);
      [200, 450, 700].forEach((lx, i) => { if (this.area === 'ward4') { g.fillStyle(0xfff1c2, 0.07 * flick(i)); g.fillTriangle(lx - 12, C1 + 25, lx - 90, F1, lx + 90, F1); } });
    }
    if (vis(0, C2, 900, F2 - C2) && this.floorBroken) { // light falls through the hole above
      g.fillStyle(0xbfe4ff, 0.05); g.fillTriangle(WL + 60, C2, WR - 60, C2, 450, F2);
      g.fillStyle(0xd8d0e0, 0.4);
      for (let i = 0; i < 14; i++) g.fillRect(120 + ((i * 97 + t * 9) % 660), C2 + 20 + ((i * 53 + t * 14) % 300), 1, 1);
    }
    if (vis(SL, landY(TOP) - 260, SR - SL, F2)) { // the stairwell lamps (dead in the dark) and the moonlight
      const lit = this.dark < 0.5;
      for (let k = 1; k <= TOP; k++) {
        const y = landY(k), lx = k % 2 ? SR - 40 : SL + 40;
        if (!vis(lx - 80, y - 70, 160, 80)) continue;
        g.fillStyle(lit ? 0xfff1c2 : 0x2a2436, 1); g.fillRect(lx - 3, y - 58, 6, 5);
        if (lit) { g.fillStyle(0xfff1c2, 0.06 * flick(k)); g.fillTriangle(lx, y - 56, lx - 70, y, lx + 70, y); }
      }
      g.fillStyle(0xbfe4ff, 0.06); g.fillTriangle(MOON.x - 50, MOON.y, MOON.x + 50, MOON.y, MOON.x + 160, landY(TOP));
    }
  },

  drawHazards() {
    const g = this.hazG, L = this.glowG, t = this.t;
    const pulse = 0.55 + 0.45 * Math.sin(t * 16);
    // the curtain: its rail glows red on the side it comes from, then it sweeps; only the hem hurts
    const spec = this.bstate === 'tellCurtain' || (this.bstate === 'tellGurney' && this.withCurtain) ? this.curtainSpec : null;
    if (spec) {
      const j = this.reduce ? 0 : Math.round(Math.sin(t * 80) * 2), x0 = spec.fromLeft ? spec.l : spec.r - 150;
      L.fillStyle(RED, 0.75 * pulse); L.fillRect(x0, spec.top - 2 + j, 150, 6);
      L.fillStyle(RED, 0.5); const ax = spec.fromLeft ? spec.l + 8 : spec.r - 8, d = spec.fromLeft ? 1 : -1;
      L.fillTriangle(ax, spec.y - 30, ax, spec.y - 6, ax + d * 16, spec.y - 18);
      L.fillRect(spec.fromLeft ? spec.l : spec.r - 6, spec.y - 16, 6, 16);
    }
    const c = this.curtain;
    if (c) {
      const l = Math.round(Math.min(c.x, c.x - c.dir * c.len));
      g.fillStyle(0xc4ccdc, 0.32); g.fillRect(l, c.top + 3, c.len, c.y - 16 - c.top - 3);
      g.fillStyle(0x8d95a8, 0.4); for (let i = 1; i < 5; i++) g.fillRect(l + Math.round((i * c.len) / 5), c.top + 3, 2, c.y - c.top - 3);
      g.fillStyle(0xc4ccdc, 1); g.fillRect(l, c.y - 16, c.len, 16);
      g.fillStyle(0x8d95a8, 1); for (let i = 1; i < 5; i++) g.fillRect(l + Math.round((i * c.len) / 5), c.y - 16, 2, 16);
      L.fillStyle(RED, 0.8); L.fillRect(l, c.y - 3, c.len, 3); L.fillRect(Math.round(c.x) - 1, c.y - 16, 3, 16);
    }
    // gurneys: a red lamp on the front
    for (const gu of this.gurneys) this.drawGurney(gu.x, gu.y, gu.dir, true);
    if (this.bstate === 'tellGurney' || (this.bstate === 'gurney' && this.toSpawn.length)) this.drawGurney(this.bx + (this.kb % 2 === 0 ? 1 : -1) * 30, this.by, this.kb % 2 === 0 ? 1 : -1, Math.floor(t * 8) % 2);
    // the charge: a red line on the floor where she will roll
    if (this.bstate === 'tellRoll') {
      const a = Math.min(this.bx, this.rollEnd), b = Math.max(this.bx, this.rollEnd);
      L.fillStyle(RED, 0.25 + 0.35 * pulse); L.fillRect(a, this.by - 3, b - a, 3);
      for (let x = this.bx + this.bDir * 30; this.bDir * (this.rollEnd - x) > 0; x += this.bDir * 40) L.fillTriangle(x, this.by - 12, x, this.by - 4, x + this.bDir * 7, this.by - 8);
    }
    // the drop: a red column under her and a red mark where she lands
    let tgt = null;
    if (['rail', 'lock', 'drop'].includes(this.bstate) && this.dropTarget) tgt = { x: this.bx, y: this.dropTarget.y, locked: this.bstate !== 'rail' };
    if (this.bstate === 'tellLeap' && this.leapTarget) tgt = { x: this.leapTarget.x, y: this.leapTarget.s.y, locked: this.bt <= 0.4 };
    if (this.bstate === 'leap' && this.leap) tgt = { x: this.leap.x1, y: this.leap.y1, locked: true };
    if (tgt) {
      const a = tgt.locked ? 0.8 * pulse + 0.2 : 0.35;
      L.fillStyle(RED, a); L.fillRect(tgt.x - 52, tgt.y - 3, 104, 3);
      L.fillTriangle(tgt.x - 8, tgt.y - 22, tgt.x + 8, tgt.y - 22, tgt.x, tgt.y - 8);
      if (this.area !== 'stair') { L.fillStyle(RED, tgt.locked ? 0.14 : 0.06); L.fillRect(tgt.x - 20, this.by, 40, tgt.y - this.by); }
    }
    // Ward 4's floor cracking (between acts 1 and 2)
    if (this.floorCrack > 0) {
      L.lineStyle(2, BLUE, 0.8);
      for (let i = 0; i < 9; i++) {
        const len = this.floorCrack * (120 + i * 70), d = i % 2 ? 1 : -1;
        L.beginPath(); L.moveTo(this.bx, F1 + 1);
        for (let s = 1; s <= 6; s++) L.lineTo(this.bx + d * len * (s / 6), F1 + 1 + ((s * 7 + i * 3) % 9) - 4);
        L.strokePath();
      }
    }
  },

  drawGurney(x, y, dir, lampOn) {
    const g = this.hazG;
    g.fillStyle(0x0b0918, 1); g.fillRect(x - 21, y - 21, 42, 9);
    g.fillStyle(0x6d6680, 1); g.fillRect(x - 20, y - 14, 40, 3); g.fillRect(x - 17, y - 12, 3, 8); g.fillRect(x + 14, y - 12, 3, 8);
    g.fillStyle(0xe8e4f2, 1); g.fillRect(x - 20, y - 20, 40, 6);
    g.fillStyle(0x2a2436, 1); g.fillCircle(x - 15, y - 3, 3); g.fillCircle(x + 15, y - 3, 3);
    if (lampOn) { this.glowG.fillStyle(RED, 0.9); this.glowG.fillCircle(x + dir * 21, y - 17, 3); this.glowG.fillStyle(RED, 0.18); this.glowG.fillCircle(x + dir * 21, y - 17, 11); }
    this.glowG.fillStyle(RED, 0.5); this.glowG.fillRect(x - 20, y - 2, 40, 2);
  },

  drawBoss() {
    const s = this.bstate, t = this.t;
    let sx = SC, sy = SC, rot = 0, bx = this.bx;
    const open = this.isOpen();
    if (s === 'roll') { sy = SC * 0.6; rot = 0.3 * this.bDir; }
    else if (s === 'tellRoll' || s === 'tellLeap') { sy = SC * 0.86; bx -= this.bDir * 4 + (this.reduce ? 0 : Math.round(Math.sin(t * 70))); }
    else if (s === 'wallStun') rot = -0.22 * this.bDir + Math.sin(t * 6) * 0.05;
    else if (open) { sy = SC * 0.8; rot = -0.12 * this.bDir; }
    else if (s === 'cracked') { sy = SC * 0.68; rot = 0.08 * Math.sin(t * 3); }
    else if (s === 'sit') { sy = SC * 0.72; }
    else if (s === 'drop') sy = SC * 1.1;
    const flip = this.bDir > 0;
    this.pose = { x: bx, y: this.by - 4, sx, sy, rot, flip };
    const alpha = this.state === 'won' ? this.bossAlpha : 1;
    this.boss.setPosition(bx, this.by - 4).setFlipX(flip).setScale(sx, sy).setRotation(rot).setAlpha(alpha);
    // her color says what she's doing: red = about to attack, gold = open
    if (this.flashB > 0) this.boss.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else if (/^tell/.test(s) || s === 'rail' || s === 'lock') this.boss.setTint(Math.floor(t * 10) % 2 ? 0xff7a8a : 0xffc0c8).setTintMode(Phaser.TintModes.MULTIPLY);
    else if (open || s === 'cracked') this.boss.setTint(0xffe7a0).setTintMode(Phaser.TintModes.MULTIPLY);
    else this.boss.clearTint();
    // the IV-pole frame she rolls on (a hook over the rail while she hangs)
    const g = this.hazG, h = BH * (sy / SC);
    g.fillStyle(0x6d6680, alpha);
    if (s === 'rise' || s === 'rail' || s === 'lock') { g.fillRect(bx - 1, RAIL2 - 2, 3, this.by - h - RAIL2 + 6); g.fillRect(bx - 6, RAIL2 - 4, 12, 3); }
    else if (s !== 'sit' && s !== 'cracked') {
      g.fillRect(bx - 22, this.by - 6, 44, 4); g.fillRect(bx + 18 * this.bDir - 1, this.by - h - 14, 3, h + 10); g.fillRect(bx + 18 * this.bDir - 7, this.by - h - 14, 13, 3);
      g.fillStyle(0x2a2436, alpha); g.fillCircle(bx - 18, this.by - 2, 3); g.fillCircle(bx + 18, this.by - 2, 3);
    }
    // the porcelain cracks, leaking ink (and light, once she's beaten)
    const cg = this.crackG, glowing = s === 'cracked' || this.state === 'trans' || this.state === 'won';
    for (const c of this.cracks) {
      cg.lineStyle(2, glowing ? 0xdff0ff : 0x0b0918, alpha); cg.beginPath();
      c.forEach(([lx, ly], i) => { const w = this.toWorld(lx, ly); if (i) cg.lineTo(w.x, w.y); else cg.moveTo(w.x, w.y); });
      cg.strokePath();
    }
    // GOLD: she's open. A soft pulsing outline
    const L = this.glowG;
    if ((open || s === 'cracked') && this.state === 'fight') {
      const bb = this.bossBox();
      L.lineStyle(2, GOLD, 0.5 + 0.35 * Math.sin(t * 10)); L.strokeRect(bb.l - 4, bb.t - 4, bb.r - bb.l + 8, bb.b - bb.t + 4);
      if (s === 'wallStun') for (let i = 0; i < 3; i++) { const a = t * 4 + i * 2.1; L.fillStyle(GOLD, 0.8); L.fillRect(bx + Math.cos(a) * 18, bb.t - 10 + Math.sin(a) * 4, 3, 2); }
      if (s === 'cracked') { L.lineStyle(2, BLUE, 0.4 + 0.3 * Math.sin(t * 6)); L.strokeCircle(bx, this.by - h / 2, 42 + 4 * Math.sin(t * 5)); }
    }
    this.bossEyes.setVisible(this.dark > 0.3 && this.state !== 'won').setPosition(bx, this.by - 4 - (28 - 6.5) * sy).setScale(SC, sy).setFlipX(flip);
    // "!" before every attack
    this.bangText.setVisible(this.bangT > 0 && this.state === 'fight').setPosition(bx, this.by - h - 26 - (0.45 - this.bangT) * 16);
  },

  drawMilo() {
    const m = this.milo, id = this.char;
    const blink = this.inv > 0 && this.inv < 50 && this.booT <= 0 && this.state === 'fight' && Math.floor(this.t * 20) % 2;
    m.setVisible(!blink).setFlipX(this.face < 0).setAlpha(1);
    if (this.state === 'lost') {
      if (m.anims.isPlaying) m.anims.stop();
      m.setTexture(`${id}_fall`).setRotation(Math.min(1.5, this.endT * 3) * -this.face).setPosition(this.x, this.y);
      this.boo.setVisible(false);
      return;
    }
    m.setRotation(0);
    if (this.dodgeT > 0 && this.dodgeDir) { if (m.anims.isPlaying) m.anims.stop(); m.setTexture(`${id}_slide`).setPosition(this.x, this.y + 1); }
    else if (!this.grounded || this.booT > 0) { if (m.anims.isPlaying) m.anims.stop(); m.setTexture(`${id}_${this.vy < 60 ? 'jump' : 'fall'}`).setPosition(this.x, this.y); }
    else if (Math.abs(this.vx) > 30) { if (m.anims.currentAnim?.key !== `${id}_run` || !m.anims.isPlaying) m.play(`${id}_run`); m.setPosition(this.x, this.y); }
    else { if (m.anims.isPlaying) m.anims.stop(); m.setTexture(`${id}_run0`).setPosition(this.x, this.y); }
    this.boo.setVisible(this.booT > 0);
    if (this.booT > 0) this.boo.setPosition(this.x, this.y - MILO_H - 12);
    // his lantern: a small pale-blue flame at his hand
    const hx = this.x + this.face * 10, hy = this.y - 22 + (this.grounded && Math.abs(this.vx) > 30 ? Math.sin(this.t * 14) * 1.5 : 0);
    this.fx.fillStyle(0x0b0918, 1); this.fx.fillRect(hx - 3, hy - 4, 7, 8);
    this.fx.fillStyle(0x4a4558, 1); this.fx.fillRect(hx - 2, hy - 3, 5, 6);
    this.fx.fillStyle(0xdff0ff, 1); this.fx.fillRect(hx - 1, hy - 2, 3, 4);
    this.lantern = { x: hx, y: hy };
  },

  drawParts() {
    const lo = this.fx, hi = this.partG;
    for (const p of this.parts) {
      const k = Math.max(0, p.life / p.max);
      switch (p.kind) {
        case 'ink': lo.fillStyle(INK, Math.min(1, k * 2)); lo.fillRect(p.x - 1, p.y - 1, 3, 3); lo.fillStyle(0x5a2a6a, 0.6 * k); lo.fillRect(p.x, p.y - 1, 1, 1); break;
        case 'shard': lo.fillStyle(0xf2eef8, k); lo.fillRect(p.x, p.y, 2 + (p.ph % 2 > 1 ? 1 : 0), 2); break;
        case 'dust': lo.fillStyle(0xb8b0c8, 0.5 * k); lo.fillRect(p.x, p.y, 2, 2); break;
        case 'tile': lo.fillStyle(0x4a4560, Math.min(1, k * 2)); lo.fillRect(p.x - 5, p.y - 3, 10, 6); break;
        case 'brick': lo.fillStyle(0x3a2e40, Math.min(1, k * 2)); lo.fillRect(p.x - 3, p.y - 2, 7, 4); break;
        case 'ember': hi.fillStyle(k > 0.5 ? 0xe6f4ff : BLUE, k); hi.fillRect(p.x, p.y, 2, 2); break;
        case 'spark': hi.fillStyle(BLUE, k); hi.fillRect(p.x, p.y, 2, 2); break;
        case 'mote': hi.fillStyle(0xe6f4ff, 0.8 * Math.sin(k * Math.PI)); hi.fillRect(p.x, p.y, 1 + (p.ph % 3 > 2 ? 1 : 0), 1); break;
        case 'moth': {
          const f = Math.abs(Math.sin(p.ph)), a = Math.min(1, k * 3);
          hi.fillStyle(0xd8d0e8, a); hi.fillRect(p.x - 1 - Math.round(3 * f), p.y - 1, Math.round(3 * f) + 1, 3); hi.fillRect(p.x + 1, p.y - 1, Math.round(3 * f) + 1, 3);
          hi.fillStyle(0x5a4a62, a); hi.fillRect(p.x, p.y - 1, 1, 4);
          break;
        }
        default: break;
      }
    }
  },

  drawDark() {
    const dg = this.darkG; dg.clear();
    if (this.dark < 0.02) return;
    const cx = (this.lantern?.x ?? this.x) - this.camX, cy = (this.lantern?.y ?? this.y - 22) - this.camY;
    const ring = (R0, R1, a) => {
      dg.fillStyle(0x000000, a);
      const N = 36;
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
        const p = (r, an) => [cx + Math.cos(an) * r, cy + Math.sin(an) * r];
        const [x0, y0] = p(R0, a0), [x1, y1] = p(R0, a1), [X0, Y0] = p(R1, a0), [X1, Y1] = p(R1, a1);
        dg.fillTriangle(x0, y0, X0, Y0, X1, Y1); dg.fillTriangle(x0, y0, X1, Y1, x1, y1);
      }
    };
    const R = 74 + (this.reduce ? 0 : Math.sin(this.t * 9) * 2);
    ring(R, R + 26, this.dark * 0.55); ring(R + 26, 900, this.dark);
  },

  drawGlow() {
    const L = this.glowG;
    // the lantern's own light
    if (this.lantern && this.state !== 'lost') { L.fillStyle(BLUE, 0.1); L.fillCircle(this.lantern.x, this.lantern.y, 22); L.fillStyle(BLUE, 0.16); L.fillCircle(this.lantern.x, this.lantern.y, 9); }
    // the swing: a pale-blue arc
    if (this.hitT > 0) {
      const k = 1 - this.hitT / HIT_T;
      L.fillStyle(BLUE, 0.4 * (1 - k)); L.beginPath(); const st = this.face > 0 ? -1.2 : Math.PI + 1.2; L.slice(this.x, this.y - 26, HIT_RANGE, st, st + this.face * 2.4 * k, this.face < 0); L.fillPath();
    }
    // the Penlight: a beam that burns through the dark, dust floating in it
    const b = this.beam;
    if (b) {
      const k = b.t / 0.6, ox = this.x, oy = this.y - 26;
      const P = (an, r) => [ox + Math.cos(an) * r, oy + Math.sin(an) * r];
      const [x1, y1] = P(b.ang - 0.17, b.len), [x2, y2] = P(b.ang + 0.17, b.len), [x3, y3] = P(b.ang - 0.05, b.len), [x4, y4] = P(b.ang + 0.05, b.len);
      L.fillStyle(BLUE, 0.35 * k); L.fillTriangle(ox, oy, x1, y1, x2, y2);
      L.fillStyle(0xeaf6ff, 0.55 * k); L.fillTriangle(ox, oy, x3, y3, x4, y4);
      L.fillStyle(0xffffff, 0.8 * k); L.fillCircle(ox, oy, 6);
      for (let i = 0; i < 3; i++) { const r = rnd(20, b.len), an = b.ang + rnd(-0.15, 0.15); const [mx, my] = P(an, r); this.part('mote', mx, my, rnd(-12, 12), rnd(-16, 4)); }
    }
  },

  renderUI() {
    const u = this.ui; u.clear();
    const fighting = this.state === 'fight';
    // her bar, three acts
    u.fillStyle(0x140f24, 0.9); u.fillRect(W / 2 - 101, 19, 202, 8);
    u.fillStyle(0xd9d0a8, 1); u.fillRect(W / 2 - 100, 20, 200 * Math.max(0, this.hp) / this.def.hp, 6);
    u.fillStyle(0x140f24, 1); u.fillRect(W / 2 - 100 + 200 / 3 - 1, 19, 2, 8); u.fillRect(W / 2 - 100 + 400 / 3 - 1, 19, 2, 8);
    for (let i = 0; i < HEARTS; i++) { u.fillStyle(i < this.hearts ? 0xff6b7d : 0x3a3646, 1); u.fillRect(W - 98 + i * 16, 8, 11, 10); }
    u.fillStyle(this.booUsed ? 0x3a3646 : 0xe6f0ff, 1); u.fillCircle(W - 110, 13, 5);
    // the Penlight's charge, pale blue (magic light)
    if (this.power) {
      const ready = this.charge >= 1;
      u.fillStyle(0x3a3646, 1); u.fillRect(W - 98, 22, 75, 4);
      u.fillStyle(ready ? BLUE : 0x5a7a9a, 1); u.fillRect(W - 98, 22, 75 * this.charge, 4);
      const showBtn = fighting && ready && this.touch;
      this.powerLabel.setVisible(showBtn);
      if (showBtn) {
        const big = this.bstate === 'cracked' ? 1.25 + 0.1 * Math.sin(this.t * 10) : 1;
        u.fillStyle(BLUE, 0.8 + 0.2 * Math.sin(this.t * 8)); u.fillCircle(POWER_BTN.x, POWER_BTN.y, POWER_BTN.r * big);
        this.powerLabel.setScale(big);
      }
      if (fighting && ready && !this.touch && !this.noteUntil) this.noteText.setText(Device.get() === 'gamepad' ? 'X  LIGHT' : 'E  LIGHT');
      else if (!this.noteUntil && this.noteText.text.endsWith('LIGHT')) this.noteText.setText('');
    }
    // where she is, when she's off the screen
    if (fighting) {
      const c = this.bossCenter(), sx = c.x - this.camX, sy = c.y - this.camY;
      if (sx < 0 || sx > W || sy < 30 || sy > H) {
        const ax = clamp(sx, 14, W - 14), ay = clamp(sy, 40, H - 14), an = Math.atan2(sy - ay, sx - ax);
        const col = this.isOpen() || this.bstate === 'cracked' ? GOLD : /^tell|rail|lock/.test(this.bstate) ? RED : 0xd9d0a8;
        u.fillStyle(col, 0.85);
        u.fillTriangle(ax + Math.cos(an) * 10, ay + Math.sin(an) * 10, ax + Math.cos(an + 2.4) * 8, ay + Math.sin(an + 2.4) * 8, ax + Math.cos(an - 2.4) * 8, ay + Math.sin(an - 2.4) * 8);
      }
    }
    const tm = this.thumbs.move;
    if (fighting && tm) {
      const dx = clamp(tm.x - tm.x0, -36, 36);
      u.lineStyle(2, 0xffffff, 0.22); u.strokeCircle(tm.x0, tm.y0, 36);
      u.fillStyle(0xffffff, 0.2); u.fillCircle(tm.x0 + dx, tm.y0, 14);
    }
    this.lineText.setText(this.say.t > 0 ? this.say.text : '').setAlpha(Math.min(1, this.say.t * 3));
    this.promptText.setText(this.prompt.t > 0 && fighting ? this.prompt.text : '').setAlpha(Math.min(1, this.prompt.t * 3)).setScale(1 + 0.04 * Math.sin(this.t * 8));
    this.actText.setAlpha(Math.min(1, this.actT * 2) * (this.state === 'won' ? 0 : 1));
    if (this.choice) {
      const k = 1 - Math.max(0, this.hp) / this.def.hp;
      u.fillStyle(0x140f24, 0.95); u.fillRect(W / 2 - 121, 189, 242, 12);
      u.fillStyle(0xd9d0a8, 1); u.fillRect(W / 2 - 120, 190, 240 * k, 10);
      u.fillStyle(0x140f24, 1); u.fillRect(W / 2 - 120 + 80 - 1, 189, 2, 12); u.fillRect(W / 2 - 120 + 160 - 1, 189, 2, 12);
      u.fillStyle(0xffd75e, 1); u.fillRect(W / 2 - 150, 234, 120, 32);
      u.lineStyle(2, 0xe6f0ff, 0.8); u.strokeRect(W / 2 + 30, 234, 120, 32);
    }
  },
};
