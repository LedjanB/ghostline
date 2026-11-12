// Ward 4 / Bed 7: approved-art gameplay vertical slice (isolated at ?wardlab=1).
// This does NOT replace opening.js, the runner, any boss, or saves.
// The approved concept is a temporary environment plate; see docs/ward4-art-target.md.
// Movement V1: the milo lab's tuning (milolab-move.js MOVE: coyote time, jump buffer, cut jump, Celeste)
// scaled to Milo's size in this room, fixed 120 Hz steps, idle/walk_start/walk/run/stop/pivot/jump/land frames,
// and the walk/run cycle timed to the real ground speed so the feet don't slide.
import { W, H } from '../data.js';
import { createInput, Device } from '../input.js';
import { loadMilo, MiloActor, MILO_ANIMS } from '../milo-sprite.js';
import { MOVE } from './milolab-move.js';

const WORLD_W = 1065;
const FLOOR = 335;
const BED = { left: 195, right: 446, top: 265 }; // solid sides, walkable top
const WINDOW = { left: 452, right: 700, top: 34, bottom: 215 };
// Milo draws at 1.5x here (his size against the approved reference). Every distance in the lab's tuning
// scales with him, so one walk/run cycle covers the same ground per step as at 1x (tempo matches speed).
export const WARD_SCALE = 1.5;
export const WARD_MOVE = { ...MOVE };
for (const k of ['walk', 'run', 'accel', 'runAccel', 'decel', 'air', 'grav', 'fallGrav', 'maxFall', 'jumpV', 'halfW']) WARD_MOVE[k] = MOVE[k] * WARD_SCALE;
export const WARD_GEOM = { FLOOR, BED, WORLD_W };
const MV = WARD_MOVE;
const PX_PER_M = 27 * WARD_SCALE;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// Bed 7 and cabinet are real transparent PNG assets extracted from the same room painting.
// The background is room-shell-v1.png: the plate with only the cabinet (and its mug) painted out
// (scripts/ward4-room-shell.py). room-plate.png stays the untouched baseline; here it only supplies
// CABINET_EXTRA, the thin bits of cabinet paint cabinet.png missed, which show and hide with the cabinet.
// The depth order is explicit: cabinet/bed body (2) < Milo (4) < sheet/footboard (6).
// Cabinet visible = the original painting exactly; K (or the CABINET button) hides it, a debug view only.
// same rects as MUG_CORNER and FEET in scripts/ward4-room-shell.py: the mug's top-left corner, the feet's last rows
export const CABINET_EXTRA = [{ x: 164, y: 229, w: 9, h: 11 }, { x: 124, y: 327, w: 83, h: 2 }];
// bed-body.png's first 15 columns (world x 192-206) have the cabinet's right edge baked in. The shell has that
// strip without it (head post + bed end continued), so those columns are cropped off the bed body.
const BED_BODY_CAB = 15;


export class WardLabScene extends Phaser.Scene {
  constructor() { super('wardlab'); }

  preload() {
    this.load.image('wardlab_shell', 'assets/ward4-bed7/room-shell-v1.png');
    this.load.image('wardlab_plate', 'assets/ward4-bed7/room-plate.png'); // baseline; only CABINET_EXTRA is drawn
    this.load.image('wardlab_front', 'assets/ward4-bed7/near-pipes.png');
    this.load.image('wardlab_bed_body', 'assets/ward4-bed7/bed-body.png');
    this.load.image('wardlab_bed_front', 'assets/ward4-bed7/bed-front.png');
    this.load.image('wardlab_cabinet', 'assets/ward4-bed7/cabinet.png');
    loadMilo(this); // the real approved character, not an image-generation substitute
  }

