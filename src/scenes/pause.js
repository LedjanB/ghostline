// Pause menu: pushed over the paused run (screen stack); popping it resumes the run.
import { W, H } from '../data.js';
import { Audio } from '../audio.js';
import { text, button, focusGroup } from '../ui.js';
import { createInput } from '../input.js';

export class PauseScene extends Phaser.Scene {
  constructor() { super('pause'); }

  create() {
    this.add.rectangle(0, 0, W, H, 0x07060d).setOrigin(0).setAlpha(0.88).setInteractive();
    text(this, W / 2, 100, 'PAUSED', 24, '#cfe0ff');
    this.inputMap = createInput(this);
    this.group = focusGroup(this, [
      button(this, W / 2, 170, 'RESUME', () => this.resumeRun()),
      button(this, W / 2, 222, 'SETTINGS', () => {
        this.scene.pause();
        this.scene.launch('settings', { from: 'pause' });
      }),
      button(this, W / 2, 274, 'MENU', () => {
        this.scene.stop('hud');
        this.scene.stop('play');
        this.scene.start('menu');
      }),
    ]);
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
