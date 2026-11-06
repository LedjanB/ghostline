// v8: boss arenas (The Story of Vigil). The run pauses at the end of a world and the arena takes over:
// Milo moves, jumps, dodges; his lantern swings on its own when the boss is open (like the runner's weapons,
// so a thumb, a keyboard and a gamepad play the same fight); the ally's power is the one button.
// A boss is fought until it is beaten once (save.story.beaten); after that the run goes past.
//
// Controls, the same 4 actions everywhere:
//   touch:    left half = hold and slide to move; right half = tap to jump (hold = higher), swipe to dodge;
//             the LIGHT button shows only when the power is charged
//   keyboard: A D / arrows move, W / UP / SPACE jump, S / DOWN dodge, E / J light, P / ESC pause
//   gamepad:  stick / d-pad move, A jump, B dodge, X / Y light, START pause
import { W, H, FLOOR, CEIL } from '../data.js';
import { Audio } from '../audio.js';
import { text } from '../ui.js';
import { createInput, Device } from '../input.js';

const STEP = 1 / 120;
const MILO_SCALE = 2.5, MILO_W = 18, MILO_H = 44;
const WALL_L = 24, WALL_R = 616;
const MOVE = 190, ACCEL = 1700, AIR_ACCEL = 1100;
const GRAV = 1800, JUMP_V = 575, JUMP_CUT = 0.45, COYOTE = 0.09, BUFFER = 0.13;
const DODGE_T = 0.32, DODGE_V = 470, DODGE_CD = 0.55;
const HIT_T = 0.12, HIT_CD = 0.32, HIT_RANGE = 44, HIT_H = 30;
const HEARTS = 5, HURT_INV = 1.0, KNOCK = 250;
const SWIPE = 24, STICK_DEAD = 9;
const POWER_BTN = { x: 598, y: 318, r: 26 };

// one entry per boss; worlds 1 and 2 for the vertical slice
export const BOSSES = {
  matron: {
    zone: 'ward', name: 'THE NIGHT MATRON', power: 'penlight', hp: 21, w: 40, h: 75,
    beds: [130, 320, 510], lamps: [63, 223, 383, 543], // the lamps line up with the ward's painted ceiling lamps
    lines: {
      start: 'LIGHTS OUT. EVERYONE IN BED.', half: 'NO RUNNING ON MY WARD.', shove: 'BACK TO BED.',
      dark: 'LIGHTS OUT.', stun: 'WHO HAS A LIGHT ON?', win: ['SHE SITS ON THE LAST BED.', 'SHE FOLDS HER HANDS.'],
    },
  },
};

// the ally powers that use the LIGHT button
const POWERS = {
  penlight: { name: 'PENLIGHT', chargeTime: 18, dodge: 0.25, clean: 0.15, stun: 1.3 },
};

const overlap = (a, b) => a.r > b.l && a.l < b.r && a.b > b.t && a.t < b.b;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------------- pixel art (art direction: text rows, 1px outline, drawn in code) ----------------
const OUTLINE = '#0b0918';
function px(scene, key, rows, pal) {
  if (scene.textures.exists(key)) return;
  const h = rows.length, w = rows[0].length;
  const tex = scene.textures.createCanvas(key, w + 2, h + 2);
  const c = tex.context;
  const solid = (x, y) => y >= 0 && y < h && x >= 0 && x < w && rows[y][x] !== '.' && pal[rows[y][x]];
  c.fillStyle = OUTLINE;
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
    if (solid(x, y)) continue;
    if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) c.fillRect(x + 1, y + 1, 1, 1);
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (solid(x, y)) { c.fillStyle = pal[rows[y][x]]; c.fillRect(x + 1, y + 1, 1, 1); } }
  tex.refresh();
}

// Sister Agathe, head nurse of Ward 4. Faces left. Tall, starched, a cap, hollow eyes.
const MATRON = [
  '.....cccccc.....',
  '....cccccccc....',
  '...cccCCCCccc...',
  '....hhhhhhhh....',
  '....hssssssh....',
  '....sEEssEEs....',
  '....sEEssEEs....',
  '....ssssssss....',
  '.....smmmms.....',
  '......ssss......',
  '....dddaaddd....',
  '...ddddaaadddd..',
  '..dddDdaaadDddd.',
  '..dd.DdaaadD.dd.',
  '..dd.DdaaadD.dd.',
  '..ss.bbbbbbb.ss.',
  '.....DdaaadD....',
  '.....DdaaadD....',
  '....DDdaaadDD...',
  '....DddaaaddD...',
  '...DdddaaadddD..',
  '...DdddaaadddD..',
  '..DddddaaaddddD.',
  '..DdddddddddddD.',
  '..DDDDDDDDDDDDD.',
  '....kk.....kk...',
];
const MATRON_PAL = { c: '#f2eef8', C: '#c9c2d8', h: '#a9a2b8', s: '#d9d2dc', E: '#0b0918', m: '#5a4a62', d: '#8d84a6', D: '#5e5677', a: '#ddd8e8', b: '#3a3450', k: '#2a2436' };
// her eyes, the only thing you see in the dark
const MATRON_EYES = ['EE..EE', 'EE..EE'];
const BED = [
  'ff....................',
  'ffpppppppppppppppppppp',
  'ffssssssssssssssssssss',
  'ffffffffffffffffffffff',
  'ff..................ff',
  'ff..................ff',
  'ff..................ff',
];
const BED_PAL = { f: '#5d5870', p: '#e8e4f2', s: '#b8b2cc' };
const CLIPBOARD = ['bbbbbb', 'bppppb', 'bpllpb', 'bppppb', 'bpllpb', 'bbbbbb'];
const CLIP_PAL = { b: '#6a5238', p: '#efe6cf', l: '#8a8070' };

