// THE WRONG SIDE OF THE BED: the playable opening (first launch, or ?opening=1).
// 1 AWAKENING: black, the monitor, the clock flips to 3:33, the power dies, Milo rises out of his body.
// 2 DISCOVERY: walk the room; at the bed his hand goes through his own, the Ghostline shows (wrist -> floor).
// 3 THE SHADOW: near the exit the vent stops, keys click, something behind bed 8's curtain, a long shadow creeps.
// 4 BOO: a lantern lights in the doorway, the shadow flinches, three lines, end (replay / temporary handoff).
// Self-contained: own art (opening-art.js), own sound (opening-audio.js), own camera that follows Milo's world x.
// Story beats fire on where the player goes, never on a clock. Nothing here can hurt Milo.
import { W, H } from '../data.js';
import { Save } from '../save.js';
import { Audio } from '../audio.js';
import { text, button, focusGroup } from '../ui.js';
import { createInput, Device } from '../input.js';
import { makeOpeningArt, OP_L, ROOM_W, LAMPS } from '../opening-art.js';
import { makeOpeningAudio } from '../opening-audio.js';

const L = OP_L;
const WORLD_W = ROOM_W * L; // 1120
const FEET = 320;
const SPEED = 105, ACCEL = 1000, GRAV = 1150, JUMP_V = 400;
// key places in world px
const P = {
  clock: { x: 152, y: 200 },
  bed: { x: 262, y: 222 },
  bodyWrist: { x: 283, y: 213 },
  under: { x: 262, y: 288 }, // where the Ghostline goes into the floor (down to the well)
  land: 400, discoverX: 345, reachX: 322, nudgeX: 760,
  shadowAt: 640, curtainEdge: 566, maxX: 815, minX: 40, door: 950,
  window: { x: 615, y: 65, w: 110, h: 110 },
  monitor: { x: 35, y: 105, w: 70, h: 50 },
  chair: { x0: 783, x1: 822, y: 275 },
};
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

export class OpeningScene extends Phaser.Scene {
  constructor() { super('opening'); }

  init() {
    this.phase = 'gate';
    this.control = false;
    this.t = 0;
    this.tl = []; this.tlT = 0;
    this.flags = { discover: 0, shadow: 0, boo: 0, ended: 0 };
    this.m = { x: P.bed.x, y: FEET, vx: 0, vy: 0, ground: true, face: -1, shown: false, walkT: 0 };
    this.auto = null;
    this.cam = { x: P.clock.x, y: P.clock.y, z: 5 };
    this.camT = { ...this.cam }; this.camK = 3; this.camMode = 'fixed'; this.look = -30;
    this.lb = 1; this.lbT = 1; // letterbox
    this.fade = 1; this.fadeT = 1; this.fadeK = 1.5;
    this.beatOn = false; this.beatT = 0.3; this.hr = 62; this.hrT = 62; this.loud = 0; this.battery = false;
    this.ecg = new Array(14).fill(0); this.ecgCol = 0; this.ecgAcc = 0; this.ecgQ = [];
    this.clockState = '32'; this.blackout = 0;
    this.lamps = 1; this.flicker = 0; this.dark = 0.35; this.darkT = 0.35; this.warm = 1;
    this.elamp = 0; this.elampT = 0; this.eFlick = 0; this.cold = 0; this.coldT = 0; this.flash = 0; this.nextFlash = 18;
    this.rise = -1; this.reach = 0; this.reachT = 0; this.ripple = -1; this.line = -1; this.lineK = 1;
    this.sil = { x: 400, a: 0, aT: 0, sway: 0, flash: 0, move: false };
    this.sh = { on: false, t: 0, tip: P.curtainEdge, wall: 0, recoil: 0, lurch: 0 };
    this.boo = { a: 0, aT: 0, x: P.door, y: 232, face: -1 };
    this.lantern = 0; this.lanternT = 0; this.lanternShown = false;
    this.thumb = null; this.jumpTap = false;
    this.moved = 0; this.hintShown = false; this.nudged = false; this.glance = 0;
    this.bubble = null; this.motes = []; this.moteT = 0; this.ghostFlick = 0;
    this.debugInput = null;
  }

  create() {
    makeOpeningArt(this);
    this.snd = null; // made on the first input (browsers need a gesture)
    this.worldL = this.add.layer();
    this.uiL = this.add.layer();
    const cam = this.cameras.main;
    cam.setBackgroundColor('#000000');
    this.uiCam = this.cameras.add(0, 0, W, H);
    // each camera skips the other's layer (set on the layer, so children added later follow)
    this.uiL.cameraFilter |= cam.id;
    this.worldL.cameraFilter |= this.uiCam.id;
    const w = (o, d) => { o.setDepth(d); this.worldL.add(o); return o; };
    const u = (o, d = 0) => { o.setDepth(d); this.uiL.add(o); return o; };
    const img = (x, y, key, d, ox = 0, oy = 0) => w(this.add.image(x, y, key).setOrigin(ox, oy).setScale(L), d);
    const add = (key, x, y, d, sx = 1, sy = sx) => w(this.add.image(x, y, key).setScale(sx, sy).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0), d);

    // ---- the room ----
    this.outside = img(390, 60, 'op_outside', -3).setScrollFactor(0.7, 1);
    this.winG = w(this.add.graphics(), -2);
    img(0, 0, 'op_room', 0);
    this.glassG = w(this.add.graphics(), 0.5);
    this.monG = w(this.add.graphics(), 1);
    this.clock = img(110, 180, 'op_clock_32', 1);
    this.bulbs = LAMPS.map((lx) => img((lx - 2) * L, 16 * L, 'op_bulb_on', 1));
    this.elampSpr = img(50 * L, 24 * L, 'op_elamp_on', 1).setAlpha(0);
    this.exitSpr = img(181 * L, 4 * L, 'op_exit_lit', 1).setAlpha(0.85);
    img(66 * L, 9 * L, 'op_curtain_bunch', 1);
    this.panels = [0, 1, 2, 3].map((i) => w(this.add.image((74 + i * 10 + 5) * L, 9 * L, 'op_curtain').setOrigin(0.5, 0).setScale(L), 1));
    this.silCurtain = w(this.add.image(400, 268, 'op_sil0').setOrigin(0.5, 1).setAlpha(0), 1.2);
    // the boy in the bed
    this.blanket = img(46 * L, 48 * L, 'op_blanket', 2, 0, 1);
    img(41.8 * L, 45 * L, 'op_body_head', 2.1, 0, 1);
    img(48 * L, 42.6 * L, 'op_body_collar', 2.05);
    img(48.6 * L, 40.6 * L, 'op_body_arm', 2.2);
    this.chair = img(156 * L, FEET, 'op_chair', 3, 0, 1);

