// MILO LAB, MOVE mode (?milolab=1&move=1 or M): a small ward corridor to drive the new Milo around at game size.
// Mixed into MiloLabScene. Keyboard: arrows / A-D walk, hold Shift to run, Space / W / Up jump (hold = higher).
// Gamepad: stick or d-pad walk (full tilt or hold X = run), A jump. Touch: left half = move thumb (drag far = run),
// right half = jump (hold = higher). P / Esc / Start = back to the acting lab.
// Tuning follows Celeste's forgiveness: coyote time, a jump buffer, a cut jump when released.
import { W, H, FONT } from '../data.js';
import { Device } from '../input.js';
import { MiloActor, MILO_ANIMS } from '../milo-sprite.js';

const MW = 1600, FLOOR = 300;
export const MOVE = {
  walk: 70, run: 175, accel: 900, runAccel: 650, decel: 1300, air: 700,
  grav: 1600, fallGrav: 1900, maxFall: 620, jumpV: 480, cut: 0.5,
  coyote: 0.09, buffer: 0.11, takeoff: 0.04, halfW: 7,
};
// one-way tops (you can jump up through them), world px
const PLATFORMS = [
  { x0: 380, x1: 520, top: FLOOR - 34, kind: 'bed' },
  { x0: 690, x1: 740, top: FLOOR - 62, kind: 'cabinet' },
  { x0: 930, x1: 1060, top: FLOOR - 40, kind: 'gurney' },
  { x0: 1270, x1: 1330, top: FLOOR - 22, kind: 'step' },
];