export class BossScene extends Phaser.Scene {
  constructor() { super('boss'); }

  init(data) {
    this.def = BOSSES[data.boss] || BOSSES.matron;
    this.bossId = data.boss || 'matron';
    this.powers = data.powers || [];
    this.char = data.char || 'survivor';
    this.onEnd = data.onEnd || (() => {});
    this.reduce = !!data.reduceFlicker;
    this.shakeOn = data.shake !== false;
    this.t = 0; this.acc = 0; this.state = 'intro'; this.introT = 0; this.endT = 0; this.paused = false;
    // Milo
    this.x = 150; this.y = 0; this.vx = 0; this.vy = 0; this.face = 1;
    this.grounded = true; this.coyote = 0; this.buffer = 0;
    this.dodgeT = 0; this.dodgeCd = 0; this.dodgeDir = 1;
    this.hitT = 0; this.hitCd = 0; this.hitDone = false;
    this.hearts = HEARTS; this.inv = 0; this.booUsed = false; this.booT = 0; this.booX = 0;
    this.power = POWERS[this.def.power] && this.powers.includes(this.def.power) ? POWERS[this.def.power] : null;
    this.charge = this.power ? 0.35 : 0; this.beamT = 0; this.cleanAttack = true;
    // the boss
    const d = this.def;
    this.bx = d.beds[2]; this.hp = d.hp; this.bstate = 'idle'; this.bt = 0.9; this.bTarget = this.bx; this.bDir = -1;
    this.flashB = 0; this.queue = []; this.lastAttack = ''; this.checkHits = 0; this.passedThisRoll = false;
    this.curtain = null; this.boards = [];
    this.dark = 0; this.darkWant = 0; this.lampsOn = d.lamps.map(() => 1);
    this.trauma = 0; this.freeze = 0; this.redEdge = 0;
    this.stats = { hits: 0, taken: 0, dodges: 0, lights: 0, time: 0 };
    this.say = { text: '', t: 0 };
    this.thumbs = { move: null, act: null };
    this.act = { left: false, right: false, jumpHeld: false, jump: false, dodge: false, dodgeDir: 0, power: false, cancelJump: false };
  }

