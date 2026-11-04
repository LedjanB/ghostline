// Game over panel, shown on top of the finished run.
import { W, H, DEATH_LINES } from '../data.js';
import { Save } from '../save.js';
import { Audio } from '../audio.js';
import { text, button, focusGroup } from '../ui.js';
import { createInput, prompt } from '../input.js';

export class OverScene extends Phaser.Scene {
  constructor() { super('over'); }

  init(data) { this.result = data; }

  create() {
    const r = this.result;
    const dim = this.add.rectangle(0, 0, W, H, 0x07060d).setOrigin(0).setAlpha(0).setInteractive();
    this.tweens.add({ targets: dim, alpha: 0.6, duration: 300 });

    const panel = this.add.container(W / 2, H / 2 + 30).setAlpha(0);
    const bg = this.add.rectangle(0, 0, 460, 300, 0x140f24).setStrokeStyle(3, 0x8f7fbf);
    const line = text(this, 0, -118, Phaser.Utils.Array.GetRandom(DEATH_LINES), 16, '#ff5577');
    const dist = text(this, 0, -76, `${r.meters}M`, 32, '#e6f0ff');
    const candles = text(this, 0, -36, `+${r.candles} CANDLES`, 16, '#ffd75e');
    const best = text(this, 0, -10, r.isBest ? 'NEW BEST!' : `BEST ${r.best}M`, 16, r.isBest ? '#ffd75e' : '#a99fd0');
    const extra = text(this, 0, 16, `${r.close} CLOSE CALLS   TOTAL ${Save.get().candles}`, 8, '#a99fd0');
    panel.add([bg, line, dist, candles, best, extra]);
    this.tweens.add({ targets: panel, alpha: 1, y: H / 2, duration: 350, ease: 'Back.easeOut' });
    if (r.isBest) {
      Audio.sfx('best');
      this.tweens.add({ targets: best, scaleX: 1.25, scaleY: 1.25, duration: 300, yoyo: true, repeat: -1 });
    }

    this.inputMap = createInput(this);
    this.ready = false;
    this.time.delayedCall(450, () => {
      this.ready = true;
      this.group = focusGroup(this, [
        button(this, W / 2 - 100, H / 2 + 72, 'RETRY', () => this.retry(), { w: 170 }),
        button(this, W / 2 + 100, H / 2 + 72, 'MENU', () => this.menu(), { w: 170 }),
      ], { horizontal: true });
      text(this, W / 2, H / 2 + 118, `${prompt('confirm')} = SELECT`, 8, '#6f6590');
    });
  }

  update() {
    this.inputMap.update();
    if (!this.ready) return;
    this.group.handle(this.inputMap);
    if (this.inputMap.pressed('back')) this.menu();
  }

  retry() {
    if (!this.ready) return;
    this.ready = false;
    Audio.duck(false);
    this.inputMap.claimPointers();
    this.scene.stop('hud');
    this.scene.stop('play');
    this.scene.start('play');
  }

  menu() {
    if (!this.ready) return;
    this.ready = false;
    Audio.duck(false);
    this.scene.stop('hud');
    this.scene.stop('play');
    this.scene.start('menu');
  }
}
