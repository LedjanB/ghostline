// Score, combo, flight juice, hats and world looks. Mixed into PlayScene like run-features.
// - Score multiplier from mission levels (Subway Surfers)
// - One combo fed by everything good you do, x1..x5 tiers, hit = combo lost (Alto's / Tony Hawk)
// - Music adds a layer per combo tier (Bit.Trip Runner)
// - Boo sprays ectoplasm that splats on the floor and knocks ghouls over (Jetpack Joyride's
//   machine-gun jetpack: the flight itself is the power fantasy)
// - Characters recolor the world (Crossy Road)
import { W, CEIL, FLOOR, PLAYER_X } from './data.js';
import { Audio } from './audio.js';
import { text } from './ui.js';
import { WorldLook, mulColor } from './looks.js';
import { multiplierFor, COMBO_WINDOW, tierFor, POINTS, TRAILS, HATS } from './unlocks.js';

const DROP_EVERY = 0.045;

export const ScoreFeatures = {
  scoreInit(save) {
    this.mult = multiplierFor(save.missions.level);
    this.points = 0;
    this.combo = 0;
    this.comboT = 0;
    this.comboTier = 1;
    this.bestCombo = 0;
    this.splats = 0;
    this.drops = [];
    this.dropT = 0;
    this.splatSfxAt = 0;
    this.trail = TRAILS.find((t) => t.id === save.boo.trail) || TRAILS[0];
    this.hatDef = HATS.find((h) => h.id === save.boo.hat) || HATS[0];
    this.thrustOn = false;
    this.lastScore = -1;
    this.speedLines = [];
    this.candleRun = 0;
    this.lastCandleAt = -9;
  },

  scoreCreate() {
    this.look = new WorldLook(this, this.char.id);
    this.layers.setLook(this.look.tint);
    this.hatImg = this.hatDef.rows
      ? this.add.image(this.ghostX, this.ghostY, `hat_${this.hatDef.id}`).setScale(2).setDepth(10.1).setOrigin(0.5, 1)
      : null;
    this.speedGfx = this.add.graphics().setDepth(5);
    for (let i = 0; i < 12; i++) this.speedLines.push({ x: Math.random() * W, y: CEIL + 10 + Math.random() * (FLOOR - CEIL - 20), len: 20 + Math.random() * 40 });
    this.events.emit('mult', this.creative ? 0 : this.mult);
    this.events.once('shutdown', () => { Audio.thrust(false); Audio.combo(1); });
  },

  totalScore() {
    if (this.creative) return 0;
    return Math.floor(this.worldX / 24) * this.mult + this.points;
  },

  trailColor(i = 0) {
    if (this.trail.rainbow) return Phaser.Display.Color.HSVToRGB(((this.clock * 0.6) + i * 0.08) % 1, 0.7, 1).color;
    return this.trail.cols[i % 2];
  },

  // ---------- combo ----------
  addCombo(kind, x = PLAYER_X + 40, y = this.py - 30) {
    if (this.dead) return;
    this.combo++;
    this.comboT = COMBO_WINDOW;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const tier = tierFor(this.combo);
    const gain = (POINTS[kind] || 5) * tier * this.mult;
    if (!this.creative) this.points += gain;
    this.tracker?.max('combo', this.combo);
    this.tracker?.max('comboTier', tier);
    if (tier > this.comboTier) {
      this.comboTier = tier;
      Audio.combo(tier);
      Audio.sfx('comboUp', { tier });
      this.popup(`COMBO x${tier}!`, ['#e6f0ff', '#e6f0ff', '#9ff0ff', '#ffb0d0', '#ffd75e', '#ff8a5e'][tier], this.py - 56);
      this.flash(80, 255, 255, 255);
      this.tweens.add({ targets: this.ghost, scaleX: 2.6, scaleY: 2.6, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
    }
    // small floating points for the big events, not every candle
    if (kind !== 'candle' && !this.creative) {
      const t = text(this, x, y, `+${gain}`, 8, '#ffe8a0').setDepth(31).setStroke('#07060d', 3);
      this.tweens.add({ targets: t, y: y - 22, alpha: 0, duration: 700, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
    }
    this.emitCombo();
  },

  emitCombo() {
    this.events.emit('combo', { n: this.combo, tier: this.comboTier, left: Math.max(0, this.comboT / COMBO_WINDOW) });
  },

  // the window ran out: bank it with a little cheer
  endCombo() {
    if (this.combo >= 12) {
      this.popup(`${this.combo} COMBO!`, '#ffd75e', this.py - 50);
      Audio.sfx('comboEnd');
    }
    this.resetCombo();
  },

  // you got hit: the combo is gone
  breakCombo() {
    if (this.combo >= 12 && !this.dead) this.popup('COMBO LOST', '#ff8a9a', this.py - 50);
    this.resetCombo();
  },

  resetCombo() {
    this.combo = 0;
    this.comboT = 0;
    if (this.comboTier !== 1) { this.comboTier = 1; Audio.combo(1); }
    this.emitCombo();
  },

  stepCombo(dt) {
    if (this.combo <= 0) return;
    this.comboT -= dt;
    if (this.comboT <= 0) this.endCombo();
    else if (Math.floor(this.clock * 20) !== this.lastComboEmit) { this.lastComboEmit = Math.floor(this.clock * 20); this.emitCombo(); }
  },

  // ---------- flight: ecto spray, squash, whoosh, speed lines ----------
  stepFlight(dt, holding) {
    const flying = holding && this.openingDone && !this.dead;
    if (flying !== this.thrustOn) {
      this.thrustOn = flying;
      Audio.thrust(flying);
      if (flying) this.tweens.add({ targets: this.player, scaleX: 1.7, scaleY: 2.5, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
    }
    if (flying) {
      this.dropT -= dt;
      while (this.dropT <= 0) {
        this.dropT += DROP_EVERY;
        const p = this.particlePool.get();
        const big = Math.random() < 0.3;
        p.setPosition(PLAYER_X - 3 + (Math.random() - 0.5) * 6, this.py + 16).setSize(big ? 4 : 3, big ? 7 : 5)
          .setFillStyle(this.trailColor(this.drops.length)).setAlpha(0.95).setVisible(true).setDepth(8.7);
        this.drops.push({ p, vx: -30 - Math.random() * 50, vy: 420 + Math.random() * 160 });
      }
    }
    const move = this.speed * dt;
    for (const d of this.drops) {
      d.p.x += d.vx * dt - move;
      d.p.y += d.vy * dt;
      d.vy += 500 * dt;
      // ectoplasm knocks ghouls over (counts as a scare and feeds the combo)
      for (const g of this.ghouls) {
        if (g.state !== 'flung' && Math.abs(d.p.x - g.x) < 12 && d.p.y > g.y - 16) {
          this.flingGhoul(g, true);
          d.hit = true;
          break;
        }
      }
      if (d.hit || d.p.y >= FLOOR - 2) {
        d.dead = true;
        if (!d.hit) {
          this.burst(d.p.x, FLOOR - 2, d.p.fillColor, 2, 10, 220, 2);
          if (this.clock - this.splatSfxAt > 0.11) { this.splatSfxAt = this.clock; Audio.sfx('splat'); }
        }
        d.p.setVisible(false).setDepth(22);
        this.particlePool.put(d.p);
      }
    }
    this.drops = this.drops.filter((d) => !d.dead);
    for (const l of this.speedLines) {
      l.x -= this.speed * 1.6 * dt;
      if (l.x < -l.len) { l.x = W + Math.random() * 80; l.y = CEIL + 10 + Math.random() * (FLOOR - CEIL - 20); }
    }
    this.look.step(dt, this.speed);
  },

  flingGhoul(g, splat = false) {
    g.state = 'flung'; g.vy = -420; g.spin = 10;
    Audio.sfx('ghoul');
    this.popup(splat ? 'SPLAT!' : 'EEK!', '#c8ffc0', g.y - 30);
    this.burst(g.x, g.y, splat ? this.trailColor() : 0xc8ffc0, 8, 26, 350);
    this.tracker?.add('ghouls', 1);
    if (splat) { this.splats++; this.tracker?.add('splats', 1); }
    this.addCombo(splat ? 'splat' : 'ghoul', g.x, g.y - 40);
  },

  renderFlight(lead, py) {
    if (this.hatImg) {
      const lift = this.hatDef.float ? this.hatDef.float + Math.sin(this.clock * 4) * 2 : 0;
      this.hatImg.setPosition(this.ghost.x, this.ghost.y - 11 - lift).setAlpha(this.dead ? 0 : this.ghost.alpha)
        .setScale(this.ghost.scaleX).setRotation(this.holding ? -0.08 : 0.05);
    }
    // speed lines once you're really moving (and always in a Spirit Rush)
    const g = this.speedGfx;
    g.clear();
    const a = this.rush ? 0.5 : Math.max(0, Math.min(0.35, (this.speed - 380) / 400));
    if (a <= 0 || this.dead) return;
    g.fillStyle(this.rush ? 0xe0c8ff : 0xdfe8ff, a);
    for (const l of this.speedLines) g.fillRect(Math.round(l.x - lead * 1.6), Math.round(l.y), Math.round(l.len), 1);
  },

  // world tint = light level (grey) x the character's world look
  worldTint() {
    const dk = Math.round(255 - (1 - this.light) * 120);
    return mulColor((dk << 16) | (dk << 8) | dk, this.look.tint);
  },
};

