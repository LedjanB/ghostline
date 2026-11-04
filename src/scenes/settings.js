// Settings overlay. Pushed on top of the menu or pause screen (screen stack).
import { W, H } from '../data.js';
import { Save } from '../save.js';
import { Audio } from '../audio.js';
import { text, button, focusGroup } from '../ui.js';
import { createInput } from '../input.js';

export class SettingsScene extends Phaser.Scene {
  constructor() { super('settings'); }

  init(data) { this.from = data.from; }

  create() {
    this.add.rectangle(0, 0, W, H, 0x07060d).setOrigin(0).setAlpha(0.92).setInteractive();
    text(this, W / 2, 40, 'SETTINGS', 24, '#cfe0ff');
    this.inputMap = createInput(this);

    const rowW = 420;
    const mk = (y, onLeft, onRight, onClick) => button(this, W / 2, y, '', onClick, { w: rowW, h: 36, onLeft, onRight });
    const vol = (key, d) => () => {
      Save.update((s) => { s.settings[key] = Math.round(Math.min(1, Math.max(0, s.settings[key] + d)) * 10) / 10; });
      Audio.applySettings();
      Audio.sfx('click');
      this.refresh();
    };
    const toggle = (key) => () => {
      Save.update((s) => { s.settings[key] = !s.settings[key]; });
      Audio.applySettings();
      this.refresh();
    };

    this.rows = [
      mk(96, vol('music', -0.1), vol('music', 0.1), vol('music', 0.1)),
      mk(140, vol('sfx', -0.1), vol('sfx', 0.1), vol('sfx', 0.1)),
      mk(184, toggle('muted'), toggle('muted'), toggle('muted')),
      mk(228, toggle('shake'), toggle('shake'), toggle('shake')),
      mk(272, toggle('flicker'), toggle('flicker'), toggle('flicker')),
      button(this, W / 2, 324, 'BACK', () => this.close(), { w: 200, h: 36 }),
    ];
    // tap the left / right half of a volume row to lower / raise it
    this.rows.slice(0, 2).forEach((b) => {
      b.bg.removeAllListeners('pointerdown');
      b.bg.on('pointerdown', (p) => { p.__ui = true; (p.x < W / 2 ? b.onLeft : b.onRight)(); });
    });
    this.group = focusGroup(this, this.rows);
    this.hint = text(this, W / 2, 352, 'LEFT / RIGHT TO CHANGE', 8, '#6f6590');
    this.refresh();
  }

  bar(v) {
    const n = Math.round(v * 10);
    return '#'.repeat(n) + '-'.repeat(10 - n);
  }

  refresh() {
    const s = Save.get().settings;
    this.rows[0].setLabel(`MUSIC  < ${this.bar(s.music)} >`);
    this.rows[1].setLabel(`SOUND  < ${this.bar(s.sfx)} >`);
    this.rows[2].setLabel(`ALL AUDIO: ${s.muted ? 'MUTED' : 'ON'}`);
    this.rows[3].setLabel(`SCREEN SHAKE: ${s.shake ? 'ON' : 'OFF'}`);
    this.rows[4].setLabel(`LIGHT FLICKER: ${s.flicker ? 'ON' : 'OFF'}`);
  }

  update() {
    this.inputMap.update();
    this.group.handle(this.inputMap);
    if (this.inputMap.pressed('back')) this.close();
  }

  close() {
    Audio.sfx('click');
    this.scene.stop();
    this.scene.resume(this.from);
  }
}
