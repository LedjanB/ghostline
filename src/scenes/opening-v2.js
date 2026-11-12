// OPENING V4, PART 2 · BED 7 (review route only: ?opening=1&prelude=1, after the St. Mercy prelude).
// The approved Ward 4 room (room-plate.png + bed-front.png + near-pipes.png) and the approved Milo sprites at
// Ward 4 size (1.5x). Directed in shots; every camera is fixed on whole pixels at zoom 1 or exactly 2.
//   r0.0  WIDE  3:32. Rain on the glass, the vent, the monitor's beat (carried over the cut from the corridor).
//   r2.4  CLOSE on Milo: asleep, breathing (chest and arm rise), his fingers twitch. Alive.
//   r6.6  CLOSE on the wall clock and the monitor: 3:32 ... r8.0 3:33, and on that frame the power drops.
//         The clock stays lit at 3:33 (frozen, as St. Mercy's clocks are). The vent dies: silence.
//   r8.9  WIDE in the dark. Only the lamp, the window, the rain. Then the monitor finds its battery: the beat returns.
//   r11.4 his spirit shows in his body, sits up out of it, stands, drifts over the footboard; his feet find the floor
//   r16.6 he surfaces (the approved awakening acting), looks around the dark ward
//   r20.5 he looks at his hands (CLOSE insert: they shake) ... r23.4 WIDE as he turns to the bed: his own body,
//         still breathing. Shock. Hold. A slow fade (the review cut ends here; nothing invented beyond it).
// Same story, same separation poses and timing as OpeningScene. Not playable. Production ?opening=1 unchanged.
import { W, H } from '../data.js';
import { text } from '../ui.js';
import { loadMilo, MiloActor, MILO_SLEEP, MILO_ANIMS } from '../milo-sprite.js';
import { makeOpeningAudio } from '../opening-audio.js';

const S = 1.5;                       // Milo on the approved Ward 4 art (WARD_SCALE)
const FLOOR = 335;
const BODY = { x: 216, y: 176 };     // top-left of his sleep frame: head on the pillow, the blanket over his legs
const STAND = { x: 312, y: 262 };    // where his spirit stands up out of the bed, feet at the mattress
const LAND = 488;                    // at the foot of Bed 7: he and his body in one frame
const WINDOW = { left: 452, right: 700, top: 34, bottom: 215 };
const LAMP = { x: 184, y: 194 };
const SCREEN = { x: 336, y: 160, w: 38, h: 23 };   // the monitor's screen in the plate
const TUBES = [{ x: 300, y: 56, w: 100, h: 11 }, { x: 754, y: 56, w: 102, h: 11 }];
const RISE = { lie: 2.0, sit: 1.0, stand: 0.9, drift: 1.3 }; // = opening.js
const RISE_T = RISE.lie + RISE.sit + RISE.stand + RISE.drift;
const F = { lie: 3, sit: 4, ghost: 5 }; // milo-sleep.png frames (+5 = the ghost row)
// camera framings: zoom + the world point at the screen's centre (whole numbers only)
const SHOTS = {
  wide: { zoom: 1, cx: 400, cy: 180 },
  milo: { zoom: 2, cx: 270, cy: 250 },
  clock: { zoom: 2, cx: 352, cy: 150 },
  hands: { zoom: 2, cx: 462, cy: 262 },
};
export const BEATS = { MILO: 2.4, TWITCH: 4.4, CLOCK: 6.6, DROP: 8.0, DARK_WIDE: 8.9, BATTERY: 9.6, BEAT_BACK: 10.2,
  RISE: 11.4, REALIZE: 20.5, HANDS: 20.9, TURN: 23.36, FADE: 27.2, END: 29.4 };
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

// everything Bed 7 needs; the prelude loads it too so its cut into the room is a straight cut
export function preloadBed7(scene) {
  loadMilo(scene);
  const a = 'assets/ward4-bed7/', p = 'assets/opening-prelude/';
  scene.load.image('v2_room', a + 'room-plate.png');
  scene.load.image('v2_bed_front', a + 'bed-front.png');
  scene.load.image('v2_near', a + 'near-pipes.png');
  scene.load.spritesheet('v2_clock', p + 'room-clock.png', { frameWidth: 40, frameHeight: 17 });
  scene.load.image('v2_glow', p + 'soft-glow.png');
  scene.load.spritesheet('v4_lie', 'assets/opening-v4/milo-lie-v4.png', { frameWidth: 128, frameHeight: 84 });
}