  create() {
    px(this, 'matron', MATRON, MATRON_PAL);
    px(this, 'matron_eyes', MATRON_EYES, { E: '#ff3355' });
    px(this, 'bed', BED, BED_PAL);
    px(this, 'clipboard', CLIPBOARD, CLIP_PAL);
    this.inputMap = createInput(this, { pointers: false });
    this.input.addPointer(2);
    const z = this.def.zone;
    // the world's own painted layers, still
    for (const [k, depth] of [['sky', 0], ['far', 1], ['mid', 2], ['near', 3]]) {
      if (this.textures.exists(`${z}_${k}`)) this.add.tileSprite(0, 0, W, H, `${z}_${k}`).setOrigin(0).setTileScale(2).setDepth(depth).setTilePosition(k === 'near' ? 40 : 0, 0);
    }
    this.add.rectangle(0, 0, W, H, 0x07060d, 0.45).setOrigin(0).setDepth(3.5); // the arena reads over the world
    if (this.textures.exists(`${z}_edge`)) this.add.tileSprite(0, 0, W, H, `${z}_edge`).setOrigin(0).setTileScale(2).setDepth(4);
    this.g = this.add.graphics().setDepth(5);
    this.beds = this.def.beds.map((bx) => this.add.image(bx, FLOOR + 1, 'bed').setOrigin(0.5, 1).setScale(3).setDepth(5.5));
    this.boss = this.add.image(this.bx, FLOOR, 'matron').setOrigin(0.5, 1).setScale(2.9).setDepth(6);
    this.bossEyes = this.add.image(0, 0, 'matron_eyes').setScale(2.9).setDepth(9.2).setVisible(false);
    this.clipImgs = [];
    this.milo = this.add.sprite(this.x, FLOOR, `${this.char}_run0`).setOrigin(0.5, 1).setScale(MILO_SCALE).setDepth(7);
    this.boo = this.add.image(0, 0, 'ghost0').setScale(2.4).setDepth(7.5).setVisible(false);
    this.fx = this.add.graphics().setDepth(8);
    this.darkG = this.add.graphics().setDepth(9);
    this.ui = this.add.graphics().setDepth(20);
    this.nameText = text(this, W / 2, 10, this.def.name, 8, '#d9d0a8').setDepth(21);
    this.lineText = text(this, W / 2, 58, '', 12, '#e6f0ff').setDepth(21).setStroke('#07060d', 5);
    this.noteText = text(this, W / 2, 84, '', 8, '#a99fd0').setDepth(21).setStroke('#07060d', 4);
    this.bigText = text(this, W / 2, 130, '', 16, '#e6f0ff').setDepth(21).setStroke('#07060d', 6);
    this.subText = text(this, W / 2, 160, '', 10, '#a99fd0').setDepth(21).setStroke('#07060d', 4);
    this.powerLabel = text(this, POWER_BTN.x, POWER_BTN.y, 'LIGHT', 6, '#2a2410').setDepth(22).setVisible(false);
    this.pauseText = text(this, W / 2, H / 2, 'PAUSED', 16, '#e6f0ff').setDepth(30).setStroke('#07060d', 6).setVisible(false);
    this.touch = Device.get() === 'touch';

    // two-thumb touch
    this.input.on('pointerdown', (p) => {
      this.touch = true;
      if (this.paused) { this.togglePause(); return; }
      if (this.state !== 'fight') return;
      if (this.power && this.charge >= 1 && Math.hypot(p.x - POWER_BTN.x, p.y - POWER_BTN.y) < POWER_BTN.r + 12) { this.act.power = true; return; }
      if (p.x < W / 2) { if (!this.thumbs.move) this.thumbs.move = { id: p.id, x0: p.x, x: p.x, y0: p.y }; }
      else if (!this.thumbs.act) { this.thumbs.act = { id: p.id, x0: p.x, y0: p.y, swiped: false }; this.act.jump = true; }
    });
    this.input.on('pointermove', (p) => {
      const m = this.thumbs.move; if (m && m.id === p.id) m.x = p.x;
      const t = this.thumbs.act;
      if (t && t.id === p.id && !t.swiped) {
        const dx = p.x - t.x0, dy = p.y - t.y0;
        if (Math.hypot(dx, dy) > SWIPE) {
          t.swiped = true; this.act.dodge = true; this.act.cancelJump = true;
          this.act.dodgeDir = Math.abs(dx) > Math.abs(dy) * 0.7 ? Math.sign(dx) : 0;
        }
      }
    });
    const up = (p) => {
      if (this.thumbs.move && this.thumbs.move.id === p.id) this.thumbs.move = null;
      if (this.thumbs.act && this.thumbs.act.id === p.id) this.thumbs.act = null;
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    this.input.keyboard.on('keydown', () => { this.touch = false; });

    this.cameras.main.fadeIn(350, 7, 6, 13);
    Audio.sfx('sting');
    this.talk(this.def.lines.start, 2.0);
    window.__boss = this; // debug + bots
  }

  talk(str, t = 1.6) { this.say = { text: str, t }; }

  togglePause() {
    this.paused = !this.paused;
    this.pauseText.setVisible(this.paused);
    this.thumbs = { move: null, act: null };
  }

  hint() {
    if (this.touch) return 'LEFT THUMB: HOLD AND SLIDE TO MOVE\nRIGHT THUMB: TAP TO JUMP, SWIPE TO DODGE';
    if (Device.get() === 'gamepad') return 'STICK MOVE   A JUMP   B DODGE' + (this.power ? '   X LIGHT' : '');
    return 'A D MOVE   W JUMP   S DODGE' + (this.power ? '   E LIGHT' : '');
  }

  update(_time, delta) {
    const im = this.inputMap; im.update();
    if (im.pressed('pause') && (this.state === 'fight' || this.paused)) this.togglePause();
    if (this.paused) return;
    const a = this.act;
    if (this.bot) this.bot(this, a); // debug: bots fill the same action map
    else {
      const mv = this.thumbs.move ? this.thumbs.move.x - this.thumbs.move.x0 : 0;
      a.left = im.held('left') || mv < -STICK_DEAD;
      a.right = im.held('right') || mv > STICK_DEAD;
      a.jumpHeld = im.held('float') || !!(this.thumbs.act && !this.thumbs.act.swiped);
      if (im.pressed('float')) a.jump = true;
      if (im.pressed('slide')) a.dodge = true;
      if (im.pressed('light')) a.power = true;
    }
    this.acc += Math.min(delta / 1000, 0.1);
    let stepped = false;
    while (this.acc >= STEP) { this.step(STEP); this.acc -= STEP; stepped = true; }
    if (stepped) { a.jump = false; a.dodge = false; a.dodgeDir = 0; a.power = false; a.cancelJump = false; }
    this.render();
  }

  // ---------------- simulation ----------------
  step(dt) {
    this.say.t = Math.max(0, this.say.t - dt);
    this.trauma = Math.max(0, this.trauma - dt * 2.2);
    this.redEdge = Math.max(0, this.redEdge - dt * 2.5);
    this.t += dt;
    if (this.state === 'intro') {
      this.introT += dt;
      if (this.introT > 1.6) { this.state = 'fight'; this.noteText.setText(this.hint()); this.noteUntil = this.t + 4.5; }
      return;
    }
    if (this.state === 'won' || this.state === 'lost') { this.stepEnd(dt); return; }
    if (this.freeze > 0) { this.freeze -= dt; return; } // hit-stop
    this.stats.time += dt;
    if (this.noteUntil && this.t > this.noteUntil) { this.noteText.setText(''); this.noteUntil = 0; }
    this.stepMilo(dt);
    this.stepBoss(dt);
    this.stepHazards(dt);
    this.dark += (this.darkWant - this.dark) * Math.min(1, dt * 5);
  }

  miloBox() {
    const h = this.dodgeT > 0 ? 20 : MILO_H;
    return { l: this.x - MILO_W / 2, r: this.x + MILO_W / 2, t: FLOOR - this.y - h, b: FLOOR - this.y };
  }
  bossBox() {
    const h = this.isOpen() ? this.def.h * 0.78 : this.def.h;
    return { l: this.bx - this.def.w / 2, r: this.bx + this.def.w / 2, t: FLOOR - h, b: FLOOR };
  }
  isOpen() { return this.bstate === 'check' || this.bstate === 'stunned'; }

  stepMilo(dt) {
    const a = this.act;
    this.inv = Math.max(0, this.inv - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.hitCd = Math.max(0, this.hitCd - dt);
    if (this.booT > 0) { // Boo carries Milo out of the way
      this.booT -= dt;
      this.y = Math.min(110, this.y + 420 * dt); this.vy = 0;
      this.x += (this.booX - this.x) * Math.min(1, dt * 4);
      if (this.booT <= 0) { this.vy = -40; this.grounded = false; }
      return;
    }
    const dir = (a.right ? 1 : 0) - (a.left ? 1 : 0);
    if (dir) this.face = dir;
    if (a.dodge && this.dodgeCd <= 0 && this.dodgeT <= 0) {
      this.dodgeT = DODGE_T; this.dodgeCd = DODGE_CD + DODGE_T; this.dodgeDir = a.dodgeDir || dir || this.face;
      if (a.cancelJump && !this.grounded && this.y < 30) this.vy = Math.min(this.vy, 80); // a swipe that began as a tap stays a roll
      this.stats.dodges++; Audio.sfx('slide');
    }
    if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      this.vx = this.dodgeDir * DODGE_V;
      if (!this.grounded) this.vy = Math.max(this.vy, -80);
    } else {
      const acc = this.grounded ? ACCEL : AIR_ACCEL;
      this.vx += clamp(dir * MOVE - this.vx, -acc * dt, acc * dt);
    }
    this.buffer = a.jump ? BUFFER : Math.max(0, this.buffer - dt);
    this.coyote = this.grounded ? COYOTE : Math.max(0, this.coyote - dt);
    if (this.buffer > 0 && this.coyote > 0 && this.dodgeT <= 0) {
      this.vy = JUMP_V; this.grounded = false; this.buffer = 0; this.coyote = 0; Audio.sfx('jump');
    }
    if (!a.jumpHeld && this.vy > 0 && !this.grounded) this.vy *= Math.pow(JUMP_CUT, dt * 20);
    if (!this.grounded) this.vy -= GRAV * dt;
    this.y += this.vy * dt;
    if (this.y <= 0) { this.y = 0; this.vy = 0; this.grounded = true; }
    this.x = clamp(this.x + this.vx * dt, WALL_L + MILO_W / 2, WALL_R - MILO_W / 2);

    // the lantern swings on its own when she's open and in reach
    if (this.power) this.charge = Math.min(1, this.charge + dt / this.power.chargeTime);
    const reach = HIT_RANGE + this.def.w / 2 - 4;
    if (this.isOpen() && this.hitCd <= 0 && this.dodgeT <= 0 && Math.abs(this.bx - this.x) < reach) {
      this.face = Math.sign(this.bx - this.x) || this.face;
      this.hitT = HIT_T; this.hitCd = HIT_CD; this.hitDone = false; Audio.sfx('swoosh');
    }
    if (this.hitT > 0) {
      this.hitT -= dt;
      if (!this.hitDone) {
        const m = this.miloBox();
        const hb = this.face > 0 ? { l: this.x, r: this.x + HIT_RANGE, t: m.t - 4, b: m.t + HIT_H } : { l: this.x - HIT_RANGE, r: this.x, t: m.t - 4, b: m.t + HIT_H };
        if (overlap(hb, this.bossBox())) { this.hitDone = true; this.damageBoss(); }
      }
    }
    this.beamT = Math.max(0, this.beamT - dt);
    if (a.power && this.power && this.charge >= 1) this.usePower();
  }

  usePower() {
    this.charge = 0; this.beamT = 0.35; this.stats.lights++;
    this.face = Math.sign(this.bx - this.x) || this.face;
    this.trauma = Math.max(this.trauma, 0.3); this.freeze = 0.04;
    Audio.sfx('holy');
    if (this.darkWant > 0) { this.darkWant = 0; this.lampsOn = this.def.lamps.map(() => 1); }
    if (this.bstate !== 'check') {
      this.bstate = 'stunned'; this.bt = this.power.stun; this.checkHits = 0; this.flashB = 0.25;
      this.curtain = null; this.boards = [];
      this.talk(this.def.lines.stun, 1.0);
    }
  }

  damageBoss() {
    this.flashB = 0.14;
    this.stats.hits++;
    this.hp -= 1; this.checkHits++;
    this.freeze = 0.05; this.trauma = Math.max(this.trauma, 0.3);
    Audio.sfx('hit');
    if (this.hp <= 0) { this.win(); return; }
    if (this.checkHits >= 3 && this.bstate === 'check') this.shove();
    if (this.hp === Math.ceil(this.def.hp / 2)) { this.talk(this.def.lines.half, 1.8); this.bt = Math.min(this.bt, 0.25); }
  }

  shove() {
    this.bstate = 'idle'; this.bt = 0.45; this.flashB = 0.2;
    if (this.dodgeT <= 0) { this.vx = (this.x < this.bx ? -1 : 1) * 340; this.vy = 200; this.grounded = false; }
    this.talk(this.def.lines.shove, 0.9);
  }

  hurt(fromX) {
    if (this.inv > 0 || this.dodgeT > 0 || this.booT > 0) return false;
    this.cleanAttack = false;
    if (this.hearts === 1 && !this.booUsed) { // Boo comes once a fight, and only when it would end you
      this.booUsed = true; this.booT = 1.0; this.inv = 1.4;
      this.booX = clamp(fromX > this.x ? this.x - 170 : this.x + 170, WALL_L + 30, WALL_R - 30);
      this.talk('GOT YOU.', 1.0); Audio.sfx('boo');
      return true;
    }
    this.hearts--; this.stats.taken++;
    this.inv = HURT_INV; this.redEdge = 1; this.trauma = 0.5; this.freeze = 0.06;
    this.vx = (this.x < fromX ? -1 : 1) * KNOCK; this.vy = 260; this.grounded = false;
    Audio.sfx('stumble');
    if (this.hearts <= 0) this.lose();
    return true;
  }

  // ---- the boss: an attack, then she stops at a bed to check it (the window) ----
  stepBoss(dt) {
    this.flashB = Math.max(0, this.flashB - dt);
    this.bt -= dt;
    const d = this.def, p2 = this.hp <= Math.ceil(d.hp / 2), s = this.bstate;
    if (s === 'idle' && this.bt <= 0) this.nextAttack(p2);
    else if (s === 'tellRoll' && this.bt <= 0) this.bstate = 'roll';
    else if (s === 'roll') {
      const v = p2 ? 500 : 410;
      this.bx += Math.sign(this.bTarget - this.bx) * v * dt;
      if (Math.abs(this.bTarget - this.bx) < v * dt) { this.bx = this.bTarget; this.check(p2); }
    } else if (s === 'tellCurtain' && this.bt <= 0) {
      this.bstate = 'curtain';
      const fromLeft = this.bx <= W / 2;
      this.curtain = { x: fromLeft ? WALL_L : WALL_R, dir: fromLeft ? 1 : -1, v: p2 ? 400 : 330, h: 20, len: 80, second: p2 };
      Audio.sfx('swoosh');
    } else if (s === 'curtain' && !this.curtain) this.check(p2);
    else if (s === 'tellBoards' && this.bt <= 0) {
      this.bstate = 'boards'; this.bt = 0.5;
      const n = p2 ? 5 : 3, flight = 0.9;
      for (let i = 0; i < n; i++) {
        const tx = clamp(this.x + (i - (n - 1) / 2) * 60, WALL_L + 14, WALL_R - 14);
        this.boards.push({ x: this.bx, y: FLOOR - 62, vx: (tx - this.bx) / flight, vy: (62 - 400 * flight * flight) / flight, spin: 0 });
      }
      Audio.sfx('swoosh');
    } else if (s === 'boards' && this.bt <= 0 && this.boards.length === 0) this.check(p2);
    else if (s === 'stunned' && this.bt <= 0) { this.bstate = 'idle'; this.bt = 0.45; }
    else if (s === 'check' && this.bt <= 0) {
      this.bstate = 'idle'; this.bt = p2 ? 0.35 : 0.6;
      if (this.darkWant > 0 && Math.random() < 0.5) { this.darkWant = 0; this.lampsOn = d.lamps.map(() => 1); }
    } else if (s === 'lights' && this.bt <= 0) {
      this.darkWant = 0.9; this.lampsOn = d.lamps.map(() => 0); Audio.sfx('close');
      this.bstate = 'idle'; this.bt = 0.5; this.queue.unshift(this.pick(['roll', 'curtain'], true));
    }
    // touching her only hurts while she charges
    if (this.bstate === 'roll' && overlap(this.miloBox(), this.bossBox())) {
      if (!this.hurt(this.bx) && this.dodgeT > 0 && !this.passedThisRoll) {
        this.passedThisRoll = true;
        if (this.power) this.charge = Math.min(1, this.charge + this.power.dodge);
      }
    }
  }

  pick(list, avoidLast) {
    const pool = avoidLast ? list.filter((x) => x !== this.lastAttack) : list;
    return pool[Math.floor(Math.random() * pool.length)] || list[0];
  }

  nextAttack(p2) {
    if (p2 && this.darkWant === 0 && Math.random() < 0.45) { this.bstate = 'lights'; this.bt = 1.0; this.talk(this.def.lines.dark, 1.0); return; }
    const a = this.queue.shift() || this.pick(['roll', 'curtain', 'boards'], true);
    this.lastAttack = a; this.cleanAttack = true;
    const beds = this.def.beds;
    if (a === 'roll') { // she charges through Milo to the bed on his far side
      const side = this.x > this.bx ? 1 : -1;
      const beyond = beds.filter((b) => (b - this.x) * side > 40);
      this.bTarget = beyond.length ? (side > 0 ? beyond[0] : beyond[beyond.length - 1]) : (side > 0 ? beds[2] : beds[0]);
      if (Math.abs(this.bTarget - this.bx) < 20) this.bTarget = this.bx > W / 2 ? beds[0] : beds[2];
      this.bDir = Math.sign(this.bTarget - this.bx) || 1;
      this.bstate = 'tellRoll'; this.bt = p2 ? 0.45 : 0.65; this.passedThisRoll = false;
      Audio.sfx('creak');
    } else if (a === 'curtain') { this.bstate = 'tellCurtain'; this.bt = p2 ? 0.55 : 0.75; Audio.sfx('warn'); }
    else { this.bstate = 'tellBoards'; this.bt = p2 ? 0.4 : 0.55; }
  }

  check(p2) {
    if (this.power && this.cleanAttack && this.lastAttack !== 'roll') this.charge = Math.min(1, this.charge + this.power.clean);
    this.bstate = 'check'; this.bt = p2 ? 1.15 : 1.6; this.checkHits = 0;
    let nb = this.def.beds[0];
    for (const b of this.def.beds) if (Math.abs(b - this.bx) < Math.abs(nb - this.bx)) nb = b;
    if (Math.abs(nb - this.bx) < 55) this.bx = nb;
  }

  stepHazards(dt) {
    const m = this.miloBox();
    if (this.curtain) {
      const c = this.curtain;
      c.x += c.dir * c.v * dt;
      const box = { l: Math.min(c.x, c.x - c.dir * c.len), r: Math.max(c.x, c.x - c.dir * c.len), t: FLOOR - c.h, b: FLOOR };
      if (overlap(m, box)) this.hurt(c.x);
      const out = c.dir > 0 ? c.x - c.len > WALL_R : c.x + c.len < WALL_L;
      if (out) this.curtain = c.second ? { ...c, dir: -c.dir, x: c.dir > 0 ? WALL_R : WALL_L, second: false, v: c.v * 1.1 } : null;
    }
    for (const b of this.boards) {
      b.vy += 800 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.spin += dt * 14;
      if (overlap(m, { l: b.x - 7, r: b.x + 7, t: b.y - 6, b: b.y + 6 }) && this.hurt(b.x)) b.gone = true;
      if (b.y > FLOOR - 4) { b.gone = true; this.trauma = Math.max(this.trauma, 0.1); }
    }
    this.boards = this.boards.filter((b) => !b.gone);
  }

  win() {
    this.state = 'won'; this.endT = 0; this.curtain = null; this.boards = []; this.darkWant = 0; this.bstate = 'sit';
    this.lampsOn = this.def.lamps.map(() => 1);
    this.thumbs = { move: null, act: null };
    Audio.sfx('win');
    this.noteText.setText('');
    // she rolls back to the last bed and sits
    this.sitFrom = this.bx; this.sitTo = this.def.beds[this.def.beds.length - 1];
  }

  lose() {
    this.state = 'lost'; this.endT = 0;
    this.thumbs = { move: null, act: null };
    Audio.sfx('lose');
    this.noteText.setText('');
    this.darkWant = 1;
  }

  stepEnd(dt) {
    this.endT += dt;
    this.dark += (this.darkWant - this.dark) * Math.min(1, dt * 2);
    if (this.state === 'won') {
      const k = Math.min(1, this.endT / 1.2);
      this.bx = this.sitFrom + (this.sitTo - this.sitFrom) * (1 - Math.pow(1 - k, 3));
      const [a, b] = this.def.lines.win;
      if (this.endT > 1.2 && !this.bigText.text) this.bigText.setText(a);
      if (this.endT > 2.2 && !this.subText.text) this.subText.setText(b);
      if (this.endT > 4.2 && !this.done) this.finish(true);
    } else {
      if (this.endT > 0.3 && !this.bigText.text) this.bigText.setText('LIGHTS OUT.');
      if (this.endT > 2.0 && !this.done) this.finish(false);
    }
  }

  finish(won) {
    this.done = true;
    window.__boss = null;
    this.cameras.main.fadeOut(300, 7, 6, 13);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const res = { won, time: this.stats.time, hits: this.stats.hits, taken: this.stats.taken, lights: this.stats.lights, boo: this.booUsed };
      this.scene.stop();
      this.onEnd(res);
    });
  }

  // ---------------- drawing ----------------
  render() {
    const g = this.g; g.clear();
    const sh = this.shakeOn ? this.trauma * this.trauma * 7 : 0;
    this.cameras.main.setScroll(sh ? Math.sin(this.t * 61) * sh : 0, sh ? Math.cos(this.t * 47) * sh * 0.6 : 0);
    const d = this.def;
    // curtain rail and lamps (lit lamps throw a pool of light)
    g.fillStyle(0x4a4558, 1); g.fillRect(WALL_L, CEIL + 44, WALL_R - WALL_L, 3);
    d.lamps.forEach((lx, i) => {
      const on = this.lampsOn[i];
      const flick = this.reduce ? 1 : (Math.sin(this.t * 17 + i * 3) > 0.97 ? 0.5 : 1);
      if (!on) { g.fillStyle(0x07060d, 0.85); g.fillRect(lx - 25, 22, 50, 11); } // a dead lamp covers the painted one
      else { g.fillStyle(0xfff1c2, 0.06 * flick); g.fillTriangle(lx - 20, 32, lx - 60, FLOOR, lx + 60, FLOOR); }
    });
    // curtain tell: the rail shakes on the side it comes from
    if (this.bstate === 'tellCurtain') {
      const fromLeft = this.bx <= W / 2, j = Math.round(Math.sin(this.t * 80) * 2);
      g.fillStyle(0xff2244, 0.85); g.fillRect(fromLeft ? WALL_L : WALL_R - 110, CEIL + 42 + j, 110, 7);
      g.fillStyle(0xff2244, 0.35); g.fillRect(fromLeft ? WALL_L : WALL_R - 10, FLOOR - 40, 10, 40);
    }
    if (this.curtain) {
      const c = this.curtain, l = Math.round(Math.min(c.x, c.x - c.dir * c.len));
      g.fillStyle(0xc4ccdc, 1); g.fillRect(l, FLOOR - c.h, c.len, c.h);
      g.fillStyle(0x8d95a8, 1); for (let i = 1; i < 5; i++) g.fillRect(l + Math.round((i * c.len) / 5), FLOOR - c.h, 2, c.h);
      g.fillStyle(0x6d6680, 0.8); g.fillRect(Math.round(c.x) - 1, CEIL + 47, 2, FLOOR - c.h - CEIL - 47);
    }
    // IV pole frame under the Matron
    const bend = this.isOpen() || this.bstate === 'sit';
    let bx = this.bx;
    if (this.bstate === 'tellRoll') bx -= this.bDir * 4 + Math.round(Math.sin(this.t * 70));
    g.fillStyle(0x6d6680, 1); g.fillRect(bx - 22, FLOOR - 6, 44, 4);
    g.fillRect(bx + 18 * this.bDir - 1, FLOOR - d.h - 14, 3, d.h + 10);
    g.fillRect(bx + 18 * this.bDir - 7, FLOOR - d.h - 14, 13, 3);
    this.boss.setPosition(bx, FLOOR - 4).setFlipX(this.bDir > 0)
      .setScale(2.9, bend ? 2.9 * 0.78 : 2.9).setRotation(bend ? -0.12 * this.bDir : 0);
    if (this.flashB > 0) this.boss.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL); else this.boss.clearTint();
    // the window: a soft gold outline while she's bent over a bed
    if (bend && this.state === 'fight') {
      const bb = this.bossBox();
      g.lineStyle(2, 0xffd75e, 0.55 + 0.3 * Math.sin(this.t * 10)); g.strokeRect(bb.l - 3, bb.t - 3, bb.r - bb.l + 6, bb.b - bb.t + 3);
    }
    // a clipboard raised before the throw
    if (this.bstate === 'tellBoards') { g.fillStyle(0xefe6cf, 1); g.fillRect(bx - 30 * -this.bDir - 5, FLOOR - d.h - 6, 10, 13); }

    // clipboards
    while (this.clipImgs.length < this.boards.length) this.clipImgs.push(this.add.image(0, 0, 'clipboard').setScale(2).setDepth(6.5));
    this.clipImgs.forEach((im, i) => {
      const b = this.boards[i];
      im.setVisible(!!b);
      if (b) im.setPosition(b.x, b.y).setRotation(b.spin);
    });

    this.drawMilo();

    // lights out: only Milo's lantern
    const dg = this.darkG; dg.clear();
    const showEyes = this.dark > 0.3 && this.bstate !== 'sit';
    if (this.dark > 0.02) {
      const my = FLOOR - this.y - 22, R = 70, FAR = 900, N = 40;
      dg.fillStyle(0x000000, this.dark);
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
        const ix0 = this.x + Math.cos(a0) * R, iy0 = my + Math.sin(a0) * R, ix1 = this.x + Math.cos(a1) * R, iy1 = my + Math.sin(a1) * R;
        const ox0 = this.x + Math.cos(a0) * FAR, oy0 = my + Math.sin(a0) * FAR, ox1 = this.x + Math.cos(a1) * FAR, oy1 = my + Math.sin(a1) * FAR;
        dg.fillTriangle(ix0, iy0, ox0, oy0, ox1, oy1); dg.fillTriangle(ix0, iy0, ox1, oy1, ix1, iy1);
      }
      if (this.state === 'fight') {
        if (this.curtain) { dg.fillStyle(0xffffff, 0.8); dg.fillRect(Math.round(this.curtain.x) - 1, FLOOR - this.curtain.h, 3, this.curtain.h); }
        if (this.bstate === 'tellRoll') { dg.fillStyle(0xff2244, 0.9); dg.fillRect(this.bx - 20, FLOOR - 3, 40, 3); }
      }
    }
    this.bossEyes.setVisible(showEyes).setPosition(bx - this.bDir * -1, FLOOR - 4 - d.h * (bend ? 0.78 : 1) + 20).setFlipX(this.bDir > 0);

    // the penlight beam
    const fx = this.fx; fx.clear();
    if (this.beamT > 0) {
      const y0 = FLOOR - this.y - 30, k = this.beamT / 0.35;
      fx.fillStyle(0xfff6d0, 0.55 * k);
      fx.fillTriangle(this.x, y0, this.x + this.face * 480, y0 - 60, this.x + this.face * 480, y0 + 60);
    }
    // the swing
    if (this.hitT > 0) {
      const k = 1 - this.hitT / HIT_T, a0 = this.face > 0 ? -1.1 : Math.PI - 1.1;
      fx.fillStyle(0xffd75e, 0.5 * (1 - k)); fx.beginPath(); fx.slice(this.x, FLOOR - this.y - 30, HIT_RANGE, a0, a0 + 2.2, false); fx.fillPath();
    }
    // red edge when hurt
    if (this.redEdge > 0) { fx.lineStyle(14, 0xff2244, this.redEdge * 0.55); fx.strokeRect(7, 7, W - 14, H - 14); }

    this.renderUI();
  }

  drawMilo() {
    const m = this.milo, id = this.char;
    const blink = this.inv > 0 && this.booT <= 0 && this.state === 'fight' && Math.floor(this.t * 20) % 2;
    m.setVisible(!blink).setFlipX(this.face < 0);
    if (this.state === 'lost') {
      if (m.anims.isPlaying) m.anims.stop();
      m.setTexture(`${id}_fall`).setRotation(Math.min(1.5, this.endT * 3) * -this.face).setPosition(this.x, FLOOR);
      return;
    }
    m.setRotation(0);
    if (this.dodgeT > 0) {
      if (m.anims.isPlaying) m.anims.stop();
      m.setTexture(`${id}_slide`).setPosition(this.x, FLOOR - this.y + 1);
    } else if (!this.grounded || this.booT > 0) {
      if (m.anims.isPlaying) m.anims.stop();
      m.setTexture(`${id}_${this.vy > -60 ? 'jump' : 'fall'}`).setPosition(this.x, FLOOR - this.y);
    } else if (Math.abs(this.vx) > 30) {
      if (m.anims.currentAnim?.key !== `${id}_run` || !m.anims.isPlaying) m.play(`${id}_run`);
      m.setPosition(this.x, FLOOR);
    } else {
      if (m.anims.isPlaying) m.anims.stop();
      m.setTexture(`${id}_run0`).setPosition(this.x, FLOOR);
    }
    this.boo.setVisible(this.booT > 0);
    if (this.booT > 0) this.boo.setPosition(this.x, FLOOR - this.y - MILO_H - 12);
  }

  renderUI() {
    const u = this.ui; u.clear();
    // her bar, under her name
    u.fillStyle(0x140f24, 0.9); u.fillRect(W / 2 - 101, 19, 202, 8);
    u.fillStyle(0xd9d0a8, 1); u.fillRect(W / 2 - 100, 20, 200 * Math.max(0, this.hp) / this.def.hp, 6);
    // hearts
    for (let i = 0; i < HEARTS; i++) { u.fillStyle(i < this.hearts ? 0xff6b7d : 0x3a3646, 1); u.fillRect(W - 98 + i * 16, 8, 11, 10); }
    // Boo, once per fight
    u.fillStyle(this.booUsed ? 0x3a3646 : 0xe6f0ff, 1); u.fillCircle(W - 110, 13, 5);
    // the power's charge
    const fighting = this.state === 'fight';
    if (this.power) {
      const ready = this.charge >= 1;
      u.fillStyle(0x3a3646, 1); u.fillRect(W - 98, 22, 75, 4);
      u.fillStyle(ready ? 0xffd75e : 0x8c7a4a, 1); u.fillRect(W - 98, 22, 75 * this.charge, 4);
      const showBtn = fighting && ready && this.touch;
      this.powerLabel.setVisible(showBtn);
      if (showBtn) { u.fillStyle(0xffd75e, 0.75 + 0.25 * Math.sin(this.t * 8)); u.fillCircle(POWER_BTN.x, POWER_BTN.y, POWER_BTN.r); }
      if (fighting && ready && !this.touch && !this.noteUntil) this.noteText.setText(Device.get() === 'gamepad' ? 'X  LIGHT' : 'E  LIGHT');
      else if (!this.noteUntil && this.noteText.text.endsWith('LIGHT')) this.noteText.setText('');
    }
    // the left thumb's stick
    const tm = this.thumbs.move;
    if (fighting && tm) {
      const dx = clamp(tm.x - tm.x0, -36, 36);
      u.lineStyle(2, 0xffffff, 0.22); u.strokeCircle(tm.x0, tm.y0, 36);
      u.fillStyle(0xffffff, 0.2); u.fillCircle(tm.x0 + dx, tm.y0, 14);
    }
    this.lineText.setText(this.say.t > 0 ? this.say.text : '').setAlpha(Math.min(1, this.say.t * 3));
  }
}