    // ---- light: darkness over the room, then light added back ----
    this.darkR = w(this.add.rectangle(0, 0, WORLD_W, H, 0x000000).setOrigin(0), 6);
    this.coldR = w(this.add.rectangle(0, 0, WORLD_W, H, 0x0a1838).setOrigin(0).setAlpha(0), 6.2);
    this.warmR = w(this.add.rectangle(0, 0, WORLD_W, H, 0xffa040).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.05), 6.4);
    this.lampL = LAMPS.map((lx) => ({
      g: add('op_glow_warm', lx * L, 84, 7, 2.2), p: add('op_pool_warm', lx * L, 304, 7, 3), s: add('op_streak_warm', lx * L, 296, 7, 2, 1.1).setOrigin(0.5, 0),
    }));
    this.eL = { g: add('op_glow_amber', 257, 128, 7, 3.8), p: add('op_pool_amber', 262, 302, 7, 3.4), s: add('op_streak_amber', 257, 294, 7, 2.2, 1.2).setOrigin(0.5, 0) };
    this.winL = { g: add('op_glow_cold', 670, 120, 7, 2.8), p: add('op_pool_cold', 670, 304, 7, 3.6), s: add('op_streak_cold', 670, 294, 7, 4, 1.2).setOrigin(0.5, 0) };
    this.monL = { g: add('op_glow_green', 70, 130, 7, 1.4), p: add('op_pool_green', 70, 298, 7, 1.3) };
    this.exitL = add('op_glow_red', 952, 40, 7, 1.2).setAlpha(0.3);
    this.clockL = add('op_glow_red', 152, 200, 7, 0.9);
    this.lanL = { g: add('op_glow_amber', P.door, 260, 7, 4), c: add('op_glow_warm', P.door, 260, 7.1, 1.3), p: add('op_pool_amber', P.door, 312, 7, 4.6), s: add('op_streak_amber', P.door, 300, 7, 2.6, 1).setOrigin(0.5, 0) };
    // ---- THE STRETCH: only ever its shadow ----
    this.silWall = w(this.add.image(0, 252, 'op_sil0').setOrigin(0.5, 1).setAlpha(0), 7.5);
    this.shG = w(this.add.graphics(), 7.6);
    // ---- Milo's spirit, the Ghostline, Boo ----
    this.ghostL = { g: add('op_glow_blue', 0, 0, 9.5, 1.7), p: add('op_pool_blue', 0, 0, 9.4, 1.3) };
    this.ghost = w(this.add.image(0, 0, 'op_milo_idle').setScale(L).setOrigin(0.5, 1).setAlpha(0), 10);
    this.armG = w(this.add.graphics(), 10.2);
    this.lineG = w(this.add.graphics(), 10.5);
    this.boo.spr = w(this.add.image(P.door, 232, 'op_boo0').setScale(L).setAlpha(0).setFlipX(true), 11);
    this.lanSpr = w(this.add.image(P.door, 220, 'op_lantern_off').setScale(L).setOrigin(0.5, 0).setAlpha(0), 11.1);

    // ---- screen layer (not zoomed) ----
    this.vig = u(this.add.image(W / 2, H / 2, 'op_vignette').setScale(4).setAlpha(0.9), 0);
    this.flashR = u(this.add.rectangle(0, 0, W, H, 0xcfe0ff).setOrigin(0).setAlpha(0), 1);
    this.barT = u(this.add.rectangle(0, 0, W, 28, 0x000000).setOrigin(0), 2);
    this.barB = u(this.add.rectangle(0, H, W, 28, 0x000000).setOrigin(0, 1), 2);
    this.stickG = u(this.add.graphics(), 3);
    this.bubG = u(this.add.graphics(), 4);
    this.bubT = u(text(this, 0, 0, '', 8, '#e6f0ff', 0), 5);
    this.hint = u(text(this, W / 2, H - 46, '', 8, '#9aa6c8').setAlpha(0), 5);
    this.caption = u(text(this, 18, H - 44, 'ST. MERCY.  WARD 4.  3:33 AM', 8, '#8f9abc', 0).setAlpha(0), 5);
    this.fadeR = u(this.add.rectangle(0, 0, W, H, 0x000000).setOrigin(0), 8);
    this.gate = [
      u(text(this, W / 2, H / 2 - 10, 'PRESS ANY KEY OR TAP', 8, '#a8b0d0'), 9),
      u(text(this, W / 2, H / 2 + 14, 'HEADPHONES ON', 8, '#4a5070'), 9),
    ];

    // ---- input: keys + gamepad from the action map; touch = left thumb moves, right tap jumps ----
    this.im = createInput(this, { pointers: false });
    this.input.on('pointerdown', (p) => {
      if (p.__ui) return;
      if (this.phase === 'gate') { this.begin(); return; }
      if (!this.control) return;
      if (p.x < W / 2) { if (!this.thumb) this.thumb = { id: p.id, x0: p.x, x: p.x }; } else this.jumpTap = true;
    });
    this.input.on('pointermove', (p) => { if (this.thumb && this.thumb.id === p.id) this.thumb.x = p.x; });
    const up = (p) => { if (this.thumb && this.thumb.id === p.id) this.thumb = null; };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    this.input.keyboard.on('keydown', () => { if (this.phase === 'gate') this.begin(); });
    this.events.once('shutdown', () => { if (this.snd) this.snd.stop(); if (window.__opening === this) window.__opening = null; });
    window.__opening = this; // tests + playtests

    Audio.music(null);
    Audio.ambience(null);
    if (Audio.running()) this.begin();
    this.applyCam();
  }

  // ---------------------------------------------------------------- story
  begin() {
    if (this.phase !== 'gate') return;
    this.phase = 'intro';
    this.snd = makeOpeningAudio();
    Audio.music(null);
    this.gate.forEach((g) => g.setVisible(false));
    const s = this.snd;
    this.run([
      [0, () => { s.rain(0.45, true); s.vent(true); this.beatOn = true; }],
      [1.3, () => { this.fadeT = 0; this.fadeK = 1.6; }],
      [2.9, () => { this.clockState = '33'; s.flip(); this.tw(this.caption, 1, 700); }],
      [3.9, () => { s.fail(); this.flicker = 0.62; }],
      [4.52, () => {
        this.flicker = 0; this.lamps = 0; this.clockState = 'off'; this.darkT = 0.62; this.warm = 0; this.blackout = 0.35;
        this.tw(this.caption, 0, 600);
        s.rain(0.55, false, 1.5);
      }],
      [4.9, () => { this.battery = true; s.batteryChirp(); }],
      [5.3, () => { this.elampT = 1; this.eFlick = 0.5; s.clunk(); this.camTo(P.bed.x + 10, 215, 2.4, 1.5); }],
      [6.1, () => { this.rise = 0; this.m.shown = true; s.rise(); s.pad(1, 2); }],
      [9.2, () => { this.loud = 2; this.camTo((P.bed.x + P.land) / 2 - 10, 250, 2.0, 2); }],
      [10.6, () => this.giveControl('explore')],
    ]);
  }

  giveControl(phase) {
    this.phase = phase;
    this.control = true;
    this.camMode = 'follow'; this.camK = 2.2;
    this.lbT = 0;
  }

  lockControl() {
    this.control = false; this.thumb = null; this.jumpTap = false;
    this.lbT = 1;
    this.tw(this.hint, 0, 300);
  }

  startDiscover() {
    this.flags.discover++;
    this.phase = 'discover';
    this.lockControl();
    this.walkTo(P.reachX, 70, () => {
      this.m.face = -1;
      const s = this.snd;
      this.camTo(300, 236, 1.8, 2.2);
      this.run([
        [0.3, () => { this.reachT = 1; }],
        [0.95, () => { this.reachT = 1.3; s.through(); this.ripple = 0; this.ghostFlick = 0.45; this.loud = 2; }],
        [1.5, () => { this.reachT = 0; this.m.x += 6; }],
        [2.0, () => { this.line = 0; s.line(); }],
        [3.8, () => this.say('milo', 'WHAT...?', 1.9)],
        [5.5, () => this.giveControl('explore2')],
      ]);
    });
  }

  startShadow() {
    this.flags.shadow++;
    this.phase = 'shadow';
    const s = this.snd;
    this.run([
      [0, () => { s.vent(false, { abrupt: true }); s.rain(0.1, true, 0.12); s.pad(0, 0.15); this.hrT = 78; }],
      [1.3, () => s.keys(0.35)],
      [2.1, () => { s.keys(0.6); s.curtain(0.7); this.sil.sway = 1; }],
      [2.8, () => { this.lightning(1); this.sil.x = 430; this.sil.flash = 0.35; this.coldT = 0.45; s.cold(1, 2); }],
      [3.4, () => s.thunder(0.6)],
      [3.7, () => { s.creak(); this.sil.aT = 0.14; this.sil.move = true; }],
      [5.3, () => { this.sh.on = true; s.breath(1); s.curtain(1); this.hrT = 92; this.darkT = 0.7; }],
      [6.6, () => s.keys(0.85)],
    ]);
  }

  startBoo() {
    this.flags.boo++;
    this.phase = 'boo';
    this.lockControl();
    this.m.vx = 0; this.m.face = 1;
    const s = this.snd;
    const midX = (this.m.x + P.door) / 2;
    this.run([
      [0, () => { s.strike(); this.lanternShown = true; this.lanternT = 0.15; }],
      [0.35, () => { s.ignite(); s.hum(1, 0.2); this.lanternT = 1; this.camTo(midX, 225, 1.3, 2.2); this.hrT = 104; }],
      [0.6, () => { s.recoil(); this.sh.recoil = 1; this.coldT = 0.2; this.darkT = 0.6; this.shake(260, 0.004); }],
      [1.0, () => { this.boo.aT = 1; s.rain(0.35, false, 1.5); }],
      [1.9, () => this.say('boo', 'THERE YOU ARE.', 1.9)],
      [4.0, () => this.say('milo', 'DO I KNOW YOU?', 1.9)],
      [6.1, () => { this.say('boo', 'LATER. RUN.', 1.6); }],
      [6.9, () => { this.boo.face = 1; s.lunge(); this.sh.lurch = 1; this.walkTo(P.maxX + 40, 150, null, true); this.boo.go = true; }],
      [7.8, () => { this.fadeT = 1; this.fadeK = 1.3; s.fade(0.3, 0.8); }],
      [9.4, () => this.showEnd()],
    ]);
  }

  showEnd() {
    this.phase = 'end';
    this.flags.ended++;
    this.lbT = 0;
    Save.update((s) => { s.storySeen = true; });
    const u = (o, d) => { o.setDepth(d); this.uiL.add(o); return o; };
    u(text(this, W / 2, 112, 'THE WRONG SIDE OF THE BED', 16, '#e8dcc0'), 10);
    u(text(this, W / 2, 142, 'END OF THE OPENING. THE CORRIDOR IS NEXT.', 8, '#7f88a8'), 10);
    const b1 = button(this, W / 2 - 124, 214, 'REPLAY OPENING', () => this.scene.restart(), { w: 220, h: 38, size: 8 });
    const b2 = button(this, W / 2 + 124, 214, 'CONTINUE TO THE RUN', () => this.toRun(), { w: 220, h: 38, size: 8 });
    [b1, b2].forEach((b) => [b.bg, b.lbl, b.ring].forEach((o) => u(o, 11)));
    u(text(this, W / 2 + 124, 246, '(TEMPORARY HANDOFF)', 8, '#5a6080'), 10);
    this.endGroup = focusGroup(this, [b1, b2], { horizontal: true });
  }

  toRun() {
    if (this.leaving) return;
    this.leaving = true;
    this.im.claimPointers();
    this.scene.start('play');
  }

  // ---------------------------------------------------------------- helpers
  run(list) { this.tl = list.map(([t, fn]) => ({ t, fn, done: false })); this.tlT = 0; }
  camTo(x, y, z, k = 2) { this.camMode = 'fixed'; this.camT = { x, y, z }; this.camK = k; }
  walkTo(x, speed, done, run = false) { this.auto = { x, speed, done, run }; }
  tw(o, alpha, ms) { this.tweens.killTweensOf(o); this.tweens.add({ targets: o, alpha, duration: ms }); }
  say(who, str, dur) { this.bubble = { who, str, n: 0, t: 0, dur, acc: 0 }; }
  lightning(v) { this.flash = Math.max(this.flash, v); }
  shake(ms, k) { if (Save.get().settings.shake) this.cameras.main.shake(ms, k); }
  wrist() { return { x: this.m.x - 20, y: this.m.y - 42 + this.bob() }; }
  bob() { return this.m.ground && Math.abs(this.m.vx) < 10 && this.rise < 0 ? Math.round(Math.sin(this.t * 2.2) * 1.5) : 0; }

  readInput() {
    if (this.debugInput) return { x: this.debugInput.x || 0, jump: !!this.debugInput.jump, held: !!this.debugInput.jump };
    let x = 0;
    if (this.im.held('left')) x -= 1;
    if (this.im.held('right')) x += 1;
    if (this.thumb) { const d = this.thumb.x - this.thumb.x0; if (Math.abs(d) > 8) x = clamp(d / 34, -1, 1); }
    const jump = this.im.pressed('float') || this.jumpTap;
    this.jumpTap = false;
    return { x, jump, held: this.im.held('float') };
  }

  update(time, delta) {
    this.im.update();
    if (this.phase === 'gate' && (this.im.pressed('confirm') || this.im.pressed('float'))) this.begin();
    if (this.phase === 'end' && this.endGroup && !this.leaving) this.endGroup.handle(this.im);
    this.step(Math.min(delta / 1000, 0.05));
    this.render();
  }

  // ---------------------------------------------------------------- simulation
  step(dt) {
    this.t += dt;
    this.tlT += dt;
    for (const e of this.tl) if (!e.done && this.tlT >= e.t) { e.done = true; e.fn(); }
    const s = this.snd;
    const m = this.m;

    // heart monitor (it never stops: battery backup)
    this.hr = lerp(this.hr, this.hrT, 1 - Math.exp(-dt * 0.8));
    if (this.beatOn) {
      this.beatT -= dt;
      if (this.beatT <= 0) {
        this.beatT += 60 / this.hr;
        if (s) s.beep({ battery: this.battery, loud: this.loud > 0 });
        this.loud = Math.max(0, this.loud - 1);
        this.ecgQ.push(-1, -5, 3, 0);
      }
    }
    this.ecgAcc += dt;
    while (this.ecgAcc > 0.07) { this.ecgAcc -= 0.07; this.ecgCol = (this.ecgCol + 1) % this.ecg.length; this.ecg[this.ecgCol] = this.ecgQ.length ? this.ecgQ.shift() : 0; }
    this.blackout = Math.max(0, this.blackout - dt);

    // light
    if (this.flicker > 0) { this.flicker -= dt; this.lamps = this.flicker > 0 && Math.random() < 0.55 ? 1 : 0.15; }
    this.dark = lerp(this.dark, this.darkT, 1 - Math.exp(-dt * 3));
    this.elamp = lerp(this.elamp, this.elampT, 1 - Math.exp(-dt * 6));
    if (this.eFlick > 0) { this.eFlick -= dt; if (Math.random() < 0.4) this.elamp = 0.1; }
    if (this.phase === 'shadow' && this.sh.on && Math.random() < dt * 2.5) this.elamp *= 0.35; // it flickers when it comes
    this.cold = lerp(this.cold, this.coldT, 1 - Math.exp(-dt * 0.9));
    this.flash = Math.max(0, this.flash - dt * 2.2);
    if (this.phase === 'explore' || this.phase === 'explore2') {
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) { this.lightning(0.6); this.nextFlash = 16 + Math.random() * 10; if (s) this.time.delayedCall(900, () => this.snd && this.snd.thunder(0.35)); }
    }
    this.lantern = lerp(this.lantern, this.lanternT, 1 - Math.exp(-dt * (this.lanternT > 0.5 ? 7 : 3)));
    this.boo.a = lerp(this.boo.a, this.boo.aT, 1 - Math.exp(-dt * 3));

    // the rise: out of the body, upright, then down to the floor beside the bed
    if (this.rise >= 0) {
      this.rise += dt;
      if (this.rise >= 3.0) { this.rise = -1; m.x = P.land; m.y = FEET; m.ground = true; m.face = -1; s && s.land(); }
    }

    // movement (player, or an automatic walk in a beat)
    if (this.rise < 0 && this.phase !== 'intro' && this.phase !== 'gate') {
      let ix = 0, jump = false, held = false;
      if (this.control) ({ x: ix, jump, held } = this.readInput());
      else if (this.auto) {
        const d = this.auto.x - m.x;
        if (Math.abs(d) < 3) { m.x = this.auto.x; m.vx = 0; const done = this.auto.done; this.auto = null; if (done) done(); }
        else ix = Math.sign(d) * (this.auto.speed / SPEED);
      }
      m.vx += clamp(ix * SPEED - m.vx, -ACCEL * dt, ACCEL * dt);
      if (ix) { m.face = Math.sign(ix); this.glance = 0; }
      if (jump && m.ground) { m.vy = -JUMP_V; m.ground = false; s && s.jump(); }
      const py = m.y;
      if (!m.ground) m.vy += (m.vy < 0 && held ? GRAV * 0.6 : GRAV) * dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      const maxX = this.auto && this.auto.run ? P.maxX + 45 : P.maxX;
      m.x = clamp(m.x, P.minX, maxX);
      const onChair = m.x > P.chair.x0 && m.x < P.chair.x1;
      if (m.vy >= 0 && !m.ground) {
        if (onChair && py <= P.chair.y && m.y >= P.chair.y) { m.y = P.chair.y; m.vy = 0; m.ground = true; s && s.land(); }
        else if (m.y >= FEET) { m.y = FEET; m.vy = 0; m.ground = true; s && s.land(); }
      }
      if (m.ground && m.y < FEET && !onChair) m.ground = false;
      this.moved += Math.abs(m.vx * dt);
      m.walkT += Math.abs(m.vx) * dt / 15;
    }

    // story triggers: where Milo goes, never a timer
    if (this.phase === 'explore') {
      if (m.x < P.discoverX) this.startDiscover();
      else if (m.x > P.nudgeX && !this.nudged) { this.nudged = true; this.loud = 2; this.glance = 1.4; } // the monitor calls him back
      if (!this.hintShown && this.tlT > 12.6 && this.moved < 30) { this.hintShown = true; this.showHint(); }
    }
    if ((this.phase === 'explore' || this.phase === 'explore2') && this.hintShown && this.moved > 90) this.tw(this.hint, 0, 400);
    if (this.phase === 'explore2' && m.x > P.shadowAt) this.startShadow();
    this.glance = Math.max(0, this.glance - dt);

    // reach + the Ghostline
    this.reach = lerp(this.reach, this.reachT, 1 - Math.exp(-dt * (this.reachT > this.reach ? 5 : 9)));
    if (this.ripple >= 0) { this.ripple += dt; if (this.ripple > 1) this.ripple = -1; }
    if (this.line >= 0 && this.line < 1) this.line = Math.min(1, this.line + dt / 1.6);
    this.ghostFlick = Math.max(0, this.ghostFlick - dt);

    // the curtain and the thing behind it
    const sil = this.sil;
    if (sil.move) sil.x = Math.min(545, sil.x + dt * 70);
    if (sil.flash > 0) sil.flash -= dt;
    sil.a = lerp(sil.a, this.sh.on ? 0 : sil.aT, 1 - Math.exp(-dt * 2));

    // its shadow: out from under the curtain, along the floor and up the wall, toward Milo
    const sh = this.sh;
    if (sh.on) {
      sh.t += dt;
      sh.wall = Math.min(1, sh.wall + dt / 1.6);
      if (sh.recoil > 0) {
        const away = Math.max(P.curtainEdge + 30, m.x - 250);
        sh.tip = lerp(sh.tip, away, 1 - Math.exp(-dt * 6));
        if (sh.lurch) sh.tip = lerp(sh.tip, m.x - 150, 1 - Math.exp(-dt * 2));
      } else sh.tip = Math.min(m.x - 45, sh.tip + dt * 50);
      if (this.phase === 'shadow' && (sh.tip > m.x - 170 || m.x >= P.maxX - 4 || sh.t > 7)) this.startBoo();
    }
    if (this.phase === 'shadow' && !sh.on && this.tlT > 9) { sh.on = true; } // safety: never stall

    // Boo drifts into the corridor at the end
    if (this.boo.go) this.boo.x = Math.min(P.door + 40, this.boo.x + dt * 60);

    // bubble
    const b = this.bubble;
    if (b) {
      b.t += dt;
      const n = Math.min(b.str.length, Math.floor(b.t * 28));
      if (n > b.n) { b.n = n; if (s && b.str[n - 1] !== ' ' && n % 2) s.blip(b.who === 'boo' ? 330 : 620); }
      if (b.t > b.dur + b.str.length / 28) this.bubble = null;
    }

    // ghost motes
    this.moteT -= dt;
    if (m.shown && this.moteT <= 0) { this.moteT = 0.14; this.motes.push({ x: m.x + (Math.random() - 0.5) * 30, y: m.y - 10 - Math.random() * 60, life: 1 }); }
    this.motes.forEach((p) => { p.y -= dt * 14; p.life -= dt * 0.9; });
    this.motes = this.motes.filter((p) => p.life > 0);

    // camera: follows Milo's world x with a little look-ahead; beats frame things on their own
    if (this.camMode === 'follow') {
      this.look = lerp(this.look, m.face * 55, 1 - Math.exp(-dt * 1.8));
      this.camT = { x: m.x + this.look, y: 180, z: 1 };
    }
    const k = 1 - Math.exp(-dt * this.camK);
    this.cam.x = lerp(this.cam.x, this.camT.x, k);
    this.cam.y = lerp(this.cam.y, this.camT.y, k);
    this.cam.z = lerp(this.cam.z, this.camT.z, k);
    this.lb = lerp(this.lb, this.lbT, 1 - Math.exp(-dt * 4));
    this.fade = lerp(this.fade, this.fadeT, 1 - Math.exp(-dt * this.fadeK * 2));
    this.applyCam();
  }

  applyCam() {
    const c = this.cam, z = c.z;
    const hw = W / (2 * z), hh = H / (2 * z);
    c.x = clamp(c.x, hw, WORLD_W - hw);
    c.y = clamp(c.y, hh, H - hh);
    const cam = this.cameras.main;
    cam.setZoom(z);
    cam.centerOn(c.x, c.y);
  }
  toScreen(x, y) { return { x: (x - this.cam.x) * this.cam.z + W / 2, y: (y - this.cam.y) * this.cam.z + H / 2 }; }

  showHint() {
    const d = Device.get();
    const str = d === 'touch' ? 'DRAG LEFT THUMB: MOVE    TAP RIGHT: JUMP'
      : d === 'gamepad' ? 'STICK: MOVE    A: JUMP' : 'A D / ARROWS: MOVE    SPACE: JUMP';
    this.hint.setText(str);
    this.tw(this.hint, 0.85, 600);
  }

  // ---------------------------------------------------------------- drawing
  render() {
    const t = this.t, m = this.m;
    // lights
    const lamp = this.lamps;
    this.bulbs.forEach((b) => b.setTexture(lamp > 0.5 ? 'op_bulb_on' : this.t < 6.5 && this.phase === 'intro' ? 'op_bulb_ember' : 'op_bulb_off'));
    this.lampL.forEach((l) => { l.g.setAlpha(lamp * 0.5); l.p.setAlpha(lamp * 0.32); l.s.setAlpha(lamp * 0.22); });
    this.warmR.setAlpha(this.warm * lamp * 0.05);
    this.darkR.setAlpha(this.dark);
    this.coldR.setAlpha(this.cold * 0.75);
    const e = this.elamp * (1 - this.cold * 0.35);
    this.elampSpr.setAlpha(e);
    this.eL.g.setAlpha(e * 0.62); this.eL.p.setAlpha(e * 0.42); this.eL.s.setAlpha(e * 0.28);
    const f = this.flash;
    this.winL.g.setAlpha(0.2 + f * 0.6); this.winL.p.setAlpha(0.26 + f * 0.5); this.winL.s.setAlpha(0.18 + f * 0.4);
    this.flashR.setAlpha(f * 0.1);
    const mon = this.blackout > 0 ? 0 : 1;
    this.monL.g.setAlpha(mon * 0.3); this.monL.p.setAlpha(mon * 0.14);
    this.clock.setTexture(`op_clock_${this.clockState}`);
    this.clockL.setAlpha(this.clockState === 'off' ? 0 : (lamp > 0.5 ? 0.35 : 0.1));
    this.exitL.setAlpha(0.22 + Math.sin(t * 1.3) * 0.03);
    // lantern + Boo
    const la = this.lantern;
    const boo = this.boo, bob = Math.sin(t * 2) * 3;
    boo.spr.setTexture(Math.floor(t * 5) % 2 ? 'op_boo1' : 'op_boo0').setPosition(Math.round(boo.x), Math.round(boo.y + bob)).setAlpha(boo.a * 0.95).setFlipX(boo.face < 0);
    const lx = boo.x + (boo.face < 0 ? -42 : 42), ly = boo.y - 2 + bob;
    this.lanSpr.setVisible(this.lanternShown).setAlpha(this.lanternShown ? 1 : 0).setTexture(la > 0.3 ? 'op_lantern_on' : 'op_lantern_off')
      .setPosition(Math.round(lx), Math.round(ly)).setAngle(Math.sin(t * 1.7) * 7 + (boo.go ? 12 : 0));
    const lfl = la * (0.92 + Math.sin(t * 17) * 0.04 + Math.sin(t * 7.3) * 0.04);
    const lc = { x: lx, y: ly + 26 };
    this.lanL.g.setPosition(lc.x, lc.y).setAlpha(lfl * 0.62);
    this.lanL.c.setPosition(lc.x, lc.y).setAlpha(lfl * 0.9);
    this.lanL.p.setPosition(lc.x - 10, 312).setAlpha(lfl * 0.5);
    this.lanL.s.setPosition(lc.x, 300).setAlpha(lfl * 0.32);

    this.drawWindow();
    this.drawMonitor();
    this.drawCurtain();
    this.drawShadow();
    this.drawGhost();
    this.drawLine();
    this.drawUi();
    // breathing
    this.blanket.setScale(L, L * (1 + 0.05 * Math.max(0, Math.sin(t * Math.PI * 2 / 4.4))));
  }

  drawWindow() {
    const g = this.winG, w = P.window, t = this.t;
    g.clear();
    g.fillStyle(0x9fc0ff, 0.12 + this.flash * 0.5); g.fillRect(w.x, w.y, w.w, w.h);
    g.fillStyle(0xa8c4f0, 0.32);
    for (let i = 0; i < 30; i++) {
      const sp = 260 + (i * 37) % 90;
      const y = w.y + ((i * 53 + t * sp) % (w.h + 20)) - 10;
      const x = w.x + ((i * 71 - t * sp * 0.25) % w.w + w.w) % w.w;
      g.fillRect(Math.round(x), Math.round(y), 1, 7);
    }
    const gg = this.glassG;
    gg.clear();
    // drops crawling down the glass
    gg.fillStyle(0xbfd6ff, 0.35);
    for (let i = 0; i < 7; i++) {
      const x = w.x + 6 + ((i * 29) % (w.w - 12));
      const y = w.y + ((i * 41 + t * (6 + i * 2)) % w.h);
      if (Math.abs(x - 672) < 6 || Math.abs(y - 120) < 5) continue;
      gg.fillRect(Math.round(x), Math.round(y), 3, 3);
      gg.fillStyle(0xbfd6ff, 0.12); gg.fillRect(Math.round(x) + 1, Math.round(y) - 10, 1, 10); gg.fillStyle(0xbfd6ff, 0.35);
    }
    // frost creeps in from the corners when it comes
    if (this.cold > 0.02) {
      gg.fillStyle(0xd8ecff, 0.42);
      for (let gx = 0; gx < 22; gx++) for (let gy = 0; gy < 22; gy++) {
        if (gx === 10 || gx === 11 || gy === 10 || gy === 11) continue;
        const lx = gx < 10 ? gx : gx - 12, ly = gy < 10 ? gy : gy - 12;
        const d = Math.min(lx, 9 - lx) + Math.min(ly, 9 - ly) + ((gx * 7 + gy * 13) % 5) * 0.5;
        if (d < this.cold * 9) gg.fillRect(w.x + gx * L, w.y + gy * L, L, L);
      }
    }
  }

  drawMonitor() {
    const g = this.monG, mo = P.monitor;
    g.clear();
    if (this.blackout > 0) return;
    g.fillStyle(0x0a2a18, 0.6); g.fillRect(mo.x, mo.y, mo.w, mo.h);
    g.fillStyle(0x4cff96, 1);
    const base = mo.y + 6 * L;
    let prev = 0;
    for (let i = 0; i < this.ecg.length; i++) {
      const dist = (this.ecgCol - i + this.ecg.length) % this.ecg.length;
      if (dist === this.ecg.length - 1) { prev = this.ecg[i]; continue; } // the gap ahead of the sweep
      const v = this.ecg[i];
      const a = Math.min(prev, v), b = Math.max(prev, v);
      g.fillStyle(0x4cff96, dist === 0 ? 1 : Math.max(0.25, 1 - dist / 14));
      g.fillRect(mo.x + i * L, base + a * L, L, (b - a) * L + 3);
      prev = v;
    }
    if (this.battery) {
      const on = Math.floor(this.t * 1.5) % 2 === 0;
      g.fillStyle(0xffb040, on ? 1 : 0.4); g.fillRect(mo.x + 2, mo.y + 2, 10, 5); g.fillRect(mo.x + 12, mo.y + 3, 2, 3);
    }
  }

  drawCurtain() {
    const t = this.t, sil = this.sil;
    this.panels.forEach((p, i) => {
      const cx = (74 + i * 10 + 5) * L;
      const near = sil.move || sil.flash > 0 ? Math.max(0, 1 - Math.abs(sil.x - cx) / 60) : 0;
      const sway = sil.sway * Math.sin(t * 2.3 + i * 1.3) * 2;
      p.setPosition(Math.round(cx + sway + near * 3), 9 * L + Math.round(near * 2));
      p.setScale(L * (1 + near * 0.09), L);
    });
    const tex = this.textures.get('op_sil0').getSourceImage();
    const a = sil.flash > 0 ? 0.62 : sil.a;
    this.silCurtain.setTexture(`op_sil${Math.floor(t * 3) % 4}`).setPosition(Math.round(sil.x), 268).setScale(L * 0.75, 215 / tex.height).setAlpha(a);
  }

  drawShadow() {
    const g = this.shG, sh = this.sh, t = this.t;
    g.clear();
    const tex = this.textures.get('op_sil0').getSourceImage();
    if (!sh.on) { this.silWall.setAlpha(0); return; }
    const base = P.curtainEdge - 10, tip = sh.tip, len = tip - base;
    if (len < 4) return;
    const N = 26, top = [], bot = [];
    for (let i = 0; i <= N; i++) {
      const k = i / N, x = base + len * k;
      const cy = 296 + k * 22;
      const wv = (15 * (1 - k * k) + 7 * Math.exp(-(((k - 0.84) / 0.06) ** 2))) * (0.9 + Math.sin(t * 3 + k * 9) * 0.1);
      top.push({ x, y: cy - wv * 0.6 });
      bot.push({ x, y: cy + wv * 0.45 });
    }
    const pts = [...top, ...bot.reverse()];
    g.fillStyle(0x020206, 0.35); g.fillPoints(pts.map((p) => ({ x: p.x, y: p.y + (p.y > 306 ? 3 : -3) })), true);
    g.fillStyle(0x000000, 0.82); g.fillPoints(pts, true);
    // fingers, feeling for him
    const ty = 296 + 22;
    g.lineStyle(3, 0x000000, 0.8);
    for (let f = 0; f < 4; f++) {
      const curl = sh.recoil ? 0.4 : 1;
      const ex = tip + (12 + f * 5 + Math.sin(t * 4 + f) * 6) * curl, ey = ty + (f - 1.5) * 6 + Math.sin(t * 3 + f * 2) * 2;
      g.beginPath(); g.moveTo(tip - 8, ty + (f - 1.5) * 3); g.lineTo((tip + ex) / 2, ey - 3); g.lineTo(ex, ey); g.strokePath();
    }
    // the long figure thrown up the wall, leaning toward him
    const fl = sh.recoil ? 0.75 + Math.sin(t * 20) * 0.04 : 1;
    this.silWall.setTexture(`op_sil${Math.floor(t * 2.5) % 4}`)
      .setPosition(Math.round(tip - 60), 252)
      .setScale(L * 0.8 * fl, (sh.wall * 240 * fl) / tex.height)
      .setAngle(sh.recoil ? 8 : 22 + Math.sin(t * 1.4) * 2)
      .setAlpha(sh.wall * 0.62);
  }

  drawGhost() {
    const m = this.m, t = this.t, gs = this.ghost;
    let x = m.x, y = m.y + this.bob(), angle = 0, alpha = 0.88;
    gs.setOrigin(0.5, 1);
    if (this.rise >= 0) {
      const r = this.rise;
      m.shown = true;
      if (r < 2.2) { // sits up out of the body
        const k = ease(r / 2.2);
        gs.setOrigin(0.5, 0.5);
        x = lerp(P.bed.x - 2, P.bed.x + 4, k); y = lerp(P.bed.y - 4, 168, k); angle = lerp(-90, 0, k);
        alpha = Math.min(0.88, r / 1.3) * (0.75 + Math.sin(t * 9) * 0.1);
        m.face = 1;
      } else { // and drifts down beside the bed
        const k = ease((r - 2.2) / 0.8);
        x = lerp(P.bed.x + 4, P.land, k); y = lerp(213, FEET, k) - Math.sin(k * Math.PI) * 14;
        if (k > 0.7) m.face = -1;
      }
    }
    if (!m.shown) { gs.setAlpha(0); this.ghostL.g.setAlpha(0); this.ghostL.p.setAlpha(0); return; }
    let key = 'op_milo_idle';
    if (this.rise < 0) {
      if (!m.ground) key = m.vy < 0 ? 'op_milo_jump' : 'op_milo_fall';
      else if (Math.abs(m.vx) > 12) key = `op_milo_run${Math.floor(m.walkT) % 4}`;
    }
    if (this.ghostFlick > 0) alpha *= Math.random() < 0.5 ? 0.35 : 1;
    const faceLeft = this.glance > 0 && Math.abs(m.vx) < 10 ? true : m.face < 0;
    gs.setTexture(key).setPosition(Math.round(x), Math.round(y)).setAngle(angle).setFlipX(faceLeft).setAlpha(alpha * (1 - this.cold * 0.15));
    const cy = this.rise >= 0 && this.rise < 2.2 ? y : y - 45;
    this.ghostL.g.setPosition(x, cy).setAlpha(0.32 + Math.sin(t * 2) * 0.04);
    this.ghostL.p.setPosition(x, Math.max(FEET + 2, y + 2)).setAlpha(this.rise >= 0 ? 0.1 : 0.22);
    // reaching for his own hand
    const ag = this.armG;
    ag.clear();
    if (this.reach > 0.03) {
      const sx = m.x - 12, sy = m.y - 56;
      const tx = lerp(sx, P.bodyWrist.x - (this.reach > 1 ? (this.reach - 1) * 40 : 0), Math.min(1, this.reach));
      const ty = lerp(sy, P.bodyWrist.y + (this.reach > 1 ? (this.reach - 1) * 20 : 0), Math.min(1, this.reach));
      ag.lineStyle(9, 0xb0e4ff, 0.9 * alpha); ag.lineBetween(sx, sy, tx, ty);
      ag.lineStyle(5, 0x96c6f4, alpha); ag.lineBetween(sx, sy, tx, ty);
      ag.fillStyle(0xe2f4ff, alpha); ag.fillRect(Math.round(tx) - 4, Math.round(ty) - 4, 8, 8);
    }
    // motes rising off him
    ag.fillStyle(0xbfe6ff, 1);
    this.motes.forEach((p) => { ag.fillStyle(0xbfe6ff, p.life * 0.5); ag.fillRect(Math.round(p.x), Math.round(p.y), 3, 3); });
  }

  drawLine() {
    const g = this.lineG, t = this.t;
    g.clear();
    if (this.ripple >= 0) {
      const r = this.ripple;
      g.lineStyle(2, 0xbfe6ff, 1 - r); g.strokeEllipse(P.bodyWrist.x, P.bodyWrist.y, 10 + r * 50, 6 + r * 24);
    }
    if (this.line < 0) return;
    const w = this.wrist(), a = P.under;
    const c = { x: P.bodyWrist.x + 30, y: P.bodyWrist.y - 30 }; // it reaches toward the bed, then bends into the floor
    const grow = ease(this.line);
    const shake = this.phase === 'shadow' || this.phase === 'boo' ? 3 : 1;
    const pts = [];
    const N = 46;
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      if (s > grow) break;
      const x = (1 - s) * (1 - s) * w.x + 2 * (1 - s) * s * c.x + s * s * a.x;
      const y = (1 - s) * (1 - s) * w.y + 2 * (1 - s) * s * c.y + s * s * a.y;
      const wob = Math.sin(t * 3 + s * 12) * 1.5 * shake * s * (1 - s) * 4;
      pts.push({ x, y: y + wob });
    }
    if (pts.length < 2) return;
    g.lineStyle(6, 0x9fc6ff, 0.16); g.strokePoints(pts);
    g.lineStyle(2, 0xe8eef8, 0.92); g.strokePoints(pts);
    // light travelling along it, down toward the floor
    for (let k = 0; k < 3; k++) {
      const idx = Math.floor(((t * 0.35 + k / 3) % 1) * (pts.length - 1));
      g.fillStyle(0xffffff, 0.9); g.fillRect(Math.round(pts[idx].x) - 1, Math.round(pts[idx].y) - 1, 3, 3);
    }
    if (grow >= 1) { // and on, into the floor, toward the well
      for (let j = 0; j < 8; j++) { g.fillStyle(0xe8eef8, 0.7 - j * 0.085); g.fillRect(a.x - 1, a.y + j * 4, 2, 4); }
      const p = (t * 0.8) % 1;
      g.lineStyle(1, 0xbfe6ff, 0.6 * (1 - p)); g.strokeEllipse(a.x, a.y + 2, 8 + p * 26, 3 + p * 6);
    }
  }

  drawUi() {
    this.barT.setY(-28 + 28 * this.lb);
    this.barB.setY(H + 28 - 28 * this.lb);
    this.fadeR.setAlpha(this.fade);
    if (this.phase === 'gate') this.gate[0].setAlpha(0.55 + Math.sin(this.t * 3) * 0.35);
    // touch stick
    const sg = this.stickG;
    sg.clear();
    if (this.thumb) {
      const d = clamp(this.thumb.x - this.thumb.x0, -34, 34);
      sg.lineStyle(2, 0xbfe6ff, 0.35); sg.strokeCircle(this.thumb.x0, H - 70, 26);
      sg.fillStyle(0xbfe6ff, 0.45); sg.fillCircle(this.thumb.x0 + d, H - 70, 10);
    }
    // speech bubble, pinned over the speaker
    const bg = this.bubG, b = this.bubble;
    bg.clear();
    if (!b) { this.bubT.setText(''); return; }
    const head = b.who === 'boo' ? { x: this.boo.x, y: this.boo.y - 52 } : { x: this.m.x, y: this.m.y - 98 };
    const sp = this.toScreen(head.x, head.y);
    const bw = b.str.length * 8 + 16, bh = 22;
    const bx = clamp(Math.round(sp.x - bw / 2), 8, W - bw - 8), by = clamp(Math.round(sp.y - bh - 10), 34, H - 60);
    const edge = b.who === 'boo' ? 0xffc870 : 0xa8e4ff;
    const fadeOut = b.t > b.dur + b.str.length / 28 - 0.3 ? 0.4 : 1;
    bg.fillStyle(0x0b0d1a, 0.88 * fadeOut); bg.fillRect(bx, by, bw, bh);
    bg.lineStyle(2, edge, fadeOut); bg.strokeRect(bx, by, bw, bh);
    const tx = clamp(sp.x, bx + 8, bx + bw - 8);
    bg.fillStyle(0x0b0d1a, 0.88 * fadeOut); bg.fillTriangle(tx - 5, by + bh, tx + 5, by + bh, tx, by + bh + 7);
    bg.lineStyle(2, edge, fadeOut); bg.lineBetween(tx - 5, by + bh + 1, tx, by + bh + 7); bg.lineBetween(tx + 5, by + bh + 1, tx, by + bh + 7);
    this.bubT.setText(b.str.slice(0, b.n)).setColor(b.who === 'boo' ? '#ffe6b0' : '#dff4ff').setPosition(bx + 9, by + bh / 2 + 1).setAlpha(fadeOut);
  }
}
