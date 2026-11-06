// HUD scene, launched once on top of the run. It never reads game state each frame;
// it listens for events the run emits (game-ui-ux skill: drive the HUD from events).
import { W, H } from '../data.js';
import { fmt } from '../unlocks.js';
import { text, button } from '../ui.js';

export class HudScene extends Phaser.Scene {
  constructor() { super('hud'); }

  create() {
    const play = this.scene.get('play');
    const d = 0;
    this.distText = text(this, 14, 18, '0M', 16, '#e6f0ff', 0).setDepth(d).setStroke('#07060d', 4);
    this.candleIcon = this.add.image(176, 18, 'candle0').setScale(1.5);
    this.candleText = text(this, 190, 18, `${play.runCandles}`, 16, '#ffd75e', 0).setStroke('#07060d', 4);
    this.runner = !!play.runner;
    // phase 4 round 6 (runner): a calm top bar on a phone. Always on: distance, the meter (centered, it's what
    // matters), score, pause. Candles, souls and B-O-O letters peek in when they change, then fade out.
    // The weapon timer lives bottom-right, over the floor band. Combo is a small line under the score.
    this.mx = this.runner ? W / 2 - 66 : 332; // the meter bar's left edge
    this.flame = this.add.image(this.mx - 14, 18, this.runner ? 'stretch_icon' : 'flame_icon').setScale(2);
    this.lightBar = this.add.graphics();
    this.shieldIcon = this.add.image(this.runner ? this.mx + 150 : 498, 18, 'shield_icon').setScale(2).setVisible(play.shield);
    this.pauseBtn = button(this, W - 24, 18, 'II', () => play.requestPause(), { w: 30, h: 26, size: 8 });
    // score + multiplier badge (Subway Surfers), combo meter on the right
    // (kept right of the player: x 120-180 must stay clear when you hug the ceiling)
    this.multBg = this.add.rectangle(218, 50, 34, 20, 0x4a3510).setStrokeStyle(2, 0xffd75e);
    this.multText = text(this, 218, 51, `x${play.mult}`, 8, '#ffd75e');
    this.scoreText = text(this, 242, 50, fmt(play.totalScore()), 16, '#e6f0ff', 0).setStroke('#07060d', 4);
    this.comboText = text(this, W - 14, 46, '', 16, '#ffb060', 1).setStroke('#07060d', 4);
    this.comboBar = this.add.graphics();
    const showScore = !play.creative;
    [this.multBg, this.multText, this.scoreText].forEach((o) => o.setVisible(showScore));
    this.light = 1;
    this.drawLight(false);
    // creative mode: rebirth counter under the distance
    const reborn = (n) => (n > 0 ? `REBORN x${n}` : 'CREATIVE');
    this.rebirthText = text(this, 14, 52, reborn(play.rebirths), 16, '#9fb8e8', 0).setStroke('#07060d', 4)
      .setVisible(play.creative);

    // souls (spin tokens), B-O-O letters, active power-up, mission toasts
    // v6: further right so a 3-digit candle count never runs into it
    this.soulIcon = this.add.sprite(play.runner ? 272 : 250, 18, 'soul0').setScale(1.4);
    this.soulText = text(this, play.runner ? 284 : 262, 18, `${play.souls}`, 16, '#9fc8ff', 0).setStroke('#07060d', 4);
    const showMeta = !play.creative;
    this.soulIcon.setVisible(showMeta); this.soulText.setVisible(showMeta);
    this.letters = ['B', 'O', 'O'].map((l, i) => this.add.image(24 + i * 24, 50, `letter_${l}`).setScale(1.6).setAlpha(0.25).setVisible(showMeta));
    this.powerIcon = this.add.image(540, 18, 'orb_magnet').setScale(1.4).setVisible(false);
    this.powerBar = this.add.graphics();
    // phase 4: tips and mission toasts are ONE small note in the bottom-left corner (over the floor band,
    // under Milo's feet), one at a time. The middle of the screen belongs to the one message that matters now.
    const ty = this.runner ? H - 13 : 90;
    this.toastBg = this.add.rectangle(8, ty, 10, 18, 0x140f24, 0.85).setOrigin(0, 0.5).setStrokeStyle(1, 0x9fb8e8).setAlpha(0);
    this.toastTitle = text(this, W / 2, ty - 11, '', 8, '#ffd75e').setAlpha(0);
    this.toastText = text(this, 26, ty + 1, '', 8, '#e6f0ff', 0).setAlpha(0);
    this.toastIcon = this.add.image(17, ty, 'ghost0').setScale(0.5).setAlpha(0);
    if (!this.runner) { // v5 keeps its big strip
      this.toastBg.setOrigin(0.5).setPosition(W / 2, ty).setSize(560, 42).setStrokeStyle(2, 0xffd75e);
      this.toastText.setOrigin(0.5).setPosition(W / 2, ty + 8).setFontSize(16);
      this.toastIcon.setScale(1).setPosition(W / 2 - 262, ty);
    }
    this.toasts = [];

    const ev = play.events;
    const on = (name, fn) => { ev.on(name, fn); this.events.once('shutdown', () => ev.off(name, fn)); };
    on('meters', (m) => this.distText.setText(`${m}M`));
    on('candles', (n) => {
      this.candleText.setText(`${n}`);
      this.tweens.add({ targets: this.candleText, scaleX: 1.3, scaleY: 1.3, duration: 60, yoyo: true });
    });
    on('score', (n) => this.scoreText.setText(fmt(n)));
    on('mult', (m) => this.multText.setText(`x${m}`));
    on('combo', (c) => {
      const cols = ['#ffb060', '#ffb060', '#9ff0ff', '#ffb0d0', '#ffd75e', '#ff8a5e'];
      const show = c.n >= 3;
      const label = show ? (c.tier > 1 ? `${c.n} COMBO x${c.tier}` : `${c.n} COMBO`) : '';
      if (label !== this.comboText.text) {
        this.comboText.setText(label).setColor(cols[c.tier]);
        if (show && c.n % 10 === 0) this.tweens.add({ targets: this.comboText, scaleX: 1.25, scaleY: 1.25, duration: 70, yoyo: true });
      }
      const g = this.comboBar;
      g.clear();
      if (!show) return;
      const at = this.comboBarAt || { x: W - 14, y: 58, min: 60 };
      const w = Math.max(at.min, this.comboText.width);
      g.fillStyle(0x07060d, 1); g.fillRect(at.x - w, at.y, w, 5);
      g.fillStyle(Phaser.Display.Color.HexStringToColor(cols[c.tier]).color, 1); g.fillRect(at.x - w + 1, at.y + 1, Math.round((w - 2) * c.left), 3);
    });
    on('stretchStage', (st) => { if (this.runner) this.flame.setTexture(st === 'f' ? 'stretch_icon' : `stretch_icon_${st}`); }); // phase 4: its face on the meter changes too
    on('light', (v) => { this.light = v; this.drawLight(false); });
    on('lightLow', (blink) => this.drawLight(blink));
    on('shield', (has) => this.shieldIcon.setVisible(has));
    on('souls', (n) => {
      this.soulText.setText(`${n}`);
      this.tweens.add({ targets: [this.soulIcon, this.soulText], scaleX: '*=1.3', scaleY: '*=1.3', duration: 80, yoyo: true });
    });
    on('letters', (n) => this.letters.forEach((l, i) => {
      l.setAlpha(i < n ? 1 : 0.25);
      if (i === n - 1) this.tweens.add({ targets: l, scaleX: 2.4, scaleY: 2.4, duration: 120, yoyo: true });
    }));
    on('power', (p) => {
      this.powerBar.clear();
      if (!p) { this.powerIcon.setVisible(false); return; }
      this.powerIcon.setTexture(p.icon || `orb_${p.kind}`).setVisible(true);
      const pa = this.powerAt || { x: 526, y: 30 };
      const bw = pa.w || 28, bh = pa.h || 4;
      this.powerBar.fillStyle(0x07060d, 1); this.powerBar.fillRect(pa.x - 1, pa.y - 1, bw + 2, bh + 2);
      this.powerBar.fillStyle(p.left < 0.25 ? 0xff6a5a : 0xffb0d0, 1); this.powerBar.fillRect(pa.x, pa.y, Math.round(bw * p.left), bh);
    });
    on('toast', (msg) => { this.toasts.push({ kind: 'mission', msg }); if (this.toasts.length === 1) this.showToast(); });
    on('note', (msg) => { if (this.toasts.some((t) => t.msg === msg) || this.toasts.length > 1) return; this.toasts.push({ kind: 'tip', msg }); if (this.toasts.length === 1) this.showToast(); });
    on('tip', (msg) => { if (this.toasts.some((t) => t.msg === msg)) return; this.toasts.push({ kind: 'tip', msg }); if (this.toasts.length === 1) this.showToast(); });
    on('hush', () => { // caught: nothing new pops up over the death
      this.toasts = [];
      [this.toastBg, this.toastTitle, this.toastText, this.toastIcon].forEach((o) => { this.tweens.killTweensOf(o); o.setAlpha(0); });
    });
    // v6: one more stumble and it gets you. Shown on the danger meter itself.
    this.strike = null;
    this.strikeText = text(this, this.mx + 66, 38, 'ONE MORE!', 8, '#ff6a5a').setVisible(false).setStroke('#07060d', 3);
    on('strike', (left) => { this.strike = left; this.strikeText.setVisible(left !== null); this.drawLight(false); });
    // hide what hasn't mattered yet: souls and B-O-O letters show once you have one; x1 isn't worth a box
    if (this.runner) {
      const showSouls = play.souls > 0;
      this.soulIcon.setVisible(showSouls && showMeta); this.soulText.setVisible(showSouls && showMeta);
      on('souls', (n) => { this.soulIcon.setVisible(n > 0 && showMeta); this.soulText.setVisible(n > 0 && showMeta); });
    }
    if (this.runner) this.layoutRunner(play, showMeta, showScore, on);
    on('rebirths', (n) => {
      this.rebirthText.setText(reborn(n));
      this.tweens.add({ targets: this.rebirthText, scaleX: 1.3, scaleY: 1.3, duration: 90, yoyo: true });
    });
  }

