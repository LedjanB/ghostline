// OPENING PRELUDE V3 (review only: ?opening=1&prelude=1). Built on the two approved concept frames
// (assets/reference/Ghostline_St_Mercy_Exterior_Concept_01.png, Ghostline_Ward4_Corridor_Concept_01.png),
// shown 1:1 at the game's 640x360 with a fixed camera: their compositions are kept exactly.
//   1 ST. MERCY in the storm (5.4 s): fade up from black. Live rain over the painted rain, the wet ground's warm
//     reflections shimmer, the lantern by the sign breathes, the porch light hums.
//   2 dip to black, then THE CORRIDOR to Ward 4 (3.8 s): the tube overhead is dying, its reflection on the wet
//     floor dies with it; the far exit light pulses; dust in the light.
//   3 fade to black, then OpeningV2Scene: Bed 7 on the approved Ward 4 art (3:32 -> 3:33 -> the separation).
// All motion is in the light and the weather, never the camera (fractional pans shimmered at 640x360).
// Not playable: the gate (audio needs a gesture), then a tap/key skips after 1 s. No save writes.
import { W, H } from '../data.js';
import { Audio } from '../audio.js';
import { text } from '../ui.js';
import { makeOpeningAudio } from '../opening-audio.js';

export const PRELUDE = { EXT_T: 5.4, DIP_MS: 260, CORR_T: 3.8, FADE_MS: 750, NEXT: 'openingv2' };
// light sources measured in the concept frames (px)
const EXT_LIGHTS = {
  lantern: { x: 73, y: 349, tint: 0xffa04a },          // by the ST. MERCY sign
  porch: { x: 446, y: 238, tint: 0xffb067 },           // over the entrance
  wards: [{ x: 600, y: 129 }, { x: 485, y: 195 }],     // two lit ward windows, upper right
};
const REFLECT = [{ x: 437, y: 298, w: 21, h: 62 }, { x: 615, y: 317, w: 14, h: 43 }]; // porch + ambulance in the wet
const TUBE = { x: 315, y: 33, w: 108, h: 12, floor: { x: 362, y: 300, w: 32, h: 60 } };
const EXIT = { x: 377, y: 166 };
const CONE = { x0: 300, x1: 440, y0: 46, y1: 250 };   // the tube's light, where dust shows

export class PreludeScene extends Phaser.Scene {
  constructor() { super('prelude'); }

  init() {
    this.shot = 'gate'; this.t = 0; this.shotT = 0; this.leaving = false;
    this.drops = []; this.dust = []; this.tube = 1; this.nextFlick = 1.0; this.flickLeft = 0;
  }

  preload() {
    const p = 'assets/opening-prelude/';
    this.load.image('pre_ext', p + 'st-mercy-exterior.png');
    this.load.image('pre_corr', p + 'ward4-corridor.png');
    this.load.image('pre_glow', p + 'soft-glow.png');
  }

