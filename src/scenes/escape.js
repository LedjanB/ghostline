// ESCAPE PROOF (isolated preview: ?escape=1). The first playable moment: Boo says RUN, and Milo runs.
// Not the full intro (V3 at ?opening=1&prelude=1 stays frozen and non-playable) and not the production opening.
// Same approved Ward 4 room, same approved ghost Milo at the same size, and the SAME movement: this scene extends
// WardLabScene (?wardlab=1) and uses its controls(), its fixed 120 Hz tick() and its animate() unchanged.
//   0.0  Milo stands at the foot of Bed 7 after the separation, facing his body. THE STRETCH's shadow rises on the
//        wall behind the bed (only its shadow: the runner's own silhouette, filled black), the lamp gutters.
//   1.6  Boo's lantern flares beyond the exit door, the door swings open, "RUN!" (Boo is off screen: his approved
//        small round look comes with the full intro). Control is handed over on that frame. No menu, no fade.
//   ...  the shadow follows along the wall and catches him if he stalls.
//        THE challenge: as he passes the curtain the shadow's arm sweeps the floor right up to the door (tell: the
//        floor darkens, a low lunge). Get off the floor until it has passed: up on Bed 8 is the safe place; a hop
//        over Bed 8 lands him on its floor too soon. Caught = a quick reset at RUN.
//   exit when his whole body is inside the open doorway, then black.
// Keyboard (A/D or arrows, SPACE), touch (left half drag, right half tap), gamepad (stick / d-pad, A). No saves.
import { W, H } from '../data.js';
import { Device } from '../input.js';
import { MILO_ANIMS } from '../milo-sprite.js';
import { makeOpeningAudio } from '../opening-audio.js';
import { WardLabScene, WARD_MOVE as MV, WARD_GEOM } from './wardlab.js';

