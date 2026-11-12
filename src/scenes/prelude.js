// OPENING PRELUDE V2 (review only: ?opening=1&prelude=1). Static shots joined by hard cuts, before Bed 7:
//   1a the tower clock, stopped at 3:33 (as it always has been), close (2x)      1.7 s
//   1b ST. MERCY in the rain, wide: the dark hospital, one warm window            2.6 s
//   1c that window, close (2x): Bed 7's lamp behind the curtain                   1.9 s
//   2  inside: the empty corridor to Ward 4, warm light through its doors, a tube dying overhead   2.8 s
//   3  fade to black, then OpeningV2Scene: Bed 7 on the approved Ward 4 art, 3:32 -> 3:33 -> the separation.
// Every camera is fixed on whole pixels at zoom 1 or 2 (no fractional pans or zooms: they shimmered at 640x360).
// Not playable: the only input is the gate (audio needs a gesture) and a tap/key to skip once a second has passed.
// Art: assets/opening-prelude/*.png (scripts/prelude-art.py). Rain is a live layer in world space, so it moves
// with the camera, not with the screen. No save writes, no global input changes.
import { W, H } from '../data.js';
import { Audio } from '../audio.js';
import { text } from '../ui.js';
import { makeOpeningAudio } from '../opening-audio.js';

export const PRELUDE = { CLOCK_T: 1.7, WIDE_T: 2.6, WINDOW_T: 1.9, CORR_T: 2.8, FADE_MS: 650, NEXT: 'openingv2' };
const EXT = { w: 720, h: 400 };
// camera framings: zoom + the world point at the centre of the screen (whole numbers only)
const FRAMES = {
  clock: { zoom: 2, cx: 390, cy: 92 },
  wide: { zoom: 1, cx: 360, cy: 200 },
  window: { zoom: 2, cx: 560, cy: 226 },
  corridor: { zoom: 1, cx: 340, cy: 190 },
};

export class PreludeScene extends Phaser.Scene {
  constructor() { super('prelude'); }

  init() {
    this.shot = 'gate'; this.t = 0; this.shotT = 0; this.leaving = false;
    this.drops = []; this.splashes = []; this.flick = 0.18; this.nextFlick = 0.8; this.sub = null;
  }

  preload() {
    const p = 'assets/opening-prelude/';
    this.load.image('pre_ext', p + 'st-mercy-exterior.png');
    this.load.image('pre_mist', p + 'st-mercy-mist.png');
    this.load.image('pre_corr', p + 'ward4-corridor.png');
    this.load.image('pre_tube', p + 'ward4-corridor-tube.png');
  }

  create() {
    const cam = this.cameras.main;
    cam.setBackgroundColor('#000000');
    // shot 1
    this.ext = this.add.image(0, 0, 'pre_ext').setOrigin(0).setDepth(0).setVisible(false);
    this.mist = this.add.tileSprite(0, 268, EXT.w, 90, 'pre_mist').setOrigin(0).setDepth(2).setAlpha(0.85).setVisible(false);
    this.rainG = this.add.graphics().setDepth(3).setVisible(false);
    // shot 2
    this.corr = this.add.image(0, 0, 'pre_corr').setOrigin(0).setDepth(0).setVisible(false);
    this.tube = this.add.image(0, 0, 'pre_tube').setOrigin(0).setDepth(1).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    // gate (same words as the opening's: the first gesture also starts the sound)
    this.gate = [
      text(this, W / 2, H / 2 - 10, 'PRESS ANY KEY OR TAP', 8, '#a8b0d0').setScrollFactor(0).setDepth(9),
      text(this, W / 2, H / 2 + 14, 'HEADPHONES ON', 8, '#4a5070').setScrollFactor(0).setDepth(9),
    ];
    const r = new Phaser.Math.RandomDataGenerator(['st-mercy']);
    for (let i = 0; i < 260; i++) {
      const near = i < 70;
      this.drops.push({ x: r.between(-40, EXT.w + 40), y: r.between(-20, EXT.h), v: near ? r.between(520, 640) : r.between(330, 430), len: near ? r.between(9, 14) : r.between(4, 7), a: near ? 0.32 : 0.2 });
    }
    this.rand = r;
    const go = () => { if (this.shot === 'gate') this.begin(); else if (this.t > 1 && !this.leaving) this.leave(250); };
    this.input.on('pointerdown', go);
    this.input.keyboard.on('keydown', go);
    this.events.once('shutdown', () => { if (this.snd) this.snd.stop(); if (window.__prelude === this) window.__prelude = null; });
    window.__prelude = this; // tests + shots
    if (Audio.running()) this.begin();
  }

