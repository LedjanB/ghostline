// Title screen + character shop. Works with mouse, touch, keyboard and gamepad.
import { W, H, CHARACTERS } from '../data.js';
import { Save } from '../save.js';
import { Audio } from '../audio.js';
import { text, button, focusGroup } from '../ui.js';
import { createInput, Device } from '../input.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super('menu'); }

  create() {
    const save = Save.get();
    this.index = Math.max(0, CHARACTERS.findIndex((c) => c.id === save.selected));

    this.far = this.add.tileSprite(0, 0, 320, 180, 'hospital_far').setOrigin(0).setScale(2);
    this.mid = this.add.tileSprite(0, 0, 320, 180, 'hospital_mid').setOrigin(0).setScale(2);
    this.edge = this.add.tileSprite(0, 0, 320, 180, 'hospital_edge').setOrigin(0).setScale(2);
    this.add.image(W / 2, H / 2 + 20, 'dark').setScale(2).setAlpha(0.78);

    this.add.image(W / 2, 60, 'glow').setScale(5, 1.6).setBlendMode(Phaser.BlendModes.ADD).setTint(0x6f8fff).setAlpha(0.35);
    this.title = text(this, W / 2, 60, 'GHOSTLINE', 32, '#cfe0ff').setStroke('#07060d', 6);
    text(this, W / 2, 90, "DON'T LET GO", 8, '#8f7fbf');
    this.ghost = this.add.sprite(W / 2 + 196, 54, 'ghost0').setScale(2).setAlpha(0.9);
    this.ghost.play('ghost_float');
    this.tweens.add({ targets: this.ghost, y: 66, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.time.addEvent({
      delay: 2600, loop: true,
      callback: () => { if (Save.get().settings.flicker) this.tweens.add({ targets: this.title, alpha: 0.3, duration: 50, yoyo: true, repeat: 2 }); },
    });

    this.add.image(24, 20, 'candle0').setScale(1.5);
    this.candleText = text(this, 40, 20, '', 16, '#ffd75e', 0).setStroke('#07060d', 4);
    this.bestText = text(this, W - 14, 20, '', 16, '#a99fd0', 1).setStroke('#07060d', 4);

    this.add.image(W / 2, 168, 'glow').setScale(2.4).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb060).setAlpha(0.25);
    this.charSprite = this.add.sprite(W / 2, 162, 'survivor_run0').setScale(4);
    this.nameText = text(this, W / 2, 212, '', 16, '#e6f0ff').setStroke('#07060d', 4);
    this.perkText = text(this, W / 2, 234, '', 16, '#a99fd0').setStroke('#07060d', 4);
    this.dots = CHARACTERS.map((c, i) => this.add.rectangle(W / 2 - 27 + i * 18, 254, 8, 8, 0x3a2f5a));

    button(this, W / 2 - 140, 162, '<', () => this.browse(-1), { w: 44, h: 44 });
    button(this, W / 2 + 140, 162, '>', () => this.browse(1), { w: 44, h: 44 });

    this.mainBtn = button(this, W / 2, 290, 'PLAY', () => this.mainAction(), { w: 220, h: 40, silent: true });
    this.settingsBtn = button(this, W / 2 - 112, 336, 'SETTINGS', () => this.openSettings(), { w: 200, h: 30 });
    this.fullBtn = button(this, W / 2 + 112, 336, 'FULLSCREEN', () => {
      try {
        if (this.scale.isFullscreen) this.scale.stopFullscreen();
        else this.scale.startFullscreen();
      } catch (e) { /* not allowed here */ }
    }, { w: 200, h: 30 });
    this.group = focusGroup(this, [this.mainBtn, this.settingsBtn, this.fullBtn]);

    this.inputMap = createInput(this);
    this.hint = text(this, W / 2, 112, '', 8, '#6f6590');
    this.offDevice = Device.onChange(() => this.refreshHint());
    this.events.once('shutdown', () => this.offDevice());
    this.events.on('resume', () => { this.inputMap.update(); this.inputMap.update(); this.refresh(); });

    Audio.music('menu');
    Audio.duck(false);
    Audio.danger(false);
    Audio.intensity(0);
    this.refresh();
    this.refreshHint();
  }

  refreshHint() {
    const d = Device.get();
    this.hint.setText(d === 'gamepad' ? 'D-PAD TO PICK  A TO START'
      : d === 'keyboard' ? 'ARROWS TO PICK  ENTER TO START' : '');
  }

  update(time, delta) {
    const m = delta / 1000;
    this.far.tilePositionX += 6 * m;
    this.mid.tilePositionX += 14 * m;
    this.edge.tilePositionX += 26 * m;
    this.inputMap.update();
    if (this.inputMap.pressed('left')) this.browse(-1);
    if (this.inputMap.pressed('right')) this.browse(1);
    this.group.handle(this.inputMap);
  }

  openSettings() {
    this.scene.pause();
    this.scene.launch('settings', { from: 'menu' });
  }

  browse(dir) {
    Audio.sfx('move');
    this.index = (this.index + dir + CHARACTERS.length) % CHARACTERS.length;
    this.tweens.add({ targets: this.charSprite, scaleX: 3.4, scaleY: 4.6, duration: 70, yoyo: true });
    this.refresh();
  }

  refresh() {
    const save = Save.get();
    const c = CHARACTERS[this.index];
    const owned = save.owned.includes(c.id);
    this.candleText.setText(`${save.candles}`);
    this.bestText.setText(`BEST ${save.best}M`);
    this.charSprite.play(`${c.id}_run`);
    if (owned) this.charSprite.clearTint(); else this.charSprite.setTint(0x000000);
    this.nameText.setText(owned ? c.name : `??? ${c.name}`);
    this.perkText.setText(c.perk);
    this.dots.forEach((d, i) => {
      const o = save.owned.includes(CHARACTERS[i].id);
      d.setFillStyle(i === this.index ? 0xcfe0ff : o ? 0x8f7fbf : 0x3a2f5a);
    });
    if (owned) this.mainBtn.setLabel('PLAY').setColors(0x2a1f4a, 0x8f7fbf);
    else if (save.candles >= c.price) this.mainBtn.setLabel(`BUY ${c.price}`).setColors(0x4a3510, 0xffd75e);
    else this.mainBtn.setLabel(`NEED ${c.price}`).setColors(0x1d1a26, 0x4a4560);
  }

  mainAction() {
    const save = Save.get();
    const c = CHARACTERS[this.index];
    if (save.owned.includes(c.id)) {
      Audio.sfx('click');
      Save.update((s) => { s.selected = c.id; });
      this.inputMap.claimPointers();
      this.cameras.main.fadeOut(220, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('play'));
      return;
    }
    if (save.candles >= c.price) {
      Save.update((s) => { s.candles -= c.price; s.owned.push(c.id); s.selected = c.id; });
      Audio.sfx('buy');
      if (Save.get().settings.flicker) this.cameras.main.flash(200, 255, 215, 94);
      this.tweens.add({ targets: this.charSprite, scaleX: 5, scaleY: 5, duration: 140, yoyo: true, ease: 'Back.easeOut' });
      this.refresh();
    } else {
      Audio.sfx('deny');
      if (Save.get().settings.shake) this.cameras.main.shake(120, 0.004);
    }
  }
}
