// v8: boss arenas (The Story of Vigil). The run pauses at the end of a world and the arena takes over:
// Milo moves, jumps, dodges; his lantern swings on its own when the boss is open (like the runner's weapons,
// so a thumb, a keyboard and a gamepad play the same fight); the ally powers upgrade the 4 actions.
// A boss is fought until it is beaten once (save.story.beaten); after that the run goes past.
//
// Controls, the same 4 actions everywhere:
//   touch:    left half = hold and slide to move; right half = tap to jump (hold = higher), swipe to dodge;
//             the LIGHT button shows only when the power is charged
//   keyboard: A D / arrows move, W / UP / SPACE jump, S / DOWN dodge, E / J light, P / ESC pause
//   gamepad:  stick / d-pad move, A jump, B dodge, X / Y light, START pause
//
// World 1, THE NIGHT MATRON (Ivy's PENLIGHT): rolls bed to bed, curtain sweeps, clipboards, lights out.
// World 2, THE CORONER (Ansel's SHEET): toe tags (a hit files you: slower for 2 s), drawers out of the
// walls (pushers, then platforms), and his lamp: a sweep of light you can't jump or roll through. Only the
// Sheet gets you through it (a dodge under the Sheet = unseen for a moment). He writes on his clipboard: hit him then.
//
// Taken from the best 2D boss fights:
//   Mega Man / Hollow Knight: the first time an attack comes, it comes slower, and one word says what to do.
//   Hollow Knight / Cuphead: a "!" over the boss's head before every attack; a gold outline = you can hit now.
//   Cuphead: lose and you see how close you were. Celeste / Cuphead: retry the arena right away.
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
const SHEET_T = 0.6, SHEET_CD = 1.5; // The Sheet: unseen for 0.6 s, ready again 1.5 s after
const FILED_T = 2.0, FILED_MOVE = 0.55;
const DRAWER_TOP = 22; // a low drawer, pulled out: Milo can stand on it
const ROWS = { low: { t: 22, b: 0 }, mid: { t: 62, b: 38 } }; // drawer rows, px above the floor
const LIGHT_TOP = CEIL + 44;

// one entry per boss
export const BOSSES = {
  matron: {
    kind: 'matron', zone: 'ward', name: 'THE NIGHT MATRON', power: 'penlight', hp: 21, w: 40, h: 75,
    beds: [130, 320, 510], lamps: [63, 223, 383, 543], // the lamps line up with the ward's painted ceiling lamps
    lines: {
      start: 'LIGHTS OUT. EVERYONE IN BED.', half: 'NO RUNNING ON MY WARD.', shove: 'BACK TO BED.',
      dark: 'LIGHTS OUT.', stun: 'WHO HAS A LIGHT ON?', win: ['SHE SITS ON THE LAST BED.', 'SHE FOLDS HER HANDS.'], lose: 'LIGHTS OUT.',
    },
  },
  coroner: {
    kind: 'coroner', zone: 'morgue', name: 'THE CORONER', power: 'sheet', hp: 30, w: 34, h: 78,
    spots: [150, 320, 490], lamps: [],
    lines: {
      start: 'TIME OF DEATH: 3:33.', half: 'YOU WERE DUE AT 3:33.', shove: 'NEXT.', light: 'HOLD STILL.',
      lost: 'WHERE DID YOU GO?', stun: 'WHO TURNED THAT ON?', win: ['HE WRITES ONE MORE NAME.', 'HIS OWN.'], lose: 'FILED.',
    },
  },
};

// the LIGHT button's power (Ivy's), and the powers that change an action
export const POWERS = {
  penlight: { name: 'PENLIGHT', action: 'light', chargeTime: 18, dodge: 0.25, clean: 0.15, stun: 1.3 },
  sheet: { name: 'THE SHEET', action: 'dodge', unseen: SHEET_T, cd: SHEET_CD },
};

