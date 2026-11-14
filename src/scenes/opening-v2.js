// OPENING V2 · BED 7 (review route only: ?opening=1&prelude=1 plays the St. Mercy prelude, then this scene).
// The first beat of the opening on the approved Ward 4 art, not the old code-drawn room:
//   room-plate.png (owner-approved), bed-front.png (blanket + footboard over the boy), near-pipes.png in front,
//   the approved Milo sprites at their Ward 4 size (1.5x, same as Ward Lab).
// Same beats and timings as OpeningScene's awakening (src/scenes/opening.js), no story changes:
//   3:32, rain, the monitor; 3:33; the power fails and the ward goes dark (the bedside lamp, the monitor on battery
//   and the window stay); his spirit shows in his body, sits up out of it, stands in the air, drifts down beside
//   the bed, lands and surfaces (the approved awakening acting). Then the review cut ends. Not playable.
// The production opening (first launch, ?opening=1) is unchanged.
import { W, H } from '../data.js';
import { text } from '../ui.js';
import { loadMilo, MiloActor, MILO_SLEEP, MILO_ANIMS } from '../milo-sprite.js';
import { makeOpeningAudio } from '../opening-audio.js';

const S = 1.5;                       // Milo on the approved Ward 4 art (WARD_SCALE)
const FLOOR = 335;
const SHOT_X = 80;                   // one static, whole-pixel frame: lamp, Bed 7, monitor, clock, the window
const BODY = { x: 216, y: 176 };     // top-left of his sleep frame: head on the pillow, the blanket over his legs
const STAND = { x: 312, y: 262 };    // where his spirit stands up out of the bed, feet at the mattress
const LAND = 548;                    // beside the bed, in front of the window (the approved composition)
const WINDOW = { left: 452, right: 700, top: 34, bottom: 215 };
const LAMP = { x: 184, y: 194 };
const SCREEN = { x: 336, y: 160, w: 38, h: 23 };   // the monitor's screen in the plate
const TUBES = [{ x: 300, y: 56, w: 100, h: 11 }, { x: 754, y: 56, w: 102, h: 11 }];
const RISE = { lie: 2.0, sit: 1.0, stand: 0.9, drift: 1.3 }; // = opening.js
const RISE_T = RISE.lie + RISE.sit + RISE.stand + RISE.drift;
const F = { bed: 0, breath: 1, twitch: 2, lie: 3, sit: 4, ghost: 5 }; // approved sleep sheet: five living poses and five ghost poses
// Play the complete approved acting, not just the start of the awakening.
const ACTING_T = ['awakening', 'realization'].reduce((seconds, name) =>
  seconds + MILO_ANIMS[name].frames.reduce((total, frame) => total + frame[1], 0) / 1000, 0);
export const V2 = { SHOT_X, BODY, LAND, RISE_T, R0: 7.2,
  END: 7.2 + RISE_T + ACTING_T + 1.5 };
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

export class OpeningV2Scene extends Phaser.Scene {
  constructor() { super('openingv2'); }

  init() {
    this.t = 0; this.phase = 'room'; this.clockState = '32'; this.rise = -1; this.tl = [];
    this.dark = 0; this.darkT = 0; this.flicker = 0; this.beatT = 0.4; this.hr = 62; this.battery = false;
    this.landed = false; this.drops = []; this.sweep = 0; this.recognitionSeen = false;
  }

  preload() {
    loadMilo(this);
    const a = 'assets/ward4-bed7/', p = 'assets/opening-prelude/';
    this.load.image('v2_room', a + 'room-plate.png');
    this.load.image('v2_bed_front', a + 'bed-front.png');
    this.load.image('v2_near', a + 'near-pipes.png');
    this.load.spritesheet('v2_clock', p + 'room-clock.png', { frameWidth: 40, frameHeight: 17 });
    this.load.image('v2_glow', p + 'soft-glow.png');
  }

