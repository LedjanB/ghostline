// Settings overlay. Pushed on top of the menu or pause screen (screen stack).
import { W, H } from '../data.js';
import { Save } from '../save.js';
import { Audio } from '../audio.js';
import { text, button, focusGroup, domPrompt } from '../ui.js';
import { createInput } from '../input.js';

export class SettingsScene extends Phaser.Scene {
  constructor() { super('settings'); }

  init(data) { this.from = data.from; }

  create() {
    this.add.rectangle(0, 0, W, H, 0x07060d).setOrigin(0).setAlpha(0.94).setInteractive();
    text(this, W / 2, 30, 'SETTINGS', 24, '#cfe0ff');
    this.inputMap = createInput(this);
    const vol = (key, d) => () => {
      Save.update((s) => { s.settings[key] = Math.round(Math.min(1, Math.max(0, s.settings[key] + d)) * 10) / 10; });
      Audio.applySettings(); Audio.sfx('click'); this.refresh();
    };
    const toggle = (key) => () => { Save.update((s) => { s.settings[key] = !s.settings[key]; }); Audio.applySettings(); this.refresh(); };
    const L = 168, R = 472, row = (i) => 76 + i * 42;
    const mk = (x, i, onClick, opts = {}) => button(this, x, row(i), '', onClick, { w: 296, h: 34, ...opts });
    this.b = {
      music: mk(L, 0, vol('music', 0.1), { onLeft: vol('music', -0.1), onRight: vol('music', 0.1) }),
      sfx: mk(L, 1, vol('sfx', 0.1), { onLeft: vol('sfx', -0.1), onRight: vol('sfx', 0.1) }),
      muted: mk(L, 2, toggle('muted')),
      shake: mk(L, 3, toggle('shake')),
      flicker: mk(L, 4, toggle('flicker')),
      vibrate: mk(R, 0, toggle('vibrate')),
      contrast: mk(R, 1, toggle('contrast')),
      backup: mk(R, 2, () => this.backup()),
      restore: mk(R, 3, () => this.restore()),
      stats: mk(R, 4, () => { this.scene.pause(); this.scene.launch('stats', { from: 'settings' }); }),
    };
    // tap the left / right half of a volume row to lower / raise it
    for (const k of ['music', 'sfx']) {
      const btn = this.b[k];
      btn.bg.removeAllListeners('pointerdown');
      btn.bg.on('pointerdown', (p) => { p.__ui = true; (p.x < L ? btn.onLeft : btn.onRight)(); });
    }
    this.b.back = button(this, W / 2, 316, 'BACK', () => this.close(), { w: 200, h: 34 });
    const order = ['music', 'sfx', 'muted', 'shake', 'flicker', 'vibrate', 'contrast', 'backup', 'restore', 'stats', 'back'];
    this.group = focusGroup(this, order.map((k) => this.b[k]));
    this.msg = text(this, W / 2, 346, 'LEFT / RIGHT CHANGES VOLUME', 8, '#6f6590');
    this.events.on('resume', () => { this.inputMap.update(); this.inputMap.update(); });
    this.refresh();
  }

  bar(v) { const n = Math.round(v * 10); return '#'.repeat(n) + '-'.repeat(10 - n); }

  refresh() {
    const s = Save.get().settings;
    const on = (v) => (v ? 'ON' : 'OFF');
    this.b.music.setLabel(`MUSIC ${this.bar(s.music)}`);
    this.b.sfx.setLabel(`SOUND ${this.bar(s.sfx)}`);
    this.b.muted.setLabel(s.muted ? 'AUDIO: MUTED' : 'AUDIO: ON');
    this.b.shake.setLabel(`SHAKE: ${on(s.shake)}`);
    this.b.flicker.setLabel(`FLASHES: ${on(s.flicker)}`);
    this.b.vibrate.setLabel(`VIBRATION: ${on(s.vibrate)}`);
    this.b.contrast.setLabel(`HIGH CONTRAST: ${on(s.contrast)}`);
    this.b.backup.setLabel('BACKUP SAVE');
    this.b.restore.setLabel('RESTORE SAVE');
    this.b.stats.setLabel('STATS');
  }

  // cloud save without a server: a code you can keep anywhere
  backup() {
    const code = Save.exportCode();
    const done = (ok) => this.msg.setText(ok ? 'BACKUP CODE COPIED. PASTE IT SOMEWHERE SAFE.' : 'COPY THE CODE FROM THE BOX');
    try {
      navigator.clipboard.writeText(code).then(() => done(true), () => { done(false); domPrompt('YOUR BACKUP CODE', code, null); });
    } catch (e) { done(false); domPrompt('YOUR BACKUP CODE', code, null); }
  }

  restore() {
    domPrompt('PASTE YOUR BACKUP CODE', '', (val) => {
      const ok = Save.importCode(val);
      this.msg.setText(ok ? 'SAVE RESTORED!' : "THAT CODE DIDN'T WORK");
      Audio.sfx(ok ? 'buy' : 'deny');
      Audio.applySettings();
      this.refresh();
    });
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