export class OpeningV2Scene extends Phaser.Scene {
  constructor() { super('openingv2'); }

  init(data) {
    this.t = 0; this.phase = 'room'; this.shot = 'wide'; this.clockState = '32'; this.rise = -1; this.tl = [];
    this.dark = 0; this.beatT = 0.37; this.hr = 62; this.beating = true; this.battery = false; this.beat = 0;
    this.landed = false; this.drops = []; this.sweep = 0; this.acting = 'none';
    this.sndIn = data && data.snd;
  }

  preload() { preloadBed7(this); }

  create() {
    const glow = (x, y, tint, sc, a, d = 7.5) => this.add.image(x, y, 'v2_glow').setTint(tint).setScale(sc).setAlpha(a).setBlendMode(Phaser.BlendModes.ADD).setDepth(d);
    // ---- the approved room ----
    this.add.image(0, 0, 'v2_room').setOrigin(0).setDepth(0);
    this.rainG = this.add.graphics().setDepth(1);
    this.clock = this.add.image(331, 117, 'v2_clock', 0).setOrigin(0).setDepth(7.2); // above the dark: it stays lit
    this.clockL = glow(351, 125, 0xff3b2e, 0.42, 0.22, 7.3);
    this.monG = this.add.graphics().setDepth(1);
    this.monL = glow(SCREEN.x + SCREEN.w / 2, SCREEN.y + 12, 0x3dff9a, 0.5, 0.12, 1.1);
    // the boy in Bed 7: the approved sleep drawing, breathing (milo-lie-v4.png), under the plate's own blanket
    this.body = this.add.sprite(BODY.x, BODY.y, 'v4_lie', 0).setOrigin(0).setScale(S).setDepth(3);
    this.add.image(265, 226, 'v2_bed_front').setOrigin(0).setDepth(6);
    // ---- the power cut ----
    this.darkR = this.add.rectangle(0, 0, 1065, H, 0x02050d).setOrigin(0).setAlpha(0).setDepth(7);
    this.tubeOff = TUBES.map((r) => this.add.rectangle(r.x, r.y, r.w, r.h, 0x0a1220).setOrigin(0).setAlpha(0).setDepth(7.1));
    this.lampL = [glow(LAMP.x, LAMP.y, 0xffa448, 1.9, 0), glow(LAMP.x + 10, 262, 0xff9a40, 2.6, 0)];
    this.winL = glow(576, 130, 0x5f8fd8, 2.6, 0);
    this.monDark = glow(SCREEN.x + SCREEN.w / 2, SCREEN.y + 14, 0x3dff9a, 0.9, 0);
    // ---- his spirit ----
    this.lie = this.add.sprite(BODY.x, BODY.y, MILO_SLEEP.key, F.lie + F.ghost).setOrigin(0).setScale(S).setAlpha(0).setDepth(7.6);
    this.sit = this.add.sprite(BODY.x, BODY.y, MILO_SLEEP.key, F.sit + F.ghost).setOrigin(0).setScale(S).setAlpha(0).setDepth(7.7);
    this.milo = new MiloActor(this, STAND.x, STAND.y, { ghost: true, scale: S }).setFacing(-1);
    this.milo.play(MILO_ANIMS.op_float ? 'op_float' : 'idle');
    this.milo.sprite.setAlpha(0).setDepth(8);
    this.ghostL = glow(0, 0, 0x8fc0ff, 0.8, 0, 7.9);
    this.ghostPool = glow(0, FLOOR, 0x8fc0ff, 0.8, 0, 7.4).setScale(1.1, 0.22);
    this.add.image(0, 0, 'v2_near').setOrigin(0).setScrollFactor(1.1).setDepth(9);
    this.caption = text(this, 18, H - 30, 'ST. MERCY.  WARD 4.', 8, '#8f9abc', 0).setAlpha(0).setScrollFactor(0).setDepth(20);
    for (let i = 0; i < 70; i++) this.drops.push({ x: WINDOW.left + (i * 29.71) % (WINDOW.right - WINDOW.left), y: WINDOW.top + (i * 41.37) % (WINDOW.bottom - WINDOW.top), v: 150 + (i * 37) % 90, len: 5 + (i % 4) });
    // the sound bed comes over the cut from the corridor; standalone, it starts here
    this.snd = this.sndIn || makeOpeningAudio();
    if (!this.sndIn && this.snd) { this.snd.rain(0.22, true); this.snd.vent(true); }
    this.events.once('shutdown', () => { if (this.snd) this.snd.stop(); if (window.__openingv2 === this) window.__openingv2 = null; });
    window.__openingv2 = this; // tests + shots
    this.frame('wide');

    const s = this.snd, B = BEATS;
    this.tl = [
      [0.6, () => this.tweens.add({ targets: this.caption, alpha: 1, duration: 700 })],
      [B.MILO - 0.5, () => this.tweens.add({ targets: this.caption, alpha: 0, duration: 400 })],
      [B.MILO, () => this.frame('milo')],
      [B.TWITCH, () => { this.twitch = 0.42; s && s.curtain(0.18); }],               // fingers, a whisper of sheet
      [B.CLOCK, () => this.frame('clock')],
      [B.DROP, () => this.powerDrop()],
      [B.DARK_WIDE, () => this.frame('wide')],
      [B.BATTERY, () => { this.battery = true; s && s.batteryChirp(); }],
      [B.BEAT_BACK, () => { this.beating = true; this.beatT = 0; }],                  // his heart, on battery
      [B.RISE, () => { this.rise = 0; s && s.rise(); s && s.pad(0.4, 2.5); }],
      [B.REALIZE, () => { this.acting = 'realize'; this.milo.play(MILO_ANIMS.op_realize ? 'op_realize' : 'realization'); }],
      [B.HANDS, () => { this.frame('hands'); s && s.breath(0.8); }],
      [B.TURN, () => this.frame('wide')],                                             // on his turn to the bed
      [B.TURN + 1.0, () => { s && s.breath(1.1); }],
      [B.FADE, () => { this.cameras.main.fadeOut(2200, 0, 0, 0); s && s.fade(0, 2.4); }],
      [B.END, () => { this.phase = 'end'; }],
    ].map(([t, fn]) => ({ t, fn, done: false }));
  }

