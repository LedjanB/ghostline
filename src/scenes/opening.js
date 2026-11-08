// THE WRONG SIDE OF THE BED: the playable opening (first launch, or ?opening=1).
// v2 (Nov 7, part 1 of the opening redesign): finer art (3 px grid).
// Nov 8, THE NEW MILO: both Milos are the approved raster sprites (src/milo-sprite.js, assets/milo/): the spirit is a
//   MiloActor (walk, run, jump and the approved acting), the boy in bed is milo-sleep.png (same drawing, laid down).
//   The camera no longer zooms (1 world px = 1 screen px, Milo 92 px like the concept's in-game size); the room is
//   rendered at full resolution and Bed 7 + the tiles are redrawn at 1 px so the sprites don't sit in giant pixels.
// 1 AWAKENING: one medium-wide shot of bed 7. Monitor, rain, 3:32 -> 3:33, the power dies, the monitor goes on battery,
//   the bedside lamp stays. His spirit separates slowly from his body and lands beside the bed; both stay in shot ~2 s.
// 2 DISCOVERY: walk to the bed; Milo stops, looks, hesitates, reaches for his own hand: his fingers pass through,
//   the living fingers twitch. "NO. THAT'S ME." Then the Ghostline: a pulse wrist to wrist, a flash at the living wrist,
//   and the filament bends down into the seam under the bed. The door drifts open.
// 3 THE SHADOW and 4 BOO: unchanged for now (their own redesign comes next).
// Self-contained: own art (opening-art.js), own sound (opening-audio.js), own camera that follows Milo's world x.
// Story beats fire on where the player goes, never on a clock. Nothing here can hurt Milo.
import { W, H } from '../data.js';
import { Save } from '../save.js';
import { Audio } from '../audio.js';
import { text, button, focusGroup } from '../ui.js';
import { createInput, Device } from '../input.js';
import { makeOpeningArt, OP_G, ROOM_W, LAMPS, SEAM_Y, DIGITS, BED7 } from '../opening-art.js';
import { loadMilo, MiloActor, MILO_ANIMS, MILO_FRAME, MILO_SLEEP, MILO_KEYS } from '../milo-sprite.js';
import { makeOpeningAudio } from '../opening-audio.js';

const G = OP_G;
const Z = 1; // the only zoom: 1 world px = 1 screen px, so the Milo sprites draw at their own size
const WORLD_W = ROOM_W * G;
const FEET = 320;
// walk speed matches the walk cycle (8 frames, two steps, same as the milo lab); the run is only Boo's "RUN."
const SPEED = 72, RUN_SPEED = 160, ACCEL = 900, GRAV = 1150, JUMP_V = 400, TAKEOFF = 0.05;
const CAM_Y = H - H / (2 * Z); // floor at the bottom of the frame
const art = (x, y) => ({ x: x * G, y: y * G });
// key places in world px
const P = {
  // bodyWrist / bodyHand come from the sleep frame's metadata (set in create)
  seam: art(84, SEAM_Y + 0.5), // where the Ghostline goes into the floor (down to the well)
  bed: BED7.sleep, // top-left of the sleeping Milo's frame
  land: 384, discoverX: 345, nudgeX: 760, doorStop: 893,
  stand: { x: 302, y: 290 }, // where his spirit stands up out of the bed, in the air
  shadowAt: 640, curtainEdge: 566, maxX: 815, minX: 40, door: 948,
  window: { x: 624, y: 102, w: 96, h: 108 },
  monitor: { x: 135, y: 213, w: 33, h: 36 },
  chair: { x0: 783, x1: 825, y: 296 },
  shot: 300, // the opening shot's centre x: bed, monitor, clock and the landing spot in one frame
};
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const RISE = { lie: 2.0, sit: 1.0, stand: 0.9, drift: 1.3 }; // the separation, in seconds
const RISE_T = RISE.lie + RISE.sit + RISE.stand + RISE.drift;
const SLEEP_F = { bed: 0, bed_breath: 1, bed_twitch: 2, lie: 3, sit: 4 }; // + 5 = the ghost row

// the opening's acting: the approved frames and order (milo lab sequences), timed for the scene
const ms = (list, k) => list.map(([f, t, ...r]) => [f, Math.round(t * k), ...r]);
Object.assign(MILO_ANIMS, {
  // asleep while his spirit floats out of the bed (eyes shut, slumped)
  op_float: { loop: true, frames: [['wake0', 1000]] },
  // lands, surfaces, opens his eyes, looks around the dark ward, doesn't understand
  op_wake: { next: 'idle', frames: ms([['wake0', 600], ['wake1', 500], ['wake2', 380], ['wake1', 220], ['wake2', 420], ['wake3', 500],
    ['idle0', 320], ['blink', 110], ['idle0', 380], ['look_l', 520], ['look_l2', 650], ['look_l', 220], ['idle0', 300], ['confused', 900]], 0.8) },
  // at the bed: looks at his hands, they shake, turns to the body, shock
  op_realize: { frames: ms(MILO_ANIMS.realization.frames.slice(1), 0.8) },
  // hesitates, reaches for his own hand: it goes through
  op_touch: { frames: ms(MILO_ANIMS.touch.frames, 0.8) },
  // pulls back, stumbles a step, fear (the long holds trimmed)
  op_fear: { frames: ms(MILO_ANIMS.fear.frames.slice(0, -2).concat([['fear3', 1000, -14]]), 1) },
});
const ACT_DX = -14; // where op_fear leaves him (dx of its last frame)

export class OpeningScene extends Phaser.Scene {
  constructor() { super('opening'); }

  init() {
    this.phase = 'gate';
    this.control = false; this.ctlT = 0;
    this.t = 0;
    this.tl = []; this.tlT = 0;
    this.flags = { discover: 0, shadow: 0, boo: 0, ended: 0 };
    this.m = { x: P.land, y: FEET, vx: 0, vy: 0, ground: true, face: -1, shown: false, walkT: 0, takeoff: 0 };
    this.auto = null; this.pose = null; this.act = false; this.through = false; this.gx = P.land; this.gy = FEET;
    this.cam = { x: P.shot, y: CAM_Y, z: Z };
    this.camT = { ...this.cam }; this.camK = 3; this.camMode = 'fixed'; this.look = -30; this.maxZ = Z;
    this.lb = 1; this.lbT = 1; // letterbox
    this.fade = 1; this.fadeT = 1; this.fadeK = 1.5;
    this.beatOn = false; this.beatT = 0.3; this.hr = 62; this.hrT = 62; this.loud = 0; this.battery = false;
    this.ecg = new Array(11).fill(0); this.ecgCol = 0; this.ecgAcc = 0; this.ecgQ = [];
    this.clockState = '32'; this.blackout = 0;
    this.lamps = 1; this.flicker = 0; this.dark = 0.35; this.darkT = 0.35; this.warm = 1;
    this.elamp = 0; this.elampT = 0; this.eFlick = 0; this.cold = 0; this.coldT = 0; this.flash = 0; this.nextFlash = 18;
    this.rise = -1; this.ripple = -1; this.twitch = 0; this.nextTwitch = 7; this.wristFlash = 0;
    // the Ghostline: stage 0 hidden, 1 pulse wrist -> wrist, 2 flash, 3 down into the floor, 4 settled
    this.gl = { stage: 0, t: 0, k: 0, a: 0 }; this.line = -1; this.glPts = null;
    this.doorOpen = 0; this.doorT = 0;
    this.sil = { x: 400, a: 0, aT: 0, sway: 0, flash: 0, move: false };
    this.sh = { on: false, t: 0, tip: P.curtainEdge, wall: 0, recoil: 0, lurch: 0 };
    this.boo = { a: 0, aT: 0, x: P.door, y: 226, face: -1 };
    this.lantern = 0; this.lanternT = 0; this.lanternShown = false;
    this.thumb = null; this.jumpTap = false;
    this.moved = 0; this.hintShown = false; this.nudged = false; this.bumped = 0; this.glance = 0;
    this.bubble = null; this.motes = []; this.moteT = 0; this.ghostFlick = 0;
    this.debugInput = null;
  }