  create() {
    this.cameras.main.setBounds(0, 0, WORLD_W, H);
    this.cameras.main.setBackgroundColor('#0a1020');
    this.shell = this.add.image(0, 0, 'wardlab_shell').setOrigin(0).setDepth(0);
    this.rainG = this.add.graphics().setDepth(1);
    this.cabinet = this.add.image(121, 227, 'wardlab_cabinet').setOrigin(0).setDepth(2);
    const plate = this.textures.get('wardlab_plate');
    this.cabinetExtra = CABINET_EXTRA.map((r, i) => {
      if (!plate.has('cabinet_extra' + i)) plate.add('cabinet_extra' + i, 0, r.x, r.y, r.w, r.h);
      return this.add.image(r.x, r.y, 'wardlab_plate', 'cabinet_extra' + i).setOrigin(0).setDepth(2);
    });
    this.bedBody = this.add.image(192, 212, 'wardlab_bed_body').setOrigin(0).setDepth(2);
    this.bedBody.setCrop(BED_BODY_CAB, 0, this.bedBody.width - BED_BODY_CAB, this.bedBody.height);
    this.cabinetShown = true;
    this.floorShadow = this.add.ellipse(0, FLOOR + 1, 24, 5, 0x050a12, 0.44).setDepth(3);
    this.milo = new MiloActor(this, 513, FLOOR, { scale: WARD_SCALE });
    this.milo.sprite.setDepth(4);
    this.milo.setFacing(1);
    this.bedFront = this.add.image(265, 226, 'wardlab_bed_front').setOrigin(0).setDepth(6);
    this.add.image(0, 0, 'wardlab_front').setOrigin(0).setScrollFactor(1.1).setDepth(9);

    // The native game action map handles keyboard/gamepad. Touch is a separate 2-thumb control.
    this.ctl = createInput(this, { pointers: false });
    this.runKey = this.input.keyboard.addKey('SHIFT');
    this.ghostKey = this.input.keyboard.addKey('G');
    this.lightKey = this.input.keyboard.addKey('L');
    this.shotKey = this.input.keyboard.addKey('C');
    this.closeKey = this.input.keyboard.addKey('ESC');
    this.cabinetKey = this.input.keyboard.addKey('K'); // Ward Lab debug only, not in input.js
    // toggles on the key's down event: polling JustDown misses a tap whose up lands in the same frame
    this.ghostKey.on('down', () => this.toggleGhost());
    this.cabinetKey.on('down', () => this.toggleCabinet());
    this.ghost = false; this.extraLight = false; this.wideShot = false; this.lastPadGhost = false;
    // body: feet x/y in world px; takeoff = the short crouch before he leaves the floor
    this.m = { x: 513, y: FLOOR, vx: 0, vy: 0, ground: true, coyote: 0, buffer: 0, takeoff: 0, cutDone: true, acc: 0 };
    this.clockT = 0; // (never this.time: that is Phaser's clock plugin)
    this.thumb = null; this.jumpPointer = null; this.jumpTap = false;
    this.rain = Array.from({ length: 82 }, (_, i) => ({
      x: WINDOW.left + (i * 29.71) % (WINDOW.right - WINDOW.left),
      y: WINDOW.top + (i * 41.37) % (WINDOW.bottom - WINDOW.top),
      spd: 46 + (i * 19) % 55,
      len: 2 + i % 5,
    }));

    this.input.on('pointerdown', (p, over) => {
      if (over.length) return; // HUD touch buttons must not trigger jump
      if (p.x < W / 2 && !this.thumb) this.thumb = { id: p.id, x: p.x, y: p.y, cur: p.x };
      else if (p.x >= W / 2) { this.jumpPointer = p.id; this.jumpTap = true; }
    });
    this.input.on('pointermove', (p) => { if (this.thumb?.id === p.id) this.thumb.cur = p.x; });
    const released = (p) => {
      if (this.thumb?.id === p.id) this.thumb = null;
      if (this.jumpPointer === p.id) this.jumpPointer = null;
    };
    this.input.on('pointerup', released);
    this.input.on('pointerupoutside', released);
    this.thumbG = this.add.graphics().setScrollFactor(0).setDepth(29);

    // Screen-space labels never drift with the world/camera.
    const hud = (x, y, t, c = '#d2dce9') => this.add.text(x, y, t, {
      fontFamily: 'monospace', fontSize: '10px', color: c, resolution: 2,
      shadow: { offsetX: 1, offsetY: 2, color: '#000000', blur: 3, fill: true },
    }).setScrollFactor(0).setDepth(30);
    this.label = hud(12, 10, 'WARD 4 / BED 7  |  ART TARGET V1  |  MOVEMENT V1');
    this.clock = hud(W - 92, 10, '3:33 AM');
    this.hint = hud(12, H - 20, '');
    this.info = hud(12, H - 34, '', '#8a98b8');
    this.note = hud(185, 43, '', '#fedfb7');
    this.note.setAlpha(0);
    this.noteTime = 0;
    this.ghostButton = hud(W - 102, 40, '[ GHOST ]', '#bce0ff').setInteractive({ useHandCursor: true });
    this.camButton = hud(W - 102, 58, '[ CAMERA ]', '#d6b994').setInteractive({ useHandCursor: true });
    this.ghostButton.on('pointerdown', () => this.toggleGhost());
    this.camButton.on('pointerdown', () => { this.wideShot = !this.wideShot; });
    this.cabinetButton = hud(W - 102, 76, '[ CABINET ]', '#9fb4c9').setInteractive({ useHandCursor: true });
    this.cabinetButton.on('pointerdown', () => this.toggleCabinet());
    this.fxGlow = this.add.graphics().setDepth(8).setVisible(false);
  }

  showNote(msg) { this.note.setText(msg); this.note.setAlpha(1); this.noteTime = 2.4; }
  toggleGhost() {
    this.ghost = !this.ghost;
    this.milo.setGhost(this.ghost);
    this.showNote(this.ghost ? 'GHOST FORM' : 'LIVING FORM');
  }