  frame(name) { const f = SHOTS[name]; this.shot = name; this.cameras.main.setZoom(f.zoom).centerOn(f.cx, f.cy); }

  // 3:33: the clock turns over and, on that same frame, the ward loses power
  powerDrop() {
    const s = this.snd;
    this.clockState = '33'; this.clock.setFrame(1);
    this.dropAt = this.t;
    this.beating = false;                         // the monitor loses mains: no beat until the battery takes over
    if (s) { s.flip(); s.fail(); s.vent(false); s.rain(0.16, true, 0.25); }
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    this.t += dt;
    for (const e of this.tl) if (!e.done && this.t >= e.t) { e.done = true; e.fn(); }
    if (this.phase === 'end') return;
    const s = this.snd;
    // heartbeat (the monitor) and breath (the body): he is alive the whole time
    if (this.beating) {
      this.beatT -= dt;
      if (this.beatT <= 0) { this.beatT += 60 / this.hr; if (s) s.beep({ battery: this.battery }); this.beat = 1; }
    }
    this.beat = Math.max(0, this.beat - dt * 3);
    const ph = (this.t % 3.4) / 3.4;                       // slow sleep breathing: in 1.5 s, out and rest 1.9 s
    this.twitch = Math.max(0, (this.twitch || 0) - dt);
    const tw = this.twitch > 0 && (this.twitch > 0.3 || this.twitch < 0.12);
    this.body.setFrame(tw ? 2 : ph < 0.44 ? 1 : 0);
    // the power: a two-frame stutter on the drop, then dark
    let d = 0;
    if (this.dropAt !== undefined) {
      const k = this.t - this.dropAt;
      d = k < 0.05 ? 0.7 : k < 0.1 ? 0.15 : Math.min(1, 0.8 + k);
    }
    this.darkR.setAlpha(d * 0.6);
    this.tubeOff.forEach((r) => r.setAlpha(d * 0.85));
    this.lampL[0].setAlpha(d * 0.42); this.lampL[1].setAlpha(d * 0.2);
    this.winL.setAlpha(d * 0.16);
    this.clock.setAlpha(d > 0 ? 0.8 : 1); this.clockL.setAlpha(d > 0 ? 0.14 : 0.22);
    this.monDark.setAlpha(this.battery ? d * (0.14 + this.beat * 0.14) : 0);
    this.monL.setAlpha((1 - d) * (0.08 + this.beat * 0.1));
    this.monG.setVisible(d === 0 || this.battery);
    this.drawRain(dt);
    if (d === 0 || this.battery) this.drawMonitor(dt);
    this.drawSpirit(dt);
    this.milo.update(delta);
  }