  preload() { loadMilo(this); }

  create() {
    makeOpeningArt(this);
    // Bed 7 anchors from the sleep frame (assets/milo/frames.json `sleep`): his wristband and hand on the blanket
    const sm = this.cache.json.get(MILO_KEYS.meta).sleep;
    P.bodyWrist = { x: P.bed.x + sm.wrist.bed[0] + 0.5, y: P.bed.y + sm.wrist.bed[1] + 0.5 };
    P.bodyHand = { x: P.bed.x + sm.hand.bed[0] + 0.5, y: P.bed.y + sm.hand.bed[1] + 0.5 };
    // he stands here to reach his own hand: facing the bed, the hand of his `touch1` frame lands right on it
    const th = this.cache.json.get(MILO_KEYS.meta).hand.touch1;
    P.reachX = Math.round(P.bodyHand.x + (th[0] - MILO_FRAME.anchorX + 2));
    this.bodyHand = P.bodyHand; this.bodyWrist = P.bodyWrist; // tests + shots
    this.snd = null; // made on the first input (browsers need a gesture)
    this.worldL = this.add.layer();
    this.uiL = this.add.layer();
    const cam = this.cameras.main;
    cam.setBackgroundColor('#000000');
    this.uiCam = this.cameras.add(0, 0, W, H);
    this.uiL.cameraFilter |= cam.id;
    this.worldL.cameraFilter |= this.uiCam.id;
    const w = (o, d) => { o.setDepth(d); this.worldL.add(o); return o; };
    const u = (o, d = 0) => { o.setDepth(d); this.uiL.add(o); return o; };
    const img = (x, y, key, d, ox = 0, oy = 0) => w(this.add.image(x, y, key).setOrigin(ox, oy).setScale(G), d);
    const add = (key, x, y, d, sx = 1, sy = sx) => w(this.add.image(x, y, key).setScale(sx, sy).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0), d);

    // ---- the room ----
    this.outside = img(330, 66, 'op_outside', -3).setScrollFactor(0.7, 1);
    this.winG = w(this.add.graphics(), -2);
    w(this.add.image(0, 0, 'op2_room').setOrigin(0), 0); // already full resolution
    this.glassG = w(this.add.graphics(), 0.5);
    this.monG = w(this.add.graphics(), 1);
    this.clock = img(30 * G, 52 * G, 'op_clock_32', 1);
    this.bulbs = LAMPS.map((lx) => img((lx - 2) * G, 37 * G, 'op_bulb_on', 1));
    this.elampSpr = img(67 * G, 72 * G, 'op_elamp_off', 1);
    this.exitSpr = img(306 * G, 40 * G, 'op_exit_lit', 1).setAlpha(0.85);
    this.doorShut = img(304 * G, 52 * G, 'op_door_shut', 1);
    this.doorOpenSpr = img(331 * G, 52 * G, 'op_door_open', 1).setAlpha(0);
    img(114 * G, 23 * G, 'op_curtain_bunch', 1);
    this.panels = [0, 1, 2, 3].map((i) => w(this.add.image(395 + i * 50, 23 * G, 'op_curtain').setOrigin(0.5, 0).setScale(G), 1));
    this.silCurtain = w(this.add.image(400, 296, 'op_sil0').setOrigin(0.5, 1).setAlpha(0), 1.2);
    // the boy in the bed: the new Milo asleep under the blanket (breathes, a finger moves now and then)
    this.blanket = w(this.add.sprite(P.bed.x, P.bed.y, MILO_SLEEP.key, SLEEP_F.bed).setOrigin(0), 2);
    this.ivG = w(this.add.graphics(), 2.1);
    this.drawIv();
    this.chair = img(P.chair.x0, FEET, 'op_chair', 3, 0, 1);

