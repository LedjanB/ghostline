// Title screen + character shop. Works with mouse, touch, keyboard and gamepad.
import { W, H, CHARACTERS, PX_PER_METER, GIFT_HOURS, ZONES } from '../data.js';
import { ZoneLayers } from '../zones.js';
import { WorldLook } from '../looks.js';
import { LOOKS, owned as ownedItems, PAGES } from '../unlocks.js';
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

    // the menu shows the deepest place you have reached
    const deepest = ZONES[Math.min(ZONES.length - 1, save.stats?.maxZone || 0)];
    this.layers = new ZoneLayers(this, deepest.id, -100);
    this.menuScroll = 0;
    this.add.image(W / 2, H / 2 + 20, 'dark').setScale(2).setAlpha(0.78);

    this.add.image(W / 2, 48, 'glow').setScale(5, 1.6).setBlendMode(Phaser.BlendModes.ADD).setTint(0x6f8fff).setAlpha(0.35);
    this.title = text(this, W / 2, 48, 'GHOSTLINE', 32, '#cfe0ff').setStroke('#07060d', 6);
    this.subtitle = text(this, W / 2, 78, '', 16, '#8f7fbf').setStroke('#07060d', 4);
    this.ghost = this.add.sprite(W / 2 + 196, 44, 'ghost0').setScale(2).setAlpha(0.9);
    this.ghost.play('ghost_float');
    this.hat = this.add.image(W / 2 + 196, 44, 'ghost0').setScale(2).setOrigin(0.5, 1).setVisible(false);
    this.tweens.add({ targets: this.ghost, y: 56, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.time.addEvent({
      delay: 2600, loop: true,
      callback: () => { if (Save.get().settings.flicker) this.tweens.add({ targets: this.title, alpha: 0.3, duration: 50, yoyo: true, repeat: 2 }); },
    });

    this.add.image(24, 20, 'candle0').setScale(1.5);
    this.candleText = text(this, 40, 20, '', 16, '#ffd75e', 0).setStroke('#07060d', 4);
    this.bestText = text(this, W - 50, 20, '', 16, '#a99fd0', 1).setStroke('#07060d', 4);
    // the long goal, always in view: the door at the end of world 8 needs every journal page
    this.doorText = text(this, W - 50, 40, '', 8, '#fff2b0', 1).setStroke('#07060d', 3);

    this.add.image(W / 2, 148, 'glow').setScale(2.4).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb060).setAlpha(0.25);
    this.charSprite = this.add.sprite(W / 2, 140, 'survivor_run0').setScale(4);
    this.nameText = text(this, W / 2, 188, '', 16, '#e6f0ff').setStroke('#07060d', 4);
    this.perkText = text(this, W / 2, 208, '', 16, '#a99fd0').setStroke('#07060d', 4);
    this.lookText = text(this, W / 2 + 140, 172, '', 8, '#ffb0d8').setStroke('#07060d', 3);
    this.dots = CHARACTERS.map((c, i) => this.add.rectangle(W / 2 - 27 + i * 18, 225, 8, 8, 0x3a2f5a));

    button(this, W / 2 - 140, 140, '<', () => this.browse(-1), { w: 44, h: 44 });
    button(this, W / 2 + 140, 140, '>', () => this.browse(1), { w: 44, h: 44 });

    this.mainBtn = button(this, W / 2, 258, 'PLAY', () => this.mainAction(), { w: 300, h: 38, silent: true });
    this.missionsBtn = button(this, 112, 302, 'MISSIONS', () => this.overlay('missions'), { w: 196, h: 30, icon: 'icon_star' });
    this.charmsBtn = button(this, 320, 302, 'CHARMS', () => this.overlay('charms'), { w: 196, h: 30, icon: 'icon_charm' });
    this.giftBtn = button(this, 528, 302, 'GIFT', () => this.claimGift(), { w: 196, h: 30, silent: true });
    this.modeBtn = button(this, 112, 340, '', () => this.toggleMode(), { w: 196, h: 30, icon: 'ghost0', iconScale: 1 });
    this.settingsBtn = button(this, 320, 340, 'SETTINGS', () => this.openSettings(), { w: 196, h: 30, icon: 'icon_gear' });
    this.unlocksBtn = button(this, 528, 340, 'UNLOCKS', () => this.overlay('unlocks'), { w: 196, h: 30, icon: 'hat_top', iconScale: 1.6 });
    this.fullBtn = button(this, W - 22, 20, '', () => this.fullscreen(), { w: 30, h: 26, icon: 'icon_full', iconScale: 2 });
    this.fullBtn.icon.x = W - 22;
    this.group = focusGroup(this, [this.mainBtn, this.missionsBtn, this.charmsBtn, this.giftBtn, this.modeBtn, this.settingsBtn, this.unlocksBtn, this.fullBtn]);
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.refreshGift() });

    this.inputMap = createInput(this);
    this.hint = text(this, W / 2, 98, '', 8, '#6f6590');
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
    this.hat.setPosition(this.ghost.x, this.ghost.y - 11);
    this.menuScroll += 60 * m;
    this.layers.render(this.menuScroll, null);
    if (this.look) this.look.step(m, 60);
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
    const order = Save.get().ending.seen ? ['normal', 'endless', 'daily', 'creative'] : ['normal', 'daily', 'creative'];
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
      this.giftBtn.setLabel(`${h}H ${m}M`).setColors(0x1d1a26, 0x4a4560);
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
    const endless = save.mode === 'endless';
    this.modeBtn.setLabel(creative ? 'CREATIVE' : daily ? 'DAILY' : endless ? 'ENDLESS' : 'NORMAL');
    if (endless) this.modeBtn.setColors(0x3a3010, 0xfff2b0);
    else if (creative) this.modeBtn.setColors(0x1d3a3a, 0x7fe0c0);
    else if (daily) this.modeBtn.setColors(0x1f2a4a, 0x6fb7ff);
    else this.modeBtn.setColors(0x2a1f4a, 0x8f7fbf);
    this.subtitle.setText(creative ? "CREATIVE: YOU CAN'T LOSE"
      : daily ? 'DAILY: RACE TODAY\'S GHOST' : endless ? 'ENDLESS: BEYOND THE DOOR' : save.ending.seen ? 'THE DOOR IS OPEN' : "DON'T LOOK BACK");
    const todayBest = save.daily.date === todayKey() ? save.daily.best : 0;
    if (daily) this.bestText.setText(`TODAY ${todayBest}M`);
    const pages = ownedItems(save.unlocks.got).pages.length;
    this.doorText.setText(save.ending.seen ? 'THE DOOR IS OPEN' : pages ? `THE DOOR: ${pages}/${PAGES.length} PAGES` : '');
    this.missionsBtn.setLabel('MISSIONS');
    const fresh = save.unlocks.fresh;
    this.unlocksBtn.setLabel(fresh ? `NEW! (${fresh})` : 'UNLOCKS');
    if (fresh) this.unlocksBtn.setColors(0x4a1f4a, 0xff9fd0); else this.unlocksBtn.setColors(0x2a1f4a, 0x8f7fbf);
    // Crossy Road: the world takes on the look of whoever you're browsing
    if (this.lookFor !== c.id) {
      this.lookFor = c.id;
      if (this.look) this.look.destroy();
      this.look = new WorldLook(this, c.id, -100);
      this.layers.setLook(this.look.tint);
      const ln = LOOKS[c.id]?.name;
      this.lookText.setText(ln ? `WORLD: ${ln}` : '');
    }
    const hatId = save.boo.hat;
    if (hatId && hatId !== 'none') this.hat.setTexture(`hat_${hatId}`).setVisible(true); else this.hat.setVisible(false);
    this.charmsBtn.setLabel('CHARMS');
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
