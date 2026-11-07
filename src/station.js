// v9 prototype (greybox): CHASE -> EXPLORE -> CHASE. Mixed into PlayScene.
// Ward 4 has lit nurse stations. Run in and the auto-run stops: walk left and right, jump on the desks,
// find the chart. THE STRETCH can't come into the light. The EXIT on the right puts you back in the chase.
// How: Milo stays at PLAYER_X like in the runner; walking moves the world under him (worldX goes both
// ways), so the camera, the HUD and every runner system stay as they are. Hollow Knight's benches and
// Inside's safe rooms: a lit place you can tell is safe at a glance.
import { W, H, CEIL, FLOOR, PLAYER_X, PX_PER_METER } from './data.js';
import { Audio } from './audio.js';
import { text } from './ui.js';
import { Device } from './input.js';
import { BOTTOM, MILO_HALF, MILO_SCALE, RUN_G, JUMP_V, JUMP_CUT, COYOTE, BUFFER, SLIDE_T, RUN } from './runner-const.js';

export const STATION_M = [55, 170];   // m into Ward 4 (clear of the opening, Ivy, the flight and the Matron)
export const STATION_LEN = 860;       // px from the entrance to the exit door
const HOLD_M = 26;                    // no new traps this far before a station (the spawner looks 22 m ahead)
const STOP_AT = 110;                  // px past the entrance where the run stops
const WALK = 150, ACCEL = 1300, DEAD = 6;
const RAMP = 1.1;                     // s from walking back to full run speed
// one-way platforms: x from the entrance, top y (screen), width. Each step is under a jump (about 90 px)
const PLATS = [
  { x: 470, y: FLOOR - 52, w: 130 },  // the desk
  { x: 300, y: FLOOR - 112, w: 112 }, // the shelf (back left: you climb backwards)
  { x: 120, y: FLOOR - 172, w: 104, chart: true }, // the cabinet top: the chart
];
const EXIT_X = STATION_LEN - 50;      // the door; walk into it to leave

