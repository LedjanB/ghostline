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
import { Save } from './save.js';

const TOP = CEIL + 16;
const MILO_SCALE = 2.5;     // v6: 1.25x the v5 size, so he reads on a busy screen
const MILO_HALF = 22;       // half his height at that scale
const BOTTOM = FLOOR - MILO_HALF; // Milo's centre when standing
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
  LAND_GAP: 100, AIR_HIT: 30, // flight: it waits where you land; each air hit = 30 px closer (3 hits = caught)
  ORB_TIME: 8,               // Boo orb flight (s): rare, but long enough to be a real moment
  ORB_FIRST_M: 900, ORB_EVERY_M: [1800, 2600],
  CHASM_S: 6.5,              // flight section width in seconds of running
  CHASM_AT_M: 220,           // a flight section every other world (0, 2, 4, 6), this far into it
  SAFE_RUNS: 3, SAFE_M: 300, // a player's first runs: Boo saves you until 300 m
};
// weapons (picked up during the run; each breaks after its time or ammo). They aim and fire on their own.
export const WEAPONS = {
  salt: { name: 'SALT SHOTGUN', icon: 'salt_gun', ammo: 24, time: 16, cd: 0.32, range: 230 },       // short, wide spread
  flame: { name: 'CANDLE FLAMETHROWER', icon: 'flame_gun', ammo: Infinity, time: 9, cd: 0.045, range: 125 }, // constant stream, burns hands
  holy: { name: 'HOLY WATER SLINGSHOT', icon: 'sling', ammo: 12, time: 18, cd: 0.7, range: 420 },  // long range, pierces
  bone: { name: 'BONE BOOMERANG', icon: 'bone', ammo: 8, time: 18, cd: 0.25, range: 270 },         // comes back, hits twice
};
const ECTO = { cd: 0.28, range: 300 }; // Boo's ectoplasm while flying: pops banshees and hands
const STRETCH_SCALE = 2.4; // about 2.5x Milo's height
const BEAM_END = FLOOR - 32; // a ceiling beam's tip: just above Milo's head, so sliding clearly fits under
// one trap of its own per world
// hand-made flight sections: the gap centre (screen y) of each beam gate, in order
export const SET_PIECES = {
  ward: { title: 'THREAD THE NEEDLE!', gates: [176, 150, 206, 160, 214], half: 74 },
};

export const WORLD_TRAPS = {
  ward: 'gurney', morgue: 'drawer', woods: 'roots', graveyard: 'sinkhole',
  sewer: 'vent', catacombs: 'chandelier', carnival: 'cart', otherside: 'eye',
};
const WALKERS = { ghoul: 45, gurney: 110, cart: 170 }; // these move at you on their own

