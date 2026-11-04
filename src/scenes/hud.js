// HUD scene, launched once on top of the run. It never reads game state each frame;
// it listens for events the run emits (game-ui-ux skill: drive the HUD from events).
import { W } from '../data.js';
import { text, button } from '../ui.js';

export class HudScene extends Phaser.Scene {
  constructor() { super('hud'); }

  create() {
    const play = this.scene.get('play');
    const d = 0;
    this.distText = text(this, 14, 18, '0M', 16, '#e6f0ff', 0).setDepth(d).setStroke('#07060d', 4);
    this.candleIcon = this.add.image(176, 18, 'candle0').setScale(1.5);
    this.candleText = text(this, 190, 18, `${play.runCandles}`, 16, '#ffd75e', 0).setStroke('#07060d', 4);
    this.flame = this.add.image(318, 18, 'flame_icon').setScale(2);
    this.lightBar = this.add.graphics();
    this.shieldIcon = this.add.image(498, 18, 'shield_icon').setScale(2).setVisible(play.shield);
    this.pauseBtn = button(this, W - 24, 18, 'II', () => play.requestPause(), { w: 30, h: 26, size: 8 });
    this.combo = text(this, 176, 52, '', 16, '#ffb060', 0).setStroke('#07060d', 4);
    this.light = 1;
    this.drawLight(false);
    // creative mode: rebirth counter under the distance
    const reborn = (n) => (n > 0 ? `REBORN x${n}` : 'CREATIVE');
    this.rebirthText = text(this, 14, 52, reborn(play.rebirths), 16, '#9fb8e8', 0).setStroke('#07060d', 4)
      .setVisible(play.creative);

    // souls (spin tokens), B-O-O letters, active power-up, mission toasts
    this.soulIcon = this.add.sprite(250, 18, 'soul0').setScale(1.4);
    this.soulText = text(this, 262, 18, `${play.souls}`, 16, '#9fc8ff', 0).setStroke('#07060d', 4);
    const showMeta = !play.creative;
    this.soulIcon.setVisible(showMeta); this.soulText.setVisible(showMeta);
    this.letters = ['B', 'O', 'O'].map((l, i) => this.add.image(W / 2 - 24 + i * 24, 52, `letter_${l}`).setScale(1.6).setAlpha(0.25).setVisible(showMeta));
    this.powerIcon = this.add.image(540, 18, 'orb_magnet').setScale(1.4).setVisible(false);
    this.powerBar = this.add.graphics();
    this.toastBg = this.add.rectangle(W / 2, 90, 470, 46, 0x140f24).setStrokeStyle(2, 0xffd75e).setAlpha(0);
    this.toastTitle = text(this, W / 2, 78, '', 8, '#ffd75e').setAlpha(0);
    this.toastText = text(this, W / 2, 98, '', 16, '#e6f0ff').setAlpha(0);
    this.toasts = [];

    const ev = play.events;
    const on = (name, fn) => { ev.on(name, fn); this.events.once('shutdown', () => ev.off(name, fn)); };
    on('meters', (m) => this.distText.setText(`${m}M`));
    on('candles', (n) => {
      this.candleText.setText(`${n}`);
      this.tweens.add({ targets: this.candleText, scaleX: 1.3, scaleY: 1.3, duration: 60, yoyo: true });
    });
    on('combo', (c) => this.combo.setText(c >= 5 ? `x${c} STREAK` : ''));
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
      this.powerIcon.setTexture(`orb_${p.kind}`).setVisible(true);
      this.powerBar.fillStyle(0x07060d, 1); this.powerBar.fillRect(526, 30, 28, 4);
      this.powerBar.fillStyle(0xffb0d0, 1); this.powerBar.fillRect(526, 30, Math.round(28 * p.left), 4);
    });
    on('toast', (msg) => { this.toasts.push(msg); if (this.toasts.length === 1) this.showToast(); });
    on('rebirths', (n) => {
      this.rebirthText.setText(reborn(n));
      this.tweens.add({ targets: this.rebirthText, scaleX: 1.3, scaleY: 1.3, duration: 90, yoyo: true });
    });
  }

  // one mission toast at a time, like Jetpack Joyride's mission popups
  showToast() {
    const msg = this.toasts[0];
    if (!msg) return;
    this.toastTitle.setText('MISSION COMPLETE!');
    this.toastText.setText(msg);
    const items = [this.toastBg, this.toastTitle, this.toastText];
    this.tweens.add({
      targets: items, alpha: 1, duration: 200, yoyo: true, hold: 1600,
      onComplete: () => { this.toasts.shift(); this.showToast(); },
    });
  }

  drawLight(blink) {
    const g = this.lightBar;
    const v = this.light;
    g.clear();
    g.fillStyle(0x07060d, 1); g.fillRect(332, 11, 132, 14);
    g.fillStyle(0x3a2a1a, 1); g.fillRect(334, 13, 128, 10);
    g.fillStyle(blink ? 0xff4040 : 0xffb040, 1); g.fillRect(334, 13, Math.round(128 * v), 10);
    g.fillStyle(0xffe0a0, 1); g.fillRect(334, 13, Math.round(128 * v), 2);
  }
}