  begin() {
    this.gate.forEach((g) => g.setVisible(false));
    this.snd = makeOpeningAudio();
    if (this.snd) this.snd.rain(0.62, false, 1.2);
    this.toExterior();
    this.cameras.main.fadeIn(900, 0, 0, 0);
  }

  frame(name) { const f = FRAMES[name]; this.cameras.main.setZoom(f.zoom).centerOn(f.cx, f.cy); }

  toExterior() {
    this.shot = 'exterior'; this.sub = 'clock'; this.shotT = 0;
    this.frame('clock');
    [this.ext, this.mist, this.rainG].forEach((o) => o.setVisible(true));
  }

  toCorridor() {
    this.shot = 'corridor'; this.shotT = 0;
    [this.ext, this.mist, this.rainG].forEach((o) => o.setVisible(false));
    [this.corr, this.tube].forEach((o) => o.setVisible(true));
    this.frame('corridor');
    if (this.snd) { this.snd.rain(0.22, true, 0.15); this.snd.vent(true); }
  }

  leave(ms = PRELUDE.FADE_MS) {
    if (this.leaving) return;
    this.leaving = true;
    const cam = this.cameras.main;
    cam.fadeOut(ms, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      if (this.snd) { this.snd.stop(); this.snd = null; }
      this.scene.start(PRELUDE.NEXT); // Bed 7 on the approved Ward 4 art (review route)
    });
  }

  update(time, delta) {
    if (this.shot === 'gate') return;
    const dt = Math.min(delta / 1000, 0.05);
    this.t += dt; this.shotT += dt;
    if (this.shot === 'exterior') {
      // hard cuts between fixed framings: clock -> wide -> the warm window
      if (this.sub === 'clock' && this.shotT >= PRELUDE.CLOCK_T) { this.sub = 'wide'; this.frame('wide'); }
      if (this.sub === 'wide' && this.shotT >= PRELUDE.CLOCK_T + PRELUDE.WIDE_T) { this.sub = 'window'; this.frame('window'); }
      this.mist.tilePositionX = Math.floor(this.t * 6); // whole pixels
      this.drawRain(dt);
      if (this.shotT >= PRELUDE.CLOCK_T + PRELUDE.WIDE_T + PRELUDE.WINDOW_T) this.toCorridor();
    } else if (this.shot === 'corridor') {
      // the tube over the corridor is dying: dim, with a rare short struggle back to light (no strobing)
      this.nextFlick -= dt;
      if (this.nextFlick <= 0) { this.flick = 0.55 + this.rand.frac() * 0.2; this.nextFlick = 1.1 + this.rand.frac() * 1.2; }
      this.flick += (0.18 - this.flick) * Math.min(1, dt * 6);
      this.tube.setAlpha(this.flick);
      if (this.shotT >= PRELUDE.CORR_T) this.leave();
    }
  }

  // rain in world space: two depths of streaks, slanted by the wind, and small splashes on the street
  drawRain(dt) {
    const g = this.rainG;
    g.clear();
    for (const d of this.drops) {
      d.y += d.v * dt; d.x -= d.v * 0.12 * dt;
      if (d.y > EXT.h) {
        if (d.len > 8 && this.splashes.length < 40) this.splashes.push({ x: d.x, y: this.rand.between(338, 396), t: 0 });
        d.y = this.rand.between(-30, -5); d.x = this.rand.between(-40, EXT.w + 40);
      }
      g.lineStyle(1, 0xa9bedc, d.a);
      g.lineBetween(d.x, d.y, d.x + d.len * 0.12, d.y - d.len);
    }
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const s = this.splashes[i];
      s.t += dt;
      if (s.t > 0.18) { this.splashes.splice(i, 1); continue; }
      g.fillStyle(0xb8c9e2, 0.35 * (1 - s.t / 0.18));
      g.fillRect(s.x - 1 - s.t * 8, s.y, 1, 1); g.fillRect(s.x + s.t * 8, s.y, 1, 1);
    }
  }
}