  create() {
    this.cameras.main.setBackgroundColor('#000000').setScroll(0, 0);
    const glow = (x, y, tint, sx, sy, d) => this.add.image(x, y, 'pre_glow').setTint(tint).setScale(sx, sy).setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(d);
    // ---- shot 1: the exterior ----
    this.ext = this.add.image(0, 0, 'pre_ext').setOrigin(0).setDepth(0);
    // the wet ground's reflections: the concept's own pixels, nudged sideways a pixel at a time like ripples
    this.ripples = REFLECT.map((r, i) => {
      const key = 'pre_ext';
      if (!this.textures.get(key).has('ref' + i)) this.textures.get(key).add('ref' + i, 0, r.x, r.y, r.w, r.h);
      return this.add.image(r.x, r.y, key, 'ref' + i).setOrigin(0).setDepth(0.5).setAlpha(0.55);
    });
    this.lantern = glow(EXT_LIGHTS.lantern.x, EXT_LIGHTS.lantern.y, EXT_LIGHTS.lantern.tint, 0.55, 0.55, 1);
    this.porch = glow(EXT_LIGHTS.porch.x, EXT_LIGHTS.porch.y, EXT_LIGHTS.porch.tint, 0.5, 0.5, 1);
    this.wards = EXT_LIGHTS.wards.map((w) => glow(w.x, w.y, 0xffa85a, 0.32, 0.38, 1));
    this.rainG = this.add.graphics().setDepth(2);
    this.extGroup = [this.ext, ...this.ripples, this.lantern, this.porch, ...this.wards, this.rainG];
    // ---- shot 2: the corridor ----
    this.corr = this.add.image(0, 0, 'pre_corr').setOrigin(0).setDepth(0);
    const t = TUBE, f = TUBE.floor;
    // when the tube drops out: its panel and its stripe on the wet floor go dark, the ceiling glow with them
    this.tubeDark = [
      this.add.rectangle(t.x, t.y, t.w, t.h, 0x0b1119).setOrigin(0).setDepth(1),
      this.add.image(f.x + f.w / 2, f.y + f.h / 2, 'pre_glow').setTint(0x05080e).setScale(0.42, 0.75).setDepth(1), // soft edges on the wet floor
    ];
    this.tubeHalo = glow(t.x + t.w / 2, t.y + 30, 0xbcd8ff, 1.6, 0.6, 1.1);
    this.tubeFloor = glow(f.x + f.w / 2, f.y + 30, 0x9cc4ff, 0.45, 0.9, 1.1);
    this.exitL = glow(EXIT.x, EXIT.y, 0xff3a3a, 0.28, 0.22, 1.1);
    this.dustG = this.add.graphics().setDepth(2);
    this.corrGroup = [this.corr, ...this.tubeDark, this.tubeHalo, this.tubeFloor, this.exitL, this.dustG];
    this.showGroup(this.extGroup, false); this.showGroup(this.corrGroup, false);
    // gate (same words as the opening's: the first gesture also starts the sound)
    this.gate = [
      text(this, W / 2, H / 2 - 10, 'PRESS ANY KEY OR TAP', 8, '#a8b0d0').setDepth(9),
      text(this, W / 2, H / 2 + 14, 'HEADPHONES ON', 8, '#4a5070').setDepth(9),
    ];
    const r = new Phaser.Math.RandomDataGenerator(['st-mercy']);
    this.rand = r;
    for (let i = 0; i < 150; i++) {
      const near = i < 40;
      this.drops.push({ x: r.between(-30, W + 60), y: r.between(-20, H), v: near ? r.between(560, 680) : r.between(360, 460),
        len: near ? r.between(10, 15) : r.between(5, 8), a: near ? 0.22 : 0.13 });
    }
    for (let i = 0; i < 26; i++) this.dust.push({ x: r.between(CONE.x0, CONE.x1), y: r.between(CONE.y0, CONE.y1), vx: r.realInRange(-2, 2), vy: r.realInRange(1, 4), ph: r.frac() * 6.28 });
    const go = () => { if (this.shot === 'gate') this.begin(); else if (this.t > 1 && !this.leaving) this.leave(300); };
    this.input.on('pointerdown', go);
    this.input.keyboard.on('keydown', go);
    this.events.once('shutdown', () => { if (this.snd) this.snd.stop(); if (window.__prelude === this) window.__prelude = null; });
    window.__prelude = this; // tests + shots
    if (Audio.running()) this.begin();
  }

  showGroup(g, on) { g.forEach((o) => o.setVisible(on)); }

  begin() {
    this.gate.forEach((g) => g.setVisible(false));
    this.snd = makeOpeningAudio();
    if (this.snd) this.snd.rain(0.65, false, 1.4);
    this.shot = 'exterior'; this.shotT = 0;
    this.showGroup(this.extGroup, true);
    this.cameras.main.fadeIn(1300, 0, 0, 0);
  }

