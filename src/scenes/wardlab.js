// Ward 4 / Bed 7: approved-art gameplay vertical slice (isolated at ?wardlab=1).
// This does NOT replace opening.js, the runner, any boss, or saves.
// The approved concept is a temporary environment plate; see docs/ward4-art-target.md.
import { W, H } from '../data.js';
import { createInput } from '../input.js';
import { loadMilo, MiloActor } from '../milo-sprite.js';

const WORLD_W = 1065;
const FLOOR = 335;
const BED = { left: 195, right: 446, top: 265 };
const WINDOW = { left: 452, right: 700, top: 34, bottom: 215 };
const WALK = 84, RUN = 166, JUMP = 470, GRAVITY = 1270;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export class WardLabScene extends Phaser.Scene {
  constructor() { super('wardlab'); }

  preload() {
    this.load.image('wardlab_plate', 'assets/ward4-bed7/room-plate.png');
    this.load.image('wardlab_front', 'assets/ward4-bed7/near-pipes.png');
    loadMilo(this); // the real approved character, not an image-generation substitute
  }

  create() {
    this.cameras.main.setBounds(0, 0, WORLD_W, H);
    this.cameras.main.setBackgroundColor('#0a1020');
    this.add.image(0, 0, 'wardlab_plate').setOrigin(0).setDepth(0);
    this.rainG = this.add.graphics().setDepth(1);
    this.floorShadow = this.add.ellipse(0, FLOOR + 1, 24, 5, 0x050a12, 0.44).setDepth(3);
    this.milo = new MiloActor(this, 513, FLOOR, { scale: 1.5 });
    this.milo.sprite.setDepth(4);
    this.milo.setFacing(1);
    this.add.image(0, 0, 'wardlab_front').setOrigin(0).setScrollFactor(1.1).setDepth(9);

    // The native game action map handles keyboard/gamepad. Touch is a separate 2-thumb control.
    this.ctl = createInput(this, { pointers: false });
    this.runKey = this.input.keyboard.addKey('SHIFT');
    this.ghostKey = this.input.keyboard.addKey('G');
    this.lightKey = this.input.keyboard.addKey('L');
    this.shotKey = this.input.keyboard.addKey('C');
    this.closeKey = this.input.keyboard.addKey('ESC');
    this.ghost = false; this.extraLight = false; this.wideShot = false; this.lastPadGhost = false;
    this.m = { x: 513, y: FLOOR, vx: 0, vy: 0, grounded: true, onBed: false, jumping: false };
    this.time = 0; this.lastJump = false;
    this.thumb = null; this.jumpPointer = null;
    this.rain = Array.from({ length: 82 }, (_, i) => ({
      x: WINDOW.left + (i * 29.71) % (WINDOW.right - WINDOW.left),
      y: WINDOW.top + (i * 41.37) % (WINDOW.bottom - WINDOW.top),
      spd: 46 + (i * 19) % 55,
      len: 2 + i % 5,
    }));

    this.input.on('pointerdown', (p, over) => {
      if (over.length) return; // HUD touch buttons must not trigger jump
      if (p.x < W / 2 && !this.thumb) this.thumb = { id: p.id, x: p.x, cur: p.x };
      else if (p.x >= W / 2) this.jumpPointer = p.id;
    });
    this.input.on('pointermove', (p) => { if (this.thumb?.id === p.id) this.thumb.cur = p.x; });
    const released = (p) => {
      if (this.thumb?.id === p.id) this.thumb = null;
      if (this.jumpPointer === p.id) this.jumpPointer = null;
    };
    this.input.on('pointerup', released);
    this.input.on('pointerupoutside', released);

    // Screen-space labels never drift with the world/camera.
    const hud = (x, y, t, c = '#d2dce9') => this.add.text(x, y, t, {
      fontFamily: 'monospace', fontSize: '10px', color: c, resolution: 2,
      shadow: { offsetX: 1, offsetY: 2, color: '#000000', blur: 3, fill: true },
    }).setScrollFactor(0).setDepth(30);
    this.label = hud(12, 10, 'WARD 4 / BED 7  |  ART TARGET V1');
    this.clock = hud(W - 92, 10, '3:33 AM');
    this.hint = hud(12, H - 20, 'A/D MOVE   SHIFT RUN   SPACE JUMP   G GHOST   C CAMERA   L LIGHT');
    this.note = hud(185, 43, '', '#fedfb7');
    this.note.setAlpha(0);
    this.noteTime = 0;
    this.ghostButton = hud(W - 102, 40, '[ GHOST ]', '#bce0ff').setInteractive({ useHandCursor: true });
    this.camButton = hud(W - 102, 58, '[ CAMERA ]', '#d6b994').setInteractive({ useHandCursor: true });
    this.ghostButton.on('pointerdown', () => this.toggleGhost());
    this.camButton.on('pointerdown', () => { this.wideShot = !this.wideShot; });
    this.fxGlow = this.add.graphics().setDepth(8).setVisible(false);
  }

  showNote(msg) { this.note.setText(msg); this.note.setAlpha(1); this.noteTime = 2.4; }
  toggleGhost() {
    this.ghost = !this.ghost;
    this.milo.setGhost(this.ghost);
    this.showNote(this.ghost ? 'GHOST FORM' : 'LIVING FORM');
  }

  controls() {
    this.ctl.update();
    let dir = Number(this.ctl.held('right')) - Number(this.ctl.held('left'));
    let fast = this.runKey.isDown;
    if (this.thumb) {
      const distance = this.thumb.cur - this.thumb.x;
      dir = Math.abs(distance) > 12 ? Math.sign(distance) : 0;
      fast ||= Math.abs(distance) > 54;
    }
    const pads = this.input.gamepad?.getAll?.() || [];
    for (const pad of pads) {
      const stick = pad.leftStick?.x || 0;
      fast ||= Math.abs(stick) > 0.85 || !!pad.buttons?.[2]?.pressed;
    }
    return {
      dir, fast,
      jump: this.ctl.held('float') || this.jumpPointer !== null,
    };
  }

  update(_t, dtMs) {
    const dt = Math.min(dtMs / 1000, 0.035);
    this.time += dt;
    const padGhost = (this.input.gamepad?.getAll?.() || []).some(p => !!p.buttons?.[1]?.pressed);
    if (Phaser.Input.Keyboard.JustDown(this.ghostKey) || (padGhost && !this.lastPadGhost)) this.toggleGhost();
    this.lastPadGhost = padGhost;
    if (Phaser.Input.Keyboard.JustDown(this.lightKey)) this.extraLight = !this.extraLight;
    if (Phaser.Input.Keyboard.JustDown(this.shotKey)) this.wideShot = !this.wideShot;
    if (Phaser.Input.Keyboard.JustDown(this.closeKey)) this.scene.start('menu');
    const c = this.controls();
    const m = this.m;

    const target = this.wideShot ? 0 : c.dir * (c.fast ? RUN : WALK);
    const acceleration = c.dir && !this.wideShot ? 800 : 1180;
    const change = clamp(target - m.vx, -acceleration * dt, acceleration * dt);
    m.vx += change;
    if (c.dir && !this.wideShot) this.milo.setFacing(c.dir);
    const pressedJump = c.jump && !this.lastJump;
    this.lastJump = c.jump;
    if (pressedJump && m.grounded && !this.wideShot) {
      m.vy = -JUMP; m.grounded = false; m.onBed = false;
      this.milo.play('jump_start');
    }
    if (!m.grounded) {
      if (!c.jump && m.vy < 0) m.vy += 1150 * dt; // variable jump height
      m.vy = Math.min(580, m.vy + GRAVITY * dt);
    }
    const lastY = m.y;
    let nextX = clamp(m.x + m.vx * dt, 30, WORLD_W - 30);
    // The bed is a real solid obstacle, not just background decoration.
    const blockedAtGround = m.y > BED.top + 5 && m.y - lastY >= -10;
    if (blockedAtGround && lastY > BED.top + 5 && !m.onBed) {
      if (m.x <= BED.left - 8 && nextX > BED.left - 8) { nextX = BED.left - 8; m.vx = 0; }
      if (m.x >= BED.right + 8 && nextX < BED.right + 8) { nextX = BED.right + 8; m.vx = 0; }
    }
    m.x = nextX;
    m.y += m.vy * dt;
    let surface = FLOOR;
    const overBed = m.x >= BED.left - 4 && m.x <= BED.right + 4;
    if (overBed && lastY <= BED.top + 2 && m.vy >= 0) surface = BED.top;
    if (m.vy >= 0 && m.y >= surface) {
      const wasAirborne = !m.grounded;
      m.y = surface; m.vy = 0; m.grounded = true; m.onBed = surface === BED.top;
      if (wasAirborne) this.milo.play('land');
    }
    if (m.grounded && m.onBed && !overBed) { m.grounded = false; m.onBed = false; }

    const moving = Math.abs(m.vx) > 12;
    if (m.grounded && (this.milo.anim !== 'land' || this.milo.done)) this.milo.want(moving ? (Math.abs(m.vx) > 110 ? 'run' : 'walk') : 'idle');
    else if (!m.grounded && this.milo.anim !== 'jump_start') this.milo.want(m.vy < -100 ? 'rise' : m.vy < 90 ? 'apex' : 'fall');
    this.milo.x = m.x; this.milo.footY = m.y;
    this.milo.update(dtMs);
    this.milo.show();
    this.floorShadow.x = m.x;
    this.floorShadow.y = m.onBed ? BED.top + 2 : FLOOR + 2;
    this.floorShadow.alpha = clamp((125 - Math.abs(this.floorShadow.y - m.y)) / 125, 0, 0.4);

    const cam = this.cameras.main;
    const wanted = clamp(m.x - W * 0.53 + 35 * this.milo.facing, 0, WORLD_W - W);
    cam.scrollX += ((this.wideShot ? 190 : wanted) - cam.scrollX) * Math.min(1, dt * 4);

    // Small, live rain only on the window plane. All other painted art is static.
    this.rainG.clear(); this.rainG.lineStyle(1, 0xa2cbfc, 0.23);
    for (const drop of this.rain) {
      drop.y += drop.spd * dt;
      if (drop.y > WINDOW.bottom) { drop.y = WINDOW.top; drop.x = WINDOW.left + (drop.x * 3.83) % (WINDOW.right - WINDOW.left); }
      if (drop.x < WINDOW.left || drop.x > WINDOW.right) continue;
      this.rainG.lineBetween(drop.x, drop.y, drop.x - 1, Math.min(WINDOW.bottom, drop.y + drop.len));
    }
    this.fxGlow.clear().setVisible(this.extraLight);
    if (this.extraLight) {
      this.fxGlow.fillStyle(0xe7a35c, 0.06 + Math.sin(this.time * 3) * .009);
      this.fxGlow.fillCircle(180, 221, 84);
    }
    if (this.noteTime > 0) { this.noteTime -= dt; this.note.setAlpha(Math.min(1, this.noteTime)); }
    // Optional interaction test: the door is a walkable endpoint; don't fake a finished corridor.
    if (m.x > 960 && !this.reachedDoor) { this.reachedDoor = true; this.showNote('END OF ART LAB  /  NEXT: CORRIDOR KIT'); }
  }
}