  // debug view: the cabinet prop (sprite + the bits it missed) on/off over the empty shell.
  // Art only: Bed 7's collision, Milo and the controls don't change.
  setCabinetVisible(on) {
    this.cabinetShown = on;
    this.cabinet.setVisible(on);
    for (const img of this.cabinetExtra) img.setVisible(on);
  }
  toggleCabinet() {
    this.setCabinetVisible(!this.cabinetShown);
    this.showNote(this.cabinetShown ? 'CABINET SHOWN' : 'CABINET HIDDEN (DEBUG)');
  }

  // what the player asks for this frame, from every device: dir -1/0/1, run, jump pressed / held
  controls() {
    this.ctl.update();
    let dir = Number(this.ctl.held('right')) - Number(this.ctl.held('left'));
    let run = this.runKey.isDown;
    const pads = this.input.gamepad?.total ? this.input.gamepad.getAll() : [];
    for (const pad of pads) {
      const sx = pad.leftStick?.x || 0;
      if (Math.abs(sx) > 0.25) { dir = Math.sign(sx); if (Math.abs(sx) > 0.85) run = true; }
      if (pad.buttons?.[2]?.pressed) run = true; // X
    }
    if (this.thumb) {
      const d = this.thumb.cur - this.thumb.x;
      if (Math.abs(d) > 10) { dir = Math.sign(d); run ||= Math.abs(d) > 48; }
    }
    const jump = this.ctl.pressed('float') || this.jumpTap;
    const hold = this.ctl.held('float') || this.jumpPointer !== null;
    this.jumpTap = false;
    if (this.wideShot) return { dir: 0, run: false, jump: false, hold: false };
    return { dir, run, jump, hold };
  }

  // one fixed 1/120 s physics step (same model as the milo lab, scaled)
  tick(dt, inp) {
    const m = this.m, a = this.milo, hw = MV.halfW;
    const target = inp.dir * (inp.run ? MV.run : MV.walk);
    if (inp.dir && inp.dir !== a.facing) {
      if (m.ground && Math.abs(m.vx) > 20 * WARD_SCALE) a.play('pivot'); // a quick profile frame while he turns
      a.setFacing(inp.dir);
    }
    const rate = !m.ground ? MV.air : inp.dir === 0 || Math.sign(target) !== Math.sign(m.vx) ? MV.decel : inp.run ? MV.runAccel : MV.accel;
    m.vx = m.vx < target ? Math.min(target, m.vx + rate * dt) : Math.max(target, m.vx - rate * dt);
    // jump: buffer + coyote time, a short crouch (anticipation) before he leaves the floor, cut jump on release
    m.buffer = Math.max(0, m.buffer - dt);
    m.coyote = m.ground ? MV.coyote : Math.max(0, m.coyote - dt);
    if (m.buffer > 0 && m.coyote > 0 && m.takeoff <= 0) { m.takeoff = MV.takeoff; m.buffer = 0; a.play('jump_start'); }
    if (m.takeoff > 0 && (m.takeoff -= dt) <= 0) { m.vy = -MV.jumpV; m.ground = false; m.coyote = 0; m.cutDone = false; }
    if (!m.ground) {
      if (m.vy < 0 && !inp.hold && !m.cutDone) { m.vy *= MV.cut; m.cutDone = true; }
      m.vy = Math.min(MV.maxFall, m.vy + (m.vy > 0 ? MV.fallGrav : MV.grav) * dt);
    }
    const prevX = m.x, prevY = m.y;
    let nx = clamp(m.x + m.vx * dt, 30, WORLD_W - 30);
    // the bed is a real solid obstacle below its top, not just background decoration
    m.blocked = false;
    if (m.y > BED.top + 0.5) {
      if (prevX + hw <= BED.left && nx + hw >= BED.left && inp.dir > 0) { nx = BED.left - hw; m.vx = 0; m.blocked = true; }
      if (prevX - hw >= BED.right && nx - hw <= BED.right && inp.dir < 0) { nx = BED.right + hw; m.vx = 0; m.blocked = true; }
    }
    m.x = nx;
    m.y += m.vy * dt;
    const overBed = m.x + hw > BED.left && m.x - hw < BED.right;
    const floor = overBed && prevY <= BED.top + 0.01 ? BED.top : FLOOR;
    if (m.ground) {
      const support = m.y >= FLOOR - 0.01 || (overBed && Math.abs(m.y - BED.top) < 0.5);
      if (!support) { m.ground = false; m.vy = 0; } // walked off the bed (coyote time still allows a jump)
    } else if (m.vy >= 0 && m.y >= floor) {
      m.y = floor; m.vy = 0; m.ground = true; m.cutDone = true;
      a.play('land');
    }
  }

