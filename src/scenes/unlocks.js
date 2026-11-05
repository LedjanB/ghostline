// Unlocks overlay: Boo's hats, trail colors and the journal. Everything here comes from the
// unlock track that fills a little every run (Downwell).
import { W, H } from '../data.js';
import { Save } from '../save.js';
import { Audio } from '../audio.js';
import { text, button, focusGroup } from '../ui.js';
import { createInput } from '../input.js';
import { HATS, TRAILS, PAGES, TRACK, owned, costFor } from '../unlocks.js';

export class UnlocksScene extends Phaser.Scene {
  constructor() { super('unlocks'); }

  init(data) { this.from = data.from; }

  create() {
    Save.update((s) => { s.unlocks.fresh = 0; });
    const save = Save.get();
    const have = owned(save.unlocks.got);
    this.add.rectangle(0, 0, W, H, 0x07060d).setOrigin(0).setInteractive();
    text(this, W / 2, 26, 'UNLOCKS', 24, '#ff9fd0');
    const u = save.unlocks;
    text(this, W / 2, 50, u.got < TRACK.length
      ? `${u.got}/${TRACK.length} UNLOCKED. NEXT ONE IN ${costFor(u.got) - u.points} POINT${costFor(u.got) - u.points === 1 ? '' : 'S'}. EVERY RUN EARNS POINTS.`
      : 'EVERYTHING UNLOCKED!', 8, '#a99fd0');

    // preview: Boo with the chosen hat, dripping the chosen trail
    this.prevGhost = this.add.sprite(W / 2, 248, 'ghost0').setScale(3).play('ghost_float');
    this.prevHat = this.add.image(W / 2, 248 - 16, 'ghost0').setScale(3).setOrigin(0.5, 1);
    this.drips = [];
    this.time.addEvent({ delay: 70, loop: true, callback: () => this.drip() });
    this.nameText = text(this, W / 2, 296, '', 16, '#e6f0ff');

    text(this, 24, 76, 'HATS', 8, '#ffd75e', 0);
    this.hatBtns = HATS.map((h, i) => {
      const b = button(this, 60 + i * 65, 100, '', () => this.pickHat(h, b), { w: 56, h: 34 });
      b.item = h; b.locked = !have.hats.includes(h.id);
      if (b.locked) b.setLabel('?').setColors(0x1d1a26, 0x4a4560);
      else if (h.rows) b.icon2 = this.add.image(b.bg.x, b.bg.y + 8, `hat_${h.id}`).setScale(2).setOrigin(0.5, 1);
      else b.setLabel('-');
      b.bg.on('pointerover', () => this.describe(b));
      return b;
    });
    text(this, 24, 132, 'TRAILS', 8, '#ffd75e', 0);
    this.trailBtns = TRAILS.map((t, i) => {
      const b = button(this, 92 + i * 65, 156, '', () => this.pickTrail(t, b), { w: 56, h: 34 });
      b.item = t; b.locked = !have.trails.includes(t.id);
      if (b.locked) b.setLabel('?').setColors(0x1d1a26, 0x4a4560);
      else {
        for (let k = 0; k < 6; k++) {
          const col = t.rainbow ? Phaser.Display.Color.HSVToRGB(k / 6, 0.7, 1).color : t.cols[k % 2];
          this.add.rectangle(b.bg.x - 15 + k * 6, b.bg.y, 5, 14, col);
        }
      }
      b.bg.on('pointerover', () => this.describe(b));
      return b;
    });
    this.pages = have.pages;
    this.journalBtn = button(this, W / 2 - 110, 334, `JOURNAL ${this.pages.length}/${PAGES.length}`, () => this.openJournal(), { w: 200, h: 32 });
    this.backBtn = button(this, W / 2 + 110, 334, 'BACK', () => this.close(), { w: 200, h: 32 });
    this.rows = [this.hatBtns, this.trailBtns, [this.journalBtn, this.backBtn]];
    this.all = this.rows.flat();
    this.group = focusGroup(this, this.all, { start: this.hatBtns.findIndex((b) => b.item.id === save.boo.hat) });
    this.inputMap = createInput(this);
    this.refresh();
    this.describe(this.all[this.group.index]);
  }

  refresh() {
    const s = Save.get().boo;
    for (const b of this.hatBtns) if (!b.locked) b.setColors(b.item.id === s.hat ? 0x1d3a3a : 0x2a1f4a, b.item.id === s.hat ? 0x7fe0c0 : 0x8f7fbf);
    for (const b of this.trailBtns) if (!b.locked) b.setColors(b.item.id === s.trail ? 0x1d3a3a : 0x2a1f4a, b.item.id === s.trail ? 0x7fe0c0 : 0x8f7fbf);
    const hat = HATS.find((h) => h.id === s.hat);
    if (hat && hat.rows) this.prevHat.setTexture(`hat_${hat.id}`).setVisible(true).setY(248 - 16 - (hat.float || 0) * 1.5);
    else this.prevHat.setVisible(false);
    this.trail = TRAILS.find((t) => t.id === s.trail) || TRAILS[0];
  }