  layoutRunner(play, showMeta, showScore, on) {
    // a soft dark band behind the top bar, so bright ceilings (the ward's lights) don't fight it
    const band = this.add.graphics().setDepth(-1);
    for (let i = 0; i < 12; i++) { band.fillStyle(0x07060d, 0.55 * (1 - i / 12)); band.fillRect(0, i * 3, W, 3); }
    // the always-on bar: distance left, meter center, score right of it, pause
    this.scoreText.setOrigin(1, 0.5).setPosition(W - 48, 18);
    this.comboText.setOrigin(1, 0.5).setPosition(W - 48, 38).setFontSize(8);
    this.multBg.setSize(26, 16); this.multText.setFontSize(8);
    const placeMult = () => {
      const show = play.mult > 1 && showScore;
      const mx = this.scoreText.x - this.scoreText.width - 18;
      this.multBg.setPosition(mx, 18).setVisible(show); this.multText.setPosition(mx, 19).setVisible(show);
    };
    placeMult();
    on('score', placeMult); on('mult', placeMult);
    // the combo bar sits under its small label
    this.comboBarAt = { x: W - 48, y: 45, min: 48 };
    // peekers: row 2 on the left (x < 120: row 2 at x 120-180 stays clear for the ceiling)
    this.candleIcon.setPosition(20, 42).setScale(1);
    this.candleText.setPosition(28, 42).setFontSize(8);
    this.letters.forEach((l, i) => l.setPosition(136 + i * 18, 18).setScale(1.2));
    const placeSouls = () => {
      const sx = this.candleText.x + this.candleText.width + 12;
      this.soulIcon.setPosition(sx, 42).setScale(0.9); this.soulText.setPosition(sx + 8, 42).setFontSize(8);
    };
    placeSouls();
    const groups = {
      candles: [this.candleIcon, this.candleText],
      souls: [this.soulIcon, this.soulText],
      letters: this.letters,
    };
    const peek = (name, hold = 2400) => {
      const g = groups[name];
      g.forEach((o) => { this.tweens.killTweensOf(o); o.setAlpha(o.peekAlpha ?? 1); });
      this.tweens.add({ targets: g, alpha: 0, delay: hold, duration: 500 });
    };
    Object.values(groups).flat().forEach((o) => o.setAlpha(0));
    this.letters.forEach((l, i) => { l.peekAlpha = 0.25; });
    on('candles', () => { placeSouls(); peek('candles'); });
    on('souls', () => peek('souls'));
    on('letters', (n) => {
      this.letters.forEach((l, i) => { l.peekAlpha = i < n ? 1 : 0.25; });
      peek('letters', n >= 3 ? 1600 : 3000);
    });
    // the weapon / power-up timer: bottom-right, over the floor band
    this.powerIcon.setPosition(W - 30, H - 20).setScale(1.8);
    this.powerAt = { x: W - 54, y: H - 7, w: 48, h: 5 };
  }

