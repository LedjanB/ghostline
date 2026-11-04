// Title screen + character shop.
import { W, H, CHARACTERS } from '../data.js';
import { Save } from '../save.js';
import { Audio } from '../audio.js';
import { text, button } from '../ui.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super('menu'); }

  create() {
    const save = Save.get();
    this.index = Math.max(0, CHARACTERS.findIndex((c) => c.id === save.selected));

    this.far = this.add.tileSprite(0, 0, 320, 180, 'hospital_far').setOrigin(0).setScale(2);
    this.mid = this.add.tileSprite(0, 0, 320, 180, 'hospital_mid').setOrigin(0).setScale(2);
    this.edge = this.add.tileSprite(0, 0, 320, 180, 'hospital_edge').setOrigin(0).setScale(2);
    this.add.image(W / 2, H / 2 + 20, 'dark').setScale(2).setAlpha(0.78);

    // title
    this.add.image(W / 2, 64, 'glow').setScale(5, 1.6).setBlendMode(Phaser.BlendModes.ADD).setTint(0x6f8fff).setAlpha(0.35);
    this.title = text(this, W / 2, 64, 'GHOSTLINE', 32, '#cfe0ff').setStroke('#07060d', 6);
    text(this, W / 2, 96, 'DONT LET GO', 8, '#8f7fbf');
    this.ghost = this.add.sprite(W / 2 + 196, 58, 'ghost0').setScale(2).setAlpha(0.9);
    this.ghost.play('ghost_float');
    this.tweens.add({ targets: this.ghost, y: 70, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.time.addEvent({
      delay: 2600, loop: true,
      callback: () => {
        this.tweens.add({ targets: this.title, alpha: 0.3, duration: 50, yoyo: true, repeat: 2 });
      },
    });

    // stats
    this.add.image(24, 20, 'candle0').setScale(1.5);
    this.candleText = text(this, 40, 20, '', 16, '#ffd75e', 0).setStroke('#07060d', 4);
    this.bestText = text(this, W - 14, 20, '', 8, '#a99fd0', 1).setStroke('#07060d', 3);

    // character showcase
    this.add.image(W / 2, 182, 'glow').setScale(2.4).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb060).setAlpha(0.25);
    this.charSprite = this.add.sprite(W / 2, 176, 'survivor_run0').setScale(4);
    this.nameText = text(this, W / 2, 232, '', 16, '#e6f0ff').setStroke('#07060d', 4);
    this.perkText = text(this, W / 2, 254, '', 8, '#a99fd0').setStroke('#07060d', 3);
    this.dots = CHARACTERS.map((c, i) => this.add.rectangle(W / 2 - 27 + i * 18, 270, 8, 8, 0x3a2f5a));

    button(this, W / 2 - 130, 176, '<', () => this.browse(-1), { w: 40, h: 40 });
    button(this, W / 2 + 130, 176, '>', () => this.browse(1), { w: 40, h: 40 });
    this.mainBtn = button(this, W / 2, 312, 'PLAY', () => this.mainAction(), { w: 200, h: 44, silent: true });

    this.soundBtn = button(this, W - 56, H - 22, '', () => {
      Audio.setMuted(!Audio.muted());
      this.refresh();
    }, { w: 96, h: 26, size: 8 });
    button(this, 56, H - 22, 'FULLSCREEN', () => {
      if (this.scale.isFullscreen) this.scale.stopFullscreen();
      else this.scale.startFullscreen();
    }, { w: 96, h: 26, size: 8 });

    this.input.keyboard.on('keydown-LEFT', () => this.browse(-1));
    this.input.keyboard.on('keydown-RIGHT', () => this.browse(1));
    this.input.keyboard.on('keydown-A', () => this.browse(-1));
    this.input.keyboard.on('keydown-D', () => this.browse(1));
    this.input.keyboard.on('keydown-SPACE', () => this.mainAction());
    this.input.keyboard.on('keydown-ENTER', () => this.mainAction());

    Audio.music('menu');
    Audio.duck(false);
    this.refresh();
  }

  update(time, delta) {
    const m = delta / 1000;
    this.far.tilePositionX += 6 * m;
    this.mid.tilePositionX += 14 * m;
    this.edge.tilePositionX += 26 * m;
  }

  browse(dir) {
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
    if (owned) this.charSprite.clearTint();
    else this.charSprite.setTint(0x000000);
    this.nameText.setText(owned ? c.name : `??? ${c.name}`);
    this.perkText.setText(c.perk);
    this.dots.forEach((d, i) => {
      const o = save.owned.includes(CHARACTERS[i].id);
      d.setFillStyle(i === this.index ? 0xcfe0ff : o ? 0x8f7fbf : 0x3a2f5a);
    });
    if (owned) {
      this.mainBtn.setLabel('PLAY').setColors(0x2a1f4a, 0x8f7fbf);
    } else if (save.candles >= c.price) {
      this.mainBtn.setLabel(`BUY ${c.price}`).setColors(0x4a3510, 0xffd75e);
    } else {
      this.mainBtn.setLabel(`NEED ${c.price}`).setColors(0x1d1a26, 0x4a4560);
    }
    this.soundBtn.setLabel(Audio.muted() ? 'SOUND OFF' : 'SOUND ON');
  }

  mainAction() {
    const save = Save.get();
    const c = CHARACTERS[this.index];
    if (save.owned.includes(c.id)) {
      Audio.sfx('click');
      Save.update((s) => { s.selected = c.id; });
      this.cameras.main.fadeOut(220, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('play'));
      return;
    }
    if (save.candles >= c.price) {
      Save.update((s) => { s.candles -= c.price; s.owned.push(c.id); s.selected = c.id; });
      Audio.sfx('buy');
      this.cameras.main.flash(200, 255, 215, 94);
      this.tweens.add({ targets: this.charSprite, scaleX: 5, scaleY: 5, duration: 140, yoyo: true, ease: 'Back.easeOut' });
      this.refresh();
    } else {
      Audio.sfx('deny');
      this.cameras.main.shake(120, 0.004);
    }
  }
}
