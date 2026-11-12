// OPENING V4, PART 1 (review only: ?opening=1&prelude=1): St. Mercy is alive, then the corridor to Ward 4.
// Approved concept frames 1:1 at 640x360, fixed camera; the action comes from small strips cut from the art itself
// (assets/opening-v4/*, scripts/opening-v4-layers.py): someone behind the lit glass, a light going out.
//   0.0  EXTERIOR fades up. Storm, heavy rain.
//   1.2  someone crosses behind the lit entrance doors (the hospital is open, staffed)
//   3.3  a shadow passes in the warmest ward window, upper right (people up there, awake at this hour)
//   5.4  hard cut inside, on the sound: the rain drops to muffled, the ventilation hum takes over
//   5.9  CORRIDOR: someone crosses behind the amber door glass ... 8.0  their light goes out, a latch
//   9.6  a heart monitor's beep, ahead of the picture ... 10.2 hard cut into Bed 7 (OpeningV2Scene), same sound bed
// Not playable: the gate (audio needs a gesture), then a tap/key skips after 1 s. No save writes.
import { W, H } from '../data.js';
import { Audio } from '../audio.js';
import { text } from '../ui.js';
import { makeOpeningAudio } from '../opening-audio.js';
import { preloadBed7 } from './opening-v2.js';

export const PRELUDE = { NEXT: 'openingv2', CUT_IN: 5.4, CUT_ROOM: 10.2 };
const STRIPS = { // from assets/opening-v4/layers.json: where each strip sits on its concept, frame count
  entrance: { key: 'v4_entrance', x: 428, y: 246, w: 38, h: 50, n: 20, t0: 1.2, dur: 1.8 },
  ward: { key: 'v4_ward', x: 588, y: 113, w: 26, h: 33, n: 14, t0: 3.3, dur: 1.2 },
  door: { key: 'v4_door', x: 578, y: 80, w: 50, h: 128, n: 18, t0: 5.9, dur: 1.7, out: 8.0 },
};
const EXT_LIGHTS = { lantern: { x: 73, y: 349 }, porch: { x: 446, y: 238 } };
const REFLECT = [{ x: 437, y: 298, w: 21, h: 62 }, { x: 615, y: 317, w: 14, h: 43 }]; // porch + ambulance in the wet
const DOOR_FLOOR = { x: 600, y: 300 };                                                  // that door's warm floor reflection
const TUBE = { x: 315, y: 33, w: 108, h: 12, floor: { x: 362, y: 300, w: 32, h: 60 } };
const EXIT = { x: 377, y: 166 };

export class PreludeScene extends Phaser.Scene {
  constructor() { super('prelude'); }

  init() {
    this.shot = 'gate'; this.t = 0; this.leaving = false; this.drops = []; this.tl = [];
    this.tube = 1;
  }

  preload() {
    const p = 'assets/opening-prelude/', v = 'assets/opening-v4/';
    this.load.image('pre_ext', p + 'st-mercy-exterior.png');
    this.load.image('pre_corr', p + 'ward4-corridor.png');
    this.load.image('pre_glow', p + 'soft-glow.png');
    for (const [k, f] of [['v4_entrance', 'ext-entrance'], ['v4_ward', 'ext-ward'], ['v4_door', 'corr-door']]) {
      const s = Object.values(STRIPS).find((x) => x.key === k);
      this.load.spritesheet(k, v + f + '.png', { frameWidth: s.w, frameHeight: s.h });
    }
    preloadBed7(this); // so the cut into Bed 7 is a straight cut, nothing left to load
  }

  create() {
    this.cameras.main.setBackgroundColor('#000000').setScroll(0, 0);
    const glow = (x, y, tint, sx, sy, d, blend = Phaser.BlendModes.ADD) => this.add.image(x, y, 'pre_glow').setTint(tint)
      .setScale(sx, sy).setAlpha(0).setBlendMode(blend).setDepth(d);
    const strip = (s) => this.add.sprite(s.x, s.y, s.key, 0).setOrigin(0).setDepth(0.6).setVisible(false);
    // ---- exterior ----
    this.ext = this.add.image(0, 0, 'pre_ext').setOrigin(0).setDepth(0);
    this.ripples = REFLECT.map((r, i) => {
      if (!this.textures.get('pre_ext').has('ref' + i)) this.textures.get('pre_ext').add('ref' + i, 0, r.x, r.y, r.w, r.h);
      return this.add.image(r.x, r.y, 'pre_ext', 'ref' + i).setOrigin(0).setDepth(0.5).setAlpha(0.5);
    });
    this.entrance = strip(STRIPS.entrance);
    this.ward = strip(STRIPS.ward);
    this.lantern = glow(EXT_LIGHTS.lantern.x, EXT_LIGHTS.lantern.y, 0xffa04a, 0.55, 0.55, 1);
    this.porch = glow(EXT_LIGHTS.porch.x, EXT_LIGHTS.porch.y, 0xffb067, 0.5, 0.5, 1);
    this.rainG = this.add.graphics().setDepth(2);
    this.extGroup = [this.ext, ...this.ripples, this.lantern, this.porch, this.rainG];
    // ---- corridor ----
    this.corr = this.add.image(0, 0, 'pre_corr').setOrigin(0).setDepth(0);
    this.door = strip(STRIPS.door);
    this.doorFloor = glow(DOOR_FLOOR.x, DOOR_FLOOR.y, 0x05080e, 0.7, 0.7, 0.7, Phaser.BlendModes.NORMAL);
    this.tubeDark = this.add.rectangle(TUBE.x, TUBE.y, TUBE.w, TUBE.h, 0x0b1119).setOrigin(0).setAlpha(0).setDepth(1);
    this.tubeFloorDark = glow(TUBE.floor.x + 16, TUBE.floor.y + 30, 0x05080e, 0.42, 0.75, 1, Phaser.BlendModes.NORMAL);
    this.exitL = glow(EXIT.x, EXIT.y, 0xff3a3a, 0.28, 0.22, 1.1);
    this.corrGroup = [this.corr, this.doorFloor, this.tubeDark, this.tubeFloorDark, this.exitL];
    [...this.extGroup, ...this.corrGroup].forEach((o) => o.setVisible(false));
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
    const go = () => { if (this.shot === 'gate') this.begin(); else if (this.t > 1 && !this.leaving) this.toRoom(); };
    this.input.on('pointerdown', go);
    this.input.keyboard.on('keydown', go);
    this.events.once('shutdown', () => { if (this.snd) this.snd.stop(); if (window.__prelude === this) window.__prelude = null; });
    window.__prelude = this; // tests + shots
    if (Audio.running()) this.begin();
  }