export const StationFeatures = {
  stationInit() {
    this.station = null;
    this.stationList = window.__noStations ? [] : STATION_M.slice(); // tests that run past them set __noStations
    this.stationQueue();
  },

  stationQueue() {
    const m = this.stationList.shift();
    this.station = m === undefined ? null : { wx0: m * PX_PER_METER, phase: 'ahead', v: 0, t: 0, face: 1, read: false, moved: false, dropT: 0, gfxOn: false };
  },

  stationCreate() {
    this.stGfx = this.add.graphics().setDepth(4.7);     // the lit room: over the darkness, under everything that moves
    this.stPlat = this.add.graphics().setDepth(8.8);    // desks and shelves: under Milo
    this.stHint = this.add.graphics().setDepth(21.6);   // the move arrows, the thumb pad
    this.stGlow = this.add.image(0, 0, 'glow').setScale(4).setDepth(4.72).setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff0c0).setAlpha(0);
    this.stSign = text(this, 0, 0, 'NURSE STATION', 8, '#2a2a30').setDepth(4.75).setVisible(false);
    this.stExit = text(this, 0, 0, 'EXIT →', 8, '#7dff9a').setDepth(4.75).setStroke('#07060d', 3).setVisible(false);
    this.stClock = text(this, 0, 0, '3:33', 8, '#ff6a5a').setDepth(4.75).setVisible(false);
    this.stThumb = null;
    // touch: like the arenas, the left half is the move thumb (hold and slide); the right half still jumps
    this.input.on('pointerdown', (p) => { if (this.stationFree() && p.x < W / 2 && !p.__ui && !this.stThumb) this.stThumb = { id: p.id, x0: p.x, x: p.x }; });
    this.input.on('pointermove', (p) => { if (this.stThumb && this.stThumb.id === p.id) this.stThumb.x = p.x; });
    const up = (p) => { if (this.stThumb && this.stThumb.id === p.id) this.stThumb = null; };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
  },

  stationFree() { return !!this.station && this.station.phase === 'in'; },
  // inside the light: no traps, it can't come in
  stationSafe() { return !!this.station && (this.station.phase === 'enter' || this.station.phase === 'in'); },
  // the spawner, tricks, scares and allies hold off from a bit before the door until you're out
  stationBusy() {
    const st = this.station;
    if (!st || this.dead) return false;
    if (st.phase !== 'ahead') return true;
    return this.zoneIndex === 0 && !this.beyond && this.worldX >= st.wx0 - HOLD_M * PX_PER_METER && this.worldX < st.wx0 + 48;
  },

  // from step(), after the run speed is set: the station owns Milo's speed while he's in it
  stationSpeed(run, dt) {
    const st = this.station;
    if (!st || this.dead || this.zoneIndex !== 0 || this.beyond || this.flying) return run;
    if (st.phase === 'ahead') {
      if (this.worldX < st.wx0) return run;
      if (this.worldX > st.wx0 + 48) { this.stationQueue(); return run; } // a run that starts past it (a checkpoint, a bot)
      // in the door: the run slows to a stop inside the light
      st.phase = 'enter'; st.v = run; st.decel = (run * run) / (2 * STOP_AT);
      this.clearAround(W);
      this.lastStumble = -99; this.stumbles = 0; this.events.emit('strike', null); this.lastStrike = null;
      this.headline('NURSE STATION', 'THE LIGHT KEEPS IT OUT.', 2.2);
      Audio.sfx('lamp');
      return run;
    }
    if (st.phase === 'enter') {
      st.v = Math.max(0, st.v - st.decel * dt);
      if (st.v <= 0) { st.phase = 'in'; st.t = 0; this.inputMap.leftFree?.(true); }
      return st.v;
    }
    if (st.phase === 'in') {
      st.t += dt;
      const dir = this.stationDir();
      const target = dir * WALK;
      const a = ACCEL * dt;
      st.v = st.v < target ? Math.min(target, st.v + a) : Math.max(target, st.v - a);
      if (Math.abs(dir) > 0.2) { st.face = Math.sign(dir); st.moved = true; }
      // the walls: the light's edge behind you, the exit ahead
      const lo = st.wx0 + 24, hi = st.wx0 + EXIT_X;
      const nx = Phaser.Math.Clamp(this.worldX + st.v * dt, lo, hi);
      st.v = (nx - this.worldX) / dt;
      if (nx >= hi && this.grounded) this.stationLeave();
      return st.v;
    }
    // 'out': the run picks back up
    st.t += dt;
    const k = Math.min(1, st.t / RAMP);
    const v = Phaser.Math.Linear(Math.max(st.v, WALK), run, k * k);
    if (k >= 1 && this.worldX > st.wx0 + STATION_LEN + 40) this.stationQueue();
    return v;
  },

  stationDir() {
    const im = this.inputMap;
    let d = (im.held('right') ? 1 : 0) - (im.held('left') ? 1 : 0);
    if (this.stThumb) {
      const dx = this.stThumb.x - this.stThumb.x0;
      if (Math.abs(dx) > DEAD) d = Phaser.Math.Clamp((dx - Math.sign(dx) * DEAD) / 26, -1, 1);
    }
    return d;
  },

  stationLeave() {
    const st = this.station;
    st.phase = 'out'; st.t = 0; st.v = Math.max(st.v, WALK); st.face = 1;
    this.inputMap.leftFree?.(false); this.stThumb = null;
    // it waited by the door: it comes back in from the left, closer than you left it
    this.gap = Math.min(this.gap, RUN.START_GAP - 14);
    this.gapVis = this.gap; this.crEnter = 0;
    this.nextTrapX = Math.max(this.nextTrapX, this.worldX + 420);
    this.headline('IT WAS WAITING.', '', 1.3, true);
    Audio.sfx('keys', { v: 0.9 }); Audio.sfx('breath', { v: 0.8 });
    this.shake(120, 0.004);
  },

  // Milo inside: the runner's jump (coyote, buffer, short hop) plus one-way desks; slide on a desk = drop through
  stepStation(dt, holding) {
    const st = this.station;
    const jump = this.jumpLatch, slide = this.slideLatch;
    this.jumpLatch = false; this.slideLatch = false;
    if (jump) this.buffer = BUFFER; else this.buffer = Math.max(0, this.buffer - dt);
    this.coyote = this.grounded ? COYOTE : Math.max(0, this.coyote - dt);
    st.dropT = Math.max(0, st.dropT - dt);
    const on = this.stationPlatUnder(this.py + MILO_HALF + 1);
    if (slide) {
      if (this.grounded && on) { st.dropT = 0.22; this.grounded = false; this.vy = 60; this.buffer = 0; }
      else if (this.grounded) { if (this.slide <= 0) Audio.sfx('slide'); this.slide = SLIDE_T * 0.6; this.buffer = 0; }
    }
    if (this.slide > 0) this.slide = Math.max(0, this.slide - dt);
    if (this.buffer > 0 && this.coyote > 0) {
      this.vy = -JUMP_V * this.perk.jump; this.grounded = false; this.coyote = 0; this.buffer = 0; this.slide = 0;
      Audio.sfx('jump');
      this.tweens.add({ targets: this.player, scaleX: MILO_SCALE * 0.85, scaleY: MILO_SCALE * 1.2, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
    }
    if (!holding && this.vy < 0) this.vy *= Math.pow(JUMP_CUT, dt * 20);
    // walked off a desk
    if (this.grounded && this.py < BOTTOM - 1 && !on) this.grounded = false;
    if (!this.grounded) {
      const feet0 = this.py + MILO_HALF;
      this.vy += RUN_G * dt;
      this.py += this.vy * dt;
      const feet = this.py + MILO_HALF;
      if (this.vy >= 0 && st.dropT <= 0) {
        const p = this.stationPlatUnder(feet, feet0);
        if (p) { if (this.vy > 250) this.land(); this.py = p.y - MILO_HALF; this.vy = 0; this.grounded = true; }
      }
    }
    if (this.py >= BOTTOM) {
      if (!this.grounded && this.vy > 250) this.land();
      this.py = BOTTOM; this.vy = 0; this.grounded = true;
    }
    if (this.invuln > 0) this.invuln -= dt;
    // the thing to find: the chart on top of the cabinet
    const chart = PLATS.find((p) => p.chart);
    if (!st.read && this.grounded && Math.abs(this.py - (chart.y - MILO_HALF)) < 2 && this.stationOver(chart)) {
      st.read = true;
      this.headline('BED 7: MILO, 16.', 'NO RESPONSE SINCE 3:33 AM.', 2.6);
      Audio.sfx('pen'); Audio.sfx('creak');
      this.addCombo?.('gate', PLAYER_X + 40, this.py - 30);
    }
  },

  stationOver(p) {
    const x = this.worldX - this.station.wx0;
    return x + 9 > p.x && x - 9 < p.x + p.w;
  },
  // the platform whose top the feet are on (or crossed this step, from above)
  stationPlatUnder(feet, feet0 = feet) {
    return PLATS.find((p) => this.stationOver(p) && feet0 <= p.y + 1 && feet >= p.y - 1 && feet <= p.y + 14) || null;
  },

  // Milo stands still in the light (render picks the pose)
  stationIdle() { return this.stationSafe() && this.station.phase === 'in' && Math.abs(this.station.v) < 4 && this.grounded; },

  renderStation(lead) {
    const st = this.station;
    const g = this.stGfx, pg = this.stPlat, hg = this.stHint;
    g.clear(); pg.clear(); hg.clear();
    const show = st && this.zoneIndex === 0 && !this.beyond && !this.dead;
    const x0 = show ? Math.round(this.sx(st.wx0) - lead) : 9999;
    const vis = show && x0 < W + 40 && x0 + STATION_LEN > -60;
    this.stSign.setVisible(vis); this.stExit.setVisible(vis); this.stClock.setVisible(vis); this.stGlow.setVisible(vis);
    this.player.setFlipX(!!(st && st.phase === 'in' && st.face < 0));
    if (!vis) return;
    const top = CEIL + 6, L = STATION_LEN;
    // the back wall: flat grey, the only lit room in the ward
    g.fillStyle(0x50545e, 1).fillRect(x0, top, L, FLOOR - top);
    g.fillStyle(0x5c606b, 1).fillRect(x0, FLOOR - 70, L, 70);          // the lower wall panel
    g.fillStyle(0x3c4048, 1).fillRect(x0, FLOOR - 72, L, 2);
    // ceiling lamps and their pools of light
    for (let lx = 140; lx < L - 60; lx += 240) {
      g.fillStyle(0xfff4d0, 1).fillRect(x0 + lx - 18, top, 36, 5);
      g.fillStyle(0xfff4d0, 0.07).fillTriangle(x0 + lx - 18, top + 5, x0 + lx + 18, top + 5, x0 + lx + 90, FLOOR);
      g.fillTriangle(x0 + lx - 18, top + 5, x0 + lx - 90, FLOOR, x0 + lx + 90, FLOOR);
    }
    // the light's edge at both doors: a hard bright line. You can see where safe ends
    for (const ex of [0, L]) {
      g.fillStyle(0xfff4d0, 0.5).fillRect(x0 + ex - 2, top, 4, FLOOR - top);
      g.fillStyle(0xfff4d0, 0.15).fillRect(x0 + ex - (ex ? 14 : 0), top, 14, FLOOR - top);
    }
    // the entrance frame and the sign over it
    g.fillStyle(0x2a2d35, 1).fillRect(x0 - 8, top, 16, FLOOR - top).fillRect(x0 - 8, top, 200, 26);
    g.fillStyle(0xe8e4d4, 1).fillRect(x0 + 18, top + 5, 160, 16);
    this.stSign.setPosition(x0 + 98, top + 13);
    this.stGlow.setPosition(x0 + 98, top + 40).setAlpha(0.18 + Math.sin(this.clock * 3) * 0.03);
    // the wall clock, stopped at 3:33
    g.fillStyle(0x1c1e24, 1).fillRect(x0 + 250, top + 30, 50, 22);
    this.stClock.setPosition(x0 + 275, top + 42);
    // the counter by the entrance (scenery)
    g.fillStyle(0x6c707a, 1).fillRect(x0 + 20, FLOOR - 40, 70, 40);
    g.fillStyle(0xb8bcc6, 1).fillRect(x0 + 16, FLOOR - 44, 78, 5);
    // the cabinet under the top platform, so it reads as furniture you climb
    const cab = PLATS[2];
    g.fillStyle(0x464a54, 1).fillRect(x0 + cab.x + 8, cab.y, cab.w - 16, FLOOR - cab.y);
    g.lineStyle(1, 0x2e3138, 1);
    for (let y = cab.y + 30; y < FLOOR; y += 34) g.lineBetween(x0 + cab.x + 8, y, x0 + cab.x + cab.w - 8, y);
    // the exit: a dark door, a green sign, an arrow
    const ex = x0 + EXIT_X;
    g.fillStyle(0x1c1e24, 1).fillRect(ex - 6, FLOOR - 74, 46, 74);
    g.lineStyle(3, 0x3ad06a, 1).strokeRect(ex - 6, FLOOR - 74, 46, 74);
    g.fillStyle(0x0e2a16, 1).fillRect(ex - 14, FLOOR - 104, 62, 18);
    this.stExit.setPosition(ex + 17, FLOOR - 95).setAlpha(0.75 + Math.sin(this.clock * 4) * 0.25);
    // the platforms: pale tops, darker bodies, legs
    for (const p of PLATS) {
      const px = x0 + p.x;
      pg.fillStyle(0x6c707a, 1).fillRect(px, p.y + 5, p.w, 9);
      pg.fillStyle(0xc8ccd6, 1).fillRect(px - 2, p.y, p.w + 4, 5);
      pg.fillStyle(0x2a2d35, 1).fillRect(px - 2, p.y + 14, p.w + 4, 1);
      if (!p.chart && p.y > FLOOR - 60) pg.fillStyle(0x50545e, 1).fillRect(px + 6, p.y + 14, 6, FLOOR - p.y - 14).fillRect(px + p.w - 12, p.y + 14, 6, FLOOR - p.y - 14);
      if (!p.chart && p.y <= FLOOR - 60) pg.fillStyle(0x50545e, 1).fillRect(px + 8, p.y + 14, 4, 10).fillRect(px + p.w - 12, p.y + 14, 4, 10); // wall brackets
      if (p.chart) {
        // the clipboard, and a glint until you've read it
        pg.fillStyle(0x7a5a3a, 1).fillRect(px + 44, p.y - 18, 16, 18);
        pg.fillStyle(0xf0eee4, 1).fillRect(px + 46, p.y - 15, 12, 14);
        pg.fillStyle(0x8a8a9a, 1).fillRect(px + 48, p.y - 12, 8, 1).fillRect(px + 48, p.y - 9, 8, 1).fillRect(px + 48, p.y - 6, 6, 1);
        if (!st.read) {
          const tw = (Math.sin(this.clock * 5) + 1) / 2;
          pg.fillStyle(0xffe08a, 0.4 + tw * 0.6).fillRect(px + 61, p.y - 26, 2, 8).fillRect(px + 58, p.y - 23, 8, 2);
        }
      }
    }
    // the cue that you can walk now: arrows by Milo's feet until he moves (no words; a pad on touch)
    if (st.phase === 'in' && !st.moved && st.t > 0.4) {
      const a = 0.45 + Math.sin(this.clock * 6) * 0.3;
      hg.fillStyle(0xe6f0ff, a);
      hg.fillTriangle(PLAYER_X - 30, FLOOR - 22, PLAYER_X - 22, FLOOR - 28, PLAYER_X - 22, FLOOR - 16);
      hg.fillTriangle(PLAYER_X + 30, FLOOR - 22, PLAYER_X + 22, FLOOR - 28, PLAYER_X + 22, FLOOR - 16);
    }
    if (st.phase === 'in' && this.touchSeen()) {
      const t = this.stThumb;
      const cx = t ? t.x0 : 90, cy = H - 60;
      hg.lineStyle(2, 0xe6f0ff, t ? 0.5 : (st.moved ? 0.12 : 0.3)).strokeCircle(cx, cy, 30);
      if (t) hg.fillStyle(0xe6f0ff, 0.5).fillCircle(Phaser.Math.Clamp(t.x, cx - 30, cx + 30), cy, 12);
    }
  },

  touchSeen() { return !!this.stThumb || Device.get() === 'touch'; },
};
