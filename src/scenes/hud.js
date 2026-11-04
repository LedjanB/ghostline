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
    on('rebirths', (n) => {
      this.rebirthText.setText(reborn(n));
      this.tweens.add({ targets: this.rebirthText, scaleX: 1.3, scaleY: 1.3, duration: 90, yoyo: true });
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