  create() {
    const cam = this.cameras.main;
    cam.setBackgroundColor('#000000').setScroll(SHOT_X, 0);
    const glow = (x, y, tint, sc, a, d = 7.5) => this.add.image(x, y, 'v2_glow').setTint(tint).setScale(sc).setAlpha(a).setBlendMode(Phaser.BlendModes.ADD).setDepth(d);
    // ---- the approved room ----
    this.add.image(0, 0, 'v2_room').setOrigin(0).setDepth(0);
    this.rainG = this.add.graphics().setDepth(1);
    this.clock = this.add.image(331, 117, 'v2_clock', 0).setOrigin(0).setDepth(1);
    this.clockL = glow(351, 125, 0xff3b2e, 0.42, 0.22, 1.1);
    this.monG = this.add.graphics().setDepth(1);
    this.monL = glow(SCREEN.x + SCREEN.w / 2, SCREEN.y + 12, 0x3dff9a, 0.5, 0.12, 1.1);
    // the boy in Bed 7 (asleep, the approved sleep drawing), under the plate's own blanket
    this.body = this.add.sprite(BODY.x, BODY.y, MILO_SLEEP.key, F.bed).setOrigin(0).setScale(S).setDepth(3);
    this.add.image(265, 226, 'v2_bed_front').setOrigin(0).setDepth(6);
    // ---- the power cut: the ward goes dark, then the lights that stay are added back ----
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
    this.ghostL = glow(0, 0, 0x8fc0ff, 0.9, 0, 7.9);
    this.ghostPool = glow(0, FLOOR, 0x8fc0ff, 0.8, 0, 7.4).setScale(1.2, 0.25);
    this.add.image(0, 0, 'v2_near').setOrigin(0).setScrollFactor(1.1).setDepth(9);
    // ---- screen ----
    this.caption = text(this, 18, H - 30, '', 8, '#8f9abc', 0).setAlpha(0).setScrollFactor(0).setDepth(20);
    this.endT = text(this, W / 2, H / 2, '', 8, '#6f7a9a').setScrollFactor(0).setDepth(21);
    for (let i = 0; i < 70; i++) this.drops.push({ x: WINDOW.left + (i * 29.71) % (WINDOW.right - WINDOW.left), y: WINDOW.top + (i * 41.37) % (WINDOW.bottom - WINDOW.top), v: 150 + (i * 37) % 90, len: 5 + (i % 4) });
    this.snd = makeOpeningAudio();
    this.events.once('shutdown', () => { if (this.snd) this.snd.stop(); if (window.__openingv2 === this) window.__openingv2 = null; });
    window.__openingv2 = this; // tests + shots

    // ---- the beats (same times as OpeningScene.begin) ----
    const s = this.snd;
    const cap = (str, a, ms = 900) => { if (str !== null) this.caption.setText(str); this.tweens.add({ targets: this.caption, alpha: a, duration: ms }); };
    this.run([
      [0, () => { if (s) { s.rain(0.45, true); s.vent(true); } cam.fadeIn(1100, 0, 0, 0); }],
      [2.0, () => cap('ST. MERCY.  WARD 4.', 1)],
      [3.4, () => { this.clockState = '33'; this.clock.setFrame(1); s && s.flip(); this.caption.setText('ST. MERCY.  WARD 4.  3:33 AM'); }],
      [4.6, () => { s && s.fail(); this.flicker = 0.62; }],
      [5.22, () => {
        this.flicker = 0; this.darkT = 1; this.clockState = 'off'; this.clock.setFrame(2); this.clockL.setAlpha(0);
        cap(null, 0, 700); s && s.rain(0.55, true, 1.5);
      }],
      [5.65, () => { this.battery = true; s && s.batteryChirp(); }],
      [6.15, () => { s && s.clunk(); this.lampDip = 0.35; }], // the bedside lamp stutters, and stays
      [V2.R0, () => { this.rise = 0; s && s.rise(); s && s.pad(0.55, 2); }],
      [V2.R0 + RISE_T + 0.8, () => { s && s.beep({ loud: true }); }], // the body: still alive
      [V2.END, () => { this.phase = 'leaving'; cam.fadeOut(1400, 0, 0, 0); s && s.fade(0, 1.2); }],
      [V2.END + 1.6, () => { this.phase = 'end'; this.endT.setText(''); cam.resetFX(); cam.setBackgroundColor('#000000'); this.hideRoom(); }],
    ]);
  }

  run(list) { this.tl = list.map(([t, fn]) => ({ t, fn, done: false })); }

