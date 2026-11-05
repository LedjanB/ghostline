// First-launch story: four quick cards, tap to go on, skip any time.
import { W, H } from '../data.js';
import { Save } from '../save.js';
import { Audio } from '../audio.js';
import { text, button } from '../ui.js';
import { createInput } from '../input.js';

const CARDS = [
  ['ST. MERCY WARD', '3:33 AM'],
  ['MILO WAKES UP.', 'EVERY LIGHT IN THE BUILDING IS DYING.'],
  ['SOMETHING IN THE DARK', 'IS HUNGRY.'],
  ['THEN A GHOST GRABS HIM.', 'HIS NAME IS BOO.'],
  ['"HOLD ON, MILO."', '"AND WHATEVER YOU DO, DON\'T LET GO."'],
];

export class StoryScene extends Phaser.Scene {
  constructor() { super('story'); }

  create() {
    this.layers = this.add.image(W / 2, H / 2, 'ward_far').setScale(2).setAlpha(0.35);
    this.add.image(W / 2, H / 2, 'dark').setScale(2).setAlpha(0.8);
    this.milo = this.add.sprite(W / 2 - 40, 250, 'survivor_run0').setScale(4).setAlpha(0);
    this.boo = this.add.sprite(W / 2 + 60, 210, 'ghost0').setScale(4).setAlpha(0);
    this.boo.play('ghost_float');
    this.l1 = text(this, W / 2, 96, '', 24, '#cfe0ff').setStroke('#07060d', 6);
    this.l2 = text(this, W / 2, 136, '', 16, '#a99fd0').setStroke('#07060d', 4);
    this.hint = text(this, W / 2, 330, 'TAP TO CONTINUE', 8, '#6f6590');
    button(this, W - 60, 24, 'SKIP', () => this.finish(), { w: 90, h: 28, size: 8 });
    this.inputMap = createInput(this);
    this.input.on('pointerdown', (p) => { if (!p.__ui) this.next(); });
    this.i = -1;
    Audio.music('menu');
    this.next();
  }

  next() {
    this.i++;
    if (this.i >= CARDS.length) { this.finish(); return; }
    const [a, b] = CARDS[this.i];
    this.l1.setText(a).setAlpha(0).setFontSize(a.length > 22 ? 16 : 24); this.l2.setText(b).setAlpha(0);
    this.tweens.add({ targets: this.l1, alpha: 1, duration: 400 });
    this.tweens.add({ targets: this.l2, alpha: 1, duration: 400, delay: 300 });
    if (this.i >= 1) this.tweens.add({ targets: this.milo, alpha: 1, duration: 500 });
    if (this.i === 2 && Save.get().settings.shake) this.cameras.main.shake(400, 0.004);
    if (this.i === 3) {
      this.tweens.add({ targets: this.boo, alpha: 0.95, x: W / 2 - 30, y: 196, duration: 700, ease: 'Back.easeOut', onComplete: () => Audio.sfx('grab') });
    }
    Audio.sfx('click');
  }

  update() {
    this.inputMap.update();
    if (this.inputMap.pressed('confirm')) this.next();
    if (this.inputMap.pressed('back')) this.finish();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    Save.update((s) => { s.storySeen = true; });
    this.inputMap.claimPointers();
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('play'));
  }
}