const overlap = (a, b) => a.r > b.l && a.l < b.r && a.b > b.t && a.t < b.b;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------------- pixel art (art direction: text rows, 1px outline, drawn in code) ----------------
const OUTLINE = '#0b0918';
export function px(scene, key, rows, pal) {
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
// a grid to paint rows with rectangles (for the bigger sprites)
export function grid(w, h) {
  const g = [...Array(h)].map(() => Array(w).fill('.'));
  return {
    r(x, y, rw, rh, c) { for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) if (j >= 0 && j < h && i >= 0 && i < w) g[j][i] = c; return this; },
    rows() { return g.map((row) => row.join('')); },
  };
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

// Doctor Lisle, who filed every death in Vigil. Faces left. Thin, a white coat, round glasses, a head mirror.
const CORONER = [
  '......hhhh......',
  '.....hhhhhh.....',
  '....RRssssss....',
  '...RWRssssss....',
  '....RRsssss.....',
  '....GgGgsss.....',
  '....ssssssss....',
  '.....ssmmss.....',
  '......ssss......',
  '.......ss.......',
  '.....cccccc.....',
  '....ccTccccc....',
  '...cccTccccccc..',
  '...cc.Tccccc.cc.',
  '...cc.cccccc.cc.',
  '...ss.cccccc.ss.',
  '......cccccc....',
  '......cccccc....',
  '.....ccccccc....',
  '.....cccCcccc...',
  '.....cccCcccc...',
  '....ccccCccccc..',
  '....ccccCccccc..',
  '......pp.pp.....',
  '......pp.pp.....',
  '......pp.pp.....',
  '......pp.pp.....',
  '.....kkk.kkk....',
];
const CORONER_PAL = { h: '#9a96a8', R: '#c9c2a0', W: '#fff6d0', s: '#c8c4bc', G: '#bfe4ff', g: '#2a2436', m: '#5e5058', c: '#e4eaec', C: '#aeb8bc', T: '#34465c', p: '#2a2436', k: '#141020' };
// a toe tag on its string
const TAG = ['..s..', '.s...', 'ttttt', 'tottt', 'ttttt', 'tlllt', 'ttttt'];
const TAG_PAL = { s: '#b8a888', t: '#e2d3a2', o: '#3a3028', l: '#6a5a40' };

export class BossScene extends Phaser.Scene {
  constructor() { super('boss'); }

  init(data) {
    this.bossId = BOSSES[data.boss] ? data.boss : 'matron';
    this.def = BOSSES[this.bossId];
    this.kind = this.def.kind;
    this.powers = data.powers || [];
    this.char = data.char || 'survivor';
    this.onEnd = data.onEnd || (() => {});
    this.reduce = !!data.reduceFlicker;
    this.shakeOn = data.shake !== false;
    this.t = 0; this.acc = 0; this.state = 'intro'; this.introT = 0; this.endT = 0; this.paused = false; this.done = false;
    // Milo
    this.x = 150; this.y = 0; this.vx = 0; this.vy = 0; this.face = 1;
    this.grounded = true; this.coyote = 0; this.buffer = 0;
    this.dodgeT = 0; this.dodgeCd = 0; this.dodgeDir = 1;
    this.hitT = 0; this.hitCd = 0; this.hitDone = false;
    this.hearts = HEARTS; this.inv = 0; this.booUsed = false; this.booT = 0; this.booX = 0;
    // every power Milo has so far: the penlight is the LIGHT button, the sheet changes the dodge
    this.power = this.powers.includes('penlight') ? POWERS.penlight : null;
    this.sheet = this.powers.includes('sheet');
    this.charge = this.power ? 0.35 : 0; this.beamT = 0; this.cleanAttack = true;
    this.unseenT = 0; this.sheetCd = 0; this.seenX = this.x; this.filedT = 0;
    // the boss
    const d = this.def;
    this.bx = this.kind === 'matron' ? d.beds[2] : d.spots[2];
    this.hp = d.hp; this.bstate = 'idle'; this.bt = 0.9; this.bTarget = this.bx; this.bDir = -1;
    this.flashB = 0; this.queue = this.kind === 'coroner' ? ['tags', 'drawers', 'light'] : [];
    this.lastAttack = ''; this.checkHits = 0; this.passedThisRoll = false; this.sinceLight = 0;
    this.curtain = null; this.boards = []; this.tags = []; this.drawers = []; this.col = null; this.lostYou = false; this.toThrow = [];
    this.lightTaught = false; this.bossAlpha = 1;
    this.data0 = data; this.tries = data.tries || 0;
    this.taught = new Set(data.taught || []); // what the fight has already taught (kept across retries)
    this.prompt = { text: '', t: 0 }; this.bangT = 0; this.slowTell = 1; this.choice = null;
    this.dark = 0; this.darkWant = 0; this.lampsOn = d.lamps.map(() => 1);
    this.trauma = 0; this.freeze = 0; this.redEdge = 0;
    this.stats = { hits: 0, taken: 0, dodges: 0, lights: 0, sheets: 0, time: 0 };
    this.say = { text: '', t: 0 };
    this.thumbs = { move: null, act: null };
    this.act = { left: false, right: false, jumpHeld: false, jump: false, dodge: false, dodgeDir: 0, power: false, cancelJump: false };
  }

  create() {
    px(this, 'matron', MATRON, MATRON_PAL);
    px(this, 'matron_eyes', MATRON_EYES, { E: '#ff3355' });
    px(this, 'bed', BED, BED_PAL);
    px(this, 'clipboard', CLIPBOARD, CLIP_PAL);
    px(this, 'coroner', CORONER, CORONER_PAL);
    px(this, 'toe_tag', TAG, TAG_PAL);
    this.inputMap = createInput(this, { pointers: false });
    this.input.addPointer(2);
    const z = this.def.zone;
    // the world's own painted layers, still
    for (const [k, depth] of [['sky', 0], ['far', 1], ['mid', 2], ['near', 3]]) {
      if (this.textures.exists(`${z}_${k}`)) this.add.tileSprite(0, 0, W, H, `${z}_${k}`).setOrigin(0).setTileScale(2).setDepth(depth).setTilePosition(k === 'near' ? 40 : 0, 0);
    }
    this.add.rectangle(0, 0, W, H, 0x07060d, 0.45).setOrigin(0).setDepth(3.5); // the arena reads over the world
    if (this.textures.exists(`${z}_edge`)) this.add.tileSprite(0, 0, W, H, `${z}_edge`).setOrigin(0).setTileScale(2).setDepth(4);
    this.wallG = this.add.graphics().setDepth(4.6); // the cold room's walls of drawers
    this.g = this.add.graphics().setDepth(5);
    this.beds = this.kind === 'matron' ? this.def.beds.map((bx) => this.add.image(bx, FLOOR + 1, 'bed').setOrigin(0.5, 1).setScale(3).setDepth(5.5)) : [];
    this.boss = this.add.image(this.bx, FLOOR, this.kind).setOrigin(0.5, 1).setScale(2.9).setDepth(6);
    this.bossEyes = this.add.image(0, 0, 'matron_eyes').setScale(2.9).setDepth(9.2).setVisible(false);
    this.clipImgs = []; this.tagImgs = [];
    this.drawerG = this.add.graphics().setDepth(6.2);
    this.milo = this.add.sprite(this.x, FLOOR, `${this.char}_run0`).setOrigin(0.5, 1).setScale(MILO_SCALE).setDepth(7);
    this.stuckTag = this.add.image(0, 0, 'toe_tag').setScale(2).setDepth(7.2).setVisible(false);
    this.sheetG = this.add.graphics().setDepth(7.3);
    this.boo = this.add.image(0, 0, 'ghost0').setScale(2.4).setDepth(7.5).setVisible(false);
    this.lightG = this.add.graphics().setDepth(7.6).setBlendMode(Phaser.BlendModes.ADD);
    this.fx = this.add.graphics().setDepth(8);
    this.darkG = this.add.graphics().setDepth(9);
    this.ui = this.add.graphics().setDepth(20);
    this.nameText = text(this, W / 2, 10, this.def.name, 8, '#d9d0a8').setDepth(21);
    this.lineText = text(this, W / 2, 58, '', 12, '#e6f0ff').setDepth(21).setStroke('#07060d', 5);
    this.noteText = text(this, W / 2, 84, '', 8, '#a99fd0').setDepth(21).setStroke('#07060d', 4);
    this.bigText = text(this, W / 2, 130, '', 16, '#e6f0ff').setDepth(21).setStroke('#07060d', 6);
    this.subText = text(this, W / 2, 160, '', 10, '#a99fd0').setDepth(21).setStroke('#07060d', 4);
    this.powerLabel = text(this, POWER_BTN.x, POWER_BTN.y, 'LIGHT', 6, '#2a2410').setDepth(22).setVisible(false);
    this.promptText = text(this, W / 2, 108, '', 12, '#ffd75e').setDepth(21).setStroke('#07060d', 5);
    this.bangText = text(this, 0, 0, '!', 16, '#ff5a3a').setDepth(21).setStroke('#07060d', 5).setVisible(false);
    this.retryText = text(this, W / 2 - 90, 250, 'TRY AGAIN', 10, '#07060d').setDepth(23).setVisible(false);
    this.quitText = text(this, W / 2 + 90, 250, 'GIVE UP', 10, '#e6f0ff').setDepth(23).setVisible(false);
    this.pauseText = text(this, W / 2, H / 2, 'PAUSED', 16, '#e6f0ff').setDepth(30).setStroke('#07060d', 6).setVisible(false);
    if (this.kind === 'coroner') this.nine = text(this, WALL_R + 12, FLOOR - 90, '9', 8, '#2a2436').setDepth(4.7);
    this.touch = Device.get() === 'touch';

    // two-thumb touch
    this.input.on('pointerdown', (p) => {
      this.touch = true;
      if (this.paused) { this.togglePause(); return; }
      if (this.choice) { if (Math.abs(p.y - 250) < 30) { if (Math.abs(p.x - (W / 2 - 90)) < 80) this.retry(); else if (Math.abs(p.x - (W / 2 + 90)) < 80) this.giveUp(); } return; }
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

  // the first time each attack comes it is slower, and one line says what to do
  teach(id, line) {
    this.bangT = 0.45; // "!" over the head before every attack
    if (this.taught.has(id)) return 1;
    this.taught.add(id);
    this.prompt = { text: line, t: 2.2 };
    return 1.7;
  }

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
  note(str, sec) { this.noteText.setText(str); this.noteUntil = this.t + sec; }

  update(_time, delta) {
    const im = this.inputMap; im.update();
    if (im.pressed('pause') && (this.state === 'fight' || this.paused)) this.togglePause();
    if (this.paused) return;
    if (this.choice) {
      if (im.pressed('confirm') || im.pressed('float')) this.retry();
      else if (im.pressed('back') || im.pressed('slide')) this.giveUp();
    }
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
    this.prompt.t = Math.max(0, this.prompt.t - dt); this.bangT = Math.max(0, this.bangT - dt);
    this.trauma = Math.max(0, this.trauma - dt * 2.2);
    this.redEdge = Math.max(0, this.redEdge - dt * 2.5);
    this.t += dt;
    if (this.state === 'intro') {
      this.introT += dt;
      if (this.introT > 1.6) { this.state = 'fight'; this.note(this.hint(), 4.5); }
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
  unseen() { return this.unseenT > 0; }

  // what Milo can stand on: the floor, or the top of a low drawer that's out
  support(x) {
    for (const d of this.drawers) {
      if (d.row !== 'low' || d.state === 'tell') continue;
      const b = this.drawerBox(d);
      if (x > b.l + 4 && x < b.r - 2 && b.r - b.l > 30) return DRAWER_TOP;
    }
    return 0;
  }

  stepMilo(dt) {
    const a = this.act;
    this.inv = Math.max(0, this.inv - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.hitCd = Math.max(0, this.hitCd - dt);
    this.sheetCd = Math.max(0, this.sheetCd - dt);
    this.filedT = Math.max(0, this.filedT - dt);
    if (this.unseenT > 0) this.unseenT -= dt; else this.seenX = this.x;
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
      if (this.sheet && this.sheetCd <= 0) { // The Sheet: for a moment nobody can see you
        this.unseenT = SHEET_T; this.sheetCd = SHEET_CD; this.stats.sheets++;
        Audio.sfx('sheet');
      }
    }
    const slow = this.filedT > 0 ? FILED_MOVE : 1;
    if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      this.vx = this.dodgeDir * DODGE_V * (this.filedT > 0 ? 0.75 : 1);
      if (!this.grounded) this.vy = Math.max(this.vy, -80);
    } else {
      const acc = this.grounded ? ACCEL : AIR_ACCEL;
      this.vx += clamp(dir * MOVE * slow - this.vx, -acc * dt, acc * dt);
    }
    this.buffer = a.jump ? BUFFER : Math.max(0, this.buffer - dt);
    this.coyote = this.grounded ? COYOTE : Math.max(0, this.coyote - dt);
    if (this.buffer > 0 && this.coyote > 0 && this.dodgeT <= 0) {
      this.vy = JUMP_V * (this.filedT > 0 ? 0.82 : 1); this.grounded = false; this.buffer = 0; this.coyote = 0; Audio.sfx('jump');
    }
    if (!a.jumpHeld && this.vy > 0 && !this.grounded) this.vy *= Math.pow(JUMP_CUT, dt * 20);
    this.x = clamp(this.x + this.vx * dt, WALL_L + MILO_W / 2, WALL_R - MILO_W / 2);
    const sup = this.support(this.x), prevY = this.y;
    if (this.grounded && this.y > sup + 0.5) this.grounded = false; // the drawer went back in under him
    if (!this.grounded) { this.vy -= GRAV * dt; this.y += this.vy * dt; }
    if (!this.grounded && this.vy <= 0 && this.y <= sup && prevY >= sup - 1) { this.y = sup; this.vy = 0; this.grounded = true; }
    if (this.y < 0) { this.y = 0; this.vy = 0; this.grounded = true; }

    // the lantern swings on its own when the boss is open and in reach
    if (this.power) this.charge = Math.min(1, this.charge + dt / this.power.chargeTime);
    const reach = HIT_RANGE + this.def.w / 2 - 4;
    if (this.isOpen() && this.hitCd <= 0 && this.dodgeT <= 0 && Math.abs(this.bx - this.x) < reach && this.y < 40) {
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
      this.curtain = null; this.boards = []; this.col = null; this.toThrow = [];
      for (const d of this.drawers) if (d.state === 'tell' || d.state === 'out') { d.state = 'hold'; d.t = 0.6; }
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

  // light = it's a light that finds you: a dodge doesn't help, only being unseen does
  hurt(fromX, light = false) {
    if (this.inv > 0 || this.booT > 0) return false;
    if (this.unseen()) return false; // under the Sheet: it goes right through you
    if (!light && this.dodgeT > 0) return false;
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
  file() { // a toe tag or his lamp: you're filed, slow for a moment
    this.filedT = FILED_T;
    Audio.sfx('tag');
  }

  stepBoss(dt) {
    this.flashB = Math.max(0, this.flashB - dt);
    this.bt -= dt;
    const p2 = this.hp <= Math.ceil(this.def.hp / 2);
    if (this.kind === 'coroner') this.stepCoroner(dt, p2); else this.stepMatron(dt, p2);
  }

  // ---- the Matron: an attack, then she stops at a bed to check it (the window) ----
  stepMatron(dt, p2) {
    const d = this.def, s = this.bstate;
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
      if (!this.hurt(this.bx) && (this.dodgeT > 0 || this.unseen()) && !this.passedThisRoll) {
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
    if (p2 && this.darkWant === 0 && Math.random() < 0.45) { this.bstate = 'lights'; this.bt = 1.0 * this.teach('lights', 'STAY IN YOUR LANTERN LIGHT'); this.talk(this.def.lines.dark, 1.0); return; }
    const a = this.queue.shift() || this.pick(['roll', 'curtain', 'boards'], true);
    this.lastAttack = a; this.cleanAttack = true;
    const beds = this.def.beds;
    if (a === 'roll') { // she charges through Milo to the bed on his far side
      const side = this.x > this.bx ? 1 : -1;
      const beyond = beds.filter((b) => (b - this.x) * side > 40);
      this.bTarget = beyond.length ? (side > 0 ? beyond[0] : beyond[beyond.length - 1]) : (side > 0 ? beds[2] : beds[0]);
      if (Math.abs(this.bTarget - this.bx) < 20) this.bTarget = this.bx > W / 2 ? beds[0] : beds[2];
      this.bDir = Math.sign(this.bTarget - this.bx) || 1;
      this.bstate = 'tellRoll'; this.bt = (p2 ? 0.45 : 0.65) * this.teach('roll', 'SHE CHARGES. DODGE THROUGH HER'); this.passedThisRoll = false;
      Audio.sfx('creak');
    } else if (a === 'curtain') { this.bstate = 'tellCurtain'; this.bt = (p2 ? 0.55 : 0.75) * this.teach('curtain', 'A CURTAIN ON THE FLOOR. JUMP IT'); Audio.sfx('warn'); }
    else { this.bstate = 'tellBoards'; this.bt = (p2 ? 0.4 : 0.55) * this.teach('boards', 'CLIPBOARDS. MOVE AWAY'); }
  }

  check(p2) {
    if (this.power && this.cleanAttack && this.lastAttack !== 'roll') this.charge = Math.min(1, this.charge + this.power.clean);
    this.bstate = 'check'; this.bt = p2 ? 1.15 : 1.6; this.checkHits = 0;
    if (!this.taught.has('open')) { this.taught.add('open'); this.prompt = { text: 'GOLD = OPEN. GET CLOSE TO HIT', t: 2.6 }; this.bt += 1.0; }
    if (this.kind !== 'matron') return;
    let nb = this.def.beds[0];
    for (const b of this.def.beds) if (Math.abs(b - this.bx) < Math.abs(nb - this.bx)) nb = b;
    if (Math.abs(nb - this.bx) < 55) this.bx = nb;
  }

  // ---- the Coroner: an attack, then he stops to write on his clipboard (the window), then walks on ----
  stepCoroner(dt, p2) {
    const s = this.bstate;
    if (s !== 'walk' && s !== 'stunned' && s !== 'check') this.bDir = Math.sign(this.x - this.bx) || this.bDir; // he watches you
    if (s === 'idle' && this.bt <= 0) this.coronerAttack(p2);
    else if (s === 'walk') {
      const v = p2 ? 210 : 160;
      this.bDir = Math.sign(this.bTarget - this.bx) || this.bDir;
      this.bx += this.bDir * v * dt;
      if (Math.abs(this.bTarget - this.bx) < v * dt + 1) { this.bx = this.bTarget; this.bstate = 'idle'; this.bt = p2 ? 0.2 : 0.35; }
    } else if (s === 'tellTags' && this.bt <= 0) {
      this.bstate = 'tags'; this.bt = 0;
      const n = p2 ? 5 : 3;
      this.toThrow = [...Array(n)].map((_, i) => ({ at: i * 0.17, i, n }));
      this.throwT = 0;
    } else if (s === 'tags') {
      this.throwT += dt;
      while (this.toThrow.length && this.toThrow[0].at <= this.throwT) this.throwTag(this.toThrow.shift(), p2);
      if (!this.toThrow.length && this.tags.every((g) => g.stuck)) this.check(p2);
    } else if (s === 'tellDrawers' && this.bt <= 0) {
      this.bstate = 'drawers';
      for (const d of this.drawers) if (d.state === 'tell') { d.state = 'out'; Audio.sfx('drawer'); }
    } else if (s === 'drawers') {
      if (this.drawers.every((d) => d.state !== 'tell' && d.state !== 'out')) this.check(p2);
    } else if (s === 'tellLight' && this.bt <= 0) {
      this.bstate = 'light';
      const dir = Math.sign(this.x - this.bx) || -this.bDir || 1;
      this.col = { x: this.bx + dir * 24, dir, v: p2 ? 330 : 270, w: 66, back: p2 };
      this.lostYou = false;
      Audio.sfx('lamp');
    } else if (s === 'light' && !this.col) {
      if (this.lostYou) { this.talk(this.def.lines.lost, 1.4); this.check(p2); this.bt += 0.7; if (this.power) this.charge = Math.min(1, this.charge + 0.3); }
      else this.check(p2);
    } else if (s === 'stunned' && this.bt <= 0) { this.bstate = 'idle'; this.bt = 0.45; }
    else if (s === 'check' && this.bt <= 0) this.walkOn();
    if (s === 'check' && Math.floor(this.t * 9) !== this.scribble) { this.scribble = Math.floor(this.t * 9); if (this.scribble % 3 === 0) Audio.sfx('pen'); }
  }

  walkOn() {
    // to a spot away from Milo (he keeps his distance)
    const far = this.def.spots.filter((x) => Math.abs(x - this.x) > 130 && Math.abs(x - this.bx) > 20);
    this.bTarget = far.length ? far[Math.floor(Math.random() * far.length)] : this.def.spots.reduce((a, b) => (Math.abs(b - this.x) > Math.abs(a - this.x) ? b : a));
    if (Math.abs(this.bTarget - this.bx) < 20) { this.bstate = 'idle'; this.bt = 0.4; return; }
    this.bstate = 'walk';
  }

  coronerAttack(p2) {
    let a = this.queue.shift();
    if (!a) {
      const list = ['tags', 'drawers'].concat(this.sheet ? ['light'] : []);
      a = this.sheet && this.sinceLight >= 2 ? 'light' : this.pick(list, true);
    }
    if (a === 'light' && !this.sheet) a = 'tags';
    this.sinceLight = a === 'light' ? 0 : this.sinceLight + 1;
    this.lastAttack = a; this.cleanAttack = true;
    if (a === 'tags') { this.bstate = 'tellTags'; this.bt = (p2 ? 0.4 : 0.6) * this.teach('tags', 'TOE TAGS. MOVE AWAY'); Audio.sfx('creak'); }
    else if (a === 'drawers') {
      this.bstate = 'tellDrawers'; this.bt = (p2 ? 0.5 : 0.7) * this.teach('drawers', 'A DRAWER. JUMP ON IT');
      const near = this.x < W / 2 ? -1 : 1; // from the wall Milo is nearer to
      this.drawers.push(this.makeDrawer(near, 'low', p2 ? 250 : 210));
      if (p2) this.drawers.push(this.makeDrawer(-near, 'mid', 300, 0.3));
      Audio.sfx('creak');
    } else {
      this.bstate = 'tellLight'; this.bt = (p2 ? 0.65 : 0.85) * this.teach('light', 'DODGE INTO THE LIGHT. THE SHEET HIDES YOU');
      this.talk(this.def.lines.light, 1.0); Audio.sfx('warn');
    }
  }

  makeDrawer(side, row, max, delay = 0) {
    return { side, row, max, len: 0, state: 'tell', t: 0, delay, v: 760 };
  }
  drawerBox(d) {
    const r = ROWS[d.row];
    const l = d.side < 0 ? WALL_L : WALL_R - d.len, rr = d.side < 0 ? WALL_L + d.len : WALL_R;
    return { l, r: rr, t: FLOOR - r.t, b: FLOOR - r.b };
  }

  throwTag(spec, p2) {
    // he aims where he last saw you
    const hx = this.bx + this.bDir * 14, hy = FLOOR - 60, T = 0.72;
    const tx = clamp(this.seenX + (spec.i - (spec.n - 1) / 2) * (p2 ? 46 : 54), WALL_L + 10, WALL_R - 10);
    this.tags.push({ x: hx, y: hy, vx: (tx - hx) / T, vy: ((FLOOR - 18) - hy - 400 * T * T) / T, spin: 0, stuck: false, life: 0.9 });
    Audio.sfx('swoosh');
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
    // toe tags: a hit files you
    for (const g of this.tags) {
      if (g.stuck) { g.life -= dt; if (g.life <= 0) g.gone = true; continue; }
      g.vy += 800 * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.spin += dt * 16;
      if (overlap(m, { l: g.x - 6, r: g.x + 6, t: g.y - 7, b: g.y + 7 }) && this.hurt(g.x)) { g.gone = true; this.file(); continue; }
      if (g.y > FLOOR - 6) { g.y = FLOOR - 6; g.stuck = true; g.spin = 0.4; Audio.sfx('tick'); }
    }
    this.tags = this.tags.filter((g) => !g.gone);
    // drawers: they shove you while they slide out, then they're a step to stand on, then they go back in
    for (const d of this.drawers) {
      if (d.state === 'tell') continue;
      if (d.delay > 0) { d.delay -= dt; if (d.delay <= 0) Audio.sfx('drawer'); continue; }
      if (d.state === 'out') {
        d.len = Math.min(d.max, d.len + d.v * dt);
        const b = this.drawerBox(d);
        const onTop = d.row === 'low' && this.y >= DRAWER_TOP - 2;
        if (!onTop && overlap(m, b) && this.hurt(d.side < 0 ? WALL_L : WALL_R)) this.trauma = Math.max(this.trauma, 0.4);
        if (d.len >= d.max) { d.state = 'hold'; d.t = 1.4; this.trauma = Math.max(this.trauma, 0.15); Audio.sfx('bounce'); }
      } else if (d.state === 'hold') { d.t -= dt; if (d.t <= 0) d.state = 'in'; }
      else if (d.state === 'in') { d.len -= 320 * dt; if (d.len <= 0) d.gone = true; }
    }
    this.drawers = this.drawers.filter((d) => !d.gone);
    // his lamp: a column of light across the room. Only the Sheet gets you through it
    if (this.col) {
      const c = this.col;
      c.x += c.dir * c.v * dt;
      const box = { l: c.x - c.w / 2, r: c.x + c.w / 2, t: LIGHT_TOP, b: FLOOR };
      if (overlap(m, box)) {
        if (this.unseen()) { if (!this.lostYou) { this.lostYou = true; Audio.sfx('whisper'); } }
        else if (this.hurt(c.x, true)) this.file();
      }
      const out = c.dir > 0 ? c.x - c.w / 2 > WALL_R : c.x + c.w / 2 < WALL_L;
      if (out) this.col = c.back ? { ...c, dir: -c.dir, x: c.dir > 0 ? WALL_R + c.w / 2 : WALL_L - c.w / 2, back: false, v: c.v * 1.1 } : null;
    }
  }

  win() {
    this.state = 'won'; this.endT = 0; this.curtain = null; this.boards = []; this.tags = []; this.col = null; this.toThrow = []; this.darkWant = 0;
    for (const d of this.drawers) d.state = 'in';
    this.bstate = 'sit';
    this.lampsOn = this.def.lamps.map(() => 1);
    this.thumbs = { move: null, act: null };
    Audio.sfx('win');
    this.noteText.setText('');
    // the Matron rolls back to the last bed and sits; the Coroner stops where he is and writes
    this.sitFrom = this.bx; this.sitTo = this.kind === 'matron' ? this.def.beds[this.def.beds.length - 1] : this.bx;
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
      this.stepHazards(dt); // drawers slide back in
      const k = Math.min(1, this.endT / 1.2);
      this.bx = this.sitFrom + (this.sitTo - this.sitFrom) * (1 - Math.pow(1 - k, 3));
      if (this.kind === 'coroner') {
        if (Math.floor(this.endT * 9) !== this.scribble && this.endT < 2.2) { this.scribble = Math.floor(this.endT * 9); if (this.scribble % 3 === 0) Audio.sfx('pen'); }
        this.bossAlpha = this.endT < 2.4 ? 1 : Math.max(0, 1 - (this.endT - 2.4) / 1.4); // then he isn't there
      }
      const [a, b] = this.def.lines.win;
      if (this.endT > 1.2 && !this.bigText.text) this.bigText.setText(a);
      if (this.endT > 2.2 && !this.subText.text) this.subText.setText(b);
      if (this.endT > 4.2 && !this.done) this.finish(true);
    } else {
      if (this.endT > 0.3 && !this.bigText.text) this.bigText.setText(this.def.lines.lose || 'LIGHTS OUT.');
      // Cuphead: how close you were. Then retry right here, or give up (the run ends)
      if (this.endT > 1.0 && !this.subText.text) this.subText.setText(`${Math.round(100 * (1 - Math.max(0, this.hp) / this.def.hp))}% OF THE WAY THERE`);
      if (this.endT > 1.3 && !this.choice && !this.done) {
        this.choice = true; this.inputMap.update();
        const d = this.touch ? null : Device.get() === 'gamepad' ? ['A', 'B'] : ['W', 'S'];
        this.retryText.setText(d ? `${d[0]}  TRY AGAIN` : 'TRY AGAIN').setVisible(true);
        this.quitText.setText(d ? `${d[1]}  GIVE UP` : 'GIVE UP').setVisible(true);
      }
    }
  }

  retry() {
    if (!this.choice || this.done) return;
    this.choice = null; this.done = true;
    Audio.sfx('click');
    this.cameras.main.fadeOut(250, 7, 6, 13);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart({ ...this.data0, tries: this.tries + 1, taught: [...this.taught] }));
  }
  giveUp() {
    if (!this.choice || this.done) return;
    this.choice = null;
    this.retryText.setVisible(false); this.quitText.setVisible(false);
    this.finish(false);
  }

  finish(won) {
    this.done = true;
    window.__boss = null;
    this.cameras.main.fadeOut(300, 7, 6, 13);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const res = { won, time: this.stats.time, hits: this.stats.hits, taken: this.stats.taken, lights: this.stats.lights, sheets: this.stats.sheets, boo: this.booUsed };
      this.scene.stop();
      this.onEnd(res);
    });
  }

  // ---------------- drawing ----------------
  render() {
    const g = this.g; g.clear();
    const sh = this.shakeOn ? this.trauma * this.trauma * 7 : 0;
    this.cameras.main.setScroll(sh ? Math.sin(this.t * 61) * sh : 0, sh ? Math.cos(this.t * 47) * sh * 0.6 : 0);
    this.fx.clear(); this.lightG.clear(); this.sheetG.clear();
    if (this.kind === 'coroner') this.renderCoroner(g); else this.renderMatron(g);
    this.drawMilo();
    this.renderDark();
    const fx = this.fx;
    // the penlight beam
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

  renderMatron(g) {
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
    this.flashTint();
    this.windowOutline(g, bend);
    // a clipboard raised before the throw
    if (this.bstate === 'tellBoards') { g.fillStyle(0xefe6cf, 1); g.fillRect(bx - 30 * -this.bDir - 5, FLOOR - d.h - 6, 10, 13); }
    // clipboards
    while (this.clipImgs.length < this.boards.length) this.clipImgs.push(this.add.image(0, 0, 'clipboard').setScale(2).setDepth(6.5));
    this.clipImgs.forEach((im, i) => {
      const b = this.boards[i];
      im.setVisible(!!b);
      if (b) im.setPosition(b.x, b.y).setRotation(b.spin);
    });
    this.bossEyes.setVisible(this.dark > 0.3 && this.bstate !== 'sit').setPosition(bx - this.bDir * -1, FLOOR - 4 - d.h * (bend ? 0.78 : 1) + 20).setFlipX(this.bDir > 0);
  }

  flashTint() {
    if (this.flashB > 0) this.boss.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL); else this.boss.clearTint();
  }
  // the window: a soft gold outline while the boss is open
  windowOutline(g, open) {
    if (!open || this.state !== 'fight') return;
    const bb = this.bossBox();
    g.lineStyle(2, 0xffd75e, 0.55 + 0.3 * Math.sin(this.t * 10)); g.strokeRect(bb.l - 3, bb.t - 3, bb.r - bb.l + 6, bb.b - bb.t + 3);
  }

  // one drawer face in the wall (x = its outer edge), and the drawer itself when it's out
  renderCoroner(g) {
    const d = this.def, wg = this.wallG; wg.clear();
    // the walls are banks of drawers: three rows a side, cold steel
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? 0 : WALL_R;
      wg.fillStyle(0x2c3340, 1); wg.fillRect(x0, CEIL + 30, WALL_L, FLOOR - CEIL - 30);
      for (const [top, bot] of [[22, 0], [62, 38], [102, 78], [142, 118]]) {
        const tell = this.drawers.some((dr) => dr.side === side && dr.state === 'tell' && ROWS[dr.row].t === top) || this.drawers.some((dr) => dr.side === side && dr.delay > 0 && ROWS[dr.row].t === top);
        const j = tell && !this.reduce ? Math.round(Math.sin(this.t * 90) * 1.5) : 0;
        wg.fillStyle(0x7d8a98, 1); wg.fillRect(x0 + 1 + j, FLOOR - top, WALL_L - 2, top - bot);
        wg.fillStyle(0x56616e, 1); wg.fillRect(x0 + 1 + j, FLOOR - bot - 3, WALL_L - 2, 3);
        wg.fillStyle(0xc9d2da, 1); wg.fillRect(x0 + (side < 0 ? 16 : 4) + j, FLOOR - (top + bot) / 2 - 2, 4, 3); // the handle
        wg.fillStyle(0xd8c89a, 1); wg.fillRect(x0 + 8 + j, FLOOR - top + 3, 7, 4); // the name card
        if (tell) { wg.lineStyle(2, 0xff2244, 0.9); wg.strokeRect(x0 + 1, FLOOR - top - 1, WALL_L - 2, top - bot + 2); }
      }
    }
    // the drawers that are out: a steel tray with a lip, a handle at the end
    const dg = this.drawerG; dg.clear();
    for (const dr of this.drawers) {
      if (dr.len <= 0) continue;
      const b = this.drawerBox(dr), front = dr.side < 0 ? b.r : b.l;
      dg.fillStyle(0x56616e, 1); dg.fillRect(b.l, b.t, b.r - b.l, b.b - b.t);
      dg.fillStyle(0x9aa6b2, 1); dg.fillRect(b.l, b.t, b.r - b.l, 4);           // its top, where you can stand
      dg.fillStyle(0x3a424e, 1); dg.fillRect(b.l, b.b - 3, b.r - b.l, 3);
      dg.fillStyle(0x7d8a98, 1); dg.fillRect(front - (dr.side < 0 ? 6 : 0), b.t, 6, b.b - b.t); // the drawer front
      dg.fillStyle(0xc9d2da, 1); dg.fillRect(front + (dr.side < 0 ? 0 : -3), (b.t + b.b) / 2 - 2, 3, 4);
      if (dr.state === 'out') { dg.fillStyle(0xff5a3a, 0.35); dg.fillRect(front - (dr.side < 0 ? 8 : -2), b.t, 6, b.b - b.t); } // the edge that hurts
    }
    // his lamp: the tell (the mirror lights, a thin line to the floor), then the sweep
    const lg = this.lightG;
    const bx = this.bx + (this.bstate === 'walk' ? 0 : 0), bob = this.bstate === 'walk' ? Math.abs(Math.sin(this.t * 9)) * 2 : 0;
    const mirror = { x: bx + this.bDir * 7, y: FLOOR - d.h - 3 - bob };
    if (this.bstate === 'tellLight') {
      const k = Math.max(0, Math.min(1, 1 - Math.max(0, this.bt) / 0.85));
      lg.fillStyle(0xfff6d0, 0.5 + 0.5 * k); lg.fillCircle(mirror.x, mirror.y, 4 + 3 * k);
      const tx = this.bx + (Math.sign(this.x - this.bx) || 1) * 24;
      lg.fillStyle(0xdfefff, 0.18 + 0.3 * k); lg.fillRect(tx - 2, LIGHT_TOP, 4, FLOOR - LIGHT_TOP);
    }
    if (this.col) {
      const c = this.col, l = c.x - c.w / 2, r = c.x + c.w / 2;
      lg.fillStyle(0xfff6d0, 0.9); lg.fillCircle(mirror.x, mirror.y, 6);
      lg.fillStyle(0xdfefff, 0.12); lg.fillTriangle(mirror.x, mirror.y, l, FLOOR, r, FLOOR);
      lg.fillStyle(0xdfefff, 0.32); lg.fillRect(l, LIGHT_TOP, c.w, FLOOR - LIGHT_TOP);
      lg.fillStyle(0xffffff, 0.55); lg.fillRect(l, LIGHT_TOP, 3, FLOOR - LIGHT_TOP); lg.fillRect(r - 3, LIGHT_TOP, 3, FLOOR - LIGHT_TOP);
      lg.fillStyle(0xffffff, 0.35); lg.fillRect(l, FLOOR - 4, c.w, 4); // where it touches the floor
    }
    // the man himself
    const open = this.isOpen() || this.bstate === 'sit';
    this.boss.setPosition(bx, FLOOR - bob).setFlipX(this.bDir > 0).setAlpha(this.bossAlpha)
      .setScale(2.9, 2.9).setRotation(this.bstate === 'stunned' ? 0.08 * this.bDir : this.bstate === 'check' || this.bstate === 'sit' ? -0.05 * this.bDir : 0);
    this.flashTint();
    this.windowOutline(g, this.isOpen());
    // writing: the clipboard held up, a pen moving (the window)
    if (open) {
      const cx = bx + this.bDir * 12, cy = FLOOR - 46;
      g.fillStyle(0x0b0918, this.bossAlpha); g.fillRect(cx - 9, cy - 10, 18, 22);
      g.fillStyle(0x6a5238, this.bossAlpha); g.fillRect(cx - 8, cy - 9, 16, 20);
      g.fillStyle(0xefe6cf, this.bossAlpha); g.fillRect(cx - 6, cy - 6, 12, 15);
      g.fillStyle(0x8a8070, this.bossAlpha); for (let i = 0; i < 4; i++) g.fillRect(cx - 4, cy - 4 + i * 3, 8 - (i === 3 ? 3 : 0), 1);
      const pen = Math.sin(this.t * 30) * 3;
      g.fillStyle(0x141020, this.bossAlpha); g.fillRect(cx - 2 + pen, cy - 2 + (Math.floor(this.t * 6) % 3) * 3, 2, 7);
    }
    // a tag in his raised hand before the throw
    if (this.bstate === 'tellTags' || (this.bstate === 'tags' && this.toThrow.length)) {
      g.fillStyle(0xe2d3a2, 1); g.fillRect(bx + this.bDir * 16 - 3, FLOOR - d.h - 4 + Math.sin(this.t * 40), 7, 9);
    }
    // the tags in the air, and stuck in the floor
    while (this.tagImgs.length < this.tags.length) this.tagImgs.push(this.add.image(0, 0, 'toe_tag').setScale(2).setDepth(6.6));
    this.tagImgs.forEach((im, i) => {
      const t = this.tags[i];
      im.setVisible(!!t);
      if (t) im.setPosition(t.x, t.y).setRotation(t.spin).setAlpha(t.stuck ? Math.min(1, t.life * 3) : 1);
    });
  }

  renderDark() {
    // lights out: only Milo's lantern
    const dg = this.darkG; dg.clear();
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
  }

  drawMilo() {
    const m = this.milo, id = this.char;
    const blink = this.inv > 0 && this.booT <= 0 && this.state === 'fight' && Math.floor(this.t * 20) % 2;
    const hid = this.unseen() && this.state === 'fight';
    m.setVisible(!blink).setFlipX(this.face < 0).setAlpha(hid ? 0.22 : 1);
    this.stuckTag.setVisible(this.filedT > 0 && this.state === 'fight' && !hid);
    if (this.state === 'lost') {
      if (m.anims.isPlaying) m.anims.stop();
      m.setTexture(`${id}_fall`).setRotation(Math.min(1.5, this.endT * 3) * -this.face).setPosition(this.x, FLOOR);
      this.boo.setVisible(false);
      return;
    }
    m.setRotation(0);
    const fy = FLOOR - this.y;
    if (this.dodgeT > 0) {
      if (m.anims.isPlaying) m.anims.stop();
      m.setTexture(`${id}_slide`).setPosition(this.x, fy + 1);
    } else if (!this.grounded || this.booT > 0) {
      if (m.anims.isPlaying) m.anims.stop();
      m.setTexture(`${id}_${this.vy > -60 ? 'jump' : 'fall'}`).setPosition(this.x, fy);
    } else if (Math.abs(this.vx) > 30) {
      if (m.anims.currentAnim?.key !== `${id}_run` || !m.anims.isPlaying) m.play(`${id}_run`);
      m.setPosition(this.x, fy);
    } else {
      if (m.anims.isPlaying) m.anims.stop();
      m.setTexture(`${id}_run0`).setPosition(this.x, fy);
    }
    this.stuckTag.setPosition(this.x - this.face * 4, fy - 30).setRotation(0.3 * Math.sin(this.t * 6));
    // under the Sheet: a sheet with nobody in it, sliding along
    if (hid) {
      const s = this.sheetG, k = Math.min(1, (SHEET_T - this.unseenT) / 0.08) * Math.min(1, this.unseenT / 0.12);
      const h = this.dodgeT > 0 ? 26 : 46, top = fy - h, l = this.x - 13, r = this.x + 13;
      s.fillStyle(0x0b0918, 0.7 * k); s.fillEllipse(this.x, top + 9, 26, 20); s.fillRect(l - 1, top + 8, r - l + 2, h - 10);
      s.fillStyle(0xd8dfe3, 0.88 * k); s.fillEllipse(this.x, top + 9, 24, 18); s.fillRect(l, top + 9, r - l, h - 12);
      s.fillStyle(0xa7b2ba, 0.88 * k);
      for (let i = 0; i < 5; i++) s.fillRect(l + i * 5 + Math.round(Math.sin(this.t * 14 + i) * 1.5), fy - 4, 5, 3 + (i % 2) * 2); // the hem, moving
      s.fillRect(this.x - this.face * 6, top + 10, 2, h - 16); // a fold
    }
    this.boo.setVisible(this.booT > 0);
    if (this.booT > 0) this.boo.setPosition(this.x, fy - MILO_H - 12);
  }

  renderUI() {
    const u = this.ui; u.clear();
    // the boss's bar, under the name
    u.fillStyle(0x140f24, 0.9); u.fillRect(W / 2 - 101, 19, 202, 8);
    u.fillStyle(0xd9d0a8, 1); u.fillRect(W / 2 - 100, 20, 200 * Math.max(0, this.hp) / this.def.hp, 6);
    // hearts
    for (let i = 0; i < HEARTS; i++) { u.fillStyle(i < this.hearts ? 0xff6b7d : 0x3a3646, 1); u.fillRect(W - 98 + i * 16, 8, 11, 10); }
    // Boo, once per fight
    u.fillStyle(this.booUsed ? 0x3a3646 : 0xe6f0ff, 1); u.fillCircle(W - 110, 13, 5);
    // the Sheet: a little white sheet that greys out while it's coming back
    if (this.sheet) {
      const ready = this.sheetCd <= 0, sx = W - 128, k = 1 - this.sheetCd / SHEET_CD;
      u.fillStyle(0x3a3646, 1); u.fillRect(sx - 5, 8, 10, 11);
      u.fillStyle(ready ? 0xd8dfe3 : 0x8a90a0, 1); u.fillRect(sx - 5, 8 + 11 * (1 - k), 10, 11 * k);
      if (ready) { u.fillStyle(0xd8dfe3, 1); u.fillEllipse(sx, 8, 10, 6); }
    }
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
    this.promptText.setText(this.prompt.t > 0 && fighting ? this.prompt.text : '').setAlpha(Math.min(1, this.prompt.t * 3)).setScale(1 + 0.04 * Math.sin(this.t * 8));
    // the "!" before every attack, over the boss's head
    this.bangText.setVisible(this.bangT > 0 && fighting).setPosition(this.bx, FLOOR - this.def.h - 22 - (0.45 - this.bangT) * 16);
    if (this.choice) {
      const k = 1 - Math.max(0, this.hp) / this.def.hp;
      u.fillStyle(0x140f24, 0.95); u.fillRect(W / 2 - 121, 189, 242, 12);
      u.fillStyle(0xd9d0a8, 1); u.fillRect(W / 2 - 120, 190, 240 * k, 10);
      u.fillStyle(0xffd75e, 1); u.fillRect(W / 2 - 150, 234, 120, 32);
      u.lineStyle(2, 0xe6f0ff, 0.8); u.strokeRect(W / 2 + 30, 234, 120, 32);
    }
  }
}
