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
import { Save } from './save.js';
import { patternsFor, stepNeed } from './patterns.js';
export { SET_PIECES } from './setpieces.js';

import { StretchFeatures } from './runner-stretch.js';
import { FlightFeatures } from './runner-flight.js';
import { WeaponFeatures } from './runner-weapons.js';
import { MILO_SCALE, MILO_HALF, BOTTOM, RUN_G, JUMP_V, JUMP_CUT, COYOTE, BUFFER, SLIDE_T, FAST_FALL, RUN, WEAPONS, WORLD_WEAPON, STRETCH_SCALE, BEAM_END, WALKERS, kindsAt, prompt2 } from './runner-const.js';
export { RUN, WEAPONS, ANSWERS, WORLD_WEAPON, WORLD_TRAPS } from './runner-const.js';

export const RunnerFeatures = {
  ...StretchFeatures, ...FlightFeatures, ...WeaponFeatures, // split out to keep each file small
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
    this.seenKinds = new Set(); this.lastPattern = ''; this.patterns = 0;
    this.tricksInit();
    this.scaresInit();
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
    this.caughtBy = false; this.stumbleT = 0; this.grab = null; this.setPiece = null; this.stretchSt = 'f';
    // v5 systems the runner replaces or doesn't use
    this.nextRushX = Infinity;   // Spirit Rush: off (flying is the rare treat now)
    this.nextGhoul = Infinity;   // v5 floor ghouls: replaced by runner ghouls you shoot
  },

  runnerCreate() {
    this.pitGfx = this.add.graphics().setDepth(15.2);  // over the floor band: pits are holes in it
    this.trapGfx = this.add.graphics().setDepth(7);
    this.shotGfx = this.add.graphics().setDepth(21.7);
    this.trickGfx = this.add.graphics().setDepth(9.45); // THE STRETCH's tricks: arms, mounds, its face
    this.aimGfx = this.add.graphics().setDepth(21.65);  // brackets on what the weapon will shoot
    this.endingCreate();
    this.scaresCreate();
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
    // v8: THE STRETCH is heard, not seen. What you see is its shadow, long and thin across the wall,
    // longer the closer it is. Its body only shows when you fail (an arm on a stumble, all of it when caught).
    this.stretchShadow = this.add.sprite(-40, FLOOR + 2, 'stretch_walk0').setOrigin(0.5, 1).setDepth(4.55)
      .setTint(0x020104).setTintMode(Phaser.TintModes.FILL).setAlpha(0);
    this.stretchShadow.play('stretch_walk');
    this.stretch.setVisible(false);
    // Boo's lantern hangs from Milo's hand; it lights when Boo is near
    this.lanternGfx = this.add.graphics().setDepth(9.05);
    this.lanternGlow = this.add.image(PLAYER_X, BOTTOM, 'glow').setScale(1.1).setDepth(9.04).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc46a).setAlpha(0);
    this.armGfx = this.add.graphics().setDepth(9.72);
    this.keysT = 1.5; this.humT = 2;
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

  headline(main, sub = '', hold = 2.0, urgent = false) {
    const h = { main, sub, hold };
    if (urgent && this.headObjs && this.clock < this.headUntil) { // it matters now: it replaces what's up
      this.clearHeadline();
    }
    if (urgent) this.heads.unshift(h); else this.heads.push(h);
    this.nextHeadline();
  },
  clearHeadline() {
    if (this.headObjs) this.headObjs.forEach((o) => { this.tweens.killTweensOf(o); o.destroy(); });
    this.headObjs = null; this.headUntil = 0;
  },
  headlineUp() { return !!this.headObjs && this.clock < this.headUntil; },
  clearMessages() { // the popup, Boo's bubble and floating points: whatever is up by Milo
    (this.popups || []).forEach((o) => o.destroy()); this.popups = [];
    (this.gains || []).forEach((o) => o.destroy()); this.gains = [];
    if (this.bubble) { this.bubble.forEach((o) => o.destroy()); this.bubble = null; }
  },
  note(str) { if (str && !this.dead) this.events.emit('note', str); },
  nextHeadline() {
    if (this.clock < this.headUntil || !this.heads.length || !this.started || this.dead || this.scare) return; // a scare owns the screen
    const h = this.heads.shift();
    this.clearHeadline(); // one headline, ever: never trust the old one's fade-out to be done
    this.headUntil = this.clock + h.hold + 0.3;
    this.quietUntil = this.headUntil;
    this.clearMessages();
    const a = text(this, W / 2, 132, h.main, 24, '#e6f0ff').setDepth(31).setStroke('#07060d', 6).setScale(0.7).setAlpha(0);
    this.headObjs = [a];
    if (h.sub) this.note(h.sub);
    this.tweens.add({ targets: a, scaleX: 1, scaleY: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: a, alpha: 1, duration: 160, yoyo: true, hold: h.hold * 1000, onComplete: () => a.destroy() });
  },

  // ---------------- ground spawning ----------------
  runnerSpawner(meters, pace) {
    const v = this.speed;
    this.runDiff = pace.diff;
    const spawnWX = this.worldX + (W + 40 - PLAYER_X);
    const zoneM = meters % ZONE_LENGTH_M;
    const toGate = ZONE_LENGTH_M - zoneM;
    // one flight section per world (a gap Boo carries you over); beyond the door, one per depth
    const chasmKey = this.chasmKey();
    const at = this.chasmAtM(v);
    if (!this.chasm && !this.chasmZones.has(chasmKey) && zoneM >= at && zoneM < at + 60 && !this.gate && !this.trick) {
      this.chasmZones.add(chasmKey);
      // as wide as this world's set piece needs (Count Vlad and Long Ride stretch the piece out, not the gap)
      const w = v * this.pieceSeconds(this.pieceHere(), v);
      this.chasm = this.addTrap('chasm', spawnWX, { w });
      this.nextTrapX = spawnWX + w + v * 0.9;
      // candles lead the eye to the edge
      for (let i = 0; i < 6; i++) this.addCandle(W + 40 - 150 + i * 22, BOTTOM - 4);
      return;
    }
    const runway = !this.chasm && !this.chasmZones.has(chasmKey) && zoneM > at - v * 1.4 / PX_PER_METER && zoneM < at;
    if (this.chasm || runway) return;
    if (this.gate || (toGate < 22 && !this.beyond)) return; // gates (and the door) stay clear
    if (this.trick || this.scare || this.scareHold || this.storyHold) return; // THE STRETCH, a scare or a story beat has the screen to itself

    // pickups: a weapon (salt first, then a different one each time) and the (rare) Boo orb
    if (this.worldX >= this.nextWeaponX && !this.weapon) {
      const kind = this.weaponHere();
      const p = this.makePickup('weapon', spawnWX + 60, BOTTOM - 4, WEAPONS[kind].icon);
      p.weapon = kind;
      this.runPickups.push(p);
      this.nextWeaponX = Infinity; // the next one is scheduled when this weapon breaks
    }
    // the (rare) Boo orb never lands near a flight section or a gate
    const nearChasm = zoneM > at - 120 && zoneM < at + 160;
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
    // hand-made patterns (patterns.js): once you've met every piece in it this run
    if (meters > 150 && this.rand.chance(0.16 + 0.22 * pace.diff + 0.4 * this.lateK()) && this.spawnPattern(meters, spawnWX, v, pace.diff)) return;
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
    const tight = 1 - 0.2 * this.lateK(); // worlds 5 to 8 pack the traps closer
    const lo = Phaser.Math.Linear(1.05, 0.62, d) * tight, hi = Phaser.Math.Linear(1.6, 1.1, d) * tight;
    let gap = v * this.rand.range(lo, hi) + w;
    if (meters > 120 && this.rand.chance(0.25 + d * 0.2)) gap = v * (0.8 - 0.12 * d) + w; // a quick double
    this.nextTrapX = this.worldX + gap;
  },

  // something that walks at you starts further out, so it reaches you when a still trap would have
  // (t: seconds later than the first thing in a pattern)
  walkLead(kind, v, t = 0) { return (WALKERS[kind] || 0) * ((W + 40 - PLAYER_X) / v + t); },

  // the pickup is the answer to this world (salt first in a run; never the same one twice in a row)
  weaponHere() {
    if (!this.lastWeapon) return 'salt';
    const want = this.beyond ? this.rand.pick(Object.keys(WEAPONS)) : WORLD_WEAPON[zoneAt(this.zoneIndex).id];
    if (want !== this.lastWeapon) return want;
    return this.rand.pick(Object.keys(WEAPONS).filter((k) => k !== this.lastWeapon));
  },

  // a hand-made pattern; returns false if none fits here
  spawnPattern(meters, spawnWX, v, d) {
    const zoneId = this.beyond ? 'otherside' : zoneAt(this.zoneIndex).id;
    const zoneM = meters % ZONE_LENGTH_M;
    const pool = patternsFor(zoneId, meters).filter((p) => p.id !== this.lastPattern && p.steps.every((st) => this.seenKinds.has(st[0])));
    if (!pool.length) return false;
    const p = this.rand.pick(pool);
    const last = p.steps[p.steps.length - 1][1];
    // later on the same pattern comes a little faster (never below the jump/slide metrics)
    const squeeze = 1 - 0.08 * d;
    const len = v * last * squeeze + 120;
    if ((ZONE_LENGTH_M - zoneM) * PX_PER_METER < len + 22 * PX_PER_METER && !this.beyond) return false; // not across a gate
    this.lastPattern = p.id; this.patterns++;
    const T0 = (W + 40 - PLAYER_X) / v;
    let endW = 0;
    for (const st of p.steps) {
      const [kind, t0, opts = {}] = st;
      const t = t0 * squeeze;
      const wx = spawnWX + v * t + this.walkLead(kind, v, t);
      const arrive = T0 + t; // seconds until it reaches Milo
      let tr;
      if (kind === 'pit') tr = this.addTrap('pit', wx, { w: Math.min(this.pitWidth(v), v * 0.26) });
      else tr = this.addTrap(kind, wx);
      if (kind === 'vent') { // steam on (or off) just as you get there
        const want = opts.on ? 1.35 : 0.3;
        tr.ph = (((want - (this.clock + arrive)) % 1.7) + 1.7) % 1.7;
      }
      if (kind === 'eye') { // high = slide under it, low = jump it
        const target = opts.at === 'low' ? Math.PI / 2 : -0.3;
        tr.ph = target - 2.4 * (this.clock + arrive);
      }
      tr.pattern = p.id;
      endW = Math.max(endW, v * t + tr.w);
    }
    this.lastKinds = [p.steps[p.steps.length - 1][0], p.steps[p.steps.length - 1][0] + '*'];
    if (p.tip) this.tip(p.tip);
    const gap = v * Phaser.Math.Linear(1.2, 0.85, d);
    this.nextTrapX = this.worldX + (W + 40 - PLAYER_X) + endW + gap;
    void stepNeed;
    return true;
  },

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
    this.seenKinds.add(kind);
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
    if (this.trick && this.trick.gone) { this.trick = null; this.crEnter = Math.min(this.crEnter, 0.25); }
    if (!this.stepScares(dt, this.worldX / PX_PER_METER)) this.stepTricks(dt, this.worldX / PX_PER_METER, ZONE_LENGTH_M - ((this.worldX / PX_PER_METER) % ZONE_LENGTH_M));
    for (const t of this.traps) {
      if (t.gone) continue;
      if (t.kind === 'trick') { if (!this.dead) this.stepTrick(t, dt); continue; } // tricks run on their own clock (tricks.js)
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
      else if (t.kind === 'trick') { const b = this.trickBox(t); hit = !!b && hits(b.l, b.r, b.t, b.b); }
      if (hit) { t.hit = true; this.stumble(t.kind === 'trick' ? 'trick:' + t.trick : t.kind); return; }
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
    this.trickGfx.clear();
    this.renderDoor(lead);
    this.renderScare();
    for (const t of this.traps) {
      if (t.gone) continue;
      const x = Math.round(this.sx(t.wx) - lead);
      if (t.kind === 'trick') { t.ownsStretch = this.renderTrick(t, x, tg, pg); continue; }
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
      if (t.kind !== 'drawer' && t.kind !== 'eye' && t.kind !== 'beam' && t.kind !== 'chandelier' && t.kind !== 'vent') {
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
    this.gunKick = Math.max(0, (this.gunKick || 0) - 0.25);
    this.gunImg.setVisible(!!this.weapon && !this.dead)
      .setPosition(PLAYER_X + 14 - this.gunKick * 4, (this.slide > 0 && this.grounded ? FLOOR - 16 : py + 4) - this.gunKick * 2)
      .setRotation(-this.gunKick * 0.25);
    this.renderAim();
    this.renderGate(lead);

    this.renderLantern(py);
    this.armGfx.clear();
    if (this.grab) { this.edgeGfx.clear(); this.stretchShadow.setAlpha(0); this.renderGrab(); return; }
    if (this.finish) { this.edgeGfx.clear(); this.stretchShadow.setAlpha(0); return; } // ending.js draws the door scene
    this.renderStretch();
    if (!this.dead && this.lungeT < 0.5 && !this.flying) this.renderLungeArm(py);
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
    // v6: a gate is a passage, not a wall. You run in through the door (the gate art), through a dark
    // stretch where the two worlds meet (the seam is hidden in there, floor and ceiling too), and out
    // into the light of the next world. Everything sits under the hazards.
    const S = this.gate.parts[0].x; // play.js puts the parts on the seam every frame
    const DOOR = S - 150, IN = S - 70, OUT = S + 130, RAMP = 190;
    this.gate.parts.forEach((p) => { p.x = DOOR; });
    const body = this.gate.parts[0];
    if (body.depth !== 4.47) body.setDepth(4.47);
    const black = 0x07060d;
    // the passage: black from the back of the door to the way out, then the next world fades in
    g.fillStyle(black, 1); g.fillRect(IN, CEIL, OUT - IN, FLOOR - CEIL);
    for (let i = 0; i < 12; i++) {
      const w = RAMP / 12;
      g.fillStyle(black, Math.pow(1 - (i + 1) / 13, 1.3)); g.fillRect(OUT + i * w, CEIL, w + 0.5, FLOOR - CEIL);
      if (i < 5) { g.fillStyle(black, 0.5 * (1 - (i + 1) / 6)); g.fillRect(DOOR - 80 - (i + 1) * 12, CEIL, 12.5, FLOOR - CEIL); } // its shadow on this side
    }
    // light from the next world on the floor near the way out
    const lc = zoneAt(this.gate.next).accent ?? 0xb8d8ff;
    const pulse = 0.22 + 0.06 * Math.sin(this.clock * 3);
    for (let i = 0; i < 6; i++) { g.fillStyle(lc, pulse * (i + 1) / 6); g.fillRect(IN + (OUT - IN) * (i / 6), FLOOR - 3, (OUT - IN) / 6 + 0.5, 3); }
    // the door wall sits back with the dark rooms (a tint alone left it pale)
    const sh = this.gateShade.clear();
    sh.fillStyle(black, 0.5); sh.fillRect(DOOR - 80, CEIL, 160, FLOOR - CEIL);
    // ceiling and floor bands: dark through the passage so their seam never shows; lintel and threshold on the door
    const hi = this.gateShadeHi.clear();
    hi.fillStyle(black, 0.72); hi.fillRect(DOOR - 80, 0, 160, CEIL); hi.fillRect(DOOR - 80, FLOOR, 160, H - FLOOR);
    hi.fillStyle(black, 0.9); hi.fillRect(IN, 0, OUT - IN, CEIL); hi.fillRect(IN, FLOOR, OUT - IN, H - FLOOR);
    for (let i = 0; i < 12; i++) {
      const w = RAMP / 12, a = 0.9 * Math.pow(1 - (i + 1) / 13, 1.3);
      hi.fillStyle(black, a); hi.fillRect(OUT + i * w, 0, w + 0.5, CEIL); hi.fillRect(OUT + i * w, FLOOR, w + 0.5, H - FLOOR);
    }
    hi.fillStyle(lc, pulse * 0.6); hi.fillRect(IN, FLOOR, OUT - IN, 2); // a faint floor line so Milo isn't running on nothing
  },

  // the dark it brings: grows in from the left as it closes in, red while one more stumble gets you
};
