// v6/v8: THE STRETCH: the chase, its shadow and sounds, a stumble, getting caught (the grab scene), Boo's lantern. Mixed into PlayScene via RunnerFeatures.
import { W, H, CEIL, FLOOR, PLAYER_X, PX_PER_METER } from './data.js';
import { Audio } from './audio.js';
import { text } from './ui.js';

import { BOTTOM, RUN, STRETCH_SCALE, maxGap, stumbleCost, cleanRate, comboWindow } from './runner-const.js';

export const StretchFeatures = {
  // ---------------- the chaser ----------------
  stepChaser(dt) {
    if (this.dead) return;
    if (this.stationSafe()) { this.light = 1; this.gapVis = this.gap; this.nextHeadline(); return; } // v9: the light keeps it out
    this.slowT += dt;
    this.runSlow = this.slowT < 0.9 ? 0.72 + 0.28 * (this.slowT / 0.9) : 1;
    if (!this.flying) {
      this.catchUpT = Math.max(0, this.catchUpT - dt);
      this.crEnter = Math.min(1, this.crEnter + dt * 1.7);
      const cap = maxGap(this.runDiff) + this.perk.startGap;
      if (this.clock - this.lastStumble > 3 && this.catchUpT <= 0 && this.started && this.gap < cap) this.gap = Math.min(cap, this.gap + cleanRate(this.runDiff) * (1 - 0.55 * this.lateK()) * dt);
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
    // v8: you know where it is by ear. Its joints click like a key ring; right behind you, it hums
    this.keysT -= dt;
    if (near > 0.3 && this.keysT <= 0) { this.keysT = 1.2 + (1 - near) * 1.6 + Math.random() * 0.6; Audio.sfx('keys', { v: 0.3 + near * 0.7 }); }
    this.humT -= dt;
    if (near > 0.6 && this.humT <= 0) { this.humT = 4.2; Audio.sfx('hum', { v: 0.5 + near * 0.5 }); }
    if (near <= 0.6) this.humT = Math.min(this.humT, 0.8);
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
    if (this.clock - this.lastStumble < comboWindow(this.runDiff) + 1.6 * this.lateK()) { this.caught('2nd'); return; }
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
    if (this.scare) this.endScare();
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
      this.grab = { t: 0, y0: this.py, cx0: -60, roared: false }; // it comes in from the left edge: the first time you see it
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
    s.clearTint().setRotation(0).setAlpha(1); s.anims.timeScale = 1;
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
    this.ghostX = PLAYER_X - 40; this.ghostY = this.py - 30; this.booUntil = this.clock + 1.8;
    this.popup(cause === 'pit' ? 'BOO PULLED YOU OUT!' : 'BOO SHOVED IT BACK!', '#cfe0ff');
    this.quip('shield', true);
  },
  dropPitUnderMilo() {
    for (const t of this.traps) if (t.kind === 'pit') { const x = this.sx(t.wx); if (x < PLAYER_X + 20 && x + t.w > PLAYER_X - 20) this.dropTrap(t); }
  },

  // candles push it back a little (in the air: it'll be a little further back when you land)
  candlePush() {
    const k = RUN.CANDLE * this.perk.candle;
    if (this.flying) this.landingGap = Math.min(RUN.LAND_MAX, this.landingGap + k);
    else this.gap = Math.min(RUN.MAX_GAP + this.perk.startGap, this.gap + k);
  },

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

  // small brackets on what your weapon will shoot, so you learn what each one is for
  stretchStage(near) {
    const st = near > 0.6 ? 'n' : near > 0.32 ? 'm' : 'f';
    if (st !== this.stretchSt) {
      const closer = (this.stretchSt === 'f' && st !== 'f') || (this.stretchSt === 'm' && st === 'n');
      this.stretchSt = st;
      this.events.emit('stretchStage', st);
      if (closer && this.started && !this.dead) Audio.sfx(st === 'n' ? 'hiss' : 'click2');
    }
    return st;
  },

  // a trick's THE STRETCH is a shadow too; only when it gets you does the real thing show
  shadeStretch(t) {
    const s = this.stretch;
    s.setRotation(0); s.anims.timeScale = 1;
    if (t && t.hit) s.clearTint().setAlpha(1);
    else s.setTint(0x020104).setTintMode(Phaser.TintModes.FILL).setAlpha(0.68);
  },

  renderStretch() {
    const s = this.stretch, sd = this.stretchShadow;
    if (this.trick && !this.trick.gone && this.trick.ownsStretch && !this.flying) {
      this.shadeStretch(this.trick);
      sd.setAlpha(Math.max(0, sd.alpha - 0.08)); // it's somewhere else now
      this.renderEdge(1 - this.light); return;
    }
    this.resetStretchSprite();
    s.clearTint().setAlpha(1);
    const near = 1 - this.light;
    if (this.flying) {
      s.setRotation(0); s.anims.timeScale = 1;
      this.edgeGfx.clear();
      // it can't follow: its shadow falls away behind you
      const t = this.crFlyT;
      const x = this.crFlyX + Math.min(t, 0.4) * 60 - Math.max(0, t - 1.1) * 220;
      const hop = t < 1.1 ? Math.abs(Math.sin(t * Math.PI / 0.55)) * 46 : 0;
      s.setPosition(x, FLOOR + 2 - hop).setVisible(false);
      sd.setAlpha(Math.max(0, 0.8 * (1 - t / 0.9)));
      return;
    }
    this.renderEdge(near);
    const fast = this.catchUpT > 0 || this.clock - this.lastStumble < 1.2 || this.dead;
    // phase 4: it moves differently as it closes in (far: slow; middle: it twitches; near: it jitters).
    // v8: you see that only in its shadow and hear it (steps, keys, breath, the hum)
    const stage = this.stretchStage(near);
    const want = (fast ? 'stretch_crawl' : 'stretch_walk') + (stage === 'f' ? '' : `_${stage}`);
    if (!this.dead || this.caughtBy) { if (s.anims.currentAnim?.key !== want) s.play(want); }
    const swant = stage === 'f' ? 'stretch_walk' : `stretch_walk_${stage}`; // the shadow stays upright: tall and thin
    if (sd.anims.currentAnim?.key !== swant) sd.play(swant);
    s.anims.timeScale = stage === 'f' ? 0.85 : 1; sd.anims.timeScale = (fast ? 1.6 : 1) * s.anims.timeScale;
    const enter = Phaser.Math.Easing.Cubic.Out(this.crEnter);
    const lunge = this.lungeT < 0.45 ? Math.sin((this.lungeT / 0.45) * Math.PI) * 34 : 0;
    const sway = Math.sin(this.clock * 1.7) * 6 + Math.sin(this.clock * 4.3) * 2;
    const tw = stage === 'm' && (this.clock % 1.7) < 0.09 ? 1 : 0;
    const jit = stage === 'n' ? (Math.random() - 0.5) * 3 + Math.max(0, Math.sin(this.clock * 5.3)) ** 6 * 10 : 0;
    // the body: off screen behind you (where the gap says it is); shown only once it has you (a pit death)
    const half = (fast ? 28 : 12) * STRETCH_SCALE / 2;
    const target = PLAYER_X - 8 - this.gapVis * 0.72 - half;
    const x = Phaser.Math.Linear(-60, target, enter) + lunge + sway + tw * 5 + jit;
    s.setPosition(Math.round(x), FLOOR + 2 + (fast ? 0 : Math.sin(this.clock * 14) * 1.5));
    s.setRotation(tw * 0.07 + (stage === 'n' ? (Math.random() - 0.5) * 0.03 : 0));
    const grow = 1 + 0.1 * near + (stage === 'n' ? 0.35 : 0);
    s.setScale(STRETCH_SCALE * grow, (fast ? STRETCH_SCALE : STRETCH_SCALE + Math.sin(this.clock * 7) * 0.05) * grow);
    s.setVisible(this.dead && this.caughtBy);
    // the shadow: its feet off the left edge, thrown long up the wall toward Milo; its head is where the gap says it is
    const foot = -26 + sway * 0.5;
    const tip = Phaser.Math.Linear(-20, PLAYER_X - 14 - this.gapVis * 0.72, enter) + lunge + tw * 6 + jit;
    const lean = 0.62 - 0.06 * near + tw * 0.06 + Math.sin(this.clock * 2.3) * 0.02; // up the wall, long and thin
    const len = Math.max(30, (tip - foot) / Math.sin(lean));
    const fh = sd.frame.realHeight || sd.height || 46;
    const thin = STRETCH_SCALE * (0.62 + 0.08 * near);
    sd.setPosition(Math.round(foot), FLOOR + 2).setRotation(lean).setScale(thin, len / fh);
    const want2 = this.dead || this.stationSafe() ? 0 : (0.5 + 0.35 * near) * enter;
    sd.setAlpha(sd.alpha + (want2 - sd.alpha) * 0.25);
  },

  // a stumble: its arm lunges in from the left edge, grabs at Milo, misses, and pulls back out
  renderLungeArm(py) {
    const k = this.lungeT;
    const out = k < 0.16 ? Phaser.Math.Easing.Cubic.Out(k / 0.16) : k < 0.24 ? 1 : Math.max(0, 1 - (k - 0.24) / 0.26);
    if (out <= 0) return;
    const sh = { x: -36, y: FLOOR - 128 };
    const hx = Phaser.Math.Linear(sh.x, PLAYER_X - 16, out), hy = Phaser.Math.Linear(sh.y, py - 10, out);
    const a = this.armGfx;
    const j1 = { x: sh.x + (hx - sh.x) * 0.36, y: sh.y + (hy - sh.y) * 0.36 - 18 * out };
    const j2 = { x: sh.x + (hx - sh.x) * 0.7, y: sh.y + (hy - sh.y) * 0.7 + 10 * out };
    const bone = (p, q, w, c) => { a.lineStyle(w, c, 1); a.beginPath(); a.moveTo(p.x, p.y); a.lineTo(q.x, q.y); a.strokePath(); };
    for (const [w, c] of [[7, 0x0b0918], [4, 0x2c2540]]) { bone(sh, j1, w, c); bone(j1, j2, w, c); bone(j2, { x: hx, y: hy }, w, c); }
    a.fillStyle(0x463c63, 1); a.fillCircle(j1.x, j1.y, 2.5); a.fillCircle(j2.x, j2.y, 2.5);
    // long pale fingers: spread as it reaches, snapping shut on nothing behind his back
    const shut = k > 0.17 ? 1 : 0;
    a.fillStyle(0x0b0918, 1); a.fillRect(hx - 3, hy - 9, 8, 18);
    a.fillStyle(0xece8f2, 1);
    for (let i = 0; i < 4; i++) {
      const fy = hy - 8 + i * 5 + (shut ? (1.5 - i) * 1.6 : 0);
      a.fillRect(hx + 2, fy, shut ? 6 : 11 - Math.abs(i - 1.5) * 2, 2);
    }
    a.fillRect(hx + 1, hy - 8, 2, 16);
  },

  // Boo's lantern: dark while Milo runs alone, lit when Boo is near or carrying him
  renderLantern(py) {
    const g = this.lanternGfx; g.clear();
    const vis = this.booVisK || 0;
    if (this.dead || this.finish || !this.player.visible) { this.lanternGlow.setAlpha(0); return; }
    const sliding = this.slide > 0 && this.grounded && !this.flying;
    const swing = Math.sin(this.clock * (this.grounded ? 11 : 4)) * (this.grounded ? 2 : 1);
    const x = Math.round(PLAYER_X + (sliding ? 16 : 9) + swing), y = Math.round(sliding ? FLOOR - 10 : py + 6);
    g.lineStyle(1, 0x0b0918, 1); g.lineBetween(x + 0.5, y - 6, x + 0.5, y - 2);              // the handle, in his hand
    g.fillStyle(0x0b0918, 1); g.fillRect(x - 3, y - 2, 8, 10);
    const lit = 0.12 + 0.88 * vis;
    g.fillStyle(Phaser.Display.Color.GetColor(90 + 165 * lit, 62 + 153 * lit, 40 + 66 * lit), 1); g.fillRect(x - 2, y, 6, 6); // the glass
    g.fillStyle(0x8a7048, 1); g.fillRect(x - 3, y - 2, 8, 2); g.fillRect(x - 2, y + 6, 6, 2);   // brass cap and base
    this.lanternGlow.setPosition(x + 1, y + 4).setAlpha(0.55 * vis * (0.85 + Math.sin(this.clock * 9) * 0.1));
  },
};
