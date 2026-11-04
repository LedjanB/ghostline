// Charms shop (Jetpack Joyride gadgets): buy with candles, equip up to 2.
import { W, H, CHARMS, MAX_CHARMS } from '../data.js';
import { Save } from '../save.js';
import { Audio } from '../audio.js';
import { text, button, focusGroup } from '../ui.js';
import { createInput } from '../input.js';

export class CharmsScene extends Phaser.Scene {
  constructor() { super('charms'); }

  init(data) { this.from = data.from; }

  create() {
    this.add.rectangle(0, 0, W, H, 0x07060d).setOrigin(0).setAlpha(0.94).setInteractive();
    text(this, W / 2, 30, 'CHARMS', 24, '#ffd75e');
    this.sub = text(this, W / 2, 58, '', 8, '#a99fd0');
    this.candleText = text(this, W / 2, 76, '', 16, '#ffd75e');
    this.buttons = CHARMS.map((c, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const b = button(this, W / 2 - 150 + col * 300, 118 + row * 52, '', () => this.choose(c), { w: 284, h: 42, size: 8 });
      b.charm = c;
      b.bg.on('pointerover', () => this.describe(c));
      return b;
    });
    this.desc = text(this, W / 2, 276, '', 16, '#e6f0ff');
    const back = button(this, W / 2, 326, 'BACK', () => this.close(), { w: 180, h: 32 });
    // grid order for keyboard / gamepad: left/right move within a row
    this.group = focusGroup(this, [...this.buttons, back]);
    this.buttons.forEach((b, i) => {
      b.onLeft = () => this.group.set(i % 2 ? i - 1 : i, false);
      b.onRight = () => this.group.set(i % 2 ? i : i + 1, false);
    });
    this.inputMap = createInput(this);
    this.refresh();
    this.describe(CHARMS[0]);
  }

  describe(c) { this.desc.setText(c.desc); }

  refresh() {
    const s = Save.get();
    this.candleText.setText(`${s.candles} CANDLES`);
    this.sub.setText(`EQUIPPED ${s.charms.equipped.length}/${MAX_CHARMS}  TAP TO BUY, EQUIP OR REMOVE`);
    for (const b of this.buttons) {
      const c = b.charm;
      const owned = s.charms.owned.includes(c.id);
      const on = s.charms.equipped.includes(c.id);
      b.setLabel(`${c.name}\n${on ? 'EQUIPPED' : owned ? 'OWNED' : `${c.price} CANDLES`}`);
      if (on) b.setColors(0x1d3a3a, 0x7fe0c0);
      else if (owned) b.setColors(0x2a1f4a, 0x8f7fbf);
      else if (s.candles >= c.price) b.setColors(0x4a3510, 0xffd75e);
      else b.setColors(0x1d1a26, 0x4a4560);
    }
  }

  choose(c) {
    const s = Save.get();
    this.describe(c);
    if (!s.charms.owned.includes(c.id)) {
      if (s.candles < c.price) { Audio.sfx('deny'); return; }
      Save.update((d) => { d.candles -= c.price; d.charms.owned.push(c.id); });
      Audio.sfx('buy');
    }
    Save.update((d) => {
      const eq = d.charms.equipped;
      if (eq.includes(c.id)) d.charms.equipped = eq.filter((id) => id !== c.id);
      else { if (eq.length >= MAX_CHARMS) eq.shift(); eq.push(c.id); }
    });
    this.refresh();
  }

  update() {
    this.inputMap.update();
    const i = this.group.index;
    if (i < this.buttons.length) {
      if (this.inputMap.pressed('up')) { this.group.set(Math.max(0, i - 2), false); this.describe(CHARMS[this.group.index] || CHARMS[0]); return; }
      if (this.inputMap.pressed('down')) { this.group.set(Math.min(this.buttons.length, i + 2), false); if (CHARMS[this.group.index]) this.describe(CHARMS[this.group.index]); return; }
    }
    this.group.handle(this.inputMap);
    if (this.inputMap.pressed('back')) this.close();
  }

  close() {
    this.scene.stop();
    this.scene.resume(this.from);
  }
}
