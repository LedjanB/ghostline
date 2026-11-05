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
    const bg = this.add.rectangle(0, 0, 540, 336, 0x140f24).setStrokeStyle(3, 0x8f7fbf);
    const items = [bg];
    items.push(text(this, 0, -146, Phaser.Utils.Array.GetRandom(DEATH_LINES), 16, '#ff5577'));
    items.push(text(this, 0, -112, `${r.meters}M`, 32, '#e6f0ff'));
    const medal = medalFor(r.meters);
    if (medal) {
      const m = this.add.image(-200, -112, `medal_${medal.name}`).setScale(4);
      items.push(m, text(this, -200, -80, medal.name, 8, '#e6f0ff'));
      this.tweens.add({ targets: m, angle: { from: -12, to: 12 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    const bestLine = r.daily ? `TODAY'S BEST ${r.dailyBest}M` : r.isBest ? 'NEW BEST!' : `BEST ${r.best}M`;
    const best = text(this, 0, -80, bestLine, 16, r.isBest ? '#ffd75e' : '#a99fd0');
    items.push(best);
    const mc = r.missions.reward;
    items.push(text(this, 0, -54, `+${r.candles} CANDLES${mc ? `  +${mc} MISSIONS` : ''}`, 16, '#ffd75e'));
    if (r.blast) items.push(text(this, 0, -34, `INCLUDES +${r.blast}M GRAVE BLAST`, 8, '#9fc8ff'));
    let y = -12;
    if (r.missions.completed.length) {
      for (const d of r.missions.completed.slice(0, 3)) { items.push(text(this, 0, y, `${'*'.repeat(d.stars)} ${d.text}`, 16, '#7fe0c0')); y += 22; }
    } else {
      items.push(text(this, 0, y, 'NO MISSIONS DONE THIS RUN', 16, '#6f6590')); y += 22;
    }
    for (const lu of r.missions.levelUps) { items.push(text(this, 0, y + 4, `LEVEL ${lu.level}! ${lu.title}`, 16, '#ffd75e')); y += 24; }
    items.push(text(this, 0, 82, `TOTAL ${Save.get().candles} CANDLES`, 8, '#a99fd0'));
    panel.add(items);
    this.tweens.add({ targets: panel, alpha: 1, y: H / 2, duration: 350, ease: 'Back.easeOut' });

    if (r.missions.levelUps.length) this.time.delayedCall(400, () => Audio.sfx('levelup'));
    else if (r.isBest) Audio.sfx('best');
    if (r.isBest) this.tweens.add({ targets: best, scaleX: 1.2, scaleY: 1.2, duration: 300, yoyo: true, repeat: -1 });

    this.inputMap = createInput(this);
    this.ready = false;
    this.time.delayedCall(500, () => {
      this.ready = true;
      this.group = focusGroup(this, [
        button(this, W / 2 - 170, H / 2 + 128, 'RETRY', () => this.retry(), { w: 160, h: 38 }),
        button(this, W / 2, H / 2 + 128, 'MENU', () => this.menu(), { w: 160, h: 38 }),
        button(this, W / 2 + 170, H / 2 + 128, 'SHARE', () => this.share(), { w: 160, h: 38 }),
      ], { horizontal: true });
    });
  }

  // no leaderboard server, so let people brag the old way
  share() {
    const r = this.result;
    const msg = `I escaped ${r.meters}M in GHOSTLINE before the dark got me. Beat that:`;
    const url = 'https://ledjanb.github.io/ghostline/';
    const toast = (t) => {
      const x = text(this, W / 2, 30, t, 16, '#ffd75e').setStroke('#07060d', 4);
      this.tweens.add({ targets: x, alpha: 0, delay: 1400, duration: 400, onComplete: () => x.destroy() });
    };
    if (navigator.share) { navigator.share({ title: 'Ghostline', text: msg, url }).catch(() => {}); return; }
    try { navigator.clipboard.writeText(`${msg} ${url}`).then(() => toast('COPIED! PASTE IT ANYWHERE'), () => toast('SHARE NOT AVAILABLE HERE')); }
    catch (e) { toast('SHARE NOT AVAILABLE HERE'); }
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