    // ---- light: darkness over the room, then light added back ----
    this.darkR = w(this.add.rectangle(0, 0, WORLD_W, H, 0x000000).setOrigin(0), 6);
    this.coldR = w(this.add.rectangle(0, 0, WORLD_W, H, 0x0a1838).setOrigin(0).setAlpha(0), 6.2);
    this.warmR = w(this.add.rectangle(0, 0, WORLD_W, H, 0xffa040).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.05), 6.4);
    this.lampL = LAMPS.map((lx) => ({
      g: add('op_glow_warm', lx * G + 1, 114, 7, 1.7), p: add('op_pool_warm', lx * G, 312, 7, 2.2), s: add('op_streak_warm', lx * G, 300, 7, 1.5, 0.9).setOrigin(0.5, 0),
    }));
    this.eL = { g: add('op_glow_amber', 212, 226, 7, 2.1), p: add('op_pool_amber', 236, 300, 7, 1.9), b: add('op_glow_warm', 236, 278, 7, 1.1, 0.5), s: add('op_streak_amber', 230, 296, 7, 1.6, 0.8).setOrigin(0.5, 0) };
    this.winL = { g: add('op_glow_cold', 672, 156, 7, 2.2), p: add('op_pool_cold', 672, 304, 7, 2.6), s: add('op_streak_cold', 672, 294, 7, 3.2, 0.9).setOrigin(0.5, 0) };
    this.monL = { g: add('op_glow_green', 160, 232, 7, 0.9), p: add('op_pool_green', 162, 312, 7, 0.9) };
    this.exitL = add('op_glow_red', 948, 132, 7, 1).setAlpha(0.3);
    this.clockL = add('op_glow_red', 118, 170, 7, 0.7);
    this.lanL = { g: add('op_glow_amber', P.door, 260, 7, 3), c: add('op_glow_warm', P.door, 260, 7.1, 1), p: add('op_pool_amber', P.door, 312, 7, 3.4), s: add('op_streak_amber', P.door, 300, 7, 2, 0.9).setOrigin(0.5, 0) };
    // ---- THE STRETCH: only ever its shadow ----
    this.silWall = w(this.add.image(0, 252, 'op_sil0').setOrigin(0.5, 1).setAlpha(0), 7.5);
    this.shG = w(this.add.graphics(), 7.6);
    // ---- Milo's spirit, the Ghostline, Boo ----
    this.ghostL = { g: add('op_glow_blue', 0, 0, 9.5, 1.2), p: add('op_pool_blue', 0, 0, 9.4, 1) };
    // his spirit: lying in his body, sitting up out of it (same drawing, ghost row), then the actor
    this.lie = w(this.add.sprite(P.bed.x, P.bed.y, MILO_SLEEP.key, SLEEP_F.lie + 5).setOrigin(0).setAlpha(0), 9.8);
    this.sit = w(this.add.sprite(P.bed.x, P.bed.y, MILO_SLEEP.key, SLEEP_F.sit + 5).setOrigin(0).setAlpha(0), 9.9);
    this.milo = new MiloActor(this, P.land, FEET, { ghost: true }).setFacing(-1);
    this.milo.play('op_float');
    this.ghost = w(this.milo.sprite.setAlpha(0), 10);
    this.lineG = w(this.add.graphics(), 10.5);
    this.fxG = w(this.add.graphics(), 10.6);
    this.boo.spr = w(this.add.image(P.door, 226, 'op_boo0').setScale(G).setAlpha(0).setFlipX(true), 11);
    this.lanSpr = w(this.add.image(P.door, 220, 'op_lantern_off').setScale(G).setOrigin(0.5, 0).setAlpha(0), 11.1);

    // ---- screen layer (not zoomed) ----
    this.vig = u(this.add.image(W / 2, H / 2, 'op_vignette').setScale(4).setAlpha(0.85), 0);
    this.flashR = u(this.add.rectangle(0, 0, W, H, 0xcfe0ff).setOrigin(0).setAlpha(0), 1);
    this.barT = u(this.add.rectangle(0, 0, W, 28, 0x000000).setOrigin(0), 2);
    this.barB = u(this.add.rectangle(0, H, W, 28, 0x000000).setOrigin(0, 1), 2);
    this.stickG = u(this.add.graphics(), 3);
    this.bubG = u(this.add.graphics(), 4);
    this.bubT = u(text(this, 0, 0, '', 8, '#e6f0ff', 0), 5);
    this.hint = u(text(this, W / 2, H - 42, '', 8, '#9aa6c8').setAlpha(0), 5);
    this.caption = u(text(this, 18, H - 44, '', 8, '#8f9abc', 0).setAlpha(0), 5);
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
  // one held medium-wide shot: no zoom, no cut, the whole awakening plays in it
  begin() {
    if (this.phase !== 'gate') return;
    this.phase = 'intro';
    this.snd = makeOpeningAudio();
    Audio.music(null);
    this.gate.forEach((g) => g.setVisible(false));
    const s = this.snd;
    const r0 = 7.2;
    this.run([
      [0, () => { s.rain(0.45, true); s.vent(true); this.beatOn = true; this.fadeT = 0; this.fadeK = 0.9; }],
      [2.0, () => { this.caption.setText('ST. MERCY.  WARD 4.'); this.tw(this.caption, 1, 900); }],
      [3.4, () => { this.clockState = '33'; s.flip(); this.caption.setText('ST. MERCY.  WARD 4.  3:33 AM'); }],
      [4.6, () => { s.fail(); this.flicker = 0.62; }],
      [5.22, () => {
        this.flicker = 0; this.lamps = 0; this.clockState = 'off'; this.darkT = 0.6; this.warm = 0; this.blackout = 0.4;
        this.tw(this.caption, 0, 700);
        s.rain(0.55, false, 1.5);
      }],
      [5.65, () => { this.battery = true; s.batteryChirp(); }],
      [6.15, () => { this.elampT = 1; this.eFlick = 0.45; s.clunk(); }],
      [r0, () => { this.rise = 0; this.m.shown = true; s.rise(); s.pad(0.55, 2); }],
      [r0 + RISE_T + 0.8, () => { this.twitch = 0.5; this.loud = 1; }], // the body: still alive
    ]);
  }

  giveControl(phase) {
    this.phase = phase;
    this.control = true; this.ctlT = 0; this.pose = null;
    this.camMode = 'follow'; this.camK = 1.6;
    this.lbT = 0;
  }

  lockControl() {
    this.control = false; this.thumb = null; this.jumpTap = false;
    this.lbT = 1;
    this.tw(this.hint, 0, 300);
  }

  // the impossible touch, then the Ghostline (a beat with its own timeline; control comes back after)
  startDiscover() {
    this.flags.discover++;
    this.phase = 'discover';
    this.lockControl();
    const s = this.snd;
    this.camTo((P.reachX + P.bodyWrist.x) / 2 - 10, CAM_Y, Z, 1.4);
    this.walkTo(P.reachX, 52, () => {
      this.m.face = -1;
      s && s.pad(0, 1.2); s && s.rain(0.3, true, 0.8); // quiet for the reveal
      this.loud = 1;
      // the approved acting, in order: his hands, the body, the reach (it goes through), the recoil
      this.acting('realize', 'op_realize', () => this.acting('touch', 'op_touch', () => {
        this.acting('fear', 'op_fear', () => {
          this.m.x += -ACT_DX * this.m.face; // he ends the stumble where the last fear frame left him
          this.pose = null; this.act = false; this.milo.play('idle');
          this.run([
            [0.5, () => { this.gl.stage = 1; this.gl.t = 0; this.line = 0; s && s.pulse(); }],
            [2.9, () => { this.doorT = 1; s && s.door(); s && s.rain(0.5, false, 2); }],
            [3.4, () => this.giveControl('explore2')],
          ]);
        });
        this.run([[1.0, () => this.say('milo', "NO. THAT'S ME.", 2.0)]]);
      }));
    });
  }

  // play one acting sequence on the spirit (no player control); `pose` names the beat for tests and shots
  acting(pose, anim, done) {
    this.pose = pose; this.act = true;
    this.milo.speed = 1; // (the walk cycle's speed scale must not slow the acting)
    this.milo.setFacing(this.m.face).play(anim, done);
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
      [0.35, () => { s.ignite(); s.hum(1, 0.2); this.lanternT = 1; this.camTo(midX, CAM_Y, Z, 2.2); this.hrT = 104; }],
      [0.6, () => { s.recoil(); this.sh.recoil = 1; this.coldT = 0.2; this.darkT = 0.6; this.shake(260, 0.004); }],
      [1.0, () => { this.boo.aT = 1; s.rain(0.35, false, 1.5); }],
      [1.9, () => this.say('boo', 'THERE YOU ARE.', 1.9)],
      [4.0, () => this.say('milo', 'DO I KNOW YOU?', 1.9)],
      [6.1, () => { this.say('boo', 'LATER. RUN.', 1.6); }],
      [6.9, () => { this.boo.face = 1; s.lunge(); this.sh.lurch = 1; this.walkTo(P.maxX + 40, RUN_SPEED, null, true); this.boo.go = true; }],
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
  camTo(x, y, z, k = 2) { this.camMode = 'fixed'; this.camT = { x, y, z: Z }; this.camK = k; }
  walkTo(x, speed, done, run = false) { this.auto = { x, speed, done, run }; }
  tw(o, alpha, ms) { this.tweens.killTweensOf(o); this.tweens.add({ targets: o, alpha, duration: ms }); }
  say(who, str, dur) { this.bubble = { who, str, n: 0, t: 0, dur, acc: 0 }; }
  lightning(v) { this.flash = Math.max(this.flash, v); }
  shake(ms, k) { if (Save.get().settings.shake) this.cameras.main.shake(ms, k); }
  faceLeft() { return this.glance > 0 && Math.abs(this.m.vx) < 10 ? true : this.m.face < 0; }
  // the spirit's wristband in world px, whatever frame he is in (the Ghostline hangs from it): measured per frame
  wrist() { return this.milo.wrist(); }

  // movement frames from the physics state (the same rules as the milo lab's MOVE mode)
  animMove() {
    const a = this.milo, m = this.m;
    const sp = Math.abs(m.vx), moving = sp > 6;
    if (m.takeoff > 0) a.want('jump_start');
    else if (!m.ground) { if (a.anim !== 'jump_start' || a.done) a.want(m.vy < -110 ? 'rise' : m.vy < 110 ? 'apex' : 'fall'); }
    else if (a.anim === 'land' && !a.done && (!moving || a.step === 0)) { /* let the landing read */ }
    else if (!moving) {
      if (['walk', 'run', 'walk_start', 'pivot'].includes(a.anim)) a.want('stop');
      else if (a.done || !['stop', 'idle', 'land'].includes(a.anim)) a.want('idle');
    } else if (a.anim === 'pivot' && !a.done) { /* turning round */ }
    else if (sp > SPEED + 18) a.want('run');
    else if (['idle', 'stop', 'land'].includes(a.anim) || a.anim.startsWith('op_')) a.want('walk_start');
    else if (a.anim !== 'walk_start' || a.done) a.want('walk');
    a.speed = a.anim === 'walk' ? clamp(sp / SPEED, 0.5, 1.4) : a.anim === 'run' ? clamp(sp / 175, 0.6, 1.2) : 1;
  }

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
    if (this.freeze) { this.render(); return; } // screenshots: the sim is driven from outside
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
    if (this.control) this.ctlT += dt;
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
    while (this.ecgAcc > 0.08) { this.ecgAcc -= 0.08; this.ecgCol = (this.ecgCol + 1) % this.ecg.length; this.ecg[this.ecgCol] = this.ecgQ.length ? this.ecgQ.shift() : 0; }
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
    this.doorOpen = lerp(this.doorOpen, this.doorT, 1 - Math.exp(-dt * 1.5));

    // the separation: he fades in inside his body, sits up out of it, stands, drifts down beside the bed
    if (this.rise >= 0) {
      this.rise += dt;
      if (this.rise >= RISE_T) {
        this.rise = -1; m.x = P.land; m.y = FEET; m.ground = true; m.face = -1; m.vx = 0; s && s.land(); this.puff();
        // he lands asleep, surfaces, looks around: control when the approved awakening acting is done
        this.act = true; this.milo.speed = 1;
        this.milo.play('op_wake', () => { this.act = false; this.tl.push({ t: this.tlT + 0.3, fn: () => this.giveControl('explore'), done: false }); });
      }
    }

    // movement (player, or an automatic walk in a beat)
    if (this.rise < 0 && this.phase !== 'intro' && this.phase !== 'gate') {
      let ix = 0, jump = false, held = false;
      if (this.control) ({ x: ix, jump, held } = this.readInput());
      else if (this.auto) {
        const d = this.auto.x - m.x;
        if (Math.abs(d) < 2 && m.ground) { m.x = this.auto.x; m.vx = 0; const done = this.auto.done; this.auto = null; if (done) done(); }
        else ix = Math.sign(d) * Math.min(1, Math.abs(d) / 24 + 0.25) * (this.auto.speed / SPEED); // eases into the stop
      }
      m.vx += clamp(ix * SPEED - m.vx, -ACCEL * dt, ACCEL * dt);
      if (ix) {
        if (Math.sign(ix) !== m.face && m.ground && Math.abs(m.vx) > 20 && !this.act) this.milo.play('pivot');
        m.face = Math.sign(ix); this.glance = 0;
      }
      // jump: a short crouch first (the takeoff frames), then up
      if (jump && m.ground && m.takeoff <= 0) { m.takeoff = TAKEOFF; this.milo.play('jump_start'); }
      if (m.takeoff > 0) { m.takeoff -= dt; if (m.takeoff <= 0) { m.vy = -JUMP_V; m.ground = false; s && s.jump(); } }
      const py = m.y;
      if (!m.ground) m.vy += (m.vy < 0 && held ? GRAV * 0.6 : GRAV) * dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      // the door is shut until he knows: he walks into it (a real door, not a wall in the air)
      const maxX = this.auto && this.auto.run ? P.maxX + 45 : this.phase === 'explore' ? P.doorStop : P.maxX;
      if (this.phase === 'explore' && m.x >= P.doorStop && this.bumped <= 0) { this.bumped = 2.5; s && s.bump(); this.loud = 2; this.glance = 1.6; m.vx = -40; }
      m.x = clamp(m.x, P.minX, maxX);
      const onChair = m.x > P.chair.x0 && m.x < P.chair.x1;
      if (m.vy >= 0 && !m.ground) {
        if (onChair && py <= P.chair.y && m.y >= P.chair.y) { m.y = P.chair.y; m.vy = 0; m.ground = true; s && s.land(); this.milo.play('land'); }
        else if (m.y >= FEET) { m.y = FEET; m.vy = 0; m.ground = true; s && s.land(); this.milo.play('land'); }
      }
      if (m.ground && m.y < FEET && !onChair && m.takeoff <= 0) m.ground = false;
      this.moved += Math.abs(m.vx * dt);
      m.walkT += Math.abs(m.vx) * dt / 15;
    }
    this.bumped = Math.max(0, this.bumped - dt);

    // the spirit's frames: acting beats play on their own, otherwise the movement picks them
    if (this.rise < 0 && m.shown) {
      const a = this.milo;
      if (!this.act) this.animMove();
      a.setFacing(this.act ? m.face : this.faceLeft() ? -1 : 1);
      a.update(dt * 1000);
      if (this.pose === 'touch' && a.tag === 'through' && !this.through) { // his fingers go into his own hand
        this.through = true;
        s && s.through(); this.ripple = 0; this.ghostFlick = 0.4; this.twitch = 0.7; this.loud = 2;
      }
      a.x = m.x; a.footY = Math.round(m.y); a.show();
      this.gx = a.sprite.x; this.gy = a.sprite.y;
    }

    // story triggers: where Milo goes, never a timer
    if (this.phase === 'explore') {
      if (m.x < P.discoverX) this.startDiscover();
      else if (m.x > P.nudgeX && !this.nudged) { this.nudged = true; this.loud = 2; this.glance = 1.4; this.twitch = 0.5; } // the monitor calls him back
      if (!this.hintShown && this.ctlT > 4.5 && this.moved < 30) { this.hintShown = true; this.showHint(); }
    }
    if ((this.phase === 'explore' || this.phase === 'explore2') && this.hintShown && this.moved > 90) this.tw(this.hint, 0, 400);
    if (this.phase === 'explore2' && m.x > P.shadowAt) this.startShadow();
    this.glance = Math.max(0, this.glance - dt);

    // the body: a finger moves now and then (it's alive), more often while he hasn't looked yet
    this.twitch = Math.max(0, this.twitch - dt);
    if (this.phase === 'explore') { this.nextTwitch -= dt; if (this.nextTwitch <= 0) { this.nextTwitch = 6 + Math.random() * 3; this.twitch = 0.35; } }
    if (this.ripple >= 0) { this.ripple += dt; if (this.ripple > 1) this.ripple = -1; }
    this.ghostFlick = Math.max(0, this.ghostFlick - dt);
    this.wristFlash = Math.max(0, this.wristFlash - dt);

    // the Ghostline reveal
    const gl = this.gl;
    if (gl.stage > 0) {
      gl.t += dt;
      if (gl.stage === 1) { gl.k = Math.min(1, gl.t / 0.9); if (gl.k >= 1) { gl.stage = 2; gl.t = 0; this.wristFlash = 0.5; this.twitch = 0.3; s && s.tick(); } }
      else if (gl.stage === 2) { if (gl.t > 0.45) { gl.stage = 3; gl.t = 0; gl.k = 0; s && s.descend(); } }
      else if (gl.stage === 3) { gl.k = Math.min(1, gl.t / 1.1); if (gl.k >= 1) { gl.stage = 4; gl.t = 0; } }
      this.line = gl.stage === 4 ? 1 : gl.stage === 3 ? 0.6 + gl.k * 0.39 : gl.stage === 2 ? 0.5 : gl.k * 0.5;
      // bright while it's found, then it settles to a faint thread (still there, never dominant)
      const aT = gl.stage < 4 ? 1 : gl.t < 1.5 ? 1 : (this.phase === 'shadow' || this.phase === 'boo' ? 0.5 : 0.32);
      gl.a = lerp(gl.a, aT, 1 - Math.exp(-dt * 1.5));
    }

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

    if (this.boo.go) this.boo.x = Math.min(P.door + 40, this.boo.x + dt * 60);

    // bubble
    const b = this.bubble;
    if (b) {
      b.t += dt;
      const n = Math.min(b.str.length, Math.floor(b.t * 24));
      if (n > b.n) { b.n = n; if (s && b.str[n - 1] !== ' ' && n % 2) s.blip(b.who === 'boo' ? 330 : 620); }
      if (b.t > b.dur + b.str.length / 24) this.bubble = null;
    }

    // ghost motes
    this.moteT -= dt;
    if (m.shown && this.rise < 0 && this.moteT <= 0) { this.moteT = 0.2; this.motes.push({ x: m.x + (Math.random() - 0.5) * 28, y: m.y - 6 - Math.random() * 80, life: 1 }); }
    this.motes.forEach((p) => { p.y -= dt * 12; p.life -= dt * 0.9; });
    this.motes = this.motes.filter((p) => p.life > 0);

    // camera: follows Milo's world x with a little look-ahead; beats frame things on their own. Zoom never changes.
    if (this.camMode === 'follow') {
      this.look = lerp(this.look, m.face * 40, 1 - Math.exp(-dt * 1.5));
      this.camT = { x: m.x + this.look, y: CAM_Y, z: Z };
    }
    const k = 1 - Math.exp(-dt * this.camK);
    this.cam.x = lerp(this.cam.x, this.camT.x, k);
    this.cam.y = lerp(this.cam.y, this.camT.y, k);
    this.cam.z = Z;
    this.maxZ = Math.max(this.maxZ, this.cam.z);
    this.lb = lerp(this.lb, this.lbT, 1 - Math.exp(-dt * 4));
    this.fade = lerp(this.fade, this.fadeT, 1 - Math.exp(-dt * this.fadeK * 2));
    this.applyCam();
  }

  puff() { for (let i = 0; i < 8; i++) this.motes.push({ x: this.m.x + (i - 3.5) * 5, y: FEET - 4 - Math.random() * 8, life: 0.9 }); }

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
    const str = d === 'touch' ? 'LEFT THUMB: MOVE    TAP RIGHT: JUMP'
      : d === 'gamepad' ? 'STICK: MOVE    A: JUMP' : 'A D / ARROWS: MOVE    SPACE: JUMP';
    this.hint.setText(str);
    this.tw(this.hint, 0.7, 800);
  }

  // ---------------------------------------------------------------- drawing
  render() {
    const t = this.t;
    const lamp = this.lamps;
    this.bulbs.forEach((b) => b.setTexture(lamp > 0.5 ? 'op_bulb_on' : this.t < 7 && this.phase === 'intro' ? 'op_bulb_ember' : 'op_bulb_off'));
    this.lampL.forEach((l) => { l.g.setAlpha(lamp * 0.45); l.p.setAlpha(lamp * 0.3); l.s.setAlpha(lamp * 0.2); });
    this.warmR.setAlpha(this.warm * lamp * 0.05);
    this.darkR.setAlpha(this.dark);
    this.coldR.setAlpha(this.cold * 0.75);
    const e = this.elamp * (1 - this.cold * 0.35);
    this.elampSpr.setTexture(e > 0.4 ? 'op_elamp_on' : 'op_elamp_off');
    this.eL.g.setAlpha(e * 0.55); this.eL.p.setAlpha(e * 0.5); this.eL.b.setAlpha(e * 0.32); this.eL.s.setAlpha(e * 0.22);
    const f = this.flash;
    this.winL.g.setAlpha(0.2 + f * 0.6); this.winL.p.setAlpha(0.24 + f * 0.5); this.winL.s.setAlpha(0.16 + f * 0.4);
    this.flashR.setAlpha(f * 0.1);
    const mon = this.blackout > 0 ? 0 : 1;
    const beatGlow = this.ecg[this.ecgCol] < -2 ? 0.12 : 0;
    this.monL.g.setAlpha(mon * (0.3 + beatGlow)); this.monL.p.setAlpha(mon * 0.14);
    this.clock.setTexture(`op_clock_${this.clockState}`);
    this.clockL.setAlpha(this.clockState === 'off' ? 0 : (lamp > 0.5 ? 0.35 : 0.1));
    this.exitL.setAlpha(0.22 + Math.sin(t * 1.3) * 0.03);
    this.doorShut.setAlpha(1 - ease(this.doorOpen * 1.4));
    this.doorOpenSpr.setAlpha(ease(this.doorOpen * 1.4));
    // the living body: breathing, a finger now and then
    const inhale = Math.sin(t * Math.PI * 2 / 4.6) > 0.35;
    const twitching = this.twitch > 0 && Math.floor(this.twitch * 10) % 2 === 0;
    this.blanket.setFrame(twitching ? SLEEP_F.bed_twitch : inhale ? SLEEP_F.bed_breath : SLEEP_F.bed);
    // lantern + Boo
    const la = this.lantern;
    const boo = this.boo, bob = Math.round(Math.sin(t * 2) * 1.5) * G / 2;
    boo.spr.setTexture(Math.floor(t * 5) % 2 ? 'op_boo1' : 'op_boo0').setPosition(Math.round(boo.x), Math.round(boo.y + bob)).setAlpha(boo.a * 0.95).setFlipX(boo.face < 0);
    const lx = boo.x + (boo.face < 0 ? -26 : 26), ly = boo.y - 2 + bob;
    this.lanSpr.setVisible(this.lanternShown).setAlpha(this.lanternShown ? 1 : 0).setTexture(la > 0.3 ? 'op_lantern_on' : 'op_lantern_off')
      .setPosition(Math.round(lx), Math.round(ly)).setAngle(Math.sin(t * 1.7) * 7 + (boo.go ? 12 : 0));
    const lfl = la * (0.92 + Math.sin(t * 17) * 0.04 + Math.sin(t * 7.3) * 0.04);
    const lc = { x: lx, y: ly + 16 };
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
  }

  drawIv() { // the drip tube from the bag down to the back of his hand
    const g = this.ivG;
    g.clear();
    const a = { x: 107.5 * G, y: 45 * G }, b = { x: P.bodyHand.x - 2, y: P.bodyHand.y + 1 }; // into the back of his hand
    g.fillStyle(0x9ab4c4, 0.55);
    for (let i = 0; i <= 40; i++) {
      const k = i / 40;
      const x = lerp(a.x, b.x, k), y = lerp(a.y, b.y, k) + Math.sin(k * Math.PI) * 14;
      g.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
  }

  drawWindow() {
    const g = this.winG, w = P.window, t = this.t;
    g.clear();
    g.fillStyle(0x9fc0ff, 0.1 + this.flash * 0.5); g.fillRect(w.x, w.y, w.w, w.h);
    g.fillStyle(0xa8c4f0, 0.3);
    for (let i = 0; i < 28; i++) {
      const sp = 260 + (i * 37) % 90;
      const y = w.y + ((i * 53 + t * sp) % (w.h + 20)) - 10;
      const x = w.x + ((i * 71 - t * sp * 0.25) % w.w + w.w) % w.w;
      g.fillRect(Math.round(x), Math.round(y), 1, 6);
    }
    const gg = this.glassG;
    gg.clear();
    // drops crawling down the glass (on the art grid)
    for (let i = 0; i < 9; i++) {
      const x = w.x + 6 + ((i * 29) % (w.w - 12));
      const y = w.y + ((i * 41 + t * (5 + i * 2)) % w.h);
      if (Math.abs(x - 672) < 7 || Math.abs(y - 156) < 6) continue;
      const sx = Math.floor(x / G) * G, sy = Math.floor(y / G) * G;
      gg.fillStyle(0xbfd6ff, 0.35); gg.fillRect(sx, sy, G, G);
      gg.fillStyle(0xbfd6ff, 0.12); gg.fillRect(sx + 1, sy - 9, 1, 9);
    }
    // frost creeps in from the corners of each pane when it comes
    if (this.cold > 0.02) {
      gg.fillStyle(0xd8ecff, 0.42);
      for (let gx = 0; gx < 32; gx++) for (let gy = 0; gy < 36; gy++) {
        if (gx === 15 || gx === 16 || gy === 17 || gy === 18) continue;
        const lx = gx < 15 ? gx : gx - 17, ly = gy < 17 ? gy : gy - 19;
        const d = Math.min(lx, 14 - lx) + Math.min(ly, 16 - ly) + ((gx * 7 + gy * 13) % 5) * 0.6;
        if (d < this.cold * 12) gg.fillRect(w.x + gx * G, w.y + gy * G, G, G);
      }
    }
  }

  drawMonitor() {
    const g = this.monG, mo = P.monitor;
    g.clear();
    if (this.blackout > 0) return;
    g.fillStyle(0x0a2a18, 0.55); g.fillRect(mo.x, mo.y, mo.w, mo.h);
    const base = mo.y + 6 * G;
    let prev = 0;
    for (let i = 0; i < this.ecg.length; i++) {
      const dist = (this.ecgCol - i + this.ecg.length) % this.ecg.length;
      if (dist === this.ecg.length - 1) { prev = this.ecg[i]; continue; } // the gap ahead of the sweep
      const v = this.ecg[i];
      const a = Math.min(prev, v), b = Math.max(prev, v);
      g.fillStyle(0x4cff96, dist === 0 ? 1 : Math.max(0.25, 1 - dist / 11));
      g.fillRect(mo.x + i * G, base + a * G, G, (b - a + 1) * G);
      prev = v;
    }
    // heart rate, in green, and the amber battery once the power is gone
    const hr = String(Math.round(this.hr));
    g.fillStyle(0x4cff96, 0.9);
    [...hr].forEach((ch, j) => DIGITS[ch].forEach((row, y) => [...row].forEach((bit, x) => { if (bit === '1') g.fillRect((57 + j * 4 + x) * G - 3, (72 + y) * G, G - 1, G - 1); })));
    if (this.battery) {
      const on = Math.floor(this.t * 1.5) % 2 === 0;
      g.fillStyle(0xffb040, on ? 1 : 0.45); g.fillRect(57 * G, 79 * G, 4 * G, 2 * G); g.fillRect(61 * G, 79 * G + 1, 2, G);
    }
  }

  drawCurtain() {
    const t = this.t, sil = this.sil;
    this.panels.forEach((p, i) => {
      const cx = 395 + i * 50;
      const near = sil.move || sil.flash > 0 ? Math.max(0, 1 - Math.abs(sil.x - cx) / 60) : 0;
      const sway = sil.sway * Math.sin(t * 2.3 + i * 1.3) * 2;
      p.setPosition(Math.round(cx + sway + near * 3), 23 * G + Math.round(near * 2));
      p.setScale(G * (1 + near * 0.09), G);
    });
    const tex = this.textures.get('op_sil0').getSourceImage();
    const a = sil.flash > 0 ? 0.62 : sil.a;
    this.silCurtain.setTexture(`op_sil${Math.floor(t * 3) % 4}`).setPosition(Math.round(sil.x), 296).setScale(3.75, 225 / tex.height).setAlpha(a);
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
    const ty = 296 + 22;
    g.lineStyle(3, 0x000000, 0.8);
    for (let f = 0; f < 4; f++) {
      const curl = sh.recoil ? 0.4 : 1;
      const ex = tip + (12 + f * 5 + Math.sin(t * 4 + f) * 6) * curl, ey = ty + (f - 1.5) * 6 + Math.sin(t * 3 + f * 2) * 2;
      g.beginPath(); g.moveTo(tip - 8, ty + (f - 1.5) * 3); g.lineTo((tip + ex) / 2, ey - 3); g.lineTo(ex, ey); g.strokePath();
    }
    const fl = sh.recoil ? 0.75 + Math.sin(t * 20) * 0.04 : 1;
    this.silWall.setTexture(`op_sil${Math.floor(t * 2.5) % 4}`)
      .setPosition(Math.round(tip - 60), 252)
      .setScale(4 * fl, (sh.wall * 240 * fl) / tex.height)
      .setAngle(sh.recoil ? 8 : 22 + Math.sin(t * 1.4) * 2)
      .setAlpha(sh.wall * 0.62);
  }

  drawGhost() {
    const m = this.m, t = this.t, gs = this.ghost, a = this.milo;
    const shimmer = 0.82 + Math.sin(t * 7) * 0.06;
    let alpha = 0.9;
    this.lie.setAlpha(0); this.sit.setAlpha(0);
    if (this.rise >= 0) {
      // 1 his spirit shows inside the body (the same drawing, ghost colours) and lifts off it, 2 sits up out of it,
      // 3 stands up in the air above the bed, still asleep, 4 drifts down beside the bed
      const r = this.rise, R1 = RISE.lie, R2 = R1 + RISE.sit, R3 = R2 + RISE.stand;
      m.shown = true; m.face = -1;
      const lift = (k) => Math.round(k * 3);
      if (r < R1) {
        const k = ease(r / R1);
        this.lie.setAlpha(k * 0.75 * shimmer).setPosition(P.bed.x, P.bed.y - lift(k));
        gs.setAlpha(0);
        this.glowAt(P.bed.x + 50, P.bed.y + 56, k * 0.35, 0);
        return;
      }
      if (r < R2) {
        const k = ease((r - R1) / RISE.sit);
        this.lie.setAlpha((1 - k) * 0.75 * shimmer).setPosition(P.bed.x, P.bed.y - 3);
        this.sit.setAlpha(k * 0.85 * shimmer).setPosition(P.bed.x, P.bed.y - 3 - Math.round(k * 2));
        gs.setAlpha(0);
        this.glowAt(P.bed.x + 60, P.bed.y + 30, 0.35, 0);
        return;
      }
      let x, y;
      if (r < R3) { // up out of the bed, upright, hanging in the air
        const k = ease((r - R2) / RISE.stand);
        this.sit.setAlpha((1 - k) * 0.85 * shimmer).setPosition(P.bed.x, P.bed.y - 5 - Math.round(k * 6));
        x = P.stand.x; y = P.stand.y - k * 6; alpha = k * 0.9;
      } else {
        const k = ease((r - R3) / RISE.drift);
        x = lerp(P.stand.x, P.land, k); y = lerp(P.stand.y - 6, FEET, k * k) - Math.sin(k * Math.PI) * 10;
      }
      m.x = x;
      a.setFacing(-1).want('op_float');
      a.x = x; a.footY = Math.round(y); a.show();
      this.gx = a.sprite.x; this.gy = a.sprite.y;
    }
    if (!m.shown) { gs.setAlpha(0); this.ghostL.g.setAlpha(0); this.ghostL.p.setAlpha(0); this.gx = m.x; this.gy = m.y; return; }
    if (this.ghostFlick > 0) alpha *= Math.random() < 0.5 ? 0.35 : 1;
    gs.setAlpha(alpha * shimmer * (1 - this.cold * 0.15));
    this.glowAt(this.gx, this.gy - 46, 0.3 + Math.sin(t * 2) * 0.04, this.rise >= 0 ? 0.08 : 0.2, this.gy);
  }

  glowAt(x, y, a, pa, feet = FEET) {
    this.ghostL.g.setPosition(x, y).setAlpha(a);
    this.ghostL.p.setPosition(x, Math.max(FEET + 2, feet + 2)).setAlpha(pa);
  }

  // the Ghostline: a narrow silver-blue filament. Spirit wrist -> living wrist -> the seam under the bed -> gone.
  drawLine() {
    const g = this.lineG, fx = this.fxG, t = this.t, gl = this.gl;
    g.clear(); fx.clear();
    // the ghost hand going through his own: a ring on the living hand, the hand shown through the spirit
    if (this.ripple >= 0) {
      const r = this.ripple, h = P.bodyHand;
      fx.lineStyle(1, 0xcfeaff, 0.9 * (1 - r)); fx.strokeEllipse(h.x, h.y, 6 + r * 30, 3 + r * 12);
    }
    // motes rising off him
    this.motes.forEach((p) => { fx.fillStyle(0xbfe6ff, p.life * 0.45); fx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); });
    if (gl.stage === 0) { this.glPts = null; return; }
    const wr = this.wrist(), bw = P.bodyWrist, sm = P.seam;
    const shake = this.phase === 'shadow' || this.phase === 'boo' ? 2.2 : 1;
    // segment A: his wrist to the living wrist, nearly taut, trembling
    const A = [];
    const lenA = Math.hypot(bw.x - wr.x, bw.y - wr.y);
    const NA = clamp(Math.round(lenA / 6), 6, 120);
    for (let i = 0; i <= NA; i++) {
      const s = i / NA;
      const sag = Math.min(10, lenA * 0.02) * Math.sin(s * Math.PI); // a little weight, never a floating arc
      const tr = (Math.sin(t * 23 + s * 41) * 0.6 + Math.sin(t * 9 + s * 17) * 0.5) * shake * Math.sin(s * Math.PI);
      A.push({ x: lerp(wr.x, bw.x, s), y: lerp(wr.y, bw.y, s) + sag + tr });
    }
    // segment B: from the living wrist down past the blanket, under the frame, into the seam
    const B = [];
    const c = { x: bw.x + 4, y: sm.y - 4 };
    for (let i = 0; i <= 18; i++) {
      const s = i / 18;
      const x = (1 - s) * (1 - s) * bw.x + 2 * (1 - s) * s * c.x + s * s * sm.x;
      const y = (1 - s) * (1 - s) * bw.y + 2 * (1 - s) * s * c.y + s * s * sm.y;
      const tr = Math.sin(t * 19 + s * 30) * 0.4 * shake * Math.sin(s * Math.PI);
      B.push({ x: x + tr, y });
    }
    this.glPts = { start: wr, mid: bw, end: sm, stage: gl.stage };
    const a = gl.a;
    const strokeFade = (pts, alpha, ends) => { // fainter in the middle of a long line, so it never dominates
      const n = pts.length - 1;
      for (let i = 0; i < n; i++) {
        const s = (i + 0.5) / n;
        const mid = ends ? 1 - Math.sin(s * Math.PI) * clamp((lenA - 80) / 300, 0, 0.75) : 1;
        g.lineStyle(1, 0xdfeaff, alpha * mid); g.lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      }
    };
    const part = (pts, k) => pts.slice(0, Math.max(2, Math.ceil(k * (pts.length - 1)) + 1));
    if (gl.stage === 1) { // the first pulse travels from his wrist to the living wrist, drawing the thread behind it
      const k = ease(gl.k), p = part(A, k);
      g.lineStyle(3, 0x8fc4ff, 0.12); g.strokePoints(p);
      strokeFade(p, 0.85, false);
      const head = p[p.length - 1];
      fx.fillStyle(0xffffff, 1); fx.fillRect(Math.round(head.x) - 1, Math.round(head.y) - 1, 3, 3);
      fx.fillStyle(0xbfe0ff, 0.35); fx.fillRect(Math.round(head.x) - 3, Math.round(head.y) - 1, 7, 3); fx.fillRect(Math.round(head.x) - 1, Math.round(head.y) - 3, 3, 7);
      fx.fillStyle(0xffffff, 0.9); fx.fillRect(Math.round(wr.x) - 1, Math.round(wr.y) - 1, 2, 2);
      return;
    }
    // A is always there from here on
    if (gl.stage < 4 || gl.t < 1.5) { g.lineStyle(3, 0x8fc4ff, 0.1 * a); g.strokePoints(A); }
    strokeFade(A, 0.85 * a, true);
    if (this.wristFlash > 0) { // the living wrist answers: a tiny flash
      const k = this.wristFlash / 0.5;
      fx.fillStyle(0xffffff, k); fx.fillRect(Math.round(bw.x) - 1, Math.round(bw.y) - 1, 3, 3);
      fx.fillStyle(0xcfeaff, k * 0.6); fx.fillRect(Math.round(bw.x) - 5, Math.round(bw.y), 11, 1); fx.fillRect(Math.round(bw.x), Math.round(bw.y) - 5, 1, 11);
      fx.lineStyle(1, 0xcfeaff, k * 0.5); fx.strokeCircle(bw.x, bw.y, 4 + (1 - k) * 10);
    }
    if (gl.stage === 2) return;
    const kB = gl.stage === 3 ? ease(gl.k) : 1;
    const pB = part(B, Math.min(1, kB * 1.25));
    strokeFade(pB, 0.85 * a, false);
    if (gl.stage === 3) {
      const head = pB[pB.length - 1];
      if (kB < 0.8) { fx.fillStyle(0xffffff, 1); fx.fillRect(Math.round(head.x) - 1, Math.round(head.y) - 1, 3, 3); }
    }
    if (kB >= 0.8) { // through the floor: the thread goes on below the seam and fades, a faint reflection stays
      const sink = clamp((kB - 0.8) / 0.2, 0, 1);
      for (let j = 0; j < 6; j++) { g.fillStyle(0xdfeaff, (0.5 - j * 0.08) * a * sink); g.fillRect(Math.round(sm.x), Math.round(sm.y) + 1 + j * 2, 1, 2); }
      if (gl.stage === 3 && sink < 1) { fx.fillStyle(0xffffff, 1 - sink); fx.fillRect(Math.round(sm.x) - 1, Math.round(sm.y) + sink * 10, 3, 3); }
      fx.fillStyle(0x9fd0ff, 0.22 * Math.max(a, 0.6)); fx.fillRect(Math.round(sm.x) - 6, Math.round(sm.y) + 1, 13, 1);
      fx.fillStyle(0x9fd0ff, 0.12 * Math.max(a, 0.6)); fx.fillRect(Math.round(sm.x) - 10, Math.round(sm.y) + 2, 21, 1);
      if (gl.stage === 3) { const p = sink; fx.lineStyle(1, 0xbfe6ff, 0.6 * (1 - p)); fx.strokeEllipse(sm.x, sm.y + 1, 6 + p * 22, 2 + p * 4); }
    }
    // after it's found: now and then a small light runs along it toward the body (the connection, quietly)
    if (gl.stage === 4) {
      const p = (t * 0.25) % 1.6;
      if (p < 1) {
        const all = [...A, ...B.slice(1)];
        const q = all[Math.floor(p * (all.length - 1))];
        fx.fillStyle(0xffffff, 0.55 * a + 0.15); fx.fillRect(Math.round(q.x) - 1, Math.round(q.y) - 1, 2, 2);
      }
    }
  }

  drawUi() {
    this.barT.setY(-28 + 28 * this.lb);
    this.barB.setY(H + 28 - 28 * this.lb);
    this.fadeR.setAlpha(this.fade);
    if (this.phase === 'gate') this.gate[0].setAlpha(0.55 + Math.sin(this.t * 3) * 0.35);
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
    const head = b.who === 'boo' ? { x: this.boo.x, y: this.boo.y - 34 } : { x: this.m.x, y: this.m.y - 100 };
    const sp = this.toScreen(head.x, head.y);
    const bw = b.str.length * 8 + 16, bh = 22;
    const bx = clamp(Math.round(sp.x - bw / 2), 8, W - bw - 8), by = clamp(Math.round(sp.y - bh - 10), 34, H - 60);
    const edge = b.who === 'boo' ? 0xffc870 : 0xa8e4ff;
    const fadeOut = b.t > b.dur + b.str.length / 24 - 0.3 ? 0.4 : 1;
    bg.fillStyle(0x0b0d1a, 0.88 * fadeOut); bg.fillRect(bx, by, bw, bh);
    bg.lineStyle(2, edge, fadeOut); bg.strokeRect(bx, by, bw, bh);
    const tx = clamp(sp.x, bx + 8, bx + bw - 8);
    bg.fillStyle(0x0b0d1a, 0.88 * fadeOut); bg.fillTriangle(tx - 5, by + bh, tx + 5, by + bh, tx, by + bh + 7);
    bg.lineStyle(2, edge, fadeOut); bg.lineBetween(tx - 5, by + bh + 1, tx, by + bh + 7); bg.lineBetween(tx + 5, by + bh + 1, tx, by + bh + 7);
    this.bubT.setText(b.str.slice(0, b.n)).setColor(b.who === 'boo' ? '#ffe6b0' : '#dff4ff').setPosition(bx + 9, by + bh / 2 + 1).setAlpha(fadeOut);
  }
}