  hideRoom() { this.children.list.forEach((o) => { if (o !== this.endT) o.setVisible(false); }); this.endT.setVisible(true); }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    this.t += dt;
    // The living Milo continues breathing after his spirit separates.
    // Use the existing hand-drawn sleep-frame variations; never warp the room or actor.
    const breathPhase = this.t % 3.8;
    const bodyTwitch = (this.t >= 2.55 && this.t < 2.80) ||
      (this.t >= 14.70 && this.t < 14.95);
    const bodyPose = bodyTwitch ? F.twitch : breathPhase < 1.9 ? F.bed : F.breath;
    if (Number(this.body.frame.name) !== bodyPose) this.body.setFrame(bodyPose);
    for (const e of this.tl) if (!e.done && this.t >= e.t) { e.done = true; e.fn(); }
    if (this.phase === 'end') return;
    const s = this.snd;
    // the heart monitor (battery after the cut)
    this.beatT -= dt;
    if (this.beatT <= 0) { this.beatT += 60 / this.hr; if (s) s.beep({ battery: this.battery }); this.beat = 1; }
    this.beat = Math.max(0, (this.beat || 0) - dt * 3);
    // the power: a stutter, then dark
    let d = (this.dark += (this.darkT - this.dark) * Math.min(1, dt * 5));
    if (this.flicker > 0) { this.flicker -= dt; d = Math.random() < 0.45 ? 0.55 : 0.08; }
    this.darkR.setAlpha(d * 0.58);
    this.tubeOff.forEach((r) => r.setAlpha(d * 0.85));
    this.lampDip = Math.max(0, (this.lampDip || 0) - dt);
    const lamp = d * (this.lampDip > 0 && Math.sin(this.lampDip * 60) > 0 ? 0.35 : 1);
    this.lampL[0].setAlpha(lamp * 0.42); this.lampL[1].setAlpha(lamp * 0.2);
    this.winL.setAlpha(d * 0.16);
    this.monDark.setAlpha(d * (0.16 + this.beat * 0.12));
    this.monL.setAlpha((1 - d) * (0.08 + this.beat * 0.1));
    this.drawRain(dt);
    this.drawMonitor(dt);
    this.drawSpirit(dt);
    this.milo.update(delta);
  }

  drawRain(dt) {
    const g = this.rainG;
    g.clear(); g.lineStyle(1, 0xa2cbfc, 0.24);
    for (const r of this.drops) {
      r.y += r.v * dt;
      if (r.y > WINDOW.bottom) { r.y = WINDOW.top; r.x = WINDOW.left + (r.x * 3.83) % (WINDOW.right - WINDOW.left); }
      g.lineBetween(r.x, r.y, r.x - 1, Math.min(WINDOW.bottom, r.y + r.len));
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

  // the separation, as in OpeningScene.drawGhost, at the approved Ward 4 size
  drawSpirit(dt) {
    const a = this.milo, gs = a.sprite, sh = 0.82 + Math.sin(this.t * 7) * 0.06;
    this.lie.setAlpha(0); this.sit.setAlpha(0);
    if (this.rise >= 0) {
      this.rise += dt;
      const r = this.rise, R1 = RISE.lie, R2 = R1 + RISE.sit, R3 = R2 + RISE.stand;
      const lift = (k) => Math.round(k * 4);
      if (r < R1) {
        const k = ease(r / R1);
        this.lie.setAlpha(k * 0.75 * sh).setPosition(BODY.x, BODY.y - lift(k));
        gs.setAlpha(0); this.glowAt(BODY.x + 80, BODY.y + 80, k * 0.32, 0);
        return;
      }
      if (r < R2) {
        const k = ease((r - R1) / RISE.sit);
        this.lie.setAlpha((1 - k) * 0.75 * sh).setPosition(BODY.x, BODY.y - 4);
        this.sit.setAlpha(k * 0.85 * sh).setPosition(BODY.x, BODY.y - 4 - Math.round(k * 3));
        gs.setAlpha(0); this.glowAt(BODY.x + 98, BODY.y + 50, 0.34, 0);
        return;
      }
      let x, y, alpha = 0.9;
      if (r < R3) {
        const k = ease((r - R2) / RISE.stand);
        this.sit.setAlpha((1 - k) * 0.85 * sh).setPosition(BODY.x, BODY.y - 7 - Math.round(k * 9));
        x = STAND.x; y = STAND.y - k * 9; alpha = k * 0.9;
      } else if (r < RISE_T) {
        const k = ease((r - R3) / RISE.drift);
        x = lerp(STAND.x, LAND, k); y = lerp(STAND.y - 9, FLOOR, k * k) - Math.sin(k * Math.PI) * 15;
      } else {
        this.rise = -1; this.landed = true; x = LAND; y = FLOOR;
        if (this.snd) this.snd.land();
        // The existing 9.48s wake-up must complete before Milo begins recognizing
        // the impossible: his own hands, then his breathing body. Both use approved
        // sprite-sheet acting frames, not screen-scale close-ups or generated poses.
        this.phase = 'awakening';
        a.play('awakening', () => {
          if (this.phase === 'leaving' || this.phase === 'end') return;
          this.phase = 'recognition';
          this.recognitionSeen = true;
          a.play('realization', () => {
            if (this.phase !== 'leaving' && this.phase !== 'end') this.phase = 'recognition-held';
          });
        });
      }
      a.setFacing(-1); a.x = Math.round(x); a.footY = Math.round(y); a.show();
      gs.setAlpha(alpha * sh);
      this.glowAt(gs.x, gs.y - 70, 0.3, 0.06, y);
      return;
    }
    if (!this.landed) { gs.setAlpha(0); this.glowAt(0, 0, 0, 0); return; }
    gs.setAlpha(0.9 * sh);
    this.glowAt(gs.x, gs.y - 70, 0.3 + Math.sin(this.t * 2) * 0.04, 0.18, FLOOR);
  }

  glowAt(x, y, a, pa, feet = FLOOR) {
    this.ghostL.setPosition(x, y).setAlpha(a);
    this.ghostPool.setPosition(x, Math.max(FLOOR + 1, feet + 1)).setAlpha(pa);
  }
}
