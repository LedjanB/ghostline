// Game over panel, shown on top of the frozen run.
import { W, H, DEATH_LINES } from '../data.js';
import { Save } from '../save.js';
import { Audio } from '../audio.js';
import { text, button } from '../ui.js';

export class OverScene extends Phaser.Scene {
  constructor() { super('over'); }

  init(data) { this.result = data; }

  create() {
    const r = this.result;
    const dim = this.add.rectangle(0, 0, W, H, 0x07060d).setOrigin(0).setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 0.6, duration: 300 });

    const panel = this.add.container(W / 2, H / 2 + 30).setAlpha(0);
    const bg = this.add.rectangle(0, 0, 460, 290, 0x140f24).setStrokeStyle(3, 0x8f7fbf);
    const line = text(this, 0, -110, Phaser.Utils.Array.GetRandom(DEATH_LINES), 16, '#ff5577');
    const dist = text(this, 0, -66, `${r.meters}M`, 32, '#e6f0ff');
    const candles = text(this, 0, -24, `+${r.candles} CANDLES`, 16, '#ffd75e');
    const best = text(this, 0, 6, r.isBest ? 'NEW BEST!' : `BEST ${r.best}M`, 8, r.isBest ? '#ffd75e' : '#a99fd0');
    const total = text(this, 0, 28, `TOTAL ${Save.get().candles} CANDLES`, 8, '#a99fd0');
    panel.add([bg, line, dist, candles, best, total]);
    this.tweens.add({ targets: panel, alpha: 1, y: H / 2, duration: 350, ease: 'Back.easeOut' });

    if (r.isBest) {
      Audio.sfx('best');
      this.tweens.add({ targets: best, scaleX: 1.4, scaleY: 1.4, duration: 300, yoyo: true, repeat: -1 });
    }

    this.ready = false;
    this.time.delayedCall(450, () => {
      this.ready = true;
      button(this, W / 2 - 90, H / 2 + 76, 'RETRY', () => this.retry(), { w: 150 });
      button(this, W / 2 + 90, H / 2 + 76, 'MENU', () => this.menu(), { w: 150 });
      text(this, W / 2, H / 2 + 116, 'SPACE = RETRY', 8, '#6f6590');
    });
    this.input.keyboard.on('keydown-SPACE', () => { if (this.ready) this.retry(); });
    this.input.keyboard.on('keydown-ENTER', () => { if (this.ready) this.retry(); });
    this.input.keyboard.on('keydown-ESC', () => { if (this.ready) this.menu(); });
  }

  retry() {
    this.ready = false;
    Audio.duck(false);
    this.scene.stop('play');
    this.scene.start('play');
  }

  menu() {
    this.ready = false;
    Audio.duck(false);
    this.scene.stop('play');
    this.scene.start('menu');
  }
}
