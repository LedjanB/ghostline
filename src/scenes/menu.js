// Title screen + character shop. Works with mouse, touch, keyboard and gamepad.
import { W, H, CHARACTERS, PX_PER_METER, GIFT_HOURS } from '../data.js';
import { todayKey } from '../run-features.js';
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

    this.add.image(W / 2, 48, 'glow').setScale(5, 1.6).setBlendMode(Phaser.BlendModes.ADD).setTint(0x6f8fff).setAlpha(0.35);
    this.title = text(this, W / 2, 48, 'GHOSTLINE', 32, '#cfe0ff').setStroke('#07060d', 6);
    this.subtitle = text(this, W / 2, 76, '', 8, '#8f7fbf');
    this.ghost = this.add.sprite(W / 2 + 196, 44, 'ghost0').setScale(2).setAlpha(0.9);
    this.ghost.play('ghost_float');
    this.tweens.add({ targets: this.ghost, y: 56, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.time.addEvent({
      delay: 2600, loop: true,
      callback: () => { if (Save.get().settings.flicker) this.tweens.add({ targets: this.title, alpha: 0.3, duration: 50, yoyo: true, repeat: 2 }); },
    });

    this.add.image(24, 20, 'candle0').setScale(1.5);
    this.candleText = text(this, 40, 20, '', 16, '#ffd75e', 0).setStroke('#07060d', 4);
    this.bestText = text(this, W - 14, 20, '', 16, '#a99fd0', 1).setStroke('#07060d', 4);

    this.add.image(W / 2, 148, 'glow').setScale(2.4).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb060).setAlpha(0.25);
    this.charSprite = this.add.sprite(W / 2, 140, 'survivor_run0').setScale(4);
    this.nameText = text(this, W / 2, 188, '', 16, '#e6f0ff').setStroke('#07060d', 4);
    this.perkText = text(this, W / 2, 208, '', 16, '#a99fd0').setStroke('#07060d', 4);
    this.dots = CHARACTERS.map((c, i) => this.add.rectangle(W / 2 - 27 + i * 18, 225, 8, 8, 0x3a2f5a));

    button(this, W / 2 - 140, 140, '<', () => this.browse(-1), { w: 44, h: 44 });
    button(this, W / 2 + 140, 140, '>', () => this.browse(1), { w: 44, h: 44 });

    this.mainBtn = button(this, W / 2, 258, 'PLAY', () => this.mainAction(), { w: 300, h: 38, silent: true });
    this.missionsBtn = button(this, 112, 302, 'MISSIONS', () => this.overlay('missions'), { w: 196, h: 30 });
    this.charmsBtn = button(this, 320, 302, 'CHARMS', () => this.overlay('charms'), { w: 196, h: 30 });
    this.giftBtn = button(this, 528, 302, 'GIFT', () => this.claimGift(), { w: 196, h: 30, silent: true });
    this.modeBtn = button(this, 112, 340, '', () => this.toggleMode(), { w: 196, h: 30 });
    this.settingsBtn = button(this, 320, 340, 'SETTINGS', () => this.openSettings(), { w: 196, h: 30 });
    this.fullBtn = button(this, 528, 340, 'FULLSCREEN', () => this.fullscreen(), { w: 196, h: 30 });
    this.group = focusGroup(this, [this.mainBtn, this.missionsBtn, this.charmsBtn, this.giftBtn, this.modeBtn, this.settingsBtn, this.fullBtn]);
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.refreshGift() });

    this.inputMap = createInput(this);
    this.hint = text(this, W / 2, 92, '', 8, '#6f6590');
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
    if (this.modal) {
      if (this.inputMap.pressed('confirm') || this.inputMap.pressed('back')) this.closeModal();
      return;
    }
    if (this.inputMap.pressed('left')) this.browse(-1);
    if (this.inputMap.pressed('right')) this.browse(1);
    this.group.handle(this.inputMap);
  }

  toggleMode() {
    const order = ['normal', 'daily', 'creative'];
    Save.update((s) => { s.mode = order[(order.indexOf(s.mode) + 1) % order.length]; });
    this.refresh();
  }

  overlay(key) {
    this.scene.pause();
    this.scene.launch(key, { from: 'menu' });
  }

  giftReadyIn() {
    return Math.max(0, Save.get().giftAt + GIFT_HOURS * 3600e3 - Date.now());
  }

  // Crossy Road-style free gift every few hours
  refreshGift() {
    const left = this.giftReadyIn();
    if (left <= 0) {
      this.giftBtn.setLabel('FREE GIFT!').setColors(0x4a1f4a, 0xff9fd0);
      if (!this.giftPulse) this.giftPulse = this.tweens.add({ targets: this.giftBtn.lbl, scaleX: 1.1, scaleY: 1.1, duration: 400, yoyo: true, repeat: -1 });
    } else {
      const mins = Math.ceil(left / 60e3);
      const h = Math.floor(mins / 60), m = mins % 60;
      this.giftBtn.setLabel(`GIFT ${h}H ${m}M`).setColors(0x1d1a26, 0x4a4560);
      if (this.giftPulse) { this.giftPulse.stop(); this.giftPulse = null; this.giftBtn.lbl.setScale(1); }
    }
  }

  claimGift() {
    if (this.giftReadyIn() > 0) { Audio.sfx('deny'); return; }
    const n = 20 + Math.floor(Math.random() * 41);
    Save.update((s) => { s.candles += n; s.giftAt = Date.now(); });
    Audio.sfx('gift');
    if (Save.get().settings.flicker) this.cameras.main.flash(200, 255, 159, 208);
    const t = text(this, W / 2, 230, `+${n} CANDLES`, 24, '#ffd75e').setStroke('#07060d', 6);
    this.tweens.add({ targets: t, y: 190, alpha: 0, duration: 1400, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
    this.refresh();
  }

  // iPhone Safari has no fullscreen for pages. The only way is the home screen web app,
  // so on iOS this shows how; everywhere else it uses the normal fullscreen API.
  fullscreen() {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = window.navigator.standalone === true
      || window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
    if (ios && !standalone) { this.showIosHelp(); return; }
    try {
      if (this.scale.isFullscreen) this.scale.stopFullscreen();
      else this.scale.startFullscreen();
    } catch (e) { /* not allowed here */ }
  }

  showIosHelp() {
    const lines = [
      'FULLSCREEN ON IPHONE',
      '',
      '1. TAP THE SHARE BUTTON',
      '   (SQUARE WITH ARROW UP)',
      '2. TAP "ADD TO HOME SCREEN"',
      '3. TAP "ADD"',
      '4. OPEN GHOSTLINE FROM',
      '   YOUR HOME SCREEN',
    ];
    const objs = [this.add.rectangle(0, 0, W, H, 0x07060d).setOrigin(0).setAlpha(0.94).setInteractive()];
    lines.forEach((l, i) => objs.push(text(this, W / 2, 50 + i * 28, l, 16, i === 0 ? '#ffd75e' : '#e6f0ff')));
    objs.push(text(this, W / 2, 284, 'USE THE GITHUB.IO LINK IN SAFARI', 8, '#a99fd0'));
    const ok = button(this, W / 2, 322, 'GOT IT', () => this.closeModal(), { w: 180, h: 34 });
    ok.focus(true);
    this.modal = { objs, ok };
  }

  closeModal() {
    if (!this.modal) return;
    this.modal.objs.forEach((o) => o.destroy());
    this.modal.ok.destroy();
    this.modal = null;
    this.inputMap.claimPointers();
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
    const creative = save.mode === 'creative';
    const daily = save.mode === 'daily';
    this.modeBtn.setLabel(creative ? 'CREATIVE' : daily ? 'DAILY' : 'NORMAL');
    if (creative) this.modeBtn.setColors(0x1d3a3a, 0x7fe0c0);
    else if (daily) this.modeBtn.setColors(0x1f2a4a, 0x6fb7ff);
    else this.modeBtn.setColors(0x2a1f4a, 0x8f7fbf);
    this.subtitle.setText(creative ? "CREATIVE MODE: YOU CAN'T LOSE"
      : daily ? 'DAILY HAUNT: SAME LEVEL ALL DAY, RACE YOUR GHOST' : "DON'T LET GO");
    const todayBest = save.daily.date === todayKey() ? save.daily.best : 0;
    if (daily) this.bestText.setText(`TODAY ${todayBest}M`);
    this.missionsBtn.setLabel('MISSIONS');
    this.charmsBtn.setLabel(`CHARMS ${save.charms.equipped.length}/2`);
    this.refreshGift();
    const cx = Math.floor(save.creative.x / PX_PER_METER);
    const playLabel = creative && cx > 0 ? `CONTINUE ${cx}M` : daily ? 'PLAY DAILY' : 'PLAY';
    if (owned) this.mainBtn.setLabel(playLabel).setColors(0x2a1f4a, 0x8f7fbf);
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
