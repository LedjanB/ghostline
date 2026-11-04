// Results: distance, medal, candles, missions finished and level-ups. One tap to go again.
import { W, H, DEATH_LINES, medalFor } from '../data.js';
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
    this.tweens.add({ targets: dim, alpha: 0.65, duration: 300 });

    const panel = this.add.container(W / 2, H / 2 + 30).setAlpha(0);
    const bg = this.add.rectangle(0, 0, 520, 330, 0x140f24).setStrokeStyle(3, 0x8f7fbf);
    const items = [bg];
    items.push(text(this, 0, -146, Phaser.Utils.Array.GetRandom(DEATH_LINES), 16, '#ff5577'));
    items.push(text(this, 0, -110, `${r.meters}M`, 32, '#e6f0ff'));
    if (r.blast) items.push(text(this, 0, -84, `INCLUDES +${r.blast}M GRAVE BLAST`, 8, '#9fc8ff'));
    const medal = medalFor(r.meters);
    if (medal) {
      const m = this.add.image(-170, -110, `medal_${medal.name}`).setScale(4);
      items.push(m, text(this, -170, -76, medal.name, 8, '#e6f0ff'));
      this.tweens.add({ targets: m, angle: { from: -12, to: 12 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    const bestLine = r.daily
      ? `TODAY'S BEST ${r.dailyBest}M`
      : r.isBest ? 'NEW BEST!' : `BEST ${r.best}M`;
    const best = text(this, 170, -110, bestLine, 8, r.isBest ? '#ffd75e' : '#a99fd0');
    items.push(best);
    const missionCandles = r.missions.reward;
    items.push(text(this, 0, -58, `+${r.candles} CANDLES${missionCandles ? `  +${missionCandles} MISSIONS` : ''}`, 16, '#ffd75e'));

    // missions finished this run
    let y = -30;
    if (r.missions.completed.length) {
      for (const d of r.missions.completed.slice(0, 3)) {
        items.push(text(this, 0, y, `${'*'.repeat(d.stars)} ${d.text}`, 8, '#7fe0c0'));
        y += 16;
      }
    } else {
      items.push(text(this, 0, y, 'NO MISSIONS DONE. CHECK THEM IN THE MENU', 8, '#6f6590'));
      y += 16;
    }
    for (const lu of r.missions.levelUps) {
      items.push(text(this, 0, y + 6, `LEVEL ${lu.level}! ${lu.title} +${lu.bonus}`, 16, '#ffd75e'));
      y += 26;
    }
    items.push(text(this, 0, 64, `${r.close} CLOSE CALLS   TOTAL ${Save.get().candles} CANDLES`, 8, '#a99fd0'));
    panel.add(items);
    this.tweens.add({ targets: panel, alpha: 1, y: H / 2, duration: 350, ease: 'Back.easeOut' });

    if (r.missions.levelUps.length) this.time.delayedCall(400, () => Audio.sfx('levelup'));
    else if (r.isBest) Audio.sfx('best');
    if (r.isBest) this.tweens.add({ targets: best, scaleX: 1.3, scaleY: 1.3, duration: 300, yoyo: true, repeat: -1 });

    this.inputMap = createInput(this);
    this.ready = false;
    this.time.delayedCall(500, () => {
      this.ready = true;
      this.group = focusGroup(this, [
        button(this, W / 2 - 110, H / 2 + 116, 'RETRY', () => this.retry(), { w: 190, h: 38 }),
        button(this, W / 2 + 110, H / 2 + 116, 'MENU', () => this.menu(), { w: 190, h: 38 }),
      ], { horizontal: true });
      text(this, W / 2, H / 2 + 148, `${prompt('confirm')} = SELECT`, 8, '#6f6590');
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