  begin() {
    this.gate.forEach((g) => g.setVisible(false));
    this.snd = makeOpeningAudio();
    const s = this.snd;
    if (s) s.rain(0.72, false, 1.2);
    this.shot = 'exterior';
    this.extGroup.forEach((o) => o.setVisible(true));
    this.cameras.main.fadeIn(1000, 0, 0, 0);
    this.tl = [
      [PRELUDE.CUT_IN, () => this.toCorridor()],
      [STRIPS.door.out, () => { s && s.clunk(); }],          // their door latches as the light goes
      [9.6, () => { s && s.beep(); }],                         // Bed 7's monitor, heard before it's seen
      [PRELUDE.CUT_ROOM, () => this.toRoom()],
    ].map(([t, fn]) => ({ t, fn, done: false }));
  }

  toCorridor() {
    this.shot = 'corridor';
    this.extGroup.forEach((o) => o.setVisible(false)); this.entrance.setVisible(false); this.ward.setVisible(false);
    this.corrGroup.forEach((o) => o.setVisible(true));
    if (this.snd) { this.snd.rain(0.22, true, 0.06); this.snd.vent(true); } // the cut is heard: storm -> inside
  }

  // straight cut into Bed 7; the sound bed (muffled rain, vent) carries over
  toRoom() {
    if (this.leaving) return;
    this.leaving = true;
    const snd = this.snd; this.snd = null;
    this.scene.start(PRELUDE.NEXT, { snd, skipped: this.t < PRELUDE.CUT_ROOM - 0.05 });
  }

  // a strip plays its frames over [t0, t0 + dur]; visible only while it acts (or after its light went out)
  play(sprite, s, T) {
    const k = (T - s.t0) / s.dur;
    const after = s.out && T >= s.out;
    if ((k < 0 || k > 1) && !after) { sprite.setVisible(false); return; }
    sprite.setVisible(true);
    if (after) sprite.setFrame(Math.min(s.n + 2, s.n + Math.floor((T - s.out) / 0.08)));
    else sprite.setFrame(Math.min(s.n - 1, Math.floor(k * s.n)));
  }

  update(time, delta) {
    if (this.shot === 'gate') return;
    const dt = Math.min(delta / 1000, 0.05);
    this.t += dt;
    const T = this.t;
    for (const e of this.tl) if (!e.done && T >= e.t) { e.done = true; e.fn(); }
    if (this.leaving) return;
    if (this.shot === 'exterior') {
      this.ripples.forEach((im, i) => { const r = REFLECT[i]; im.x = r.x + Math.round(Math.sin(T * (2.3 + i) + i) * 1.2); im.setAlpha(0.42 + 0.15 * Math.sin(T * 3.1 + i)); });
      this.lantern.setAlpha(0.22 + 0.05 * Math.sin(T * 5.3) + 0.03 * Math.sin(T * 13.7));
      this.porch.setAlpha(0.14 + 0.02 * Math.sin(T * 9.1));
      this.play(this.entrance, STRIPS.entrance, T);
      this.play(this.ward, STRIPS.ward, T);
      this.drawRain(dt);
    } else if (this.shot === 'corridor') {
      this.play(this.door, STRIPS.door, T);
      const out = Math.min(1, Math.max(0, (T - STRIPS.door.out) / 0.3));
      this.doorFloor.setAlpha(out * 0.55);                 // its warm reflection leaves the wet floor
      // the tube holds, with one short struggle as the door goes dark (no strobing)
      const k = T - (STRIPS.door.out + 0.5);
      this.tube = k > 0 && k < 0.42 && Math.sin(k * 40) > 0.1 ? 0.3 : 1;
      this.tubeDark.setAlpha((1 - this.tube) * 0.8); this.tubeFloorDark.setAlpha((1 - this.tube) * 0.9);
      this.exitL.setAlpha(0.16 + 0.1 * (0.5 + 0.5 * Math.sin(T * 1.6)));
    }
  }

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
}