  // one mission toast at a time, like Jetpack Joyride's mission popups
  showToast() {
    const item = this.toasts[0];
    if (!item) return;
    const tip = item.kind === 'tip';
    const items = [this.toastBg, this.toastText];
    if (this.runner) {
      this.toastText.setText(tip ? item.msg : `MISSION DONE: ${item.msg}`).setColor(tip ? '#e6f0ff' : '#ffd75e');
      this.toastBg.setSize(this.toastText.width + 26, 18).setStrokeStyle(1, tip ? 0x9fb8e8 : 0xffd75e);
      items.push(this.toastIcon);
    } else {
      this.toastTitle.setText(tip ? '' : 'MISSION COMPLETE!');
      this.toastText.setText(item.msg).setY(this.toastBg.y + (tip ? 1 : 8)).setX(W / 2 + (tip ? 12 : 0));
      this.toastBg.setStrokeStyle(2, tip ? 0x9fb8e8 : 0xffd75e);
      items.push(this.toastTitle);
      if (tip) items.push(this.toastIcon);
    }
    this.toastAt = this.time.now;
    this.tweens.add({
      targets: items, alpha: 1, duration: 160, yoyo: true, hold: tip ? 2600 : 1800,
      onComplete: () => { this.toasts.shift(); this.showToast(); },
    });
  }

