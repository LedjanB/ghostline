// Missions overlay: level, title, star progress and the 3 active missions.
import { W, H } from '../data.js';
import { Save } from '../save.js';
import { text, button, focusGroup } from '../ui.js';
import { createInput } from '../input.js';
import { refillMissions, missionDef, progress, starsForLevel, titleFor } from '../missions.js';

export class MissionsScene extends Phaser.Scene {
  constructor() { super('missions'); }

  init(data) { this.from = data.from; }

  create() {
    refillMissions();
    const m = Save.get().missions;
    this.add.rectangle(0, 0, W, H, 0x07060d).setOrigin(0).setAlpha(0.94).setInteractive();
    text(this, W / 2, 30, 'MISSIONS', 24, '#ffd75e');
    text(this, W / 2, 62, `LEVEL ${m.level}  ${titleFor(m.level)}`, 16, '#e6f0ff');
    const need = starsForLevel(m.level);
    const g = this.add.graphics();
    g.fillStyle(0x07060d, 1); g.fillRect(W / 2 - 152, 80, 304, 14);
    g.fillStyle(0x3a2f5a, 1); g.fillRect(W / 2 - 150, 82, 300, 10);
    g.fillStyle(0xffd75e, 1); g.fillRect(W / 2 - 150, 82, Math.round(300 * (m.stars / need)), 10);
    text(this, W / 2, 106, `${m.stars} / ${need} STARS TO LEVEL UP`, 8, '#a99fd0');

    m.active.map(missionDef).filter(Boolean).forEach((d, i) => {
      const y = 140 + i * 56;
      this.add.rectangle(W / 2, y + 6, 500, 48, 0x140f24).setStrokeStyle(2, 0x3a2f5a);
      text(this, W / 2 - 236, y - 4, d.text, 16, '#e6f0ff', 0);
      text(this, W / 2 + 236, y - 4, '*'.repeat(d.stars), 16, '#ffd75e', 1);
      const p = progress(d);
      g.fillStyle(0x3a2f5a, 1); g.fillRect(W / 2 - 236, y + 14, 380, 6);
      g.fillStyle(0x7fe0c0, 1); g.fillRect(W / 2 - 236, y + 14, Math.round(380 * p), 6);
      const label = d.scope === 'total'
        ? `${Math.min(d.target, Math.floor(p * d.target))}/${d.target}`
        : d.scope === 'death' ? 'ONE RUN' : 'IN ONE RUN';
      text(this, W / 2 + 236, y + 17, label, 8, '#a99fd0', 1);
    });
    text(this, W / 2, 304, 'EACH STAR = 15 CANDLES. LEVEL UP FOR A BONUS.', 8, '#6f6590');
    this.group = focusGroup(this, [button(this, W / 2, 334, 'BACK', () => this.close(), { w: 180, h: 32 })]);
    this.inputMap = createInput(this);
  }

  update() {
    this.inputMap.update();
    this.group.handle(this.inputMap);
    if (this.inputMap.pressed('back')) this.close();
  }

  close() {
    this.scene.stop();
    this.scene.resume(this.from);
  }
}
