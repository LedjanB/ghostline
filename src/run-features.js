// Run features added in the "best of every runner" pass. Mixed into PlayScene.
// Sources of each idea are noted inline (Jetpack Joyride, Subway Surfers, Canabalt, Alto's...).
import { W, H, CEIL, FLOOR, PLAYER_X, PX_PER_METER, ZONES, zoneAt, ZONE_LENGTH_M } from './data.js';
import { Save } from './save.js';
import { Audio } from './audio.js';
import { text } from './ui.js';
import { createTracker } from './missions.js';
import { UNLOCK } from './pacing.js';
import { TRACK, costFor, runPoints, BONUS_PER_POINT } from './unlocks.js';

const TOP = CEIL + 16;
const BOTTOM = FLOOR - 16;
const LASER_LANES = [80, 180, 280]; // safe gaps between and at the floor
const LASER_TEMPLATES = [[0], [2], [1], [0, 2], [0, 1], [1, 2]];
const GHOST_SAMPLE_PX = 48;
const LETTERS = ['B', 'O', 'O'];

// candle shapes (Jetpack Joyride spells words with coins)
const GLYPHS = {
  B: ['XX.', 'X.X', 'XX.', 'X.X', 'XX.'],
  O: ['.X.', 'X.X', 'X.X', 'X.X', '.X.'],
  arrow: ['..X..', '...X.', 'XXXXX', '...X.', '..X..'],
  skull: ['.XXX.', 'X.X.X', 'XXXXX', '.XXX.', '.X.X.'],
  heart: ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'],
};

export function dailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
export function todayKey() { return String(dailySeed()); }