  drawRain(dt) {
    const g = this.rainG;
    g.clear(); g.lineStyle(1, 0xa2cbfc, 0.24);
    for (const r of this.drops) {
      r.y += r.v * dt;
      if (r.y > WINDOW.bottom) { r.y = WINDOW.top; r.x = WINDOW.left + (r.x * 3.83) % (WINDOW.right - WINDOW.left); }
      g.lineBetween(Math.round(r.x), Math.round(r.y), Math.round(r.x - 1), Math.round(Math.min(WINDOW.bottom, r.y + r.len)));
    }
  }

  // the ECG redraws left to right: a dark bar sweeps the painted trace, a bright head on each beat
  drawMonitor(dt) {
    const g = this.monG, sc = SCREEN;
    this.sweep = (this.sweep + dt * 22) % sc.w;
    const x = Math.floor(sc.x + this.sweep);
    g.clear();
    g.fillStyle(0x041510, 0.85); g.fillRect(x + 1, sc.y + 1, 3, sc.h - 2);
    g.fillStyle(0x9dffc8, 0.55 + this.beat * 0.45); g.fillRect(x, sc.y + 14 - Math.round(this.beat * 6), 1, 1 + Math.round(this.beat * 5));
  }

  // the separation: the approved poses and timing (OpeningScene.drawGhost), at Ward 4 size
  drawSpirit(dt) {
    const a = this.milo, gs = a.sprite, sh = 0.84 + Math.sin(this.t * 7) * 0.05;
    this.lie.setAlpha(0); this.sit.setAlpha(0);
    if (this.rise >= 0) {
      this.rise += dt;
      const r = this.rise, R1 = RISE.lie, R2 = R1 + RISE.sit, R3 = R2 + RISE.stand;
      if (r < R1) {
        const k = ease(r / R1);
        this.lie.setAlpha(k * 0.75 * sh).setPosition(BODY.x, BODY.y - Math.round(k * 4));
        gs.setAlpha(0); this.glowAt(BODY.x + 80, BODY.y + 80, k * 0.2, 0);
        return;
      }
      if (r < R2) {
        const k = ease((r - R1) / RISE.sit);
        this.lie.setAlpha((1 - k) * 0.75 * sh).setPosition(BODY.x, BODY.y - 4);
        this.sit.setAlpha(k * 0.85 * sh).setPosition(BODY.x, BODY.y - 4 - Math.round(k * 3));
        gs.setAlpha(0); this.glowAt(BODY.x + 98, BODY.y + 50, 0.2, 0);
        return;
      }
      let x, y, alpha = 0.9;
      if (r < R3) {
        const k = ease((r - R2) / RISE.stand);
        this.sit.setAlpha((1 - k) * 0.85 * sh).setPosition(BODY.x, BODY.y - 7 - Math.round(k * 9));
        x = STAND.x; y = STAND.y - k * 9; alpha = k * 0.9;
      } else if (r < RISE_T) {
        const k = ease((r - R3) / RISE.drift);
        x = lerp(STAND.x, LAND, k); y = lerp(STAND.y - 9, FLOOR, k * k) - Math.sin(k * Math.PI) * 18;
      } else {
        this.rise = -1; this.landed = true; x = LAND; y = FLOOR; this.acting = 'wake';
        if (this.snd) this.snd.land();
        a.play(MILO_ANIMS.op_wake ? 'op_wake' : 'awakening');
      }
      a.setFacing(-1); a.x = Math.round(x); a.footY = Math.round(y); a.show();
      gs.setAlpha(alpha * sh);
      this.glowAt(gs.x, gs.y - 70, 0.18, 0.05, y);
      return;
    }
    if (!this.landed) { gs.setAlpha(0); this.glowAt(0, 0, 0, 0); return; }
    gs.setAlpha(0.9 * sh);
    this.glowAt(gs.x, gs.y - 70, 0.16 + Math.sin(this.t * 2) * 0.03, 0.14, FLOOR);
  }

  glowAt(x, y, a, pa, feet = FLOOR) {
    this.ghostL.setPosition(x, y).setAlpha(a);
    this.ghostPool.setPosition(x, Math.max(FLOOR + 1, feet + 1)).setAlpha(pa);
  }
}