const kindsAt = (m, zoneId) => [
  [WORLD_TRAPS[zoneId], m > 40 ? 2.6 : 0],
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
    this.weapon = null; this.kills = 0; this.lastWeapon = ''; this.ectoCd = 0; this.slideHeldT = 0;
    this.nextTrapX = this.worldX + 700;
    this.lastKinds = [];
    this.runDiff = 0;
    this.chasmZones = new Set(); this.chasm = null;
    this.nextOrbX = this.worldX + RUN.ORB_FIRST_M * PX_PER_METER;
    this.cleanFromX = this.worldX;
    this.stepT = 0; this.breathT = 0;
    // perks (characters) and charms, v6 meanings
    this.perk = {
      startGap: this.char.id === 'nurse' ? 24 : 0,                         // Nurse Ivy: it starts further back
      fly: (this.char.id === 'vampire' ? 1.5 : 1),                         // Count Vlad: Boo carries you longer
      stumble: this.char.id === 'skeleton' ? 0.7 : 1,                      // Rattles: stumbles cost less
      power: this.char.powerMul || 1,                                      // Fang: power-ups and weapons last longer
      candle: this.charm.nightlight ? 2 : 1,                               // Night Light: candles push it back twice as far
      flyPlus: this.charm.longrush ? 3 : 0,                                // Long Ride: +3 s per flight
      jump: this.charm.bouncy ? 1.08 : 1,                                  // Bouncy Bones: jump higher
    };
    this.gap = RUN.START_GAP + this.perk.startGap; this.gapVis = this.gap;
    // a player's first few runs are gentle: Boo saves you until 300 m
    this.safeRun = !this.creative && !this.daily && (Save.get().runs || 0) < RUN.SAFE_RUNS;
    this.rescues = 0;
    // one new system per run (testers drowned in them on run 1): run 1 missions only, run 2 power-ups,
    // run 3 the B-O-O letters, run 5 souls and Grave Spin
    if (!this.creative && !this.daily) {
      const runs = Save.get().runs || 0;
      if (runs < 1) { this.nextPowerX = Infinity; this.nextRushX = Infinity; }
      if (runs < 2) this.nextLetterX = Infinity;
      if (runs < 4 && !this.charm.lucky) this.nextSoulX = Infinity;
    }
    this.heads = []; this.headUntil = 0; this.quietUntil = 0; this.lastStrike = undefined; this.lungeT = 9; this.lastHitKind = '';
    this.nextWeaponX = this.worldX + 90 * PX_PER_METER;
    this.crFlyT = 0; this.crFlyX = 0; this.crEnter = 1; this.catchUpT = 0;
    this.caughtBy = false; this.stumbleT = 0; this.grab = null; this.setPiece = null;
    // v5 systems the runner replaces or doesn't use
    this.nextRushX = Infinity;   // Spirit Rush: off (flying is the rare treat now)
    this.nextGhoul = Infinity;   // v5 floor ghouls: replaced by runner ghouls you shoot
  },

  runnerCreate() {
    this.pitGfx = this.add.graphics().setDepth(15.2);  // over the floor band: pits are holes in it
    this.trapGfx = this.add.graphics().setDepth(7);
    this.shotGfx = this.add.graphics().setDepth(21.7);
    this.stretch = this.add.sprite(PLAYER_X - this.gap, FLOOR + 2, 'stretch_walk0').setScale(STRETCH_SCALE).setOrigin(0.5, 1).setDepth(9.4);
    this.edgeGfx = this.add.graphics().setDepth(4.45);
    this.gateGfx = this.add.graphics().setDepth(4.46); // the dark passage you run through at a world gate
    this.gateShade = this.add.graphics().setDepth(4.48); this.gateShadeHi = this.add.graphics().setDepth(15.6);
    // the death scene: room dims under the actors, the arm sits on THE STRETCH, the dark wall swallows both
    this.grabDim = this.add.graphics().setDepth(9.6);
    this.hurtGfx = this.add.graphics().setDepth(19.5).setAlpha(0);
    this.grabGfx = this.add.graphics().setDepth(9.72);
    this.grabDark = this.add.graphics().setDepth(25);
    this.player.setScale(MILO_SCALE); // the dark it brings with it: backgrounds only, under every hazard
    this.stretch.play('stretch_walk');
    this.gunImg = this.add.image(PLAYER_X, BOTTOM, 'salt_gun').setScale(1.5).setDepth(9.1).setVisible(false);
    this.tutorial.setText(`${prompt2('jump')} TO JUMP`);
    this.tutorial2.setText(`${prompt2('slide')} TO SLIDE`);
    this.events.once('shutdown', () => { this.traps.forEach((t) => this.dropTrap(t)); this.pellets.forEach((p) => p.img && p.img.destroy()); });
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
    // hold Down (or keep the finger down after a swipe) to keep sliding, up to 1.2 s
    if (slide) this.slideHeldT = 0;
    if (this.slide > 0 && this.grounded && this.inputMap && this.inputMap.held('slide') && this.slideHeldT < 1.2) {
      this.slideHeldT += dt; this.slide = Math.max(this.slide, 0.12);
    }
    if (this.slide > 0) this.slide = Math.max(0, this.slide - dt);
    if (this.buffer > 0 && this.coyote > 0) {
      this.vy = -JUMP_V * this.perk.jump; this.grounded = false; this.coyote = 0; this.buffer = 0; this.slide = 0;
      Audio.sfx('jump');
      this.tweens.add({ targets: this.player, scaleX: MILO_SCALE * 0.85, scaleY: MILO_SCALE * 1.2, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
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
    this.headUntil = Math.max(this.headUntil, this.clock + 0.5); // the world title waits for the controls to clear
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
      const cap = maxGap(this.runDiff) + this.perk.startGap;
      if (this.clock - this.lastStumble > 3 && this.catchUpT <= 0 && this.started && this.gap < cap) this.gap = Math.min(cap, this.gap + cleanRate(this.runDiff) * dt);
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
    this.tracker?.max('clean', Math.floor((this.worldX - this.cleanFromX) / PX_PER_METER));
    this.stretchSounds(dt);
    this.nextHeadline();
    // one more stumble inside the window and it gets you: tell the HUD (rounded, so it's only sent when it changes)
    const win = comboWindow(this.runDiff), since = this.clock - this.lastStumble;
    const strike = !this.flying && since < win && this.stumbles > 0 ? Math.round((1 - since / win) * 20) / 20 : null;
    if (strike !== this.lastStrike) { this.lastStrike = strike; this.events.emit('strike', strike); }
    // while one more stumble gets you, the meter says so: it drops near empty and refills as the danger passes
    if (strike !== null) this.light = Math.min(this.light, 0.1 + 0.9 * (1 - strike));
    this.lungeT += dt;
    this.stumbleT = Math.max(0, this.stumbleT - dt);
  },

  // audio-design: it is heard before it is seen. Steps get louder and faster as it closes in;
  // it breathes when it's right behind you; silence while Boo carries you.
  stretchSounds(dt) {
    if (this.dead || !this.started) return;
    const near = 1 - this.light;
    if (this.flying) return;
    const crawling = this.catchUpT > 0 || near > 0.6 || this.clock - this.lastStumble < 1.2;
    this.stepT -= dt;
    if (this.stepT <= 0) {
      this.stepT = crawling ? 0.18 : 0.42 - near * 0.12;
      Audio.sfx('step', { v: 0.25 + near * 0.75 });
    }
    this.breathT -= dt;
    if (near > 0.55 && this.breathT <= 0) { this.breathT = 1.4; Audio.sfx('breath', { v: near }); }
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
    this.lastHitKind = kind; // the results screen names the trap that got you
    if (this.clock - this.lastStumble < comboWindow(this.runDiff)) { this.caught('2nd'); return; }
    this.lastStumble = this.clock; this.stumbles++;
    this.lungeT = 0; this.lastHitKind = kind;
    this.cleanFromX = this.worldX;
    this.tracker?.add('stumbles', 1);
    this.gap -= stumbleCost(this.runDiff) * this.perk.stumble;
    Audio.sfx('roar');
    this.slowT = 0; this.invuln = 0.6;
    this.breakCombo();
    this.deathCause = kind;
    Audio.sfx('stumble');
    this.shake(160, 0.008);
    this.hurtEdge();
    this.burst(PLAYER_X + 8, FLOOR - 6, 0x8a8a9a, 8, 30, 300);
    this.popup(this.gap - RUN.CAUGHT < 45 ? 'IT\'S RIGHT BEHIND YOU' : 'STUMBLE!', '#ff8a9a');
    this.stumbleT = 0.4; // the stumble pose (render)
    if (this.gap <= RUN.CAUGHT) this.caught('caught');
  },

  caught(cause) {
    if (this.dead) return;
    // first runs: until 300 m, Boo shoves it back (or pulls you out of the pit) instead of game over
    if (this.safeRun && this.worldX / PX_PER_METER < RUN.SAFE_M) { this.rescue(cause); return; }
    if (this.creative) { // creative: Boo pulls you free, the creature is shoved back
      this.rebirth();
      this.gap = RUN.START_GAP; this.landingGap = RUN.LAND_GAP;
      if (this.py > BOTTOM) { this.py = BOTTOM; this.vy = 0; this.grounded = true; }
      return;
    }
    this.deathCause = cause === 'pit' ? 'pit' : 'caught';
    if (cause === 'pit') this.lastHitKind = 'pit';
    this.events.emit('hush'); this.events.emit('strike', null);
    this.heads = [];
    this.caughtBy = true; // pit or not, it comes for you
    if (cause !== 'pit') {
      // the death scene (stepGrab / renderGrab): its arm shoots out, lifts Milo, and the dark takes them both
      this.grab = { t: 0, y0: this.py, cx0: this.stretch.x, roared: false };
      this.stretch.anims.stop(); this.stretch.setTexture('stretch_grab');
      Audio.sfx('scream');
    } else { // it crawls up to the edge of the pit and looks down
      this.stretch.play('stretch_crawl');
      this.tweens.add({ targets: this, gapVis: 26, duration: 900, ease: 'Sine.easeOut' });
    }
    this.die();
    this.hitStop = 0.14;
    if (this.grab) { this.vy = 0; this.spin = 0; this.player.rotation = 0; this.player.setDepth(9.7); this.stretch.setDepth(9.65); }
    const why = cause === 'pit' ? 'YOU FELL IN!' : cause === '2nd' ? '2ND STUMBLE!' : 'IT CAUGHT UP!';
    const t = text(this, this.grab ? W / 2 + 40 : PLAYER_X + 70, this.grab ? 120 : this.py - 50, why, 16, '#ff6a5a').setDepth(32).setStroke('#07060d', 5).setScale(1.4);
    this.tweens.add({ targets: t, scaleX: 1, scaleY: 1, duration: 240, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 1400, duration: 400, onComplete: () => t.destroy() });
  },

  // a hit: a short red edge round the screen instead of a full-screen flash, so Milo and the
  // hazards stay readable (testers lost both under the old wash)
  hurtEdge() {
    const g = this.hurtGfx;
    if (!g.drawn) {
      g.drawn = true;
      for (let i = 0; i < 6; i++) {
        const a = 0.55 * (1 - i / 6), w = 6;
        g.fillStyle(0xff2244, a);
        g.fillRect(i * w, 0, w, H); g.fillRect(W - (i + 1) * w, 0, w, H);
        g.fillRect(0, i * w, W, w); g.fillRect(0, H - (i + 1) * w, W, w);
      }
    }
    this.tweens.killTweensOf(g);
    g.setAlpha(1);
    this.tweens.add({ targets: g, alpha: 0, duration: 220, ease: 'Quad.easeIn' });
  },

  // ---------------- the death scene ----------------
  // 0-0.3 s the arm shoots out; 0.3-0.8 it lifts Milo, kicking; 0.8-1.2 it holds him up and grins;
  // 1.2-2.0 it pulls him back into the dark, which closes over the screen. Then the results.
  stepGrab(dt) {
    const g = this.grab;
    g.t += dt;
    this.speed *= Math.exp(-7 * dt); if (this.speed < 8) this.speed = 0;
    if (g.t > 0.3 && !g.hit) { g.hit = true; Audio.sfx('stumble'); this.shake(120, 0.008); this.buzz(80); }
    if (g.t > 0.85 && !g.roared) { g.roared = true; Audio.sfx('roar'); this.shake(260, 0.006); }
    if (g.t > 1.2 && !g.hushed) { // the HUD and Boo's bubble go too: only the dark and the grin
      g.hushed = true;
      const hud = this.scene.get('hud');
      if (hud && hud.cameras && hud.cameras.main) this.tweens.add({ targets: hud.cameras.main, alpha: 0, duration: 300 });
      if (this.bubble) this.tweens.add({ targets: this.bubble, alpha: 0, duration: 200 });
    }
    if (g.t > 2.1 && !this.ended) { this.ended = true; this.time.delayedCall(250, () => this.afterDeath()); }
  },

  renderGrab() {
    const g = this.grab, t = g.t;
    const ease = Phaser.Math.Easing;
    const drag = t > 1.2 ? Math.pow((t - 1.2) / 0.8, 2) * 420 : 0;
    // the creature steps up to its full height, a little behind Milo
    const cx = Phaser.Math.Linear(g.cx0, PLAYER_X - 70, ease.Cubic.Out(Math.min(1, t / 0.25))) - drag;
    const s = this.stretch;
    s.setVisible(true).setPosition(Math.round(cx), FLOOR + 2).setScale(STRETCH_SCALE, STRETCH_SCALE + (t > 0.8 && t < 1.2 ? 0.08 : 0));
    const sh = { x: cx + 9, y: FLOOR + 2 - s.displayHeight + 26 }; // its right shoulder
    // Milo: frozen where he was, then lifted up and back, kicking
    const lift = ease.Back.Out(Phaser.Math.Clamp((t - 0.3) / 0.5, 0, 1));
    const mx = Phaser.Math.Linear(PLAYER_X, PLAYER_X - 18, lift) - drag;
    const my = Phaser.Math.Linear(g.y0, FLOOR - 92, lift);
    const kick = Math.floor(t * 14) % 2;
    this.player.setTexture(`${this.char.id}_${t < 0.3 ? 'fall' : kick ? 'fall' : 'jump'}`).setAlpha(1)
      .setPosition(Math.round(mx), Math.round(my)).setRotation(t < 0.3 ? -0.15 : Math.sin(t * 22) * 0.22);
    // the arm: three long bones with knuckle joints, from the shoulder to Milo's collar
    const reach = ease.Cubic.Out(Math.min(1, t / 0.3));
    const hx = Phaser.Math.Linear(sh.x, mx - 4, reach), hy = Phaser.Math.Linear(sh.y, my - 12, reach);
    const a = this.grabGfx; a.clear();
    const j1 = { x: sh.x + (hx - sh.x) * 0.36, y: sh.y + (hy - sh.y) * 0.36 - 14 * reach };
    const j2 = { x: sh.x + (hx - sh.x) * 0.7, y: sh.y + (hy - sh.y) * 0.7 + 8 * reach };
    const bone = (p, q, w, c) => { a.lineStyle(w, c, 1); a.beginPath(); a.moveTo(p.x, p.y); a.lineTo(q.x, q.y); a.strokePath(); };
    for (const [w, c] of [[7, 0x0b0918], [4, 0x2c2540]]) { bone(sh, j1, w, c); bone(j1, j2, w, c); bone(j2, { x: hx, y: hy }, w, c); }
    a.fillStyle(0x463c63, 1); a.fillCircle(j1.x, j1.y, 2.5); a.fillCircle(j2.x, j2.y, 2.5);
    // long pale fingers wrapped round his collar
    a.fillStyle(0x0b0918, 1); a.fillRect(hx - 5, hy - 4, 12, 9);
    a.fillStyle(0xece8f2, 1); a.fillRect(hx - 4, hy - 3, 10, 2); a.fillRect(hx - 4, hy + 1, 10, 2); a.fillRect(hx + 4, hy - 3, 2, 6);
    // the dark: a soft wall that sweeps in from the left and swallows them
    const d = this.grabDark; d.clear();
    const cover = t > 1.2 ? ease.Quadratic.In(Math.min(1, (t - 1.2) / 0.8)) * (W + 160) : 0;
    const vign = Math.min(1, t / 0.6) * 0.45; // the room dims as soon as it has you
    this.grabDim.clear().fillStyle(0x07060d, vign).fillRect(0, 0, W, H);
    if (cover > 0) {
      d.fillStyle(0x07060d, 1); d.fillRect(0, 0, Math.max(0, cover - 120), H);
      for (let i = 0; i < 8; i++) { d.fillStyle(0x07060d, 1 - (i + 1) / 9); d.fillRect(cover - 120 + i * 15, 0, 15.5, H); }
    }
    // its grin is the last thing you see
    if (t > 1.75) {
      const ea = Math.min(1, (t - 1.75) / 0.2) * (t > 2.25 ? Math.max(0, 1 - (t - 2.25) / 0.25) : 1);
      d.fillStyle(0xece8f2, ea); d.fillRect(W / 2 - 22, H / 2 - 18, 12, 6); d.fillRect(W / 2 + 10, H / 2 - 18, 12, 6);
      d.fillStyle(0xece8f2, ea); d.fillRect(W / 2 - 34, H / 2 + 4, 68, 4);
      for (let i = 0; i < 8; i++) { d.fillStyle(0xffffff, ea); d.fillRect(W / 2 - 32 + i * 8, H / 2 + 8, 5, 6); }
    }
  },

  rescue(cause) {
    this.rescues++;
    this.invuln = 1.6; this.lastStumble = -99;
    this.gap = Math.max(this.gap, RUN.CAUGHT + 46); this.gapVis = Math.min(this.gapVis, this.gap);
    if (cause === 'pit' || this.py > BOTTOM) { this.py = BOTTOM - 70; this.vy = -380; this.grounded = false; this.dropPitUnderMilo(); }
    Audio.sfx('grab'); this.shake(140, 0.006);
    this.burst(PLAYER_X - 30, FLOOR - 40, 0xcfe0ff, 14, 50, 450);
    this.ghostX = PLAYER_X - 40; this.ghostY = this.py - 30;
    this.popup(cause === 'pit' ? 'BOO PULLED YOU OUT!' : 'BOO SHOVED IT BACK!', '#cfe0ff');
    this.quip('shield', true);
  },
  dropPitUnderMilo() {
    for (const t of this.traps) if (t.kind === 'pit') { const x = this.sx(t.wx); if (x < PLAYER_X + 20 && x + t.w > PLAYER_X - 20) this.dropTrap(t); }
  },

  // candles push it back a little (in the air: it'll be a little further back when you land)
  candlePush() {
    const k = RUN.CANDLE * this.perk.candle;
    if (this.flying) this.landingGap = Math.min(RUN.START_GAP, this.landingGap + k);
    else this.gap = Math.min(RUN.MAX_GAP + this.perk.startGap, this.gap + k);
  },

  // ---------------- Boo's flights ----------------
  startFlight(kind) {
    this.flying = true; this.flyKind = kind; this.flights++;
    this.flyT = RUN.ORB_TIME * this.perk.fly + this.perk.flyPlus; this.landingGap = RUN.LAND_GAP; this.airHits = 0;
    this.tracker?.add('flights', 1);
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
    const piece = kind === 'section' ? SET_PIECES[zoneAt(this.zoneIndex).id] : null;
    this.setPiece = piece ? { ...piece, i: 0, step: this.speed * 1.0 } : null;
    if (this.setPiece) this.nextSpawn = this.worldX + this.speed * 0.3;
    Audio.sfx('grab'); Audio.thrust(true);
    this.shake(140, 0.006); this.flash(120, 200, 220, 255);
    this.addCombo('power', PLAYER_X + 40, this.py - 40);
    this.flyPop(kind === 'orb' ? 'BOO!' : this.setPiece ? this.setPiece.title : 'HOLD ON!');
    this.quip('grab', true);
  },

  // ---------------- flight set pieces ----------------
  // A hand-made flight instead of the random air spawner: a row of beam gates whose gap climbs and
  // drops, with candles marking the line through each one. Phase 2 builds the ward's; phase 3 adds one per world.
  stepSetPiece() {
    const sp = this.setPiece;
    if (sp.i >= sp.gates.length || this.worldX < this.nextSpawn) return;
    const x0 = W + 60, gc = sp.gates[sp.i++];
    const half = sp.half;
    const beam = (y1, y2) => this.spawnBeam(x0, 0, Math.PI / 2, false, (y1 + y2) / 2, null, y2 - y1);
    beam(CEIL + 22, gc - half); // the top node stays clear of the HUD row
    beam(gc + half, FLOOR - 8);
    for (let k = -1; k <= 1; k++) this.addCandle(x0 + k * 40, gc);
    // candles bend from this gap to the next so the line is easy to follow
    const next = sp.gates[sp.i];
    if (next !== undefined) for (let k = 1; k <= 4; k++) this.addCandle(x0 + 40 + k * (sp.step / 5), gc + (next - gc) * (k / 5));
    else for (let k = 0; k < 8; k++) this.addCandle(x0 + 120 + k * 22, gc - Math.sin(k / 7 * Math.PI) * 50);
    this.nextSpawn = this.worldX + sp.step;
  },

  stepRunnerFlight(dt) {
    if (!this.flying || this.dead) return;
    this.jumpLatch = false; this.slideLatch = false; // presses in the air don't carry over to the landing
    if (this.py > BOTTOM) { this.py = BOTTOM; if (this.vy > 0) this.vy = 0; }
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
    if (this.airHits === 0) { // a clean flight earns real distance
      this.tracker?.add('cleanLands', 1);
      this.addCombo('power', PLAYER_X + 40, this.py - 40);
      this.popup(this.setPiece ? 'NEEDLE THREADED!' : 'CLEAN LANDING!', '#9fe8ff');
    }
    this.setPiece = null;
    this.flyPop(this.gap - RUN.CAUGHT < 40 ? 'IT\'S RIGHT THERE' : 'IT\'S COMING');
    this.quip('landed');
  },

  airHit(kind) {
    if (this.invuln > 0 || this.dead) return;
    this.buzz(120);
    if (this.shield) { this.stumble(kind); return; } // the shield code path is shared
    this.airHits++;
    this.lastHitKind = 'air:' + kind;
    this.landingGap -= RUN.AIR_HIT;
    this.flyT -= 1;
    this.invuln = 1.0;
    this.breakCombo();
    this.deathCause = kind;
    Audio.sfx('stumble');
    this.shake(160, 0.008); this.hurtEdge();
    this.burst(PLAYER_X, this.py, 0xcfe0ff, 10, 40, 400);
    const left = this.landingGap - RUN.CAUGHT;
    this.popup(left <= 0 ? 'IT WILL CATCH YOU' : left < 40 ? 'CAREFUL!' : 'OUCH!', '#ff8a9a');
  },

  // every hit goes through here (v5 collide in the air, tests, the ground traps)
  runnerHit(kind) {
    if (this.flying) this.airHit(kind); else this.stumble(kind);
  },

  flyPop(str) { this.headline(str, '', 0.9, true); },

  // ONE headline slot up top. Queued; urgent ones (flight moments) jump the queue.
  headline(main, sub = '', hold = 2.0, urgent = false) {
    const h = { main, sub, hold };
    if (urgent) this.heads.unshift(h); else this.heads.push(h);
    this.nextHeadline();
  },
  nextHeadline() {
    if (this.clock < this.headUntil || !this.heads.length || !this.started || this.dead) return;
    const h = this.heads.shift();
    this.headUntil = this.clock + h.hold + 0.3;
    this.quietUntil = this.headUntil;
    const a = text(this, W / 2, 132, h.main, 24, '#e6f0ff').setDepth(31).setStroke('#07060d', 6).setScale(0.7).setAlpha(0);
    const b = h.sub ? text(this, W / 2, 156, h.sub, 8, '#a99fd0').setDepth(31).setStroke('#07060d', 3).setAlpha(0) : null;
    const objs = b ? [a, b] : [a];
    this.tweens.add({ targets: a, scaleX: 1, scaleY: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: objs, alpha: 1, duration: 180, yoyo: true, hold: h.hold * 1000, onComplete: () => objs.forEach((o) => o.destroy()) });
  },

  // ---------------- ground spawning ----------------
  runnerSpawner(meters, pace) {
    const v = this.speed;
    this.runDiff = pace.diff;
    const spawnWX = this.worldX + (W + 40 - PLAYER_X);
    const zoneM = meters % ZONE_LENGTH_M;
    const toGate = ZONE_LENGTH_M - zoneM;
    // one flight section per world (a gap Boo carries you over)
    const chasmWorld = this.zoneIndex % 2 === 0;
    if (chasmWorld && !this.chasm && !this.chasmZones.has(this.zoneIndex) && zoneM >= RUN.CHASM_AT_M && zoneM < RUN.CHASM_AT_M + 60 && !this.gate) {
      this.chasmZones.add(this.zoneIndex);
      const w = v * (RUN.CHASM_S * this.perk.fly + this.perk.flyPlus);
      this.chasm = this.addTrap('chasm', spawnWX, { w });
      this.nextTrapX = spawnWX + w + v * 0.9;
      // candles lead the eye to the edge
      for (let i = 0; i < 6; i++) this.addCandle(W + 40 - 150 + i * 22, BOTTOM - 4);
      return;
    }
    const runway = chasmWorld && !this.chasm && !this.chasmZones.has(this.zoneIndex) && zoneM > RUN.CHASM_AT_M - v * 1.4 / PX_PER_METER && zoneM < RUN.CHASM_AT_M;
    if (this.chasm || runway) return;
    if (this.gate || toGate < 22) return; // gates stay clear

    // pickups: a weapon (salt first, then a different one each time) and the (rare) Boo orb
    if (this.worldX >= this.nextWeaponX && !this.weapon) {
      const kind = this.lastWeapon ? this.rand.pick(Object.keys(WEAPONS).filter((k) => k !== this.lastWeapon)) : 'salt';
      const p = this.makePickup('weapon', spawnWX + 60, BOTTOM - 4, WEAPONS[kind].icon);
      p.weapon = kind;
      this.runPickups.push(p);
      this.nextWeaponX = Infinity; // the next one is scheduled when this weapon breaks
    }
    // the (rare) Boo orb never lands near a flight section or a gate
    const nearChasm = chasmWorld && zoneM > RUN.CHASM_AT_M - 120 && zoneM < RUN.CHASM_AT_M + 160;
    if (this.worldX >= this.nextOrbX && !nearChasm && toGate > 80) {
      this.runPickups.push(this.makePickup('orb', spawnWX + 30, BOTTOM - 62));
      this.nextOrbX = this.worldX + this.rand.range(RUN.ORB_EVERY_M[0], RUN.ORB_EVERY_M[1]) * PX_PER_METER;
    }

    if (this.worldX < this.nextTrapX) return;
    if (pace.breather) { // a candle-only breather at the start of each segment
      const n = this.rand.int(6, 10);
      for (let i = 0; i < n; i++) this.addCandle(W + 40 + i * 22, BOTTOM - 4);
      this.tip('candle');
      this.nextTrapX = this.worldX + n * 22 + v * 0.8;
      return;
    }
    const table = kindsAt(meters, zoneAt(this.zoneIndex).id).map(([k, w]) => [k, w]);
    if (this.lastKinds.length === 2 && this.lastKinds[0] === this.lastKinds[1]) {
      for (const e of table) if (e[0] === this.lastKinds[0]) e[1] = 0;
    }
    const kind = this.rand.weighted(table.filter((e) => e[1] > 0));
    this.lastKinds = [...this.lastKinds, kind].slice(-2);
    let w = 28;
    if (kind === 'swing') { this.spawnGroundSwing(W + 60); w = 60; }
    else {
      const t = this.addTrap(kind, spawnWX + this.walkLead(kind, v), kind === 'pit' ? { w: this.pitWidth(v) } : {});
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

  // something that walks at you starts further out, so it reaches you when a still trap would have
  walkLead(kind, v) { return (WALKERS[kind] || 0) * ((W + 40 - PLAYER_X) / v); },

  // pits keep growing with speed, so they stay a real jump at 500 px/s
  pitWidth(v) { return Phaser.Math.Clamp(v * 0.3, 60, 150); },

  // a follow-up right after the trap that was just placed; returns the extra length it adds
  spawnCombo(wx, v, d) {
    const prev = this.lastKinds[this.lastKinds.length - 1];
    const jumpy = prev === 'grave' || prev === 'crate' || prev === 'pit' || prev === 'hand';
    let kind;
    if (jumpy) kind = this.rand.pick(['beam', 'grave', prev === 'pit' ? 'grave' : 'pit']); // jump then slide, or jump-jump
    else kind = this.rand.pick(['grave', 'hand']);                                         // slide then jump
    // jump after a jump needs room to land and jump again (a full jump is ~0.64 s in the air); a slide can follow closer
    const step = kind === 'beam' ? v * (0.62 - 0.08 * d) : v * (0.86 - 0.06 * d);
    const t = this.addTrap(kind, wx + step, kind === 'pit' ? { w: this.pitWidth(v) } : {});
    if (prev === 'hand' && kind !== 'beam' && this.rand.chance(0.5)) { // three hands in a row, each one landable
      this.addTrap('hand', wx + step * 2);
      return step * 2 + 24;
    }
    return step + t.w;
  },

  addTrap(kind, wx, opts = {}) {
    const t = { kind, wx, w: 28, h: 0, hit: false, gone: false, passed: false, ...opts };
    if (kind === 'grave') { // a tombstone outside; indoors (hospital, morgue) a wet floor sign
      const indoor = this.zoneIndex <= 1;
      t.w = 28; t.h = 36; t.s = this.add.image(0, FLOOR, indoor ? 'wetfloor' : 'grave').setScale(2).setOrigin(0, 1).setDepth(8);
    }
    if (kind === 'crate') { t.w = 32; t.h = 32; t.hp = 2; t.s = this.add.image(0, FLOOR, 'crate').setScale(2).setOrigin(0, 1).setDepth(8); }
    if (kind === 'hand') {
      t.w = 24; t.reach = 46; t.y = FLOOR + 6; t.state = 'wait'; t.t = 0;
      t.s = this.add.image(0, t.y, 'hand').setScale(2).setOrigin(0.5, 0).setDepth(5);
    }
    if (kind === 'beam') { // comes out of a node in the ceiling, ends in a thin tip above Milo's head
      t.w = 14;
      t.nodes = [this.add.image(0, CEIL + 2, 'spirit').setScale(2).setDepth(15.5).setTint(this.hz.node)];
      t.glow = this.add.image(0, BEAM_END, 'glow').setScale(0.55).setDepth(21).setBlendMode(Phaser.BlendModes.ADD).setTint(this.hz.glow).setAlpha(0.5);
    }
    if (kind === 'ghoul') {
      t.w = 20; t.h = 30; t.hp = 2; t.walk = 45;
      t.s = this.add.sprite(0, FLOOR - 15, 'ghoul0').setScale(2).setDepth(8.8).setTint(zoneAt(this.zoneIndex).ghoul).setFlipX(true);
      t.s.play('ghoul_walk');
    }
    if (kind === 'beam') t.tip = 'slide';
    if (kind === 'gurney') { t.w = 44; t.h = 22; t.hp = 3; t.walk = WALKERS.gurney; t.tip = 'gurney'; t.s = this.add.image(0, FLOOR + 2, 'gurney').setScale(2).setOrigin(0, 1).setDepth(8); }
    if (kind === 'cart') { t.w = 40; t.h = 22; t.hp = 3; t.walk = WALKERS.cart; t.tip = 'cart'; t.s = this.add.image(0, FLOOR + 2, 'cart').setScale(2).setOrigin(0, 1).setDepth(8); }
    if (kind === 'drawer') { // slides out of the wall at head height: slide under (or a big jump)
      t.w = 48; t.out = 0; t.state = 'in'; t.tip = 'drawer';
      t.s = this.add.image(0, FLOOR - 38, 'drawer').setScale(0.2, 2).setOrigin(0, 0.5).setDepth(8).setAlpha(0.6);
    }
    if (kind === 'roots') { t.w = 64; t.reach = 30; t.cur = 4; t.state = 'wait'; t.t = 0; t.tip = 'roots'; }
    if (kind === 'sinkhole') { t.w = 56; t.state = 'solid'; t.tip = 'sinkhole'; t.seed = Math.floor(wx) % 89; }
    if (kind === 'vent') { // steam on and off: jump the steam, or run through when it's off
      t.w = 24; t.ph = this.rand.range(0, 1.7); t.tip = 'vent';
      t.s = this.add.image(0, FLOOR + 2, 'vent').setScale(2).setOrigin(0, 1).setDepth(15.3);
    }
    if (kind === 'chandelier') { // watch the shadow: it drops in front of you, then you jump the wreck
      t.w = 44; t.h = 18; t.y = CEIL - 2; t.vy = 0; t.state = 'hang'; t.tip = 'chandelier';
      t.s = this.add.image(0, t.y, 'chandelier').setScale(2).setOrigin(0, 0).setDepth(8.2);
    }
    if (kind === 'eye') { // bobs up and down: slide under, or jump it when it's low
      t.w = 22; t.hp = 2; t.ph = this.rand.range(0, Math.PI * 2); t.y = FLOOR - 40; t.tip = 'eye';
      t.s = this.add.image(0, t.y, 'eye').setScale(2).setDepth(8.6);
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
    // hooks and axes are grey on grey rooms: they get a warning glow so they read as danger
    const glow = this.add.image(x0, CEIL, 'glow').setScale(info.glow ? 1.4 : 1.0).setDepth(21).setBlendMode(Phaser.BlendModes.ADD)
      .setTint(info.glow || this.hz.warn).setAlpha(info.glow ? 0.4 : 0.55);
    const len = FLOOR - CEIL - 20 - info.off - info.r; // lowest swing: through standing height, over a slide
    this.swings.push({ x: x0, len, type, s, glow, info, th: 0, amp: this.rand.range(0.32, 0.45), w: this.rand.range(2.2, 2.8), phase: this.rand.range(0, Math.PI * 2), lastSign: 0, ground: true });
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
      if (t.walk) t.wx -= t.walk * dt;
      const x = this.sx(t.wx);
      if (t.tip && !t.tipped && x < W - 90) { t.tipped = true; this.tip(t.tip); } // the tip shows when you can see the thing
      this.stepWorldTrap(t, x, dt);
      if (t.kind === 'hand') {
        const near = x - PLAYER_X;
        if (t.state === 'wait') {
          // the tell: fingertips poke out and scrabble as soon as it's on screen, with dirt kicking up
          if (x < W - 10) {
            t.y = FLOOR - (14 + Math.sin(this.clock * 22) * 3);
            if (Math.floor(this.clock * 8) !== t.dustTick) { t.dustTick = Math.floor(this.clock * 8); this.burst(x, FLOOR - 2, 0x6a6a72, 2, 14, 200, 2); }
          }
          if (near < 250) { t.state = 'rise'; t.t = 0; t.from = t.y; Audio.sfx('hand'); this.burst(x, FLOOR, 0x6a6a72, 8, 36, 350); }
        } else if (t.state === 'rise') {
          t.t = Math.min(1, t.t + dt / 0.26);
          const k = t.t, c = 1.7;
          const e = 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2;
          t.y = t.from + (FLOOR - t.reach - t.from) * e;
        }
      }
      // cleared it clean: that's worth something
      if (!t.passed && x + t.w < PLAYER_X - 12) {
        t.passed = true;
        if (!t.hit && t.kind !== 'chasm' && !this.dead) { this.addCombo('dodge', PLAYER_X, this.py - 30); this.tracker?.add('dodges', 1); }
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
        else this.armWeapon(p.weapon);
      }
      if (x < -40) p.dead = true;
      if (p.dead) { p.s.destroy(); p.glow.destroy(); }
    }
    this.runPickups = this.runPickups.filter((p) => !p.dead);
    this.stepWeapon(dt);
  },

  stepWorldTrap(t, x, dt) {
    const near = x - PLAYER_X;
    if (t.kind === 'drawer') {
      if (t.state === 'in' && near < 300) { t.state = 'out'; Audio.sfx('swoosh'); }
      if (t.state === 'in' && x < W) t.s.x = x + Math.sin(this.clock * 40) * 1; // it rattles before it opens
      if (t.state === 'out') t.out = Math.min(1, t.out + dt / 0.22);
    } else if (t.kind === 'roots') {
      if (t.state === 'wait' && near < 220) { t.state = 'rise'; Audio.sfx('hand'); this.burst(x + t.w / 2, FLOOR, 0x6a4a2a, 10, 40, 350); }
      if (t.state === 'rise') t.cur = Math.min(t.reach, t.cur + dt * 220);
    } else if (t.kind === 'sinkhole') {
      if (t.state === 'solid' && near < this.speed * 0.5) {
        t.state = 'open'; Audio.sfx('hand'); this.shake(80, 0.004);
        this.burst(x + t.w / 2, FLOOR - 2, 0x7a5a3a, 12, 34, 400);
      }
    } else if (t.kind === 'vent') {
      const c = (this.clock + t.ph) % 1.7;
      const was = t.on;
      t.on = c > 1.0;           // on for 0.7 s
      t.warn = c > 0.7 && c <= 1.0;
      if (t.on && !was && x < W && x > -20) Audio.sfx('swoosh');
    } else if (t.kind === 'chandelier') {
      if (t.state === 'hang' && near < this.speed * 0.62) { t.state = 'fall'; Audio.sfx('swoosh'); }
      if (t.state === 'fall') {
        t.vy += 1800 * dt; t.y += t.vy * dt;
        if (t.y >= FLOOR - t.h) {
          t.y = FLOOR - t.h; t.state = 'down';
          Audio.sfx('bounce'); this.shake(120, 0.006);
          this.burst(x + t.w / 2, FLOOR - 4, 0xffd75e, 10, 40, 400);
        }
      }
    } else if (t.kind === 'eye') {
      t.y = FLOOR - 40 + Math.sin(this.clock * 2.4 + t.ph) * 22;
    }
  },

  armSalt() { this.armWeapon('salt'); },

  armWeapon(kind) {
    const def = WEAPONS[kind];
    this.weapon = { kind, ammo: def.ammo === Infinity ? Infinity : Math.round(def.ammo * this.perk.power), t: def.time * this.perk.power, cd: 0 };
    this.tracker?.add('weapons', 1);
    this.lastWeapon = kind;
    this.gunImg.setTexture(def.icon);
    Audio.sfx('powerup');
    this.popup(def.name + '!', '#ffffff');
    this.tip('weapon');
    this.addCombo('power', PLAYER_X + 40, this.py - 40);
    this.events.emit('power', { kind: 'weapon', icon: def.icon, left: 1 });
  },

  // every target a weapon can hit right now: { cx, cy, box, t (trap) | b (banshee) | h (v5 hand) }
  targets(kind) {
    const out = [];
    for (const t of this.traps) {
      if (t.gone) continue;
      const x = this.sx(t.wx);
      const burnable = kind === 'flame' && ((t.kind === 'hand' && t.state !== 'wait') || (t.kind === 'roots' && t.state === 'rise'));
      if (!(t.hp > 0) && !burnable) continue;
      let box;
      if (t.kind === 'eye') box = { l: x, r: x + t.w, t: t.y - 11, b: t.y + 11 };
      else if (t.kind === 'hand') box = { l: x - 10, r: x + 10, t: t.y, b: FLOOR };
      else if (t.kind === 'roots') box = { l: x, r: x + t.w, t: FLOOR - t.cur - 4, b: FLOOR };
      else box = { l: x, r: x + t.w, t: FLOOR - t.h - 4, b: FLOOR };
      out.push({ cx: (box.l + box.r) / 2, cy: (box.t + box.b) / 2, box, t });
    }
    if (kind !== 'flame') for (const b of this.banshees) out.push({ cx: b.x - 6, cy: b.y, box: { l: b.x - 22, r: b.x + 10, t: b.y - 16, b: b.y + 16 }, b });
    if (kind === 'ecto') for (const h of this.hands) if (h.state !== 'wait') {
      const box = h.fromFloor ? { l: h.x - 12, r: h.x + 12, t: h.y + 6, b: FLOOR } : { l: h.x - 12, r: h.x + 12, t: CEIL, b: h.y - 6 };
      out.push({ cx: h.x, cy: (box.t + box.b) / 2, box, h });
    }
    return out;
  },

  stepWeapon(dt) {
    this.stepShots(dt);
    if (this.dead) return;
    // Boo's ecto blaster: only while he carries you, aimed down at what's in the way
    this.ectoCd -= dt;
    if (this.flying && this.ectoCd <= 0) {
      const gx = this.ghostX + 8, gy = this.ghostY + 10;
      const tg = this.nearest(this.targets('ecto'), gx, gy, ECTO.range);
      if (tg) {
        const a = Math.atan2(tg.cy - gy, tg.cx - gx);
        this.pellets.push({ type: 'ecto', x: gx, y: gy, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, life: 0.6, dmg: 9, hits: new Set() });
        this.ectoCd = ECTO.cd;
        Audio.sfx('splat');
      }
    }
    const wp = this.weapon;
    if (!wp) return;
    const def = WEAPONS[wp.kind];
    wp.t -= dt; wp.cd -= dt;
    if (!this.power) this.events.emit('power', { kind: 'weapon', icon: def.icon, left: Math.max(0, Math.min(wp.t / (def.time * this.perk.power), wp.ammo / (def.ammo * this.perk.power))) });
    if (wp.t <= 0 || wp.ammo <= 0) {
      this.weapon = null;
      this.events.emit('power', null);
      Audio.sfx('powerdown');
      this.popup(wp.kind === 'salt' ? 'OUT OF SALT' : 'IT BROKE!', '#c8c8d8');
      this.nextWeaponX = this.worldX + this.rand.range(240, 380) * PX_PER_METER;
      return;
    }
    if (wp.cd > 0 || this.flying) return; // in the air, Boo's ecto does the shooting
    if (wp.kind === 'bone' && this.pellets.some((p) => p.type === 'bone')) return; // one boomerang at a time
    const mx = PLAYER_X + 12, my = this.py - 2;
    const tg = this.nearest(this.targets(wp.kind), mx, my, def.range);
    if (!tg) return;
    const a = Math.atan2(tg.cy - my, tg.cx - mx);
    const shot = (type, ang, speed, life, dmg, extra = {}) => this.pellets.push({ type, x: mx, y: my, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life, dmg, hits: new Set(), ...extra });
    if (wp.kind === 'salt') {
      for (const sp of [-0.12, 0, 0.12]) shot('salt', a + sp, 720, def.range / 720 + 0.05, 1, { once: true });
      Audio.sfx('salt');
      this.burst(mx + 6, my, 0xffffff, 3, 12, 150, 2);
    } else if (wp.kind === 'flame') {
      shot('flame', a + this.rand.range(-0.22, 0.22), 340, 0.34, 0.25);
      if (this.rand.chance(0.25)) Audio.sfx('flame');
    } else if (wp.kind === 'holy') {
      shot('holy', a, 950, def.range / 950, 2);
      Audio.sfx('holy');
    } else if (wp.kind === 'bone') {
      const img = this.add.image(mx, my, 'bone').setScale(1.6).setDepth(21.7);
      shot('bone', a, 520, 3, 1, { phase: 'out', dist: 0, img, back: new Set() });
      Audio.sfx('swoosh');
    }
    wp.cd = def.cd;
    if (wp.ammo !== Infinity) wp.ammo--;
  },

  nearest(list, mx, my, range) {
    let best = null, bestD = range;
    for (const t of list) { const d = Math.hypot(t.cx - mx, t.cy - my); if (t.cx > mx - 4 && d < bestD) { bestD = d; best = t; } }
    return best;
  },

  stepShots(dt) {
    for (const p of this.pellets) {
      if (p.type === 'bone') {
        if (p.phase === 'out') {
          p.x += p.vx * dt; p.y += p.vy * dt; p.dist += 520 * dt;
          if (p.dist > WEAPONS.bone.range) p.phase = 'back';
        } else { // comes back to Milo
          const dx = PLAYER_X - p.x, dy = this.py - p.y, d = Math.hypot(dx, dy) || 1;
          p.x += (dx / d) * 560 * dt; p.y += (dy / d) * 560 * dt;
          if (d < 14) p.dead = true;
        }
        p.life -= dt;
        p.img.setPosition(p.x, p.y).setRotation(p.img.rotation + 16 * dt);
      } else {
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.type === 'ecto') p.vy += 500 * dt; // ectoplasm arcs down
      }
      if (p.life <= 0 || p.x > W + 40 || p.x < -40 || p.y > FLOOR + 4) p.dead = true;
    }
    // hits: pierce unless the shot is a single pellet; each shot hits each target once (bone: once out, once back)
    const list = this.pellets.some((p) => !p.dead) ? this.targets('ecto').concat(this.targets('flame').filter((x) => x.t && !(x.t.hp > 0))) : [];
    for (const p of this.pellets) {
      if (p.dead) continue;
      const seen = p.type === 'bone' && p.phase === 'back' ? p.back : p.hits;
      for (const tg of list) {
        const ref = tg.t || tg.b || tg.h;
        if (seen.has(ref)) continue;
        const bx = tg.box;
        if (p.x < bx.l || p.x > bx.r || p.y < bx.t || p.y > bx.b) continue;
        if (tg.h && p.type !== 'ecto') continue;
        if (tg.t && !(tg.t.hp > 0) && p.type !== 'flame') continue; // only fire burns hands and roots
        seen.add(ref);
        this.hitTarget(tg, p);
        if (p.once) { p.dead = true; break; }
      }
    }
    for (const p of this.pellets) if (p.dead && p.img) { p.img.destroy(); p.img = null; }
    this.pellets = this.pellets.filter((p) => !p.dead);
  },

  hitTarget(tg, p) {
    if (tg.b) { // banshees: ecto pops them; everything else only shoves them back
      const b = tg.b;
      if (p.type === 'ecto') {
        this.burst(b.x - 6, b.y, 0xcfe0ff, 14, 40, 420);
        for (let i = 0; i < 2; i++) this.addCandle(b.x - 10 + i * 16, b.y);
        b.x = -1e5;
        this.tracker?.add('popped', 1); this.kills++;
        Audio.sfx('ghoul');
        this.addCombo('ghoul', PLAYER_X + 60, this.py - 30);
      } else {
        b.x += p.type === 'holy' ? 60 : 26; b.vx *= 0.82;
        this.burst(b.x - 10, b.y, 0xcfe0ff, 4, 16, 200, 2);
        if (!b.salted) { b.salted = true; this.addCombo('near', b.x, b.y - 20); }
      }
      return;
    }
    if (tg.h) { // a v5 hand in the air
      this.burst(tg.h.x, tg.cy, 0xb8ffd2, 10, 30, 350);
      tg.h.x = -1e5;
      this.addCombo('splat', PLAYER_X + 60, this.py - 30);
      return;
    }
    const t = tg.t;
    const x = this.sx(t.wx);
    if (!(t.hp > 0)) { // fire burns a hand or roots away
      this.burst(tg.cx, tg.cy, 0xff8a2a, 12, 30, 380);
      this.addCandle(tg.cx, FLOOR - 30);
      this.addCombo('splat', tg.cx, tg.cy - 30);
      this.popup('BURNED!', '#ffb060', tg.cy - 30);
      this.tracker?.add('burns', 1); this.kills++; this.tracker?.add('kills', 1);
      this.dropTrap(t);
      return;
    }
    t.hp -= p.dmg;
    if (t.s) this.tweens.add({ targets: t.s, alpha: 0.4, duration: 40, yoyo: true });
    if (t.hp <= 0) this.smash(t, x);
  },

  smash(t, x) {
    const cx = x + t.w / 2, cy = t.kind === 'eye' ? t.y : FLOOR - t.h / 2;
    this.burst(cx, cy, t.kind === 'ghoul' ? 0xc8ffc0 : t.kind === 'eye' ? 0xd8b0ff : 0xb07a3a, 12, 36, 420);
    this.kills++;
    this.tracker?.add('kills', 1);
    if (t.kind === 'crate') this.tracker?.add('crates', 1);
    this.gap = Math.min(RUN.MAX_GAP + this.perk.startGap, this.gap + RUN.KILL);
    // monsters go poof into candles
    const n = t.kind === 'ghoul' ? 3 : 2;
    for (let i = 0; i < n; i++) this.addCandle(cx - 14 + i * 14, cy - 10 - i * 8);
    if (t.kind === 'ghoul') { Audio.sfx('ghoul'); this.tracker?.add('ghouls', 1); this.popup('POOF!', '#c8ffc0', cy - 30); }
    else if (t.kind === 'eye') { Audio.sfx('ghoul'); this.popup('BLINK!', '#d8b0ff', t.y - 30); }
    else { Audio.sfx('bounce'); this.popup('SMASH!', '#ffd0a0', cy - 30); }
    this.addCombo(t.kind === 'ghoul' ? 'ghoul' : 'splat', cx, cy - 40);
    this.dropTrap(t);
  },

  // ---------------- ground collisions ----------------
  miloBox() {
    const sliding = this.slide > 0;
    // standing = the sprite's real head (FLOOR-44); a slide fits under anything above FLOOR-20
    const top = sliding ? (this.grounded ? this.py + 2 : this.py - 4) : this.py - MILO_HALF;
    return { l: PLAYER_X - 8, r: PLAYER_X + 8, t: top, b: this.py + MILO_HALF };
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
      else if (t.kind === 'gurney' || t.kind === 'cart') hit = hits(x + 4, x + t.w - 4, FLOOR - t.h + 4, FLOOR);
      else if (t.kind === 'drawer') hit = t.out > 0.5 && hits(x, x + t.w * t.out, FLOOR - 48, FLOOR - 28);
      else if (t.kind === 'roots') hit = t.state === 'rise' && hits(x + 4, x + t.w - 4, FLOOR - t.cur + 4, FLOOR);
      else if (t.kind === 'sinkhole') hit = t.state === 'open' && this.grounded && PLAYER_X > x + 8 && PLAYER_X < x + t.w - 8;
      else if (t.kind === 'vent') hit = t.on && hits(x + 3, x + t.w - 3, FLOOR - 60, FLOOR);
      else if (t.kind === 'chandelier') hit = t.state !== 'hang' && hits(x + 4, x + t.w - 4, t.y + 2, t.y + t.h);
      else if (t.kind === 'eye') hit = hits(x + 3, x + t.w - 3, t.y - 9, t.y + 9);
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
        // a hole with depth: lit lips, side walls going down, the dark getting deeper
        pg.fillStyle(0x07060d, 1); pg.fillRect(x, FLOOR - 1, t.w, H - FLOOR + 1);
        pg.fillStyle(0x2a2440, 1); pg.fillRect(x, FLOOR - 1, t.w, 3);                        // far wall top edge
        pg.fillStyle(0x1d1a2c, 1); pg.fillRect(x, FLOOR + 2, t.w, 6);
        pg.fillStyle(0x141220, 1); pg.fillRect(x, FLOOR + 8, t.w, 8);
        pg.fillStyle(0x3a3450, 1); pg.fillRect(x - 3, FLOOR - 3, 5, H - FLOOR + 3); pg.fillRect(x + t.w - 2, FLOOR - 3, 5, H - FLOOR + 3); // walls
        pg.fillStyle(0x9a90b8, 1); pg.fillRect(x - 4, FLOOR - 3, 7, 2); pg.fillRect(x + t.w - 3, FLOOR - 3, 7, 2);                     // lit lips
        pg.fillStyle(0x140f24, 1);
        for (let i = 4; i < t.w - 4; i += 7) pg.fillRect(x + i, FLOOR - 1, 3, ((i + t.seed) % 3) + 1); // crumbs falling in
        if (t.kind === 'chasm') { // mist down in the dark, and the far ledge, so you can see where Boo will drop you
          pg.fillStyle(0x8f7fbf, 0.16);
          for (let i = 0; i < t.w; i += 26) pg.fillRect(x + i + ((Math.floor(this.clock * 6) + i) % 10), FLOOR + 22 + (i % 3) * 3, 18, 3);
          pg.fillStyle(0xcfc6ee, 0.9); pg.fillRect(x + t.w - 3, FLOOR - 4, 8, 3);
        }
        continue;
      }
      // every ground threat sits on a warm danger shadow, so it reads as a threat and not as scenery
      if (t.kind !== 'drawer' && t.kind !== 'eye' && t.kind !== 'beam' && t.kind !== 'chandelier') {
        tg.fillStyle(0xff5a3a, 0.28); tg.fillEllipse(x + (t.kind === 'hand' ? 0 : t.w / 2), FLOOR - 1, (t.kind === 'hand' ? 24 : t.w) + 10, 7);
      }
      if (t.kind === 'beam') {
        const flick = Math.random() < 0.5 ? 0 : 2;
        tg.lineStyle(14 + flick, this.hz.glow, 0.25); tg.lineBetween(x, CEIL, x, BEAM_END);
        tg.lineStyle(6, this.hz.core, 0.9); tg.lineBetween(x, CEIL, x, BEAM_END);
        tg.fillStyle(this.hz.core, 1); tg.fillRect(x - 4, BEAM_END - 2, 8, 3); // a hard, flat tip: the beam stops here
        t.nodes[0].setPosition(x, CEIL + 2); t.glow.setPosition(x, BEAM_END);
        // slide marks on the floor under it
        if (x < W && x > PLAYER_X - 30) {
          const a = 0.35 + Math.sin(this.clock * 8) * 0.2;
          pg.fillStyle(this.hz.core, a);
          for (let k = -1; k <= 1; k++) { pg.fillRect(x + k * 12 - 3, FLOOR + 3, 6, 2); pg.fillRect(x + k * 12 - 1, FLOOR + 5, 2, 2); }
        }
        continue;
      }
      if (this.renderWorldTrap(t, x, tg, pg)) continue;
      if (t.kind === 'hand') { t.s.setPosition(x, t.y); continue; }
      if (t.kind === 'ghoul') { t.s.setPosition(x + t.w / 2, FLOOR - 15 + Math.sin(this.clock * 12 + t.wx) * 1.5); continue; }
      if (t.s) t.s.setPosition(x, FLOOR);
    }
    for (const p of this.runPickups) {
      const x = this.sx(p.wx) - lead;
      p.s.setPosition(x, p.y); p.glow.setPosition(x, p.y);
    }
    // shots
    const sg = this.shotGfx;
    sg.clear();
    for (const p of this.pellets) {
      const x = Math.round(p.x), y = Math.round(p.y);
      if (p.type === 'salt') { sg.fillStyle(0xf4f4ff, 1); sg.fillRect(x - 1, y - 1, 3, 3); }
      else if (p.type === 'flame') { const k = p.life / 0.34; sg.fillStyle(k > 0.5 ? 0xffd75e : 0xff8a2a, 0.9); sg.fillCircle(x, y, 2 + (1 - k) * 4); }
      else if (p.type === 'holy') { sg.fillStyle(0x6fb7ff, 1); sg.fillRect(x - 3, y - 2, 6, 5); sg.fillStyle(0xffffff, 1); sg.fillRect(x - 1, y - 1, 2, 2); }
      else if (p.type === 'ecto') { sg.fillStyle(this.trailColor(), 1); sg.fillRect(x - 2, y - 2, 5, 5); }
    }

    // Milo's pose: slide = lean back low, jump = the fly frame
    if (!this.dead && !this.flying) {
      const sliding = this.slide > 0 && this.grounded;
      if (sliding) {
        if (this.player.anims.isPlaying) this.player.anims.stop();
        if (this.player.texture.key !== `${this.char.id}_slide`) this.player.setTexture(`${this.char.id}_slide`);
        this.player.rotation = 0;
        this.player.setPosition(PLAYER_X + 6, FLOOR - 12); // the slide frame is 10 px tall: about 25 on screen
      } else if (this.stumbleT > 0) {
        // the stumble: arms flung up, pitched forward, a hop
        if (this.player.anims.isPlaying) this.player.anims.stop();
        this.player.setTexture(`${this.char.id}_fall`);
        const k = this.stumbleT / 0.4;
        this.player.rotation = 0.45 * Math.sin(k * Math.PI);
        this.player.setPosition(PLAYER_X + 4 * Math.sin(k * Math.PI), py - 6 * Math.sin(k * Math.PI));
      } else if (this.grounded) {
        const key = `${this.char.id}_run`;
        if (this.player.anims.currentAnim?.key !== key || !this.player.anims.isPlaying) this.player.play(key);
        this.player.rotation = 0;
        const f = this.player.anims.currentFrame ? this.player.anims.currentFrame.index : 1;
        this.player.setPosition(PLAYER_X, py - (f % 2 === 0 ? 2 : 0)); // bob up on the passing frames
      } else {
        if (this.player.anims.isPlaying) this.player.anims.stop();
        const k = `${this.char.id}_${this.vy < 60 ? 'jump' : 'fall'}`;
        if (this.player.texture.key !== k) this.player.setTexture(k);
        this.player.rotation = Phaser.Math.Clamp(this.vy / 3200, -0.12, 0.18);
        this.player.setPosition(PLAYER_X, py);
      }
    }
    this.gunImg.setVisible(!!this.weapon && !this.dead)
      .setPosition(PLAYER_X + 14, (this.slide > 0 && this.grounded ? FLOOR - 16 : py + 4));
    this.renderGate(lead);

    if (this.grab) { this.edgeGfx.clear(); this.renderGrab(); return; }
    this.renderStretch();
  },

  // world traps; returns true when it drew the trap
  renderWorldTrap(t, x, tg, pg) {
    switch (t.kind) {
      case 'gurney': case 'cart':
        t.s.setPosition(x, FLOOR + 2 + (Math.floor(this.clock * 20) % 2));
        if (t.kind === 'cart') { tg.fillStyle(0x8a8aa0, 0.8); tg.fillRect(Math.max(0, x - 40), FLOOR - 3, W, 2); } // the rails
        return true;
      case 'drawer':
        tg.fillStyle(0x07060d, 0.9); tg.fillRect(x - 2, FLOOR - 50, 52, 24); // the hole in the wall it comes out of
        tg.fillStyle(0xff5a3a, 0.25 + 0.2 * Math.abs(Math.sin(this.clock * 6))); tg.fillRect(x - 4, FLOOR - 52, 56 * Math.max(0.3, t.out), 28); // warning glow
        t.s.setPosition(x + (t.state === 'in' ? Math.sin(this.clock * 40) : 0), FLOOR - 38).setScale(0.2 + 1.8 * t.out, 2).setAlpha(0.6 + 0.4 * t.out);
        return true;
      case 'roots': {
        const h = t.cur;
        tg.fillStyle(0x5a3a1e, 1);
        for (let i = 0; i < 4; i++) { // arched roots
          const rx = x + 6 + i * 15, rh = h * (i % 2 ? 0.8 : 1);
          tg.fillRect(rx, FLOOR - rh, 4, rh); tg.fillRect(rx + 4, FLOOR - rh, 8, 4); tg.fillRect(rx + 10, FLOOR - rh, 4, rh * 0.6);
        }
        tg.fillStyle(0x8a5a2e, 1);
        for (let i = 0; i < 4; i++) tg.fillRect(x + 7 + i * 15, FLOOR - h * (i % 2 ? 0.8 : 1), 2, 3);
        if (t.state === 'wait' && x < W) { tg.fillStyle(0x5a3a1e, 1); for (let i = 0; i < 4; i++) tg.fillRect(x + 6 + i * 15, FLOOR - 3 - (Math.sin(this.clock * 18 + i) > 0 ? 2 : 0), 6, 3); }
        return true;
      }
      case 'sinkhole':
        if (t.state === 'solid') { // loose dirt: a bump with cracks
          pg.fillStyle(0x6a4a2a, 1);
          for (let i = 0; i < t.w; i += 4) pg.fillRect(x + i, FLOOR - 3 - ((i + t.seed) % 3), 4, 4 + ((i + t.seed) % 3));
          pg.fillStyle(0x2a1a0e, 1); pg.fillRect(x + 14, FLOOR, 10, 1); pg.fillRect(x + 30, FLOOR + 1, 12, 1);
        } else {
          pg.fillStyle(0x07060d, 1); pg.fillRect(x, FLOOR - 1, t.w, 14);
          pg.fillStyle(0x6a4a2a, 1); pg.fillRect(x - 3, FLOOR - 3, t.w + 6, 3);
        }
        return true;
      case 'vent': {
        t.s.setPosition(x - 0, FLOOR + 2);
        if (t.on || t.warn) {
          const top = t.on ? FLOOR - 60 : FLOOR - 10 - Math.random() * 6;
          tg.fillStyle(0xdfe8e0, t.on ? 0.55 : 0.35);
          for (let yy = FLOOR - 2; yy > top; yy -= 8) {
            const wob = Math.sin(this.clock * 20 + yy) * 3;
            tg.fillRect(x + 3 + wob, yy - 8, t.w - 6, 8);
          }
          if (t.on) { tg.fillStyle(0xffffff, 0.35); tg.fillRect(x + 8, FLOOR - 60, t.w - 16, 58); }
        }
        return true;
      }
      case 'chandelier': {
        t.s.setPosition(x, t.y);
        if (t.state !== 'down') { // the shadow: grows and darkens as it gets closer to falling
          const k = Phaser.Math.Clamp(1 - (x - PLAYER_X) / 500, 0.15, 1);
          tg.fillStyle(0x000000, 0.25 + 0.35 * k);
          tg.fillEllipse(x + t.w / 2, FLOOR - 1, t.w * (0.6 + 0.6 * k), 6);
          tg.fillStyle(0x4a4458, 1); tg.fillRect(x + t.w / 2 - 1, CEIL - 4, 2, Math.max(0, t.y - CEIL + 4)); // its chain
        }
        return true;
      }
      case 'eye':
        t.s.setPosition(x + t.w / 2, t.y);
        tg.fillStyle(0x000000, 0.25); tg.fillEllipse(x + t.w / 2, FLOOR - 1, 18 - (FLOOR - t.y - 18) * 0.2, 4);
        return true;
      default: return false;
    }
  },

  renderGate(lead) {
    const g = this.gateGfx;
    g.clear();
    if (!this.gate) { if (this.gateShadeOn) { this.gateShade.clear(); this.gateShadeHi.clear(); this.gateShadeOn = false; } return; }
    this.gateShadeOn = true;
    // v6: the gate is a dark doorway you run through, under every hazard. Its top and bottom trims still
    // cover the ceiling and floor seams; the sign sits over the door, out of the HUD row.
    const body = this.gate.parts[0];
    if (body.depth !== 4.47) body.setDepth(4.47);
    const x0 = body.x - 80, x1 = body.x + 80, ramp = 210;
    // shade the wall itself so it sits back with the dark rooms (a tint alone left it pale), and the
    // trims over the ceiling and floor even more, so they read as a lintel and a threshold
    const sh = this.gateShade.clear();
    sh.fillStyle(0x07060d, 0.5); sh.fillRect(x0, CEIL, 160, FLOOR - CEIL);
    const hi = this.gateShadeHi.clear();
    hi.fillStyle(0x07060d, 0.72); hi.fillRect(x0, 0, 160, CEIL); hi.fillRect(x0, FLOOR, 160, H - FLOOR);
    for (let i = 0; i < 13; i++) { // the shadow the wall throws on both sides hides the zone seam
      const a = 0.9 * Math.pow(1 - i / 13, 1.4), w = ramp / 13;
      g.fillStyle(0x07060d, a);
      g.fillRect(x0 - (i + 1) * w, CEIL, w + 0.5, FLOOR - CEIL);
      g.fillRect(x1 + i * w, CEIL, w + 0.5, FLOOR - CEIL);
    }
    // light from the next world spilling over the threshold
    const lc = zoneAt(this.gate.next).accent ?? 0xb8d8ff;
    const pulse = 0.18 + 0.06 * Math.sin(this.clock * 3);
    for (let i = 0; i < 4; i++) { g.fillStyle(lc, pulse * (1 - i / 4)); g.fillRect(body.x - 56 - i * 10, FLOOR - 4 - i * 2, 112 + i * 20, 4 + i * 2); }
  },

  // the dark it brings: grows in from the left as it closes in, red while one more stumble gets you
  renderEdge(near) {
    const g = this.edgeGfx;
    g.clear();
    if (this.dead && !this.caughtBy) return;
    const strike = this.lastStrike !== null && this.lastStrike !== undefined;
    const w = 40 + near * 200 + (strike ? 30 : 0);
    const col = strike ? 0x3a0610 : 0x07060d;
    for (let i = 0; i < 8; i++) {
      const a = (strike ? 0.55 : 0.7) * near * (1 - i / 8) + (strike ? 0.12 * (1 - i / 8) : 0);
      g.fillStyle(col, Math.min(0.9, a)); g.fillRect(i * (w / 8), CEIL, w / 8 + 1, FLOOR - CEIL);
    }
  },

  renderStretch() {
    const s = this.stretch;
    if (this.flying) {
      this.edgeGfx.clear();
      // it can't follow: it jumps and reaches up with its long arms, then falls behind
      const t = this.crFlyT;
      const x = this.crFlyX + Math.min(t, 0.4) * 60 - Math.max(0, t - 1.1) * 220;
      const hop = t < 1.1 ? Math.abs(Math.sin(t * Math.PI / 0.55)) * 46 : 0;
      s.setPosition(x, FLOOR + 2 - hop).setVisible(x > -40);
      return;
    }
    const near = 1 - this.light;
    this.renderEdge(near);
    const fast = this.catchUpT > 0 || this.clock - this.lastStumble < 1.2 || near > 0.6 || this.dead;
    const want = fast ? 'stretch_crawl' : 'stretch_walk';
    if (!this.dead || this.caughtBy) { if (s.anims.currentAnim?.key !== want) s.play(want); }
    // honest position: the creature's FRONT edge (not its centre) is where the gap says it is
    const half = (fast ? 28 : 12) * STRETCH_SCALE / 2;
    const target = PLAYER_X - 8 - this.gapVis * 0.72 - half; // 0.72: always on screen, still in step with the bar
    const enter = Phaser.Math.Easing.Cubic.Out(this.crEnter);
    // never parked: it sways, and it lunges at you when you stumble
    const lunge = this.lungeT < 0.45 ? Math.sin((this.lungeT / 0.45) * Math.PI) * 34 : 0;
    const sway = Math.sin(this.clock * 1.7) * 6 + Math.sin(this.clock * 4.3) * 2;
    const x = Phaser.Math.Linear(-60, target, enter) + lunge + sway;
    s.setVisible(true).setPosition(Math.round(x), FLOOR + 2 + (fast ? 0 : Math.sin(this.clock * 14) * 1.5));
    s.setScale(STRETCH_SCALE, fast ? STRETCH_SCALE : STRETCH_SCALE + Math.sin(this.clock * 7) * 0.05); // a slight, wrong breathing stretch
  },
};

// short prompts for the run (input.js keeps the menu prompts)
function prompt2(action) {
  // before the first input the device is unknown: a touch screen means a phone, so say TAP, not SPACE
  let d = Device.get();
  if (d === 'keyboard' && typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) d = 'touch';
  if (action === 'jump') return d === 'touch' ? 'TAP' : d === 'gamepad' ? 'A' : d === 'mouse' ? 'CLICK' : 'SPACE';
  return d === 'touch' ? 'SWIPE DOWN' : d === 'gamepad' ? 'B' : 'DOWN';
}