export const MOVE_LAB = {
  buildMove() {
    const g = this.add.graphics().setDepth(0);
    const bands = [0x0c1020, 0x0e1324, 0x101629, 0x12182d, 0x141b31, 0x151d33];
    bands.forEach((c, i) => { g.fillStyle(c, 1); g.fillRect(0, i * 50, MW, 50); });
    // windows (moonlight), doors, wall rail
    for (let x = 120; x < MW; x += 360) {
      g.fillStyle(0x0a0d18, 1); g.fillRect(x, 80, 80, 104);
      g.fillStyle(0x1d2b4a, 1); g.fillRect(x + 5, 85, 70, 94);
      g.fillStyle(0x0a0d18, 1); g.fillRect(x + 38, 85, 4, 94); g.fillRect(x + 5, 130, 70, 3);
    }
    for (let x = 300; x < MW; x += 360) {
      g.fillStyle(0x0f1322, 1); g.fillRect(x, 168, 54, FLOOR - 168);
      g.fillStyle(0x1a2238, 1); g.fillRect(x - 3, 165, 60, 4); g.fillRect(x - 3, 165, 3, FLOOR - 165); g.fillRect(x + 54, 165, 3, FLOOR - 165);
      g.fillStyle(0x8a7a50, 1); g.fillRect(x + 44, 236, 4, 3);
    }
    g.fillStyle(0x1a2238, 1); g.fillRect(0, 236, MW, 6);
    g.fillStyle(0x0b0e19, 1); g.fillRect(0, FLOOR, MW, H - FLOOR);
    g.fillStyle(0x1c2540, 1); g.fillRect(0, FLOOR, MW, 2);
    for (let x = 0; x < MW; x += 64) { g.fillStyle(0x10152a, 1); g.fillRect(x, FLOOR + 2, 1, H - FLOOR); }
    // metre marks on the floor (27 px = 1 m, the art lab's scale) to judge speed and jump distance
    for (let x = 0, m = 0; x < MW; x += 27, m++) { g.fillStyle(m % 5 ? 0x18203a : 0x2a3658, 1); g.fillRect(x, FLOOR + 3, 1, m % 5 ? 3 : 6); }
    const light = this.add.graphics().setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
    for (let x = 120; x < MW; x += 360) { light.fillStyle(0x4a6aa8, 0.06); light.fillTriangle(x, 184, x + 80, 184, x + 150, FLOOR + 30); light.fillTriangle(x, 184, x + 150, FLOOR + 30, x + 70, FLOOR + 30); }
    const lamp = this.add.image(1180, 230, 'milolab_glow').setScale(1.2).setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
    // the props he can stand on
    for (const p of PLATFORMS) {
      const h = FLOOR - p.top, w = p.x1 - p.x0;
      if (p.kind === 'bed') {
        g.fillStyle(0x1b2235, 1); g.fillRect(p.x0, p.top + 8, w, 10); g.fillRect(p.x0 + 2, p.top + 18, 4, h - 18); g.fillRect(p.x1 - 6, p.top + 18, 4, h - 18);
        g.fillStyle(0x3c4a6a, 1); g.fillRect(p.x0, p.top, w, 9); g.fillStyle(0x5a6788, 1); g.fillRect(p.x1 - 34, p.top - 4, 30, 6);
        g.fillStyle(0x1b2235, 1); g.fillRect(p.x1 - 4, p.top - 26, 5, 30);
      } else if (p.kind === 'cabinet') {
        g.fillStyle(0x1e2438, 1); g.fillRect(p.x0, p.top, w, h); g.fillStyle(0x2c3550, 1); g.fillRect(p.x0, p.top, w, 3);
        g.fillStyle(0x151a2a, 1); g.fillRect(p.x0 + 4, p.top + 10, w - 8, 1); g.fillRect(p.x0 + 4, p.top + 32, w - 8, 1);
        g.fillStyle(0x6a6a5a, 1); g.fillRect(p.x0 + w / 2 - 3, p.top + 18, 6, 2); g.fillRect(p.x0 + w / 2 - 3, p.top + 44, 6, 2);
      } else if (p.kind === 'gurney') {
        g.fillStyle(0x3a4560, 1); g.fillRect(p.x0, p.top, w, 5); g.fillStyle(0x222a40, 1); g.fillRect(p.x0 + 6, p.top + 5, 3, h - 9); g.fillRect(p.x1 - 9, p.top + 5, 3, h - 9);
        g.fillRect(p.x0 + 6, p.top + 22, w - 12, 2); g.fillStyle(0x10141f, 1); g.fillCircle(p.x0 + 8, FLOOR - 3, 3); g.fillCircle(p.x1 - 8, FLOOR - 3, 3);
      } else {
        g.fillStyle(0x1e2438, 1); g.fillRect(p.x0, p.top, w, h); g.fillStyle(0x2c3550, 1); g.fillRect(p.x0, p.top, w, 2);
      }
    }
    this.mover = new MiloActor(this, 160, FLOOR);
    this.mover.sprite.setDepth(5);
    this.thumbG = this.add.graphics().setDepth(25).setScrollFactor(0);
    this.moveObjs = [g, light, lamp, this.mover.sprite, this.thumbG];
    this.moveObjs.forEach((o) => o.setVisible(false));
    const txt = (x, y, s, col, ox = 0) => this.add.text(x, y, s, { fontFamily: FONT, fontSize: '8px', color: col, resolution: 2 }).setOrigin(ox, 0).setDepth(30).setScrollFactor(0);
    this.moveHelp = txt(8, 36, '', '#7a88a8').setVisible(false);
    // top-right buttons in MOVE mode (tap / click; keys M, G, S, Z)
    this.moveBtns = [['ACTING', () => this.setMove(false)], ['LIVING', () => this.setGhost(!this.ghost)], ['SLOW', () => this.setSlow(!this.slow)], ['ZOOM', () => this.setZoom(!this.zoom)]]
      .map(([s, fn], i) => {
        const t = txt(W - 8 - (3 - i) * 64, 6, s, '#8a98b8', 1).setPadding(6, 5, 6, 5).setInteractive({ useHandCursor: true });
        t.on('pointerdown', () => { fn(); this.paintMoveBtns(); });
        return t.setVisible(false);
      });
    this.runKey = this.input.keyboard.addKey('SHIFT');
    this.mv = { x: 160, y: FLOOR, vx: 0, vy: 0, ground: true, coyote: 0, buffer: 0, takeoff: 0, cutDone: false, landT: 0, acc: 0 };
    this.thumb = null; this.jumpPtr = null; this.jumpTap = false;
    this.input.on('pointerdown', (p, over) => {
      if (!this.move || over.length) return;
      if (p.x < W / 2) this.thumb = { id: p.id, x0: p.x, y0: p.y, x: p.x };
      else { this.jumpPtr = p.id; this.jumpTap = true; }
    });
    this.input.on('pointermove', (p) => { if (this.thumb && p.id === this.thumb.id) this.thumb.x = p.x; });
    const up = (p) => { if (this.thumb && p.id === this.thumb.id) this.thumb = null; if (p.id === this.jumpPtr) this.jumpPtr = null; };
    this.input.on('pointerup', up); this.input.on('pointerupoutside', up);
  },

  setMove(on) {
    this.move = on;
    if (on && this.compare) this.setCompare(false);
    this.roomObjs.forEach((o) => o.setVisible(!on));
    this.milo.setVisible(!on); this.ring.setVisible(!on);
    this.moveObjs.forEach((o) => o.setVisible(on));
    this.btns.forEach((b) => b.t.setVisible(!on && this.uiOn));
    this.moveBtns.forEach((t) => t.setVisible(on && this.uiOn));
    this.moveHelp.setVisible(on && this.uiOn);
    this.title.setText(on ? 'MILO LAB V2: MOVE' : 'MILO LAB V2');
    const cam = this.cameras.main;
    if (on) { cam.setBounds(0, 0, MW, H); this.mover.setGhost(this.ghost); this.mover.sprite.setAlpha(this.ghost ? 0.9 : 1); } else { cam.removeBounds(); cam.scrollX = 0; }
    this.paintMoveBtns(); this.paintBtns();
  },
  paintMoveBtns() {
    const on = [false, this.ghost, this.slow, this.zoom];
    this.moveBtns[1].setText(this.ghost ? 'GHOST' : 'LIVING');
    this.moveBtns.forEach((t, i) => t.setColor(on[i] ? '#ffe0a0' : '#8a98b8').setBackgroundColor(on[i] ? '#221c30' : '#00000000'));
  },

  // what the player asks for this tick: dir -1/0/1, run, jump pressed/held (all devices)
  readMove() {
    const c = this.ctl;
    let dir = (c.held('right') ? 1 : 0) - (c.held('left') ? 1 : 0), run = this.runKey.isDown;
    const pads = this.input.gamepad && this.input.gamepad.total ? this.input.gamepad.getAll() : [];
    for (const pad of pads) {
      const sx = pad.leftStick ? pad.leftStick.x : 0;
      if (Math.abs(sx) > 0.25) { dir = Math.sign(sx); if (Math.abs(sx) > 0.85) run = true; }
      if (pad.buttons[2] && pad.buttons[2].pressed) run = true;
    }
    if (this.thumb) {
      const dx = this.thumb.x - this.thumb.x0;
      if (Math.abs(dx) > 10) { dir = Math.sign(dx); run = run || Math.abs(dx) > 48; }
    }
    const jump = c.pressed('float') || this.jumpTap;
    const hold = c.held('float') || this.jumpPtr !== null;
    this.jumpTap = false;
    return { dir, run, jump, hold };
  },

  stepMove(dt) {
    const m = this.mv, a = this.mover, inp = this.readMove();
    if (this.ctl.pressed('pause')) { this.setMove(false); return; }
    if (inp.jump) m.buffer = MOVE.buffer;
    // fixed 120 Hz steps, like the run
    m.acc += dt / 1000;
    while (m.acc >= 1 / 120) { m.acc -= 1 / 120; this.tickMove(1 / 120, inp); }
    // animation follows the body
    const sp = Math.abs(m.vx), moving = inp.dir !== 0 || sp > 6;
    const ground = m.ground && m.takeoff <= 0;
    if (m.takeoff > 0) a.want('jump_start');
    else if (!ground) {
      if (a.anim !== 'jump_start') a.want(m.vy < -110 ? 'rise' : m.vy < 110 ? 'apex' : 'fall');
    } else if (a.anim === 'land' && (!moving || a.step === 0) && !a.done) {
      // let the squash read; movement takes over after the first landing frame
    } else if (!moving) {
      if (['walk', 'run', 'walk_start', 'pivot'].includes(a.anim)) a.want('stop');
      else if (a.done || !['stop', 'idle', 'land'].includes(a.anim)) a.want('idle');
    } else if (a.anim === 'pivot' && !a.done) {
      // a quick profile frame while he turns around
    } else if (sp > MOVE.walk + 18) a.want('run');
    else if (['idle', 'stop', 'land'].includes(a.anim)) a.want('walk_start');
    else if (a.anim !== 'walk_start' || a.done) a.want(sp > MOVE.walk + 18 ? 'run' : 'walk');
    a.speed = a.anim === 'walk' ? Phaser.Math.Clamp(sp / MOVE.walk, 0.5, 1.4) : a.anim === 'run' ? Phaser.Math.Clamp(sp / MOVE.run, 0.6, 1.2) : 1;
    a.x = m.x; a.footY = m.y;
    a.update(dt);
    a.show();
    // camera leads a little in the facing direction
    const cam = this.cameras.main, tx = Phaser.Math.Clamp(m.x - W * 0.42 + a.facing * 40, 0, MW - W);
    cam.scrollX += (tx - cam.scrollX) * Math.min(1, dt / 160);
    // the thumb
    this.thumbG.clear();
    if (this.thumb) {
      this.thumbG.lineStyle(1, 0x6f8fc8, 0.5).strokeCircle(this.thumb.x0, this.thumb.y0, 48);
      this.thumbG.fillStyle(0x9fd8ff, 0.35).fillCircle(Phaser.Math.Clamp(this.thumb.x, this.thumb.x0 - 48, this.thumb.x0 + 48), this.thumb.y0, 8);
    }
    const d = Device.get();
    this.moveHelp.setText(d === 'touch' ? 'LEFT HALF: DRAG TO WALK, FAR = RUN   RIGHT HALF: JUMP (HOLD = HIGHER)'
      : d === 'gamepad' ? 'STICK / D-PAD WALK   FULL TILT OR X = RUN   A JUMP   START BACK'
        : 'ARROWS / A-D WALK   SHIFT RUN   SPACE / W JUMP (HOLD = HIGHER)   ESC BACK');
    this.info.setText(`${a.anim.toUpperCase()}  ${a.frame}  ${a.step + 1}/${MILO_ANIMS[a.anim].frames.length}   ${Math.round(sp / 27 * 10) / 10} M/S${m.ground ? '' : '   AIR'}${this.ghost ? '   GHOST' : ''}${this.slow ? '   1/4 SPEED' : ''}`);
  },

  tickMove(dt, inp) {
    const m = this.mv, a = this.mover;
    const top = inp.run ? MOVE.run : MOVE.walk, target = inp.dir * top;
    // facing: turn when asked; a quick profile frame if he was already walking the other way
    if (inp.dir && inp.dir !== a.facing) {
      if (m.ground && Math.abs(m.vx) > 20) a.play('pivot');
      a.setFacing(inp.dir);
    }
    const rate = !m.ground ? MOVE.air : inp.dir === 0 || Math.sign(target) !== Math.sign(m.vx) ? MOVE.decel : inp.run ? MOVE.runAccel : MOVE.accel;
    m.vx = m.vx < target ? Math.min(target, m.vx + rate * dt) : Math.max(target, m.vx - rate * dt);
    // jump: buffer + coyote time; a short takeoff crouch (anticipation) before he leaves the floor
    m.buffer = Math.max(0, m.buffer - dt);
    m.coyote = m.ground ? MOVE.coyote : Math.max(0, m.coyote - dt);
    if (m.buffer > 0 && m.coyote > 0 && m.takeoff <= 0) { m.takeoff = MOVE.takeoff; m.buffer = 0; a.play('jump_start'); }
    if (m.takeoff > 0 && (m.takeoff -= dt) <= 0) { m.vy = -MOVE.jumpV; m.ground = false; m.coyote = 0; m.cutDone = false; }
    if (!m.ground) {
      if (m.vy < 0 && !inp.hold && !m.cutDone) { m.vy *= MOVE.cut; m.cutDone = true; }
      m.vy = Math.min(MOVE.maxFall, m.vy + (m.vy > 0 ? MOVE.fallGrav : MOVE.grav) * dt);
    }
    const prevY = m.y;
    m.x = Phaser.Math.Clamp(m.x + m.vx * dt, 24, MW - 24);
    m.y += m.vy * dt;
    // land on the floor or on a one-way top while falling
    let floor = FLOOR;
    for (const p of PLATFORMS) if (m.x + MOVE.halfW > p.x0 && m.x - MOVE.halfW < p.x1 && prevY <= p.top + 0.01) floor = Math.min(floor, p.top);
    if (m.ground) {
      const support = m.y >= FLOOR - 0.01 || PLATFORMS.some((p) => Math.abs(p.top - m.y) < 0.5 && m.x + MOVE.halfW > p.x0 && m.x - MOVE.halfW < p.x1);
      if (!support) { m.ground = false; m.vy = 0; } // walked off an edge (coyote time still allows a jump)
    } else if (m.vy >= 0 && m.y >= floor) {
      m.y = floor; m.vy = 0; m.ground = true; m.cutDone = true;
      a.play('land');
    }
  },
};