export const Features = {
  featInit(save) {
    this.mode = save.mode;
    this.daily = save.mode === 'daily';
    const eq = save.charms.equipped;
    this.charm = Object.fromEntries(['magnet', 'nightlight', 'lucky', 'headstart', 'bouncy', 'graverobber', 'ironlung', 'soulmagnet', 'longrush', 'luckyspin'].map((k) => [k, eq.includes(k)]));
    this.souls = this.charm.lucky ? 1 : 0;
    if (this.charm.ironlung) this.shield = true;
    this.tipsSeen = new Set(save.tips);
    this.rush = null;
    this.chase = null;
    this.chaseDone = new Set();
    this.nextRushX = this.worldX + 350 * PX_PER_METER;
    this.quipCooldown = 0;
    this.deathCause = null;
    // high-contrast hazard colors (settings) for colorblind players
    this.hz = save.settings.contrast
      ? { glow: 0xff40ff, core: 0xffffff, warn: 0xffe000, node: 0xff80ff, laser: 0xff40ff }
      : { glow: 0x4fe38a, core: 0xb8ffd2, warn: 0xff2244, node: 0xffffff, laser: 0x4fe38a };
    this.blastM = 0;
    this.booIndex = 0;
    this.nextLetterX = 0;
    this.nextSoulX = 0;
    this.nextPowerX = 0;
    this.power = null;
    this.speedMul = 1;
    this.ghouls = [];
    this.lasers = [];
    this.nextGhoul = 3;
    this.nextGiant = 20 + Math.random() * 15;
    this.nextLightning = 6;
    this.lastCandleX = this.worldX;
    this.groundStreak = 0;
    this.ceilStreak = 0;
    this.exhaustT = 0;
    this.dustT = 0;
    this.openingT = 0;
    this.openingDone = false;
    this.ghostRec = [];
    this.ghostPlay = this.daily && save.daily.date === todayKey() ? save.daily.ghost : null;
    this.ghostGone = false;
    this.deathM = 0;
    this.tracker = this.creative ? null : createTracker((def) => this.missionDone(def));
    if (this.charm.headstart && !this.creative) {
      this.worldX = 250 * PX_PER_METER;
      this.nextSpawn = this.worldX + 520;
      this.headStart = true;
    }
    this.nextLetterX = this.worldX + 150 * PX_PER_METER;
    this.nextSoulX = this.worldX + (this.charm.graverobber ? 200 : 380) * PX_PER_METER;
    this.nextPowerX = this.worldX + 260 * PX_PER_METER;
    this.lastCandleX = this.worldX;
  },

  featCreate() {
    this.rainLayer = this.add.tileSprite(0, 0, W, H, 'rain').setOrigin(0).setDepth(2).setAlpha(0);
    this.fogLayer = this.add.tileSprite(0, 0, W, 180, 'fog').setOrigin(0).setScale(1, 2).setDepth(13).setAlpha(0);
    this.flashRect = this.add.rectangle(0, 0, W, H, 0xdfe8ff).setOrigin(0).setDepth(19).setAlpha(0);
    this.rushTint = this.add.rectangle(0, 0, W, H, 0x9b5de5).setOrigin(0).setDepth(19).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.darkWall = this.add.image(-260, 0, 'darkwall').setOrigin(1, 0).setScale(2).setDepth(25).setVisible(false);
    this.fireflies = [];
    this.giant = null;
    this.laserGfx = this.add.graphics().setDepth(16);
    this.trailGfx = this.add.graphics().setDepth(8.4);
    this.pickups = []; // souls, letters, power orbs
    this.ghostSprite = this.add.image(PLAYER_X, BOTTOM, `${this.char.id}_fly`).setScale(2).setDepth(8.6)
      .setTint(0x9fb8e8).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.setWeather(zoneAt(this.zoneIndex).id);

    // Opening (Canabalt-style dramatic start): the ghost swoops in and grabs you.
    this.ghostX = W + 40; this.ghostY = -40;
    this.tweens.add({
      targets: this, ghostX: PLAYER_X - 20, ghostY: BOTTOM - 40, duration: 750, ease: 'Back.easeOut',
      onComplete: () => {
        Audio.sfx('grab');
        this.shake(120, 0.006);
        this.tweens.add({ targets: this.player, scaleY: 1.5, scaleX: 2.5, duration: 80, yoyo: true });
        const t = text(this, PLAYER_X, BOTTOM - 34, '!', 16, '#ffd75e').setDepth(31).setStroke('#07060d', 4);
        this.tweens.add({ targets: t, y: '-=18', alpha: 0, duration: 600, onComplete: () => t.destroy() });
        if (this.headStart) this.popup('HEAD START!', '#ffd75e');
        this.quip('start', true);
      },
    });
    if (this.tracker) this.tracker.add('runs', 1);
  },

  popup(str, color = '#e6f0ff', y = null) {
    const t = text(this, PLAYER_X + 50, y ?? this.py - 40, str, 16, color).setDepth(31).setStroke('#07060d', 4);
    this.tweens.add({ targets: t, y: '-=36', alpha: 0, duration: 1000, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  },

  onZoneEnter(zone) {
    this.time.delayedCall(900, () => this.quip(`zone_${zone.id}`, true));
    Save.update((s) => { s.stats.maxZone = Math.max(s.stats.maxZone, this.zoneIndex); });
  },

  // vibration on phones that support it (Android; iPhone Safari has no vibration API)
  buzz(ms) {
    if (!this.settings.vibrate || !navigator.vibrate) return;
    try { navigator.vibrate(ms); } catch (e) { /* not allowed */ }
  },

  // ---------- Spirit Rush: a pace breaker (Jetpack Joyride's vehicles, without a vehicle) ----------
  startRush() {
    const dur = (6 + (this.charm.longrush ? 3 : 0)) * (this.char.rushMul || 1);
    this.rush = { t: dur, dur };
    Audio.sfx('rush');
    Audio.intensity(1);
    this.flash(200, 180, 120, 255);
    this.shake(200, 0.008);
    this.quip('rush', true);
    this.tracker?.add('rushes', 1);
    this.rushTint.setAlpha(0.18);
    this.events.emit('power', { kind: 'rush', left: 1 });
  },
  stepRush(dt) {
    if (!this.rush) return;
    this.rush.t -= dt;
    this.events.emit('power', { kind: 'rush', left: Math.max(0, this.rush.t / this.rush.dur) });
    this.clearAround(90); // smash whatever is right in front
    if (this.rush.t <= 0) {
      this.rush = null;
      this.clearAround(420); // shockwave on landing, no cheap deaths
      this.invuln = 1.5;
      this.rushTint.setAlpha(0);
      this.events.emit('power', null);
      Audio.sfx('powerdown');
    }
  },

  // ---------- The Dark: a chase in the woods, sewers and carnival (Temple Run's pursuer) ----------
  stepChase(dt, meters) {
    const zone = zoneAt(this.zoneIndex);
    const into = (meters % ZONE_LENGTH_M) / ZONE_LENGTH_M;
    if (!this.runner && !this.chase && !this.dead && !this.creative && ['woods', 'sewer', 'carnival'].includes(zone.id)
      && !this.chaseDone.has(zone.id) && into > 0.4 && into < 0.6 && !this.gate) {
      this.chaseDone.add(zone.id);
      this.chase = { t: 0, dur: 15, wall: 30 };
      this.darkWall.setVisible(true).setX(-260);
      Audio.hush(0.8);
      Audio.sfx('scream');
      this.time.delayedCall(800, () => Audio.danger(true));
      this.shake(400, 0.006);
      this.banner('THE DARK IS COMING', 'GRAB CANDLES TO PUSH IT BACK');
      this.quip('dark', true);
    }
    const c = this.chase;
    if (!c) return;
    c.t += dt;
    c.wall += (14 + c.t * 0.8) * dt;
    if (c.wall >= PLAYER_X - 30 && this.invuln <= 0 && !this.dead) {
      if (this.creative || this.shield) { c.wall = -60; this.hit('dark'); } else { this.hit('dark'); return; }
    }
    if (c.t >= c.dur) this.endChase(true);
  },
  endChase(won) {
    const c = this.chase;
    this.chase = null;
    Audio.danger(false);
    this.tweens.add({ targets: this.darkWall, x: -300, duration: 900, ease: 'Quad.easeIn', onComplete: () => this.darkWall.setVisible(false) });
    if (!won || !c) return;
    this.souls++;
    this.runCandles += 25;
    this.events.emit('souls', this.souls);
    this.events.emit('candles', this.runCandles);
    Audio.sfx('boo');
    this.popup('YOU OUTRAN THE DARK! +25', '#ffd75e');
    this.addCombo('escape');
    this.quip('escaped', true);
    this.tracker?.add('chases', 1);
  },

  // ---------- Boo talks (identity + humor) ----------
  quip(kind, force = false) {
    if (this.dead && kind !== 'death') return;
    if (!force && this.quipCooldown > 0) return;
    const hero = this.char.name.split(' ').pop();
    const LINES = {
      start: ['HOLD ON TIGHT!', "DON'T LET GO!", 'OUT, OUT, OUT!'],
      near: ['TOO CLOSE!', 'WHOA!', 'MY HEART! WAIT...', 'NICE ONE!'],
      soul: ['OOH, SHINY!', 'A SOUL! MINE!', 'KEEP THAT ONE.'],
      rush: ['SPIIIRIT RUSH!', 'SMASH IT ALL!'],
      dark: ["IT'S THE DARK! GO!", 'FASTER, ' + hero + '!'],
      escaped: ['WE MADE IT!', 'BYE, DARKNESS!'],
      death: ['NOOO!', 'OOPS. MY BAD.', 'I SLIPPED!'],
      shield: ['THAT WAS CLOSE!', 'SHIELD SAVED US!'],
      floor: ['FLY, ' + hero + '!', 'HOLD TO FLOAT!'],
      zone_morgue: ["DON'T WAKE THEM."], zone_woods: ['FRESH AIR! KIND OF.'], zone_graveyard: ['I KNOW SOME OF THESE.'],
      zone_sewer: ['EW. EW. EW.'], zone_catacombs: ['NICE SKULLS.'], zone_carnival: ['I HATE CLOWNS.'], zone_otherside: ['WHERE ARE WE?!'],
    };
    if (this.runner) Object.assign(LINES, { // v6: running from THE STRETCH
      start: ['RUN, ' + hero + '!', "DON'T LOOK BACK!", 'IT SAW US. RUN!'],
      grab: ['I GOT YOU!', 'UP WE GO!', 'HOLD ON!'],
      landed: ['RUN! RUN!', "IT'S STILL COMING!"],
    });
    const opts = LINES[kind];
    if (!opts) return;
    this.quipCooldown = 4;
    const str = opts[Math.floor(Math.random() * opts.length)];
    if (this.bubble) this.bubble.forEach((o) => o.destroy());
    const t = text(this, 0, 0, str, 16, '#1b1630').setDepth(33);
    const bg = this.add.rectangle(0, 0, t.width + 16, 28, 0xe6f0ff).setDepth(32).setStrokeStyle(2, 0x1b1630);
    const tail = this.add.triangle(0, 0, 0, 0, 8, 0, 0, 8, 0xe6f0ff).setDepth(32);
    this.bubble = [bg, t, tail];
    this.bubbleUntil = this.clock + 1.8;
  },
  renderBubble() {
    if (!this.bubble) return;
    const half = this.bubble[0].width / 2 + 8;
    const x = Math.min(W - half, Math.max(half, this.ghost.x + 40)), y = Math.max(60, this.ghost.y - 34);
    this.bubble[0].setPosition(x, y); this.bubble[1].setPosition(x, y + 1); this.bubble[2].setPosition(x - 26, y + 16);
    if (this.clock > this.bubbleUntil) { this.bubble.forEach((o) => o.destroy()); this.bubble = null; }
  },

  // ---------- one-time tutorial tips ----------
  tip(id) {
    if (this.creative || this.tipsSeen.has(id)) return;
    const TIPS = {
      candle: 'CANDLES = LIGHT. GRAB THEM!', beam: "DON'T TOUCH THE SPIRITS!", hands: 'HANDS COME OUT OF THE FLOOR!',
      swing: 'WATCH THE SWINGING THINGS!', banshee: 'RED ! MEANS A BANSHEE. DODGE!', laser: 'LASERS FIRE ACROSS. FIND A GAP!',
      soul: 'SOULS = SPINS WHEN YOU DIE', letter: 'SPELL B-O-O FOR A PRIZE', power: 'POWER-UP! IT LASTS A FEW SECONDS',
      rush: 'SPIRIT RUSH! SMASH THROUGH IT ALL!', light: 'LIGHT IS LOW! GRAB CANDLES!',
    };
    if (this.runner) Object.assign(TIPS, { // v6 (each fits the tip banner: 32 characters max)
      candle: 'CANDLES PUSH THE STRETCH BACK!', slide: 'SLIDE UNDER THE BEAMS!', weapon: 'WEAPONS FIRE ON THEIR OWN!',
      gurney: 'ROLLING BEDS! JUMP OR SHOOT', drawer: 'DRAWERS POP OUT. SLIDE UNDER!', roots: 'ROOTS RISE UP. JUMP THEM!',
      sinkhole: 'LOOSE DIRT CAVES IN. JUMP IT!', vent: 'STEAM! JUMP IT OR WAIT IT OUT', chandelier: 'WATCH THE SHADOW ON THE FLOOR',
      cart: 'CARTS ON THE RAILS! JUMP!', eye: 'THE EYE BOBS. SLIDE OR JUMP',
    });
    if (!TIPS[id]) return;
    this.tipsSeen.add(id);
    Save.update((s) => { if (!s.tips.includes(id)) s.tips.push(id); });
    this.tipQueue = this.tipQueue || [];
    this.tipQueue.push(TIPS[id]);
    if (this.tipQueue.length === 1) this.showNextTip();
  },
  showNextTip() {
    const msg = this.tipQueue && this.tipQueue[0];
    if (!msg) return;
    const bg = this.add.rectangle(W / 2, 142, 560, 40, 0x07060d).setDepth(34).setAlpha(0).setStrokeStyle(2, 0x9fb8e8);
    const icon = this.add.image(W / 2 - 262, 142, 'ghost0').setDepth(35).setAlpha(0);
    const t = text(this, W / 2 + 10, 143, msg, 16, '#e6f0ff').setDepth(35).setAlpha(0);
    this.tweens.add({
      targets: [bg, icon, t], alpha: 1, duration: 200, yoyo: true, hold: 2600,
      onComplete: () => { bg.destroy(); icon.destroy(); t.destroy(); this.tipQueue.shift(); this.showNextTip(); },
    });
  },

  missionDone(def) {
    Audio.sfx('mission');
    this.events.emit('toast', def.text);
  },

  // ---------- fixed-step update ----------
  featStep(dt, meters, pace, holding) {
    this.openingT += dt;
    if (!this.openingDone && this.openingT > 0.8) this.openingDone = true;

    // power-up timers
    if (this.power) {
      this.power.t -= dt;
      this.events.emit('power', { kind: this.power.kind, left: Math.max(0, this.power.t / this.power.dur) });
      if (this.power.t <= 0) {
        Audio.sfx('powerdown');
        this.power = null;
        this.events.emit('power', null);
      }
    }
    const slow = this.power && this.power.kind === 'slow';
    this.speedMul += ((this.rush ? 1.8 : slow ? 0.6 : 1) - this.speedMul) * Math.min(1, dt * 4);
    this.stepRush(dt);
    this.stepChase(dt, meters);
    this.quipCooldown -= dt;
    if (!this.runner && !this.dead && this.light < 0.3) this.tip('light');
    if (!this.runner && !this.dead && this.groundStreak > 4 && this.openingDone) { this.quip('floor'); this.groundStreak = -6; }

    // magnets pull candles in (charm = small radius, power-up = big)
    const pull = this.power && this.power.kind === 'magnet' ? 230 : this.charm.magnet ? 110 : 0;
    if (pull && !this.dead) {
      for (const c of this.candles) {
        const dx = PLAYER_X - c.x, dy = this.py - c.y;
        if (dx * dx + dy * dy < pull * pull) { c.x += dx * Math.min(1, dt * 9); c.y += dy * Math.min(1, dt * 9); }
      }
    }

    if (!this.dead) {
      this.spawnPickups(meters, pace);
      this.stepGhouls(dt);
      this.stepStats(dt, meters);
      this.recordGhost();
    }
    this.stepPickups(dt);
    this.stepLasers(dt);
    this.stepGiants(dt);
    this.stepWeather(dt);
    this.stepJuice(dt, holding);
  },

  stepStats(dt, meters) {
    if (!this.tracker) return;
    this.groundStreak = this.grounded ? this.groundStreak + dt : 0;
    this.ceilStreak = this.py <= TOP + 1 ? this.ceilStreak + dt : 0;
    const t = this.tracker;
    if (Math.floor(meters) !== this.lastStatM) {
      this.lastStatM = Math.floor(meters);
      t.max('meters', this.lastStatM);
      t.max('zone', this.zoneIndex);
      t.max('noCandleM', Math.floor((this.worldX - this.lastCandleX) / PX_PER_METER));
    }
    if (this.groundStreak > (t.run.groundTime || 0) + 0.5) t.max('groundTime', Math.floor(this.groundStreak));
    if (this.ceilStreak > (t.run.ceilTime || 0) + 0.5) t.max('ceilTime', Math.floor(this.ceilStreak));
  },

  // ---------- pickups: souls (tokens), B-O-O letters, power-up orbs ----------
  spawnPickups(meters, pace) {
    const spawnAt = (kind, tex, y) => {
      const s = this.add.sprite(W + 40, y, tex).setScale(2).setDepth(21.6);
      const glowCol = kind === 'soul' ? 0x4f8bff : kind === 'letter' ? 0xffd75e : 0xffffff;
      const glow = this.add.image(W + 40, y, 'glow').setScale(1.2).setDepth(21).setBlendMode(Phaser.BlendModes.ADD).setTint(glowCol).setAlpha(0.5);
      const p = { kind, x: W + 40, y, baseY: y, s, glow, t: Math.random() * 6 };
      this.pickups.push(p);
      return p;
    };
    // runner: on the ground, pickups sit where a jump (or just running) reaches them
    const safeY = () => (this.runner && !this.flying ? this.rand.range(BOTTOM - 76, BOTTOM - 6) : this.rand.range(TOP + 30, BOTTOM - 30));
    if (this.worldX >= this.nextSoulX) {
      const p = spawnAt('soul', 'soul0', safeY());
      p.s.play('soul_flicker');
      this.nextSoulX = this.worldX + this.rand.range(500, 850) * (this.charm.graverobber ? 0.5 : 1) * PX_PER_METER;
    }
    if (this.worldX >= this.nextLetterX) {
      const p = spawnAt('letter', `letter_${LETTERS[this.booIndex]}`, safeY());
      p.letter = this.booIndex;
      this.nextLetterX = this.worldX + this.rand.range(180, 320) * PX_PER_METER;
    }
    if (this.worldX >= this.nextRushX && !this.rush && !this.chase) {
      spawnAt('power', 'orb_rush', safeY()).power = 'rush';
      this.nextRushX = this.worldX + this.rand.range(700, 1100) * PX_PER_METER;
    }
    if (this.worldX >= this.nextPowerX && !this.power) {
      const kinds = this.shield ? ['magnet', 'slow'] : ['magnet', 'slow', 'shield'];
      const kind = this.rand.pick(kinds);
      spawnAt('power', `orb_${kind}`, safeY()).power = kind;
      this.nextPowerX = this.worldX + this.rand.range(380, 620) * PX_PER_METER;
    }
  },

  stepPickups(dt) {
    const move = this.speed * dt;
    for (const p of this.pickups) {
      p.x -= move;
      p.t += dt;
      p.y = p.baseY + Math.sin(p.t * 3) * 8;
      if ((this.charm.soulmagnet || this.rush) && p.kind !== 'power' && !this.dead) {
        const dx = PLAYER_X - p.x, dy = this.py - p.y;
        if (dx * dx + dy * dy < 200 * 200) { p.x += dx * Math.min(1, dt * 6); p.baseY += dy * Math.min(1, dt * 6); }
      }
      if (!this.dead && Math.hypot(p.x - PLAYER_X, p.y - this.py) < 26) this.grabPickup(p);
      if (p.x < -40) p.dead = true;
      if (p.dead) { p.s.destroy(); p.glow.destroy(); }
    }
    this.pickups = this.pickups.filter((p) => !p.dead);
  },

  grabPickup(p) {
    p.dead = true;
    this.burst(p.x, p.y, p.kind === 'soul' ? 0x6fb7ff : 0xffd75e, 12, 40, 400);
    this.tip(p.kind === 'power' ? (p.power === 'rush' ? 'rush' : 'power') : p.kind);
    if (p.kind === 'power' && p.power === 'rush') { this.startRush(); return; }
    if (p.kind === 'soul') {
      this.quip('soul');
      this.souls++;
      Audio.sfx('soul');
      this.events.emit('souls', this.souls);
      this.popup('+1 SOUL', '#9fc8ff');
      this.tracker?.add('souls', 1);
      this.addCombo('soul', p.x, p.y - 30);
    } else if (p.kind === 'letter') {
      if (p.letter !== this.booIndex) return; // stale letter
      this.booIndex++;
      Audio.sfx('letter');
      this.addCombo(this.booIndex >= LETTERS.length ? 'boo' : 'letter', p.x, p.y - 30);
      this.events.emit('letters', this.booIndex);
      if (this.booIndex >= LETTERS.length) {
        // Subway Surfers word hunt / Jetpack Joyride S-A-M: spell it for a reward
        this.booIndex = 0;
        this.runCandles += 50;
        this.light = 1;
        Audio.sfx('boo');
        this.flash(200, 255, 215, 94);
        this.shake(200, 0.008);
        this.popup('BOO! +50', '#ffd75e');
        this.events.emit('candles', this.runCandles);
        this.tracker?.add('boo', 1);
        this.time.delayedCall(700, () => this.events.emit('letters', 0));
      }
    } else if (p.kind === 'power') {
      Audio.sfx('powerup');
      this.tracker?.add('powerups', 1);
      this.addCombo('power', p.x, p.y - 30);
      if (p.power === 'shield') {
        this.shield = true;
        this.events.emit('shield', true);
        this.popup('SPIRIT SHIELD', '#9fc8ff');
      } else {
        const dur = (p.power === 'magnet' ? 8 : 5) * (this.char.powerMul || 1);
        this.power = { kind: p.power, t: dur, dur };
        this.popup(p.power === 'magnet' ? 'CANDLE MAGNET' : 'SLOW-MO', '#ffb0d0');
      }
    }
  },

  // ---------- spirit laser rows (Jetpack Joyride lasers: telegraphed breathers) ----------
  spawnLaser(diff) {
    const lanes = this.rand.pick(LASER_TEMPLATES).map((i) => LASER_LANES[i]);
    const warn = this.intro.first('laser') ? 2.2 : 1.6 - 0.3 * diff;
    const emitters = lanes.flatMap((y) => [
      this.add.image(-20, y, 'emitter').setScale(2).setDepth(17),
      this.add.image(W + 20, y, 'emitter').setScale(2).setDepth(17).setFlipX(true),
    ]);
    this.lasers.push({ lanes, t: 0, warn, fire: 1.0, phase: 'warn', emitters, hit: false });
    Audio.sfx('laserCharge');
    // nothing else spawns while the lasers run
    return this.speed * (warn + 1.4);
  },

  stepLasers(dt) {
    for (const L of this.lasers) {
      L.t += dt;
      if (L.phase === 'warn' && L.t >= L.warn) { L.phase = 'fire'; L.t = 0; Audio.sfx('laserFire'); this.shake(L.fire * 1000, 0.002); }
      else if (L.phase === 'fire' && L.t >= L.fire) {
        L.phase = 'out'; L.t = 0;
        if (!this.dead && !L.hit) this.tracker?.add('lasers', 1);
      } else if (L.phase === 'out' && L.t >= 0.3) {
        L.dead = true;
        L.emitters.forEach((e) => e.destroy());
      }
    }
    this.lasers = this.lasers.filter((L) => !L.dead);
  },

  laserHits(py) {
    for (const L of this.lasers) {
      if (L.phase !== 'fire') continue;
      for (const y of L.lanes) if (Math.abs(py - y) < 20) { L.hit = true; return true; }
    }
    return false;
  },

  // ---------- ghouls: floor NPCs that panic (Jetpack Joyride scientists) ----------
  stepGhouls(dt) {
    this.nextGhoul -= dt;
    if (this.nextGhoul <= 0 && this.openingDone) {
      this.nextGhoul = 2.5 + Math.random() * 4;
      const s = this.add.sprite(W + 30, FLOOR - 15, 'ghoul0').setScale(2).setDepth(8.8).setTint(zoneAt(this.zoneIndex).ghoul);
      s.play('ghoul_walk');
      this.ghouls.push({ x: W + 30, y: FLOOR - 15, vy: 0, s, state: 'walk', walk: 30 + Math.random() * 30 });
    }
    for (const g of this.ghouls) {
      const near = g.x - PLAYER_X;
      if (g.state === 'walk' && near < 170 && this.py > H / 2) {
        g.state = 'run'; g.walk = 150; g.vy = -200;
        g.s.play('ghoul_run');
        if (Math.random() < 0.5) Audio.sfx('ghoul');
      }
      g.x -= (this.speed - g.walk) * dt;
      if (g.state !== 'flung') {
        g.vy += 900 * dt; g.y += g.vy * dt;
        if (g.y > FLOOR - 15) { g.y = FLOOR - 15; g.vy = 0; }
        // touching a panicking ghoul scares it silly (counts for missions)
        if (Math.abs(near) < 16 && this.py > FLOOR - 64 && !this.dead) this.flingGhoul(g);
      } else {
        g.vy += 900 * dt; g.y += g.vy * dt; g.s.rotation += g.spin * dt;
        if (g.y > H + 40) g.x = -100;
      }
      if (g.x < -40) { g.dead = true; g.s.destroy(); }
    }
    this.ghouls = this.ghouls.filter((g) => !g.dead);
  },

  // ---------- background events (Canabalt's giant robots) ----------
  stepGiants(dt) {
    this.nextGiant -= dt;
    if (this.nextGiant <= 0 && !this.giant && !this.dead) {
      this.nextGiant = 30 + Math.random() * 25;
      const zone = zoneAt(this.zoneIndex).giant;
      if (zone === 'shadow') {
        const s = this.add.image(W + 140, 200, 'giant_shadow').setScale(2).setDepth(0.5).setAlpha(0.9);
        const eyes = [0, 1].map((i) => this.add.image(0, 0, 'glow').setScale(0.35).setDepth(0.6).setTint(0xff3355).setBlendMode(Phaser.BlendModes.ADD));
        this.giant = { kind: 'shadow', x: W + 140, s, eyes, t: 0 };
      } else if (zone === 'eyes') {
        const y = 120 + Math.random() * 60;
        const eyes = [0, 1].map(() => this.add.image(0, y, 'glow').setScale(0.6, 0.3).setDepth(1.5).setTint(zoneAt(this.zoneIndex).accent).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));
        this.giant = { kind: 'eyes', x: W - 60 - Math.random() * 200, y, eyes, t: 0 };
      } else {
        const s = this.add.image(W - 120 - Math.random() * 200, H + 160, 'giant_tentacle').setScale(2).setDepth(0.5).setOrigin(0.5, 0);
        this.giant = { kind: 'tentacle', s, t: 0 };
      }
    }
    const g = this.giant;
    if (!g) return;
    g.t += dt;
    if (g.kind === 'shadow') {
      g.x -= (this.speed * 0.1 + 20) * dt;
      g.s.x = g.x;
      const blink = Math.floor(g.t * 2) % 5 === 0 ? 0 : 0.9;
      g.eyes[0].setPosition(g.x - 10, 200 - 82).setAlpha(blink);
      g.eyes[1].setPosition(g.x + 10, 200 - 82).setAlpha(blink);
      if (g.x < -160) { g.s.destroy(); g.eyes.forEach((e) => e.destroy()); this.giant = null; }
    } else if (g.kind === 'eyes') {
      g.x -= this.speed * 0.25 * dt;
      const a = g.t < 0.6 ? g.t / 0.6 : g.t > 3 ? Math.max(0, 1 - (g.t - 3)) : 1;
      const blink = (g.t > 1.4 && g.t < 1.55) || (g.t > 1.75 && g.t < 1.9) ? 0 : 1;
      g.eyes[0].setPosition(g.x - 16, g.y).setAlpha(a * blink);
      g.eyes[1].setPosition(g.x + 16, g.y).setAlpha(a * blink);
      if (g.t > 4) { g.eyes.forEach((e) => e.destroy()); this.giant = null; }
    } else {
      g.s.x -= this.speed * 0.1 * dt;
      const rise = g.t < 2 ? g.t / 2 : g.t > 4 ? Math.max(0, 1 - (g.t - 4) / 2) : 1;
      g.s.y = H + 10 - rise * 220;
      g.s.rotation = Math.sin(g.t * 1.5) * 0.12;
      if (g.t > 6) { g.s.destroy(); this.giant = null; }
    }
  },

  // ---------- weather per zone (Alto's Adventure) ----------
  setWeather(zoneId) {
    const zone = ZONES.find((z) => z.id === zoneId) || ZONES[0];
    this.weather = zone.weather;
    if (this.giant) { // a background event never carries into the next zone
      if (this.giant.s) this.giant.s.destroy();
      if (this.giant.eyes) this.giant.eyes.forEach((e) => e.destroy());
      this.giant = null;
    }
    Audio.ambience(zone.id);
    const FOG = { ward: [0, 0], morgue: [0.35, 0xdff0ff], woods: [0.55, 0xd0c8f0], graveyard: [0.4, 0xff9aa0], sewer: [0.35, 0x9fd8a0], catacombs: [0.25, 0xffd0a0], carnival: [0.15, 0xffb0e0], otherside: [0.3, 0x9ff0ff] };
    const [fa, ft] = FOG[zone.id] || [0, 0xffffff];
    this.tweens.add({ targets: this.rainLayer, alpha: zone.weather === 'rain' ? 0.35 : 0, duration: 600 });
    this.fogLayer.setTint(ft);
    this.tweens.add({ targets: this.fogLayer, alpha: fa, duration: 600 });
    this.fireflies.forEach((f) => f.destroy());
    this.fireflies = [];
    // particle fields: [count, color(s), glow?, vx, vy, size, alpha]
    const P = {
      frost: [26, [0xdff6ff], false, -15, 18, 2, 0.7],
      fireflies: [10, [0xd8ff7a], true, -15, 0, 0.18, 0.8],
      leaves: [18, [0xb0402a, 0xd8803a, 0x7a2a1a], false, -40, 30, 3, 0.9],
      embers: [22, [0xffb040, 0xff7020], true, -10, -30, 0.12, 0.9],
      confetti: [24, [0xffd75e, 0xff6bb5, 0x7ff0ff], false, -20, 22, 2, 0.9],
      sparkles: [24, [0x7ff0ff, 0xff7ff0, 0xffffff], true, -10, -18, 0.12, 0.9],
    }[zone.weather];
    if (P) {
      const [n, cols, glow, vx, vy, size, alpha] = P;
      for (let i = 0; i < n; i++) {
        const col = cols[i % cols.length];
        const f = glow
          ? this.add.image(Math.random() * W, 50 + Math.random() * 260, 'glow').setScale(size).setTint(col).setBlendMode(Phaser.BlendModes.ADD).setDepth(21)
          : this.add.rectangle(Math.random() * W, 40 + Math.random() * 280, size, size, col).setDepth(13).setAlpha(alpha);
        f.vx = vx * (0.6 + Math.random() * 0.8); f.vy = vy * (0.6 + Math.random() * 0.8); f.ph = Math.random() * 6; f.glowy = glow; f.baseA = alpha;
        this.fireflies.push(f);
      }
    }
  },

  stepWeather(dt) {
    this.rainLayer.tilePositionX -= this.speed * dt * 0.5;
    this.rainLayer.tilePositionY -= 380 * dt;
    this.fogLayer.tilePositionX += (this.speed * 0.6 + 12) * dt;
    for (const f of this.fireflies) {
      f.ph += dt;
      f.x += (f.vx - this.speed * 0.25) * dt + Math.sin(f.ph * 1.7) * 10 * dt;
      f.y += f.vy * dt + Math.sin(f.ph * 2) * 8 * dt;
      if (f.glowy) f.setAlpha(f.baseA * (0.5 + Math.sin(f.ph * 3) * 0.5));
      else if (this.weather === 'leaves' || this.weather === 'confetti') f.rotation += dt * 3;
      if (f.x < -10) f.x = W + 10;
      if (f.y > FLOOR) f.y = CEIL + 2;
      if (f.y < CEIL) f.y = FLOOR - 2;
    }
    if (this.weather === 'rain' && this.settings.flicker) {
      this.nextLightning -= dt;
      if (this.nextLightning <= 0) {
        this.nextLightning = 9 + Math.random() * 10;
        this.tweens.chain({
          targets: this.flashRect,
          tweens: [
            { alpha: 0.45, duration: 40 }, { alpha: 0, duration: 90 },
            { alpha: 0.3, duration: 40 }, { alpha: 0, duration: 400 },
          ],
        });
        this.time.delayedCall(500, () => Audio.sfx('thunder'));
      }
    }
  },

  // ---------- juice: ectoplasm exhaust + running dust (Jetpack Joyride's jetpack) ----------
  stepJuice(dt, holding) {
    if (this.dead) return;
    if (holding && this.openingDone) {
      this.exhaustT -= dt;
      while (this.exhaustT <= 0) {
        this.exhaustT += 0.03;
        const p = this.particlePool.get();
        const x = PLAYER_X - 2 + (Math.random() - 0.5) * 8;
        const y = this.py + 14;
        p.setPosition(x, y).setSize(3, 3).setFillStyle(this.trailColor(Math.floor(Math.random() * 2))).setAlpha(0.6).setVisible(true).setDepth(8.7);
        this.tweens.add({
          targets: p, x: x - 30 - Math.random() * 30, y: y + 26 + Math.random() * 26, alpha: 0, duration: 280,
          onComplete: () => { p.setVisible(false); this.particlePool.put(p); },
        });
      }
    }
    if (this.grounded) {
      this.dustT -= dt;
      if (this.dustT <= 0) {
        this.dustT = 0.09;
        const p = this.particlePool.get();
        p.setPosition(PLAYER_X - 6, FLOOR - 3).setSize(3, 3).setFillStyle(0x8a8a9a).setAlpha(0.7).setVisible(true).setDepth(8.7);
        this.tweens.add({
          targets: p, x: PLAYER_X - 30, y: FLOOR - 10 - Math.random() * 8, alpha: 0, duration: 300,
          onComplete: () => { p.setVisible(false); this.particlePool.put(p); },
        });
      }
    }
  },

  // ---------- daily run ghost (Super Mario Run's ghost racing) ----------
  recordGhost() {
    if (!this.daily) return;
    const i = Math.floor(this.worldX / GHOST_SAMPLE_PX);
    while (this.ghostRec.length <= i && this.ghostRec.length < 4000) this.ghostRec.push(Math.round(this.py));
  },

  renderFeatures(lead, py) {
    this.renderBubble();
    if (this.chase) this.darkWall.x = this.chase.wall + Math.sin(this.clock * 7) * 3;
    // lasers
    const g = this.laserGfx;
    g.clear();
    for (const L of this.lasers) {
      const slide = L.phase === 'out' ? 1 - Math.min(1, L.t / 0.3) : Math.min(1, (L.phase === 'warn' ? L.t : 1) / 0.3);
      const left = -20 + slide * 34, right = W + 20 - slide * 34;
      L.lanes.forEach((y, i) => {
        L.emitters[i * 2].setPosition(left, y);
        L.emitters[i * 2 + 1].setPosition(right, y);
        if (L.phase === 'warn') {
          const blink = Math.floor(L.t * (L.t > L.warn - 0.5 ? 16 : 6)) % 2;
          g.lineStyle(2, this.hz.core, blink ? 0.7 : 0.25);
          for (let x = left + 12; x < right - 12; x += 16) g.lineBetween(x, y, x + 8, y);
          g.fillStyle(this.hz.laser, 0.3 + (L.t / L.warn) * 0.5);
          g.fillCircle(left + 10, y, 4 + (L.t / L.warn) * 6);
          g.fillCircle(right - 10, y, 4 + (L.t / L.warn) * 6);
        } else if (L.phase === 'fire') {
          const w = 18 + Math.sin(this.clock * 60) * 3;
          g.fillStyle(this.hz.laser, 0.35); g.fillRect(left, y - w / 2, right - left, w);
          g.fillStyle(this.hz.core, 0.95); g.fillRect(left, y - 4, right - left, 8);
        }
      });
    }
    for (const p of this.pickups) { p.s.setPosition(p.x - lead, p.y); p.glow.setPosition(p.x - lead, p.y); }
    for (const gh of this.ghouls) gh.s.setPosition(gh.x - lead, gh.y);

    // daily ghost: your best run today, as a see-through spirit
    this.trailGfx.clear();
    if (this.ghostPlay && this.ghostPlay.length && !this.dead) {
      const fi = this.worldX / GHOST_SAMPLE_PX;
      const i = Math.floor(fi);
      if (i < this.ghostPlay.length - 1) {
        const y = this.ghostPlay[i] + (this.ghostPlay[i + 1] - this.ghostPlay[i]) * (fi - i);
        this.ghostSprite.setPosition(PLAYER_X, y).setAlpha(0.35);
        this.trailGfx.fillStyle(0x9fb8e8, 0.35);
        for (let k = 1; k < 8 && i + k < this.ghostPlay.length; k++) {
          this.trailGfx.fillRect(PLAYER_X + (k - (fi - i)) * GHOST_SAMPLE_PX - 2, this.ghostPlay[i + k] - 2, 4, 4);
        }
      } else if (!this.ghostGone) {
        this.ghostGone = true;
        this.burst(PLAYER_X, this.ghostSprite.y, 0x9fb8e8, 14, 50, 600);
        this.ghostSprite.setAlpha(0);
        this.popup("TODAY'S BEST: BEATEN!", '#9fc8ff');
      }
    }
  },

  // clears hazards near the player (Jetpack Joyride's anti-frustration shockwave)
  clearAround(range = 280) {
    const clearX = PLAYER_X + range;
    const gone = (x, y) => this.burst(x, y, 0x9fb8e8, 8, 30, 400);
    for (const b of this.beams) if (b.x - b.len / 2 < clearX) { gone(b.x, b.y); b.x = -1e5; }
    for (const h of this.hands) if (h.x < clearX) { gone(h.x, h.y); h.x = -1e5; }
    for (const sw of this.swings) if (sw.x < clearX) { if (sw.hx !== undefined) gone(sw.hx, sw.hy); sw.x = -1e5; }
    for (const b of this.banshees) { gone(b.x, b.y); b.x = -1e5; }
    for (const w of this.warnings) w.dead = true;
    for (const L of this.lasers) if (L.phase !== 'out') { L.phase = 'out'; L.t = 0; }
  },

  // ---------- end of run: Grave Spin, second chance, results ----------
  afterDeath() {
    if (this.souls > 0) this.scene.launch('spin', { souls: this.souls });
    else this.finalize();
  },

  revive() {
    this.dead = false;
    this.ended = false;
    this.speed = this.deathSpeed;
    this.py = H / 2; this.prevPy = this.py;
    this.vy = -120;
    this.spin = 0;
    this.invuln = 2.5;
    this.player.rotation = 0;
    this.player.play(`${this.char.id}_flyA`);
    this.clearAround(400);
    this.ghost.setAlpha(0.92); this.ghostGlow.setAlpha(0.35);
    this.ghostX = PLAYER_X - 4; this.ghostY = -40;
    Audio.duck(false);
    Audio.sfx('rebirth');
    this.flash(200, 160, 200, 255);
    this.popup('SECOND CHANCE!', '#ffd75e');
    this.tracker?.add('revives', 1);
    Save.update((s) => { s.stats.revives += 1; });
  },

  finalize() {
    const meters = Math.floor(this.worldX / PX_PER_METER) + this.blastM;
    const save = Save.get();
    const prevBest = save.best;
    const prevBestScore = save.bestScore;
    // the Grave Blast meters count for score too
    const score = this.creative ? 0 : this.totalScore() + this.blastM * this.mult;
    const missions = this.tracker ? this.tracker.finish() : { completed: [], reward: 0, levelUps: [] };
    const daily = this.daily;
    const todays = save.daily.date === todayKey() ? save.daily.best : 0;
    // Downwell: every run fills the unlock bar
    const earned = this.creative ? 0 : runPoints(meters, missions.completed.length);
    const unlocked = [];
    let bonus = 0;
    Save.update((s) => {
      s.candles += this.runCandles;
      s.best = Math.max(s.best, meters);
      s.bestScore = Math.max(s.bestScore, score);
      s.bestCombo = Math.max(s.bestCombo, this.bestCombo);
      s.runs += 1;
      s.stats.runs += 1;
      s.stats.meters += meters;
      s.stats.candles += this.runCandles;
      s.stats.nearMisses += this.nearMisses;
      s.stats.maxZone = Math.max(s.stats.maxZone, this.zoneIndex);
      if (this.deathCause) s.stats.deaths[this.deathCause] = (s.stats.deaths[this.deathCause] || 0) + 1;
      if (daily && meters >= todays) {
        s.daily = { date: todayKey(), best: meters, ghost: this.ghostRec.slice() };
      }
      const u = s.unlocks;
      u.points += earned;
      while (u.got < TRACK.length && u.points >= costFor(u.got)) {
        u.points -= costFor(u.got);
        const item = TRACK[u.got];
        u.got += 1;
        unlocked.push(item);
        if (item.kind === 'candles') s.candles += item.n;
        else u.fresh += 1;
        // something new is something you see: new hats and trails go straight on
        if (item.kind === 'hat') s.boo.hat = item.id;
        if (item.kind === 'trail') s.boo.trail = item.id;
      }
      if (u.got >= TRACK.length && u.points > 0) { bonus = u.points * BONUS_PER_POINT; s.candles += bonus; u.points = 0; }
    });
    const u = Save.get().unlocks;
    this.scene.launch('over', {
      meters, candles: this.runCandles, isBest: meters > prevBest, best: Math.max(prevBest, meters),
      close: this.nearMisses, missions, daily, dailyBest: Math.max(todays, daily ? meters : 0), blast: this.blastM,
      score, mult: this.mult, isBestScore: score > prevBestScore && score > 0, bestScore: Math.max(prevBestScore, score),
      bestCombo: this.bestCombo, creative: this.creative,
      unlock: { earned, unlocked, bonus, got: u.got, points: u.points, cost: u.got < TRACK.length ? costFor(u.got) : 0 },
    });
  },

  // candle words and pictures
  spawnGlyphCandles(x0, which) {
    const word = which === 'word' ? ['B', 'O', 'O'] : [which];
    const rows = 5;
    const y0 = this.rand.range(TOP + 10, BOTTOM - rows * 18 - 10);
    let x = x0;
    for (const ch of word) {
      const g = GLYPHS[ch];
      g.forEach((row, r) => row.split('').forEach((c, k) => { if (c === 'X') this.addCandle(x + k * 18, y0 + r * 18); }));
      x += (g[0].length + 1) * 18;
    }
    return x - x0;
  },
};

export const SWARM_UNLOCK = UNLOCK.swarm;