  describe(b) {
    if (!b || !b.item) { this.nameText.setText(''); return; }
    this.nameText.setText(b.locked ? 'LOCKED. KEEP RUNNING!' : b.item.name);
  }

  pickHat(h, b) {
    if (b.locked) { Audio.sfx('deny'); return; }
    Save.update((s) => { s.boo.hat = h.id; });
    this.tweens.add({ targets: this.prevGhost, scaleX: 3.5, scaleY: 3.5, duration: 80, yoyo: true });
    this.refresh();
  }

  pickTrail(t, b) {
    if (b.locked) { Audio.sfx('deny'); return; }
    Save.update((s) => { s.boo.trail = t.id; });
    this.refresh();
  }

  drip() {
    if (this.journal) return;
    const t = this.trail;
    const col = t.rainbow ? Phaser.Display.Color.HSVToRGB((this.time.now / 1500) % 1, 0.7, 1).color : t.cols[Math.floor(Math.random() * 2)];
    const d = this.add.rectangle(W / 2 - 4 + Math.random() * 8, 268, 3, 5, col);
    this.tweens.add({ targets: d, y: 286, x: d.x - 6, alpha: 0, duration: 300, onComplete: () => d.destroy() });
  }

  // ---------- journal: read the pages you have found ----------
  openJournal() {
    if (!this.pages.length) { this.nameText.setText('NO PAGES YET. KEEP RUNNING!'); Audio.sfx('deny'); return; }
    this.page = 0;
    const objs = [this.add.rectangle(0, 0, W, H, 0x07060d).setOrigin(0).setAlpha(0.97).setInteractive()];
    objs.push(this.add.rectangle(W / 2, 160, 520, 200, 0x2a2238).setStrokeStyle(3, 0xc9b48a));
    this.jTitle = text(this, W / 2, 84, '', 16, '#ffd75e');
    this.jLines = [0, 1, 2].map((k) => text(this, W / 2, 136 + k * 30, '', 16, '#f3e6c4'));
    objs.push(this.jTitle, ...this.jLines);
    const prev = button(this, W / 2 - 200, 300, '<', () => this.turn(-1), { w: 50, h: 36 });
    const next = button(this, W / 2 + 200, 300, '>', () => this.turn(1), { w: 50, h: 36 });
    const close = button(this, W / 2, 300, 'CLOSE', () => this.closeJournal(), { w: 180, h: 36 });
    this.journal = { objs, btns: [prev, close, next] };
    this.jGroup = focusGroup(this, this.journal.btns, { horizontal: true, start: 1 });
    this.turn(0);
  }

  turn(d) {
    this.page = (this.page + d + this.pages.length) % this.pages.length;
    const i = this.pages[this.page];
    this.jTitle.setText(`PAGE ${i + 1}  (${this.page + 1} OF ${this.pages.length} FOUND)`);
    PAGES[i].forEach((line, k) => this.jLines[k].setText(line));
    if (d) Audio.sfx('move');
  }

  closeJournal() {
    this.journal.objs.forEach((o) => o.destroy());
    this.journal.btns.forEach((b) => b.destroy());
    this.journal = null;
    this.all.forEach((b) => { b.group = this.group; });
    this.group.set(this.group.index);
  }

  update() {
    this.inputMap.update();
    const inp = this.inputMap;
    if (this.journal) {
      if (inp.pressed('left')) this.turn(-1);
      else if (inp.pressed('right')) this.turn(1);
      else if (inp.pressed('back')) this.closeJournal();
      else if (inp.pressed('confirm')) this.jGroup.items[this.jGroup.index].press();
      return;
    }
    // grid navigation: left/right inside a row, up/down between rows
    const cur = this.all[this.group.index];
    const r = this.rows.findIndex((row) => row.includes(cur));
    const c = this.rows[r].indexOf(cur);
    let target = null;
    if (inp.pressed('left')) target = this.rows[r][Math.max(0, c - 1)];
    else if (inp.pressed('right')) target = this.rows[r][Math.min(this.rows[r].length - 1, c + 1)];
    else if (inp.pressed('up') && r > 0) { const row = this.rows[r - 1]; target = row[Math.min(row.length - 1, Math.round(c * (row.length - 1) / Math.max(1, this.rows[r].length - 1)))]; }
    else if (inp.pressed('down') && r < this.rows.length - 1) { const row = this.rows[r + 1]; target = row[Math.min(row.length - 1, Math.round(c * (row.length - 1) / Math.max(1, this.rows[r].length - 1)))]; }
    if (target && target !== cur) { this.group.set(this.all.indexOf(target), false); this.describe(target); }
    if (inp.pressed('confirm')) cur.press();
    if (inp.pressed('back')) this.close();
  }

  close() {
    this.scene.stop();
    this.scene.resume(this.from);
  }
}