const { FLOOR, BED, WORLD_W } = WARD_GEOM;
const BED8 = { left: 845, right: 905, top: 262 };         // the second bed in the plate, solid like Bed 7
const DOOR = { x: 958, y: 112, w: 67, h: 206 };           // the exit door's leaf in the plate (hinge on the left)
const START = 488;                                        // where the separation left him, facing his body
const SHADOW0 = 236;                                      // its leading edge behind Bed 7's head when RUN comes
const ENTER = DOOR.x + 12 + MV.halfW;                     // his whole body is past the door frame
const SWEEP = { at: 620, tell: 0.6, out: 0.45, hold: 0.55, back: 0.5, reach: 992 }; // the floor, right into the doorway
export const ESCAPE = { START, BED8, DOOR, ENTER, SWEEP, RUN_AT: 1.6 };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export class EscapeScene extends WardLabScene {
  constructor() { super('escape'); }

  preload() {
    super.preload();
    this.load.image('esc_glow', 'assets/opening-prelude/soft-glow.png');
  }

  create() {
    super.create(); // the approved room, layers, ghost-ready Milo, keyboard/gamepad/touch input
    [this.label, this.clock, this.hint, this.info, this.note, this.ghostButton, this.camButton, this.cabinetButton].forEach((o) => o.destroy());
    this.cabinetKey.removeAllListeners(); this.ghostKey.removeAllListeners();
    this.solids = [BED, BED8];
    this.ghost = true; this.milo.setGhost(true);
    this.milo.sprite.setDepth(8);
    this.floorShadow.setDepth(7.4).setFillStyle(0x8fc0ff, 0.12);
    const glow = (x, y, tint, sx, sy, a, d = 7.5) => this.add.image(x, y, 'esc_glow').setTint(tint).setScale(sx, sy).setAlpha(a).setBlendMode(Phaser.BlendModes.ADD).setDepth(d);
    // after 3:33: the ward is dark; the lamp, the window and (soon) Boo's lantern are the light
    this.add.rectangle(0, 0, WORLD_W, H, 0x02050d).setOrigin(0).setAlpha(0.55).setDepth(7);
    this.lamp = glow(184, 194, 0xffa448, 1.9, 1.9, 0.4);
    this.lampPool = glow(194, 262, 0xff9a40, 2.6, 2.6, 0.18);
    glow(576, 130, 0x5f8fd8, 2.6, 2.6, 0.15);
    this.ghostL = glow(0, 0, 0x8fc0ff, 0.8, 0.8, 0.16, 7.9);
    // the exit: its opening (dark corridor, Boo's lantern in it) under the door leaf, which swings in on RUN
    this.add.rectangle(DOOR.x, DOOR.y, DOOR.w, DOOR.h, 0x070b16).setOrigin(0).setDepth(0.5);
    const plate = this.textures.get('wardlab_plate');
    if (!plate.has('esc_door')) plate.add('esc_door', 0, DOOR.x, DOOR.y, DOOR.w, DOOR.h);
    this.leaf = this.add.image(DOOR.x, DOOR.y, 'wardlab_plate', 'esc_door').setOrigin(0).setDepth(0.6);
    this.lantern = glow(DOOR.x + 34, DOOR.y + 120, 0xffc46a, 1.2, 1.6, 0, 7.6);
    this.lanternFloor = glow(DOOR.x + 30, FLOOR + 4, 0xffb060, 2.4, 0.5, 0, 7.6);
    // THE STRETCH: only its shadow on the wall (the runner's silhouette, filled black), and its arm on the floor
    // a cast shadow has soft edges: the silhouette is laid down as a solid core plus a ring of faint offset copies,
    // so its pixel steps melt at this size (no filters: kept plain and cheap)
    const sc = 236 / this.textures.getFrame('stretch_walk0').height;
    this.shadeParts = [[0, 0, 1], [-3, 0, 0.3], [3, 0, 0.3], [0, -3, 0.3], [-2, 2, 0.3], [2, 2, 0.3], [-5, 1, 0.14], [5, 1, 0.14]]
      .map(([dx, dy, k]) => {
        const sp = this.add.sprite(SHADOW0, 318, 'stretch_walk0').setOrigin(0.5, 1).setDepth(1.5)
          .setTint(0x020104).setTintMode(Phaser.TintModes.FILL).setAlpha(0).setScale(sc * 0.72, sc);
        sp.play('stretch_walk'); sp.dx = dx; sp.dy = dy; sp.k = k;
        return sp;
      });
    this.shade = this.shadeParts[0];
    this.shadeAlpha = 0;
    this.armG = this.add.graphics().setDepth(6.8);
    this.floorDark = glow(0, FLOOR + 3, 0x000000, 1, 0.35, 0, 6.7).setBlendMode(Phaser.BlendModes.NORMAL);
    // words: Boo's RUN! (from off screen, by the door), and short feedback
    const say = (x, y, str, size, color) => this.add.text(x, y, str, { fontFamily: 'monospace', fontSize: size, color, resolution: 2,
      shadow: { offsetX: 1, offsetY: 2, color: '#000000', blur: 4, fill: true } }).setOrigin(0.5).setScrollFactor(0).setDepth(30).setAlpha(0);
    this.cue = say(W - 74, 128, 'RUN!', '22px', '#ffd28a');
    this.cueBy = say(W - 74, 106, 'BOO', '9px', '#c99a5c');
    this.feedback = say(W / 2, 96, '', '12px', '#b8c8e8');
    this.hintT = say(W / 2, H - 18, '', '10px', '#8f9abc');
    this.blackR = this.add.rectangle(0, 0, W, H, 0x000000).setOrigin(0).setScrollFactor(0).setDepth(40).setAlpha(0);
    this.snd = makeOpeningAudio(); // starts audible on the first key / tap (browser rule)
    if (this.snd) { this.snd.rain(0.24, true); this.snd.presence(0.35, 2); }
    this.events.once('shutdown', () => { if (this.snd) this.snd.stop(); if (window.__escape === this) window.__escape = null; });
    window.__escape = this; // tests + shots
    this.tries = 0;
    this.camX = clamp(START - W * 0.53 - 35, 0, WORLD_W - W);
    this.reset(true);
  }

  // the moment before RUN (first time), or straight back to RUN after being caught
  reset(first) {
    Object.assign(this.m, { x: START, y: FLOOR, vx: 0, vy: 0, ground: true, coyote: 0, buffer: 0, takeoff: 0, cutDone: true, acc: 0 });
    this.milo.setFacing(-1); this.milo.play('idle'); this.milo.sprite.setAlpha(1);
    this.sx = SHADOW0 - (first ? 60 : 0); this.sv = 0;
    this.sweep = null; this.sweepDone = false; this.caught = 0; this.escaped = 0;
    this.phase = first ? 'threat' : 'run'; this.t = first ? 0 : ESCAPE.RUN_AT; this.runT = 0;
    if (!first) this.giveRun(false);
  }

  // Boo: RUN! The door opens on his light and the player has Milo on this frame
  giveRun(first) {
    this.phase = 'run'; this.runT = 0;
    const s = this.snd;
    if (first && s) { s.flare(); s.keys(0.6); s.door(); }
    this.cue.setAlpha(1); this.cueBy.setAlpha(1);
    this.tweens.add({ targets: [this.cue, this.cueBy], alpha: 0, delay: first ? 1100 : 500, duration: 500 });
    this.tweens.add({ targets: this.leaf, scaleX: 0.14, duration: first ? 380 : 1, ease: 'Cubic.easeOut' });
    this.lantern.setAlpha(0.55); this.lanternFloor.setAlpha(0.3);
    const dev = Device.get();
    if (first) {
      this.hintT.setText(dev === 'touch' ? 'DRAG LEFT HALF TO RUN    TAP RIGHT HALF TO JUMP' : dev === 'gamepad' ? 'STICK / D-PAD RUN    A JUMP' : 'D / RIGHT RUN    SPACE JUMP').setAlpha(1);
      this.tweens.add({ targets: this.hintT, alpha: 0, delay: 2600, duration: 600 });
    }
  }

  // in a chase he runs: any direction held is a run (the lab's walk is for exploring)
  controls() {
    const inp = super.controls();
    if (this.phase !== 'run' || this.caught || this.escaped) return { dir: 0, run: false, jump: false, hold: false };
    return { ...inp, run: inp.dir !== 0 };
  }

  update(_t, dtMs) {
    const dt = Math.min(dtMs / 1000, 0.05);
    this.t += dt; this.clockT += dt;
    const m = this.m, a = this.milo, s = this.snd;
    if (this.phase === 'threat') {
      // the shadow climbs the wall behind his bed; the lamp gutters; he hasn't seen it
      this.shadeAlpha = Math.min(0.62, this.t * 0.5);
      this.sx += 38 * dt;
      this.lamp.setAlpha(0.4 * (Math.sin(this.t * 31) > 0.6 ? 0.5 : 1));
      if (this.t >= ESCAPE.RUN_AT) this.giveRun(true);
    }
    const inp = this.controls();
    if (inp.jump && m.buffer <= 0) s && s.jump();
    if (inp.jump) m.buffer = MV.buffer;
    const wasGround = m.ground;
    m.acc += dt;
    while (m.acc >= 1 / 120) { m.acc -= 1 / 120; this.tick(1 / 120, inp); }
    if (!wasGround && m.ground) s && s.land();
    if (!this.caught && !this.escaped) this.animate(inp);
    a.x = m.x; a.footY = m.y;
    a.update(dt * 1000); a.show();
    const on = this.solids.find((b) => m.x + MV.halfW > b.left && m.x - MV.halfW < b.right && m.y <= b.top + 0.5);
    this.floorShadow.setPosition(m.x, (on ? on.top : FLOOR) + 2);
    this.ghostL.setPosition(a.sprite.x, a.sprite.y - 70);
    if (this.phase === 'run') this.chase(dt);
    for (const p of this.shadeParts) p.setPosition(Math.round(this.sx + p.dx), 318 + p.dy).setAlpha(this.shadeAlpha * p.k);
    this.drawRain(dt);
    // camera: follows him, on whole pixels only (the world never shimmers)
    const wanted = clamp(m.x - W * 0.53 + 35 * a.facing, 0, WORLD_W - W);
    this.camX += (wanted - this.camX) * Math.min(1, dt * 5);
    this.cameras.main.scrollX = Math.round(this.camX);
    this.thumbG.clear();
    if (this.thumb) {
      this.thumbG.lineStyle(1, 0x6f8fc8, 0.5).strokeCircle(this.thumb.x, this.thumb.y, 48);
      this.thumbG.fillStyle(0x9fd8ff, 0.35).fillCircle(clamp(this.thumb.cur, this.thumb.x - 48, this.thumb.x + 48), this.thumb.y, 8);
    }
  }

  chase(dt) {
    const m = this.m, s = this.snd;
    this.runT += dt;
    if (this.escaped) { this.exit(dt); return; }
    if (this.caught) {
      this.caught -= dt;
      this.blackR.setAlpha(clamp(1 - this.caught / 0.7, 0, 0.85));
      if (this.caught <= 0) { this.blackR.setAlpha(0); this.feedback.setAlpha(0); this.tries++; this.reset(false); }
      return;
    }
    // the shadow: slow off the mark, then faster than a walk, slower than his run; it closes if he stalls
    const target = this.runT < 0.9 ? 70 : 165;
    this.sv += (target - this.sv) * Math.min(1, dt * 2);
    this.sx += this.sv * dt;
    this.shadeAlpha = 0.62;
    const gap = m.x - this.sx;
    if (s) s.presence(clamp(1 - gap / 420, 0.15, 1), 0.3);
    if (gap < 26) return this.catch('IT HAS YOU.  AGAIN.');
    // THE challenge: the arm sweeps the floor as he nears Bed 8
    if (!this.sweep && !this.sweepDone && m.x > SWEEP.at) { this.sweep = { t: 0 }; s && s.lunge(); }
    this.drawSweep(dt);
    if (m.x >= ENTER && m.y >= FLOOR - 1) {
      this.escaped = 0.01; this.milo.want('run'); s && s.door(); s && s.presence(0, 0.4);
    }
  }

  // the tell (it leans, the floor darkens), the arm out along the floor, a hold, back
  drawSweep(dt) {
    const g = this.armG, m = this.m, sw = this.sweep;
    g.clear(); this.floorDark.setAlpha(0);
    if (!sw) return;
    sw.t += dt;
    const S = SWEEP, from = this.sx + 10;
    let tip;
    if (sw.t < S.tell) {
      const k = sw.t / S.tell;
      this.floorDark.setPosition(from + 120, FLOOR + 3).setScale(3.2, 0.32).setAlpha(0.35 * k);
      tip = from + 30 * k;
    } else {
      const k = sw.t - S.tell;
      tip = k < S.out ? from + (S.reach - from) * Math.pow(k / S.out, 0.6)
        : k < S.out + S.hold ? S.reach
          : from + (S.reach - from) * Math.max(0, 1 - (k - S.out - S.hold) / S.back);
      if (k >= S.out + S.hold + S.back) { this.sweep = null; this.sweepDone = true; return; }
      // under him while he's on the floor = caught (on Bed 8, or in the air, it passes under)
      if (tip >= m.x - MV.halfW && from <= m.x && m.ground && m.y >= FLOOR - 1) return this.catch('THE FLOOR WAS ITS.  GET OFF IT.');
    }
    // the arm: a long shadow along the floor, fingers at the tip; a thin red edge (in this game red = it hurts)
    const y = FLOOR + 1;
    g.fillStyle(0x7a1018, 0.55);
    g.fillRect(from, y - 6, Math.max(0, tip - from - 10), 1);
    for (let f = -2; f <= 2; f++) g.fillTriangle(tip - 12, y - 4 + f, tip - 12, y - 2 + f, tip + 16 - Math.abs(f) * 3, y - 3 + f * 3);
    g.fillStyle(0x010103, 0.92);
    g.fillRect(from, y - 5, Math.max(0, tip - from - 10), 10);
    for (let f = -2; f <= 2; f++) g.fillTriangle(tip - 12, y - 3 + f, tip - 12, y + 1 + f, tip + 15 - Math.abs(f) * 3, y - 1 + f * 3);
  }

  catch(msg) {
    this.caught = 0.7; this.sweep = null;
    this.armG.clear(); this.floorDark.setAlpha(0);
    this.milo.play(MILO_ANIMS.fear ? 'fear' : 'idle');
    if (this.snd) { this.snd.grip(); this.snd.presence(1, 0.1); }
    this.feedback.setText(msg).setAlpha(1);
  }

  // through the door: he runs into the dark beyond it, then black
  exit(dt) {
    this.escaped += dt;
    const k = clamp(this.escaped / 0.45, 0, 1);
    this.m.x += (DOOR.x + DOOR.w / 2 - this.m.x) * Math.min(1, dt * 8); this.m.vx = 0; // into the doorway, not past it
    this.milo.sprite.setAlpha(1 - k);
    this.blackR.setAlpha(clamp((this.escaped - 0.35) / 0.6, 0, 1));
    if (this.escaped > 1.1 && this.phase !== 'escaped') {
      this.phase = 'escaped';
      this.feedback.setText('OUT OF WARD 4.\n\nnext: the corridor (escape proof ends here)').setAlpha(1).setY(H / 2);
      if (this.snd) this.snd.presence(0, 1);
    }
  }

  drawRain(dt) {
    this.rainG.clear(); this.rainG.lineStyle(1, 0xa2cbfc, 0.23);
    for (const d of this.rain) {
      d.y += d.spd * dt;
      if (d.y > 215) { d.y = 34; d.x = 452 + (d.x * 3.83) % 248; }
      this.rainG.lineBetween(Math.round(d.x), Math.round(d.y), Math.round(d.x - 1), Math.round(Math.min(215, d.y + d.len)));
    }
  }
}
