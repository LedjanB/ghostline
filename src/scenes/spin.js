// Grave Spin (Jetpack Joyride's Final Spin): spend the souls you collected on a slot machine.
// Prizes: candles, another soul, a blast of extra meters, or a second chance.
import { W, H } from '../data.js';
import { Audio } from '../audio.js';
import { Save } from '../save.js';
import { text, button, focusGroup } from '../ui.js';
import { createInput } from '../input.js';

const PRIZES = [
  ['nothing', 30], ['candles', 24], ['bigcandles', 14], ['soul', 10], ['blast', 14], ['revive', 8],
];
const SYMBOL = {
  candles: 'candle0', bigcandles: 'sym_candles', soul: 'soul0', blast: 'sym_blast', revive: 'sym_revive', nothing: 'sym_bone',
};
const ALL = Object.values(SYMBOL);

export class SpinScene extends Phaser.Scene {
  constructor() { super('spin'); }

  init(data) { this.souls = data.souls; }

  create() {
    this.play = this.scene.get('play');
    this.add.rectangle(0, 0, W, H, 0x07060d).setOrigin(0).setAlpha(0.7).setInteractive();
    this.add.rectangle(W / 2, H / 2, 440, 290, 0x140f24).setStrokeStyle(3, 0x6fb7ff);
    text(this, W / 2, 62, 'GRAVE SPIN', 24, '#9fc8ff');
    this.soulText = text(this, W / 2, 94, '', 16, '#e6f0ff');
    this.reels = [-110, 0, 110].map((dx) => {
      this.add.rectangle(W / 2 + dx, 160, 90, 84, 0x07060d).setStrokeStyle(2, 0x3a2f5a);
      return this.add.image(W / 2 + dx, 160, 'sym_bone').setScale(4);
    });
    this.result = text(this, W / 2, 222, 'SPEND A SOUL TO SPIN', 16, '#a99fd0');
    this.btn = button(this, W / 2, 274, 'SPIN', () => this.onButton(), { w: 220, h: 40, silent: true });
    this.group = focusGroup(this, [this.btn]);
    this.inputMap = createInput(this);
    this.spinning = false;
    this.refresh();
  }

  refresh() {
    this.soulText.setText(`SOULS x${this.souls}`);
    this.btn.setLabel(this.souls > 0 ? 'SPIN' : 'CONTINUE');
  }

  update() {
    this.inputMap.update();
    if (!this.spinning) this.group.handle(this.inputMap);
  }

  onButton() {
    if (this.spinning) return;
    if (this.souls <= 0) { this.finish(); return; }
    this.spin();
  }

  spin() {
    this.spinning = true;
    this.souls--;
    this.play.souls = this.souls;
    this.play.tracker?.add('spins', 1);
    Save.update((d) => { d.stats.spins += 1; });
    this.refresh();
    Audio.sfx('click');
    // WRAPS and the Lucky Spin charm shift odds away from 'nothing'
    const lucky = this.play.char.spinLuck || this.play.charm.luckyspin;
    const table = PRIZES.map(([p, w]) => [p, lucky ? (p === 'nothing' ? 12 : p === 'revive' ? 13 : w + 3) : w]);
    const total = table.reduce((t, p) => t + p[1], 0);
    let roll = Math.random() * total;
    let prize = 'nothing';
    for (const [p, w] of table) { roll -= w; if (roll <= 0) { prize = p; break; } }
    let final = [SYMBOL[prize], SYMBOL[prize], SYMBOL[prize]];
    if (prize === 'nothing') {
      final = Phaser.Utils.Array.Shuffle(ALL.slice()).slice(0, 3); // a miss never shows three of a kind
    }
    this.result.setText('...');
    this.reels.forEach((reel, i) => {
      const stopAt = 600 + i * 300;
      const ev = this.time.addEvent({
        delay: 60, loop: true,
        callback: () => { reel.setTexture(Phaser.Utils.Array.GetRandom(ALL)); Audio.sfx('tick'); },
      });
      this.time.delayedCall(stopAt, () => {
        ev.remove();
        reel.setTexture(final[i]);
        this.tweens.add({ targets: reel, scaleX: 4.8, scaleY: 4.8, duration: 80, yoyo: true });
        if (i === 2) this.payout(prize);
      });
    });
  }

  payout(prize) {
    const p = this.play;
    let msg = 'NOTHING... THE DEAD LAUGH';
    if (prize !== 'nothing') Audio.sfx('win'); else Audio.sfx('lose');
    if (prize === 'candles') { p.runCandles += 15; msg = '+15 CANDLES'; }
    if (prize === 'bigcandles') { p.runCandles += 40; msg = '+40 CANDLES!'; }
    if (prize === 'soul') { this.souls++; p.souls = this.souls; msg = '+1 SOUL'; }
    if (prize === 'blast') { const m = 120 + Math.floor(Math.random() * 130); p.blastM += m; msg = `GRAVE BLAST +${m}M`; }
    p.events.emit('candles', p.runCandles);
    p.events.emit('souls', this.souls);
    this.result.setText(msg);
    this.refresh();
    if (prize === 'revive') {
      this.result.setText('SECOND CHANCE!');
      this.time.delayedCall(900, () => {
        this.scene.stop();
        p.revive();
      });
      return;
    }
    this.time.delayedCall(350, () => { this.spinning = false; });
  }

  finish() {
    this.scene.stop();
    this.play.finalize();
  }
}
