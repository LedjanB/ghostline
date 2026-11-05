// Results: distance, score, medal, candles, missions, the unlock bar (Downwell), then a card for
// every level-up and every new unlock. One tap to go again.
import { W, H, DEATH_LINES, CAUSE_LINES, medalFor } from '../data.js';
import { Save } from '../save.js';
import { Audio } from '../audio.js';
import { text, button, focusGroup } from '../ui.js';
import { createInput } from '../input.js';
import { fmt, itemName, PAGES, TRAILS, multiplierFor } from '../unlocks.js';

export class OverScene extends Phaser.Scene {
  constructor() { super('over'); }

  init(data) { this.result = data; }

  create() {
    const r = this.result;
    const dim = this.add.rectangle(0, 0, W, H, 0x07060d).setOrigin(0).setAlpha(0).setInteractive();
    this.tweens.add({ targets: dim, alpha: 0.65, duration: 300 });

    const panel = this.add.container(W / 2, H / 2 + 30).setAlpha(0);
    const bg = this.add.rectangle(0, 0, 560, 336, 0x140f24).setStrokeStyle(3, 0x8f7fbf);
    const items = [bg];
    const cause = r.cause && r.cause.startsWith('air:') ? 'IT WAS WAITING WHERE YOU LANDED.' : CAUSE_LINES[r.cause];
    items.push(text(this, 0, -146, (r.runner && cause) || Phaser.Utils.Array.GetRandom(DEATH_LINES), 16, '#ff5577'));
    items.push(text(this, 0, -114, `${r.meters}M`, 32, '#e6f0ff'));
    const medal = medalFor(r.meters);
    if (medal) {
      const m = this.add.image(-210, -110, `medal_${medal.name}`).setScale(4);
      items.push(m, text(this, -210, -78, medal.name, 8, '#e6f0ff'));
      this.tweens.add({ targets: m, angle: { from: -12, to: 12 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    let best = null;
    if (r.creative) {
      items.push(text(this, 0, -82, 'CREATIVE RUN', 16, '#7fe0c0'));
    } else {
      best = text(this, 0, -82, r.isBestScore ? `NEW BEST SCORE ${fmt(r.score)}!` : `SCORE ${fmt(r.score)}`, 16, r.isBestScore ? '#ffd75e' : '#e6f0ff');
      items.push(best);
      // say each thing once: no 'best score' twice, no x1 multiplier
      const bestLine = r.daily ? `TODAY'S BEST ${r.dailyBest}M` : `${r.isBest ? 'NEW BEST DISTANCE!' : `BEST ${r.best}M`}${r.isBestScore ? '' : `   BEST SCORE ${fmt(r.bestScore)}`}`;
      items.push(text(this, 0, -62, `${r.mult > 1 ? `x${r.mult} MULTIPLIER   ` : ''}${bestLine}`, 8, r.isBest ? '#ffd75e' : '#a99fd0'));
    }
    const mc = r.missions.reward;
    items.push(text(this, 0, -40, `+${r.candles} CANDLES${mc ? `  +${mc} FROM MISSIONS` : ''}`, 16, '#ffd75e'));
    if (r.blast) items.push(text(this, 0, -22, `INCLUDES +${r.blast}M GRAVE BLAST`, 8, '#9fc8ff'));
    let y = -2;
    if (r.missions.completed.length) {
      for (const d of r.missions.completed.slice(0, 3)) { items.push(text(this, 0, y, `${'*'.repeat(d.stars)} ${d.text}`, 16, '#7fe0c0')); y += 21; }
    } else if (!r.creative) {
      items.push(text(this, 0, y, 'NO MISSIONS DONE THIS RUN', 16, '#6f6590'));
    }

    // the unlock bar: every run fills it
    const u = r.unlock;
    if (!r.creative) {
      const g = this.add.graphics();
      const bw = 300, bx = -bw / 2, by = 70;
      g.fillStyle(0x07060d, 1); g.fillRect(bx - 2, by - 2, bw + 4, 14);
      g.fillStyle(0x3a2f5a, 1); g.fillRect(bx, by, bw, 10);
      const fill = this.add.rectangle(bx, by, 1, 10, 0xff9fd0).setOrigin(0);
      items.push(g, fill);
      const label = u.cost ? `+${u.earned} TOWARD THE NEXT UNLOCK  (${u.points}/${u.cost})` : u.bonus ? `ALL UNLOCKED! +${u.bonus} CANDLES` : 'ALL UNLOCKED!';
      items.push(text(this, 0, 92, label, 8, '#ffb0d8'));
      const target = u.cost ? Math.max(0.02, u.points / u.cost) : 1;
      this.tweens.add({ targets: fill, width: Math.round(bw * target), duration: 600, delay: 450, ease: 'Cubic.easeOut' });
    }
    items.push(text(this, 0, 112, `YOU HAVE ${Save.get().candles} CANDLES`, 8, '#a99fd0'));
    panel.add(items);
    this.tweens.add({ targets: panel, alpha: 1, y: H / 2, duration: 350, ease: 'Back.easeOut' });

    if (r.isBestScore || r.isBest) Audio.sfx('best');
    if (best && r.isBestScore) this.tweens.add({ targets: best, scaleX: 1.12, scaleY: 1.12, duration: 300, yoyo: true, repeat: -1 });

    // celebration cards: level-ups first, then everything new
    this.cards = [
      ...r.missions.levelUps.map((lu) => ({ kind: 'level', ...lu })),
      ...u.unlocked.map((it) => ({ kind: 'unlock', item: it })),
    ];

    this.inputMap = createInput(this);
    this.ready = false;
    // the results stay readable for a moment before any card covers them
    this.time.delayedCall(this.cards.length ? 2600 : 500, () => this.nextCard());
  }

  // ---------- reveal cards ----------
  nextCard() {
    if (this.card) { this.card.forEach((o) => o.destroy()); this.card = null; }
    const c = this.cards.shift();
    if (!c) { this.showButtons(); return; }
    const objs = [];
    const add = (o) => { objs.push(o); return o; };
    add(this.add.rectangle(0, 0, W, H, 0x07060d).setOrigin(0).setAlpha(0.95).setInteractive().setDepth(50));
    const box = add(this.add.rectangle(W / 2, H / 2, 420, 260, 0x1d1436).setStrokeStyle(3, 0xffd75e).setDepth(51));
    const rays = add(this.add.image(W / 2, H / 2 - 20, 'glow').setScale(4).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb0e0).setAlpha(0.35).setDepth(51));
    this.tweens.add({ targets: rays, scale: 4.6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const at = (x, y, str, size, col) => add(text(this, x, y, str, size, col).setDepth(53));
    if (c.kind === 'level') {
      at(W / 2, H / 2 - 100, `LEVEL ${c.level}!`, 24, '#ffd75e');
      at(W / 2, H / 2 - 70, c.title, 16, '#e6f0ff');
      at(W / 2, H / 2 - 10, `x${multiplierFor(c.level)}`, 32, '#ffd75e');
      at(W / 2, H / 2 + 26, 'SCORE MULTIPLIER', 16, '#a99fd0');
      at(W / 2, H / 2 + 54, `+${c.bonus} CANDLES`, 16, '#ffd75e');
      Audio.sfx('levelup');
    } else {
      const it = c.item;
      at(W / 2, H / 2 - 100, it.kind === 'page' ? 'NEW JOURNAL PAGE!' : 'NEW!', 24, '#ff9fd0');
      if (it.kind === 'hat') {
        add(this.add.sprite(W / 2, H / 2 - 18, 'ghost0').setScale(4).setDepth(52).play('ghost_float'));
        add(this.add.image(W / 2, H / 2 - 18 - 22, `hat_${it.id}`).setScale(4).setOrigin(0.5, 1).setDepth(53));
      } else if (it.kind === 'trail') {
        const tr = TRAILS.find((x) => x.id === it.id);
        add(this.add.sprite(W / 2, H / 2 - 40, 'ghost0').setScale(3).setDepth(52).play('ghost_float'));
        for (let i = 0; i < 9; i++) {
          const col = tr.rainbow ? Phaser.Display.Color.HSVToRGB(i / 9, 0.7, 1).color : tr.cols[i % 2];
          const d = add(this.add.rectangle(W / 2 - 4 + (i % 3) * 4, H / 2 - 8 + i * 6, 4, 7, col).setDepth(52));
          this.tweens.add({ targets: d, y: d.y + 18, alpha: 0.2, duration: 500, delay: i * 50, repeat: -1 });
        }
      } else if (it.kind === 'page') {
        PAGES[it.i].forEach((line, k) => at(W / 2, H / 2 - 44 + k * 24, line, 16, '#e6f0ff'));
      } else {
        add(this.add.image(W / 2, H / 2 - 20, 'sym_candles').setScale(5).setDepth(52));
      }
      at(W / 2, H / 2 + 52, itemName(it), 16, '#ffd75e');
      if (it.kind === 'hat' || it.kind === 'trail') at(W / 2, H / 2 + 74, 'PUT ON BOO. CHANGE IT IN UNLOCKS.', 8, '#a99fd0');
      Audio.sfx('unlock');
    }
    box.setScale(0.6); this.tweens.add({ targets: box, scale: 1, duration: 260, ease: 'Back.easeOut' });
    const ok = button(this, W / 2, H / 2 + 104, this.cards.length ? 'NEXT' : 'OK', () => this.nextCard(), { w: 160, h: 34 });
    ok.setDepth(54); ok.focus(true);
    objs.push(ok);
    this.card = objs;
    this.cardOk = ok;
    this.cardReadyAt = this.time.now + 350;
  }

  showButtons() {
    this.ready = true;
    this.group = focusGroup(this, [
      button(this, W / 2 - 150, H / 2 + 138, 'RUN AGAIN', () => this.retry(), { w: 230, h: 40 }),
      button(this, W / 2 + 60, H / 2 + 138, 'MENU', () => this.menu(), { w: 150, h: 36 }),
      button(this, W / 2 + 220, H / 2 + 138, 'SHARE', () => this.share(), { w: 150, h: 36 }),
    ], { horizontal: true });
  }

  // no leaderboard server, so let people brag the old way
  share() {
    const r = this.result;
    const msg = r.score
      ? `I scored ${fmt(r.score)} and escaped ${r.meters}M in GHOSTLINE before the dark got me. Beat that:`
      : `I escaped ${r.meters}M in GHOSTLINE before the dark got me. Beat that:`;
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
    if (this.card) {
      if (this.time.now > this.cardReadyAt && (this.inputMap.pressed('confirm') || this.inputMap.pressed('back'))) this.nextCard();
      return;
    }
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