  drawLight(blink) {
    const g = this.lightBar;
    const v = this.light, m = this.mx;
    g.clear();
    g.fillStyle(0x07060d, 1); g.fillRect(m - 2, 11, 132, 14);
    g.fillStyle(0x3a2a1a, 1); g.fillRect(m, 13, 128, 10);
    // phase 4b (runner): the bar is how CLOSE it is. It fills from its face toward the right and goes
    // grey, then orange, then red. Fuller and redder = worse (testers read the old shrinking bar as "safer").
    if (this.runner) {
      const c = 1 - v;
      const col = blink ? 0xff4040 : c < 0.35 ? 0x8a8298 : c < 0.65 ? 0xffb040 : 0xff3a4a;
      if (this.strike !== null && this.strike !== undefined) { // red frame + a shrinking timer: the next stumble is fatal
        g.fillStyle(0xff4040, 1); g.fillRect(m - 4, 9, 136, 18);
        g.fillStyle(0x07060d, 1); g.fillRect(m - 2, 11, 132, 14);
        g.fillStyle(0xff6a5a, 1); g.fillRect(m, 27, Math.round(128 * this.strike), 3);
      }
      g.fillStyle(0x1c1626, 1); g.fillRect(m, 13, 128, 10);
      const w = Math.max(4, Math.round(128 * c));
      g.fillStyle(col, 1); g.fillRect(m, 13, w, 10);
      g.fillStyle(0xffffff, 0.35); g.fillRect(m, 13, w, 2);
      return;
    }
    const col = blink ? 0xff4040 : 0xffb040;
    g.fillStyle(col, 1); g.fillRect(m, 13, Math.round(128 * v), 10);
    g.fillStyle(0xffe0a0, 1); g.fillRect(m, 13, Math.round(128 * v), 2);
  }
}