  toCorridor() {
    this.shot = 'dip'; this.shotT = 0;
    const cam = this.cameras.main;
    cam.fadeOut(PRELUDE.DIP_MS, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      this.shot = 'corridor'; this.shotT = 0;
      this.showGroup(this.extGroup, false); this.showGroup(this.corrGroup, true);
      if (this.snd) { this.snd.rain(0.2, true, 0.2); this.snd.vent(true); }
      cam.fadeIn(PRELUDE.DIP_MS + 140, 0, 0, 0);
    });
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
    const T = this.t;
    if (this.shot === 'exterior') {
      // ripples: each reflection steps a pixel left/right on its own slow beat (whole pixels only)
      this.ripples.forEach((im, i) => { const r = REFLECT[i]; im.x = r.x + Math.round(Math.sin(T * (2.3 + i) + i) * 1.2); im.setAlpha(0.45 + 0.15 * Math.sin(T * 3.1 + i)); });
      this.lantern.setAlpha(0.22 + 0.05 * Math.sin(T * 5.3) + 0.03 * Math.sin(T * 13.7));
      this.porch.setAlpha(0.14 + 0.02 * Math.sin(T * 9.1));
      this.wards.forEach((w, i) => w.setAlpha(0.07 + 0.03 * Math.sin(T * 0.9 + i * 2)));
      this.drawRain(dt);
      if (this.shotT >= PRELUDE.EXT_T) this.toCorridor();
    } else if (this.shot === 'corridor') {
      // the dying tube: steady, then a short struggle (two or three drop-outs), then steady again
      this.nextFlick -= dt;
      if (this.nextFlick <= 0 && this.flickLeft <= 0) { this.flickLeft = 0.45 + this.rand.frac() * 0.25; this.nextFlick = 1.4 + this.rand.frac() * 0.8; }
      if (this.flickLeft > 0) {
        this.flickLeft -= dt;
        this.tube = Math.sin(this.flickLeft * 38) > 0.2 ? 0.25 : 0.9;
      } else this.tube += (1 - this.tube) * Math.min(1, dt * 8);
      const off = 1 - this.tube;
      this.tubeDark[0].setAlpha(off * 0.8); this.tubeDark[1].setAlpha(off * 0.9);
      this.tubeHalo.setAlpha(this.tube * 0.1); this.tubeFloor.setAlpha(this.tube * 0.08);
      this.exitL.setAlpha(0.16 + 0.1 * (0.5 + 0.5 * Math.sin(T * 1.6)));
      this.drawDust(dt);
      if (this.shotT >= PRELUDE.CORR_T) this.leave();
    }
  }

  // rain over the painted rain: two depths, slanted with the storm (the concept's own rain runs down-left)
  drawRain(dt) {
    const g = this.rainG;
    g.clear();
    for (const d of this.drops) {
      d.y += d.v * dt; d.x -= d.v * 0.1 * dt;
      if (d.y > H + 10) { d.y = this.rand.between(-30, -5); d.x = this.rand.between(-30, W + 60); }
      g.lineStyle(1, 0xb4c8e6, d.a);
      g.lineBetween(Math.round(d.x), Math.round(d.y), Math.round(d.x + d.len * 0.1), Math.round(d.y - d.len));
    }
  }

  // dust turning slowly in the tube's light; it goes with the light
  drawDust(dt) {
    const g = this.dustG;
    g.clear();
    for (const p of this.dust) {
      p.x += (p.vx + Math.sin(this.t + p.ph) * 1.5) * dt; p.y += p.vy * dt;
      if (p.y > CONE.y1) { p.y = CONE.y0; p.x = this.rand.between(CONE.x0, CONE.x1); }
      const k = 1 - (p.y - CONE.y0) / (CONE.y1 - CONE.y0);
      g.fillStyle(0xcfe0ff, 0.28 * k * this.tube);
      g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
  }
}
