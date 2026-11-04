// Pause menu: pushed over the paused run (screen stack); popping it resumes the run.
import { W, H } from '../data.js';
import { Audio } from '../audio.js';
import { text, button, focusGroup } from '../ui.js';
import { createInput } from '../input.js';
import { Save } from '../save.js';

export class PauseScene extends Phaser.Scene {
  constructor() { super('pause'); }

  create() {
    this.add.rectangle(0, 0, W, H, 0x07060d).setOrigin(0).setAlpha(0.88).setInteractive();
    text(this, W / 2, 100, 'PAUSED', 24, '#cfe0ff');
    this.inputMap = createInput(this);
    const creative = this.scene.get('play').creative;
    const y0 = creative ? 150 : 170;
    const items = [
      button(this, W / 2, y0, 'RESUME', () => this.resumeRun(), { w: 240 }),
      button(this, W / 2, y0 + 52, 'SETTINGS', () => {
        this.scene.pause();
        this.scene.launch('settings', { from: 'pause' });
      }, { w: 240 }),
    ];
    if (creative) {
      items.push(button(this, W / 2, y0 + 104, 'RESTART AT 0M', () => {
        const play = this.scene.get('play');
        play.saveCheckpoint(); // keep candles picked up so far
        play.skipCheckpoint = true;
        Save.update((s) => { s.creative.x = 0; s.creative.rebirths = 0; });
        Audio.duck(false);
        this.scene.stop('hud');
        this.scene.stop('play');
        this.scene.start('play');
      }, { w: 240 }));
    }
    items.push(button(this, W / 2, y0 + 52 * items.length, 'MENU', () => {
      this.scene.stop('hud');
      this.scene.stop('play');
      this.scene.start('menu');
    }, { w: 240 }));
    this.group = focusGroup(this, items);
    Audio.duck(true);
  }

  update() {
    this.inputMap.update();
    this.group.handle(this.inputMap);
    if (this.inputMap.pressed('pause') || this.inputMap.pressed('back')) this.resumeRun();
  }

  resumeRun() {
    Audio.duck(false);
    this.inputMap.claimPointers();
    this.scene.stop();
    this.scene.resume('play');
  }
}