  // the animation follows the body (same rules as the milo lab)
  animate(inp) {
    const m = this.m, a = this.milo;
    // pushing against the bed is not walking: he stands instead of treading in place
    const sp = Math.abs(m.vx), moving = (inp.dir !== 0 && !m.blocked) || sp > 6;
    if (m.takeoff > 0) a.want('jump_start');
    else if (!m.ground) {
      if (a.anim !== 'jump_start') a.want(m.vy < -110 * WARD_SCALE ? 'rise' : m.vy < 110 * WARD_SCALE ? 'apex' : 'fall');
    } else if (a.anim === 'land' && (!moving || a.step === 0) && !a.done) {
      // let the squash read; movement takes over after the first landing frame
    } else if (!moving) {
      if (['walk', 'run', 'walk_start', 'pivot'].includes(a.anim)) a.want('stop');
      else if (a.done || !['stop', 'idle', 'land'].includes(a.anim)) a.want('idle');
    } else if (a.anim === 'pivot' && !a.done) {
      // profile frame while turning
    } else if (sp > MV.walk + 18 * WARD_SCALE) a.want('run');
    else if (['idle', 'stop', 'land'].includes(a.anim)) a.want('walk_start');
    else if (a.anim !== 'walk_start' || a.done) a.want('walk');
    // cycle tempo = ground speed / the speed the cycle was drawn for
    a.speed = a.anim === 'walk' ? clamp(sp / MV.walk, 0.5, 1.4) : a.anim === 'run' ? clamp(sp / MV.run, 0.6, 1.2) : 1;
  }

  update(_t, dtMs) {
    const dt = Math.min(dtMs / 1000, 0.05);
    this.clockT += dt;
    const padGhost = (this.input.gamepad?.total ? this.input.gamepad.getAll() : []).some(p => !!p.buttons?.[1]?.pressed);
    if (padGhost && !this.lastPadGhost) this.toggleGhost();
    this.lastPadGhost = padGhost;
    if (Phaser.Input.Keyboard.JustDown(this.lightKey)) this.extraLight = !this.extraLight;
    if (Phaser.Input.Keyboard.JustDown(this.shotKey)) this.wideShot = !this.wideShot;
    if (Phaser.Input.Keyboard.JustDown(this.closeKey)) { this.scene.start('menu'); return; }
    const inp = this.controls();
    const m = this.m;
    if (inp.jump) m.buffer = MV.buffer;
    m.acc += dt;
    while (m.acc >= 1 / 120) { m.acc -= 1 / 120; this.tick(1 / 120, inp); }
    this.animate(inp);
    this.milo.x = m.x; this.milo.footY = m.y;
    this.milo.update(dt * 1000);
    this.milo.show();
    const overBed = m.x + MV.halfW > BED.left && m.x - MV.halfW < BED.right && m.y <= BED.top + 0.5;
    this.floorShadow.x = m.x;
    this.floorShadow.y = (overBed ? BED.top : FLOOR) + 2;
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
      this.fxGlow.fillStyle(0xe7a35c, 0.06 + Math.sin(this.clockT * 3) * .009);
      this.fxGlow.fillCircle(180, 221, 84);
    }
    // the touch thumb, so a phone player sees where the drag started
    this.thumbG.clear();
    if (this.thumb) {
      this.thumbG.lineStyle(1, 0x6f8fc8, 0.5).strokeCircle(this.thumb.x, this.thumb.y, 48);
      this.thumbG.fillStyle(0x9fd8ff, 0.35).fillCircle(clamp(this.thumb.cur, this.thumb.x - 48, this.thumb.x + 48), this.thumb.y, 8);
    }
    const dev = Device.get();
    this.hint.setText(dev === 'touch' ? 'LEFT HALF: DRAG TO WALK, FAR = RUN   RIGHT HALF: JUMP (HOLD = HIGHER)'
      : dev === 'gamepad' ? 'STICK / D-PAD WALK   FULL TILT OR X RUN   A JUMP   B GHOST'
        : 'A/D MOVE   SHIFT RUN   SPACE JUMP   G GHOST   C CAMERA   L LIGHT   K CABINET');
    const a = this.milo;
    this.info.setText(`${a.anim.toUpperCase()} ${a.step + 1}/${MILO_ANIMS[a.anim].frames.length}  ${(Math.abs(m.vx) / PX_PER_M).toFixed(1)} M/S${m.ground ? '' : '  AIR'}`);
    if (this.noteTime > 0) { this.noteTime -= dt; this.note.setAlpha(Math.min(1, this.noteTime)); }
    // Optional interaction test: the door is a walkable endpoint; don't fake a finished corridor.
    if (m.x > 960 && !this.reachedDoor) { this.reachedDoor = true; this.showNote('END OF ART LAB  /  NEXT: CORRIDOR KIT'); }
  }
}
