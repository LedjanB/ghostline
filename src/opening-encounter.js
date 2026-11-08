// THE FIRST ENCOUNTER (opening, cinematic revision V1): THE STRETCH's shadow and Boo's rescue, mixed into OpeningScene.
// UNEASE -> RECOGNITION -> DANGER -> RESCUE -> ESCAPE, as story states with event gates, never a bare timer:
//   warning  the vent dies, rain goes far, keys behind bed 8's curtain, bed 8's lamp flickers on behind the fabric,
//            something grips the curtain from behind (the fabric pulls in), the door swings shut. Milo glances over.
//   shadow   figure:  a too-tall silhouette rises on the backlit curtain (only its shadow, never the body)
//            climb:   head and neck stretch up over the rail onto the lit wall and bend along the ceiling
//            reach:   one arm crawls along the upper wall, down the wall, over the floor to Milo's feet
//            Gates: the figure must have been on screen `SEE.figure` s before it climbs, the climb seen before it
//            reaches, the reaching hand seen `SEE.reach` s before it may take him. Milo keeps control (fear once).
//   rescue   it has his ankle; silence; a match in the corridor; the door opens, warm light comes along the floor;
//            Boo arrives (event: he reached his mark), the lantern flares, the shadow burns back, Boo steps between.
//            "THERE YOU ARE." / "WHAT IS THAT?" / "NOT NOW, KID. MOVE." + he points at the door.
//   escape   control back, Boo leads to the door; at the door the shadow tries one last reach and burns on the
//            lantern; they go through the door into the dark corridor; only then the end card.
// Camera: one slow framing that holds Milo + the beat's key point (curtain, head, hand, Boo, door), never the full
// room swing. Zoom stays 1. The room is 1122 px wide and the curtain sits at 370..570, so Milo and the curtain always
// fit one 640 px frame: the reveal also waits until the curtain is actually in the frame.
import { W, H } from './data.js';
import { BooActor } from './boo-sprite.js';
import { MILO_ANIMS } from './milo-sprite.js';

const FEET = 320;
const CURT = { x0: 372, x1: 568, mid: 470, rail: 69, hem: 300 };
const DOOR = { x: 950, stop: 893, in: 905 };
const SEE = { figure: 2.2, climb: 1.6, reach: 2.5 };
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

Object.assign(MILO_ANIMS, {
  // a short look toward the sound
  op_glance: { frames: [['turn', 120], ['idle0', 160], ['shock0', 520], ['idle0', 120]] },
  // the hand is coming: he flinches into the approved fear pose
  op_scared: { frames: [['shock0', 140], ['fear0', 160], ['fear1', 180], ['fear2', 110], ['fear4', 110], ['fear3', 420]] },
  // held in fear, trembling (in place)
  op_tremble: { loop: true, frames: [['fear3', 420], ['fear2', 90], ['fear4', 90], ['fear2', 90], ['fear3', 520], ['fear4', 90], ['fear2', 90]] },
  // the flare: arms up against the light
  op_shield: { frames: [['recoil0', 160], ['recoil1', 900], ['recoil0', 200], ['fear3', 300]] },
  // from the shadow to Boo: still afraid, then he looks at the old man
  op_look_boo: { loop: true, frames: [['fear3', 260], ['idle0', 400], ['confused', 1600], ['blink', 100], ['confused', 1400]] },
});

export const ENCOUNTER = {
  encInit() {
    this.enc = { st: 'none', t: 0, seen: 0, seenClimb: 0, seenReach: 0, scared: false, react: null, keysT: 0, crawlT: 0, idleT: 0, nagged: 0, lastSaid: '', final: false };
    this.sh = { a: 0, aT: 0, fx: CURT.mid, rise: 0, climb: 0, len: 0, tx: CURT.mid, dir: 1, curl: 0.15, burn: 0, retreat: 0, lunge: 0, grab: false, flakes: [], frost: [], hand: null, head: null, pts: null, flip: 0 };
    this.b8 = 0; this.b8T = 0; this.b8Flick = 0; this.dent = 0; this.dentT = 0; this.dentX = 470;
    this.booS = { on: false, x: DOOR.x + 20, tx: DOOR.x + 20, face: -1, speed: 0, a: 0, aT: 0, mode: 'off', arrived: null };
    this.flare = 0; this.camF = null;
  },

  encCreate(w, add) {
    // bed 8's lamp, behind the curtain: the backlight that makes the fabric a screen, the spill on wall and ceiling
    this.b8L = {
      c: add('op_glow_sick', CURT.mid + 10, 196, 6.9, 2.7, 2.5), s: add('op_glow_sick', CURT.mid, 46, 6.9, 5.4, 1.2),
      f: add('op_pool_sick', CURT.mid, 306, 6.9, 2.4),
    };
    // the shadow: drawn opaque into one texture (no doubled overlaps), shown with one alpha; the lantern erases it
    this.shRT = w(this.add.renderTexture(0, 0, this.worldW, H).setOrigin(0), 7.6);
    this.shG = this.make.graphics({}, false);
    this.haloG = w(this.add.graphics().setBlendMode(Phaser.BlendModes.ADD), 7.55);
    this.eraser = this.make.image({ key: 'op_glow_warm', x: 0, y: 0 }, false);
    this.flG = w(this.add.graphics(), 7.7); // flakes burning off + frost
    this.gripG = w(this.add.graphics(), 10.3); // its fingers over his ankle while it holds him
    // Boo (new raster sprites) and the warm copy of Milo the lantern lights
    this.booA = new BooActor(this, this.booS.x, FEET, (o) => w(o, 11)).setFacing(-1);
    this.booA.alpha = 0; this.booA.show();
    this.miloWarm = w(this.add.sprite(0, 0, this.milo.sprite.texture.key, 0).setBlendMode(Phaser.BlendModes.ADD).setTint(0xff9a48).setAlpha(0), 10.1);
  },

  // ------------------------------------------------------------ story states
  encTrigger(m) {
    if (this.phase === 'explore2' && this.enc.st === 'none' && (m.x > 420 || this.ctlT > 6)) this.startWarning();
  },

  startWarning() {
    this.flags.warning++;
    this.phase = 'warning'; this.enc.st = 'warning'; this.enc.t = 0;
    this.camMode = 'frame'; this.camK = 1.2;
    const s = this.snd || {};
    const call = (f, ...a) => s[f] && s[f](...a);
    this.run([
      [0, () => { call('vent', false, { abrupt: true }); call('rain', 0.12, true, 0.25); call('pad', 0, 0.2); this.hrT = 72; this.eFlick = 0.5; }],
      [0.9, () => { call('keysOdd', 0.5); this.dentX = clamp(this.m.x, CURT.x0 + 40, CURT.x1 - 40); }],
      [1.3, () => this.react('glance', 'op_glance', Math.sign(CURT.mid - this.m.x) || 1)],
      [1.7, () => { this.b8T = 1; this.b8Flick = 1.4; call('clunk'); }],
      [2.5, () => { call('keysOdd', 0.7); call('curtain', 0.8); call('creak'); this.dentT = 1; }],
      [3.4, () => { this.doorT = 0; call('slam'); }],
      [3.9, () => { this.dentT = 0; call('curtain', 0.5); call('keysOdd', 0.4); }],
      [4.5, () => { this.enc.st = 'ready'; }],
    ]);
  },

  // the figure appears only once the curtain is really in the frame
  startShadow() {
    this.flags.shadow++;
    this.phase = 'shadow'; this.enc.st = 'figure'; this.enc.t = 0; this.enc.seen = 0;
    const sh = this.sh;
    sh.fx = clamp(this.m.x, CURT.x0 + 50, CURT.x1 - 50);
    sh.dir = this.m.x >= sh.fx ? 1 : -1; sh.tx = this.m.x;
    sh.aT = 0.94;
    const s = this.snd;
    if (s) { s.presence(0.5, 2); s.breath(0.8); s.cold(0.4, 3); }
    this.hrT = 84; this.coldT = 0.25; this.darkT = 0.68;
  },

  startRescue() {
    this.flags.boo++;
    this.phase = 'rescue'; this.enc.st = 'trapped'; this.enc.t = 0;
    this.lockControl();
    this.m.vx = 0; this.auto = null;
    const sh = this.sh, s = this.snd || {};
    const call = (f, ...a) => s[f] && s[f](...a);
    sh.grab = true;
    this.trembleAt(sh.fx);
    this.hrT = 150; this.darkT = 0.8; this.coldT = 0.7;
    const sdir = Math.sign(this.m.x - sh.fx) || 1; // from the shadow toward Milo
    const between = clamp(this.m.x - sdir * 44, 70, 880);
    const stop = sdir < 0 ? between : clamp(this.m.x + 50, 70, 880); // where he first stops (coming from the door)
    this.enc.between = between; this.enc.sdir = sdir;
    const b = this.booS;
    this.run([
      [0, () => { call('grip'); call('presence', 1, 0.6); call('rain', 0.05, true, 0.4); this.shake(220, 0.003); }],
      [1.1, () => { call('presence', 0.15, 0.08); }], // silence
      [1.6, () => { call('farStrike'); this.enc.st = 'ember'; }],
      [2.2, () => {
        this.doorT = 1; call('door');
        b.on = true; b.x = DOOR.x + 10; b.tx = stop; b.speed = 300; b.face = -1; b.aT = 0.94; b.mode = 'come';
        this.lanternT = 0.35; this.booA.play('walk');
        b.arrived = () => this.booArrives();
      }],
    ]);
  },

  // Boo reached his mark: the lantern flares, the shadow burns back, he steps between, the lines
  booArrives() {
    const b = this.booS, s = this.snd || {};
    const call = (f, ...a) => s[f] && s[f](...a);
    const sdir = this.enc.sdir;
    b.face = -sdir; b.mode = 'stand';
    this.booA.setFacing(b.face).play('ignite');
    this.run([
      [0.15, () => { call('flare'); this.lanternT = 1; this.flare = 1; this.shake(200, 0.004); this.coldT = 0.15; this.darkT = 0.58; }],
      [0.4, () => { this.burnBack(); this.react('shield', 'op_shield', -sdir, true); }],
      [1.5, () => { b.tx = this.enc.between; b.speed = 70; b.mode = 'step'; this.booA.play('walk'); }],
      [2.4, () => { this.trembleAt(this.sh.fx); }],
      [2.5, () => this.say('boo', 'THERE YOU ARE.', 1.5)],
      [3.3, () => { this.m.face = this.booS.x > this.m.x ? 1 : -1; this.milo.setFacing(this.m.face).play('op_look_boo'); }],
      [4.3, () => this.say('milo', 'WHAT IS THAT?', 1.4)],
      [6.2, () => { b.face = 1; this.booA.setFacing(1).play('point'); this.say('boo', 'NOT NOW, KID. MOVE.', 1.6); call('keysOdd', 0.3); }],
      [8.2, () => this.startEscape()],
    ]);
  },

  burnBack() {
    const sh = this.sh;
    sh.burn = 1; sh.grab = false; this.enc.st = 'recoil';
    this.snd && this.snd.burn();
    this.hrT = 112;
    this.flakeBurst(sh.hand ? [sh.hand] : [], 26);
  },

  startEscape() {
    this.phase = 'escape'; this.enc.st = 'escape'; this.enc.idleT = 0; this.enc.t = 0;
    this.giveControl('escape'); this.camMode = 'frame'; this.camK = 1.2;
    this.act = false; this.pose = null; this.milo.play('idle');
    this.booS.mode = 'lead'; this.booS.speed = 90;
    this.hrT = 104; this.enc.scared = false;
    this.snd && this.snd.presence(0.25, 2);
  },

  // the last try, at the door: the arm shoots along the floor from the curtain; Boo turns and the lantern holds it
  finalReach() {
    if (this.enc.final) return;
    this.enc.final = true;
    this.phase = 'exit';
    this.lockControl(); this.m.vx = 0; this.auto = null;
    const sh = this.sh, b = this.booS, s = this.snd || {};
    const call = (f, ...a) => s[f] && s[f](...a);
    sh.retreat = 0; sh.burn = 0; sh.len = 0; sh.lunge = 1; sh.dir = 1; sh.tx = this.m.x; sh.aT = 0.94; this.enc.st = 'lunge';
    call('lunge'); call('presence', 0.9, 0.2); this.hrT = 138;
    this.react('scared', 'op_scared', -1, true);
    b.tx = this.m.x - 42; b.speed = 260; b.mode = 'step'; b.face = -1; this.booA.setFacing(-1).play('walk');
    b.arrived = () => { this.booA.play('guard'); };
    this.run([
      [0.75, () => { call('flare'); this.flare = 1; this.lanternT = 1; this.shake(160, 0.003); }],
      [0.95, () => { this.burnBack(); sh.lunge = 0; this.enc.st = 'gone'; }],
      [2.2, () => { call('presence', 0, 1.5); this.booA.setFacing(1).play('walk'); b.tx = DOOR.x + 30; b.speed = 70; b.mode = 'out'; this.act = false; this.pose = null; this.walkTo(DOOR.x + 6, 60, null); }],
      [5.6, () => { this.lanternT = 0; call('keysOdd', 0.25); call('curtain', 0.4); }],
      [6.4, () => { this.fadeT = 1; this.fadeK = 0.8; call('fade', 0.25, 1); }],
      [8.4, () => this.showEnd()],
    ]);
  },

  // a short, intentional reaction: control goes away only for the length of the acting
  react(pose, anim, face, keepLocked = false) {
    const m = this.m;
    const go = () => {
      const had = this.control;
      this.control = false; this.thumb = null; m.vx = 0; this.auto = null;
      m.face = face;
      this.acting(pose, anim, () => {
        this.act = false; this.pose = null;
        if (!keepLocked && had && (this.phase === 'warning' || this.phase === 'shadow')) this.control = true;
      });
    };
    if (m.ground) go(); else this.enc.react = go; // in the air: as soon as he lands
  },

  trembleAt(x) {
    this.m.face = Math.sign(x - this.m.x) || this.m.face;
    this.act = true; this.pose = 'trapped'; this.milo.speed = 1;
    this.milo.setFacing(this.m.face).play('op_tremble');
  },

  // ------------------------------------------------------------ simulation
  encStep(dt) {
    const enc = this.enc, sh = this.sh, m = this.m, s = this.snd;
    enc.t += dt;
    if (enc.react && m.ground) { const f = enc.react; enc.react = null; f(); }
    // bed 8's lamp + the curtain
    this.b8Flick = Math.max(0, this.b8Flick - dt);
    const b8Goal = this.b8Flick > 0 ? (Math.random() < 0.5 ? 1 : 0.1) : this.b8T * (sh.burn > 0.2 ? 0.55 : 1);
    this.b8 = lerp(this.b8, b8Goal, 1 - Math.exp(-dt * (this.b8Flick > 0 ? 30 : 3)));
    this.dent = lerp(this.dent, this.dentT, 1 - Math.exp(-dt * 2.2));
    this.flare = Math.max(0, this.flare - dt * 0.8);

    if (this.phase === 'warning' && enc.st === 'ready' && this.inView(CURT.mid, 180, 60)) this.startShadow();

    // ---- the shadow
    sh.a = lerp(sh.a, sh.aT, 1 - Math.exp(-dt * 2.5));
    sh.burn = Math.max(0, sh.burn - dt * 0.45);
    const live = this.phase === 'shadow' || this.phase === 'rescue' || this.phase === 'escape' || this.phase === 'exit';
    if (live) {
      sh.tx = lerp(sh.tx, m.x, 1 - Math.exp(-dt * 1.6));
      const view = this.inView(sh.fx, 190, 40) && sh.a > 0.6 && this.fade < 0.1;
      if (enc.st === 'figure') {
        sh.rise = Math.min(1, sh.rise + dt / 1.8);
        sh.fx = lerp(sh.fx, clamp(m.x, CURT.x0 + 50, CURT.x1 - 50), 1 - Math.exp(-dt * 0.4));
        if (view) enc.seen += dt;
        if (sh.rise >= 1 && enc.seen >= SEE.figure) { enc.st = 'climb'; s && s.creak(); s && s.presence(0.65, 1.5); }
      } else if (enc.st === 'climb') {
        sh.climb = Math.min(1, sh.climb + dt / 2.2);
        if (this.inView(sh.head ? sh.head.x : sh.fx, 120, 30)) enc.seenClimb += dt;
        if (sh.climb >= 1 && enc.seenClimb >= SEE.climb) { enc.st = 'reach'; this.hrT = 104; this.coldT = 0.5; this.darkT = 0.74; s && s.presence(0.8, 3); }
      } else if (enc.st === 'reach') {
        // committed to Milo's side; if he slips past the body to the other side, it pulls the arm back and turns
        const side = Math.sign(m.x - sh.fx) || sh.dir;
        if (side !== sh.dir) { sh.len = Math.max(0, sh.len - dt * 420); if (sh.len <= 0) sh.dir = side; }
        else {
          const sp = clamp(80 + enc.t * 4, 80, 150);
          sh.len += dt * sp;
        }
        const tot = sh.pts ? sh.pts.total : 1e9;
        sh.len = Math.min(sh.len, tot);
        const h = sh.hand;
        if (h && this.inView(h.x, h.y, 24)) enc.seenReach += dt;
        const d = h ? Math.hypot(h.x - m.x, h.y - m.y) : 1e9;
        if (!enc.scared && d < 170 && h && this.inView(h.x, h.y, 24)) { enc.scared = true; this.react('scared', 'op_scared', Math.sign(h.x - m.x) || 1); this.hrT = 128; }
        this.hrT = Math.max(this.hrT, d < 100 ? 140 : this.hrT);
        sh.curl = lerp(sh.curl, d < 60 ? 0.65 : 0.15, 1 - Math.exp(-dt * 3));
        const arrived = sh.pts && sh.len >= sh.pts.total - 1; // the arm's path ends at his feet
        if (h && arrived && m.ground && enc.seenReach >= SEE.reach && !this.act) this.startRescue();
        enc.crawlT -= dt;
        if (enc.crawlT <= 0) { enc.crawlT = 0.5 + Math.random() * 0.5; s && s.crawl(0.6); }
        if (h && Math.random() < dt * 6) sh.frost.push({ x: h.x + (Math.random() - 0.5) * 16, y: h.y + (Math.random() - 0.5) * 10, life: 1 });
      } else if (enc.st === 'trapped' || enc.st === 'ember') {
        sh.curl = lerp(sh.curl, 0.9, 1 - Math.exp(-dt * 4));
        sh.len = sh.pts ? sh.pts.total : sh.len;
      } else if (enc.st === 'recoil' || enc.st === 'escape' || enc.st === 'gone') {
        // pulled back, curled, pushed down behind the curtain while the lantern burns
        sh.len = Math.max(0, sh.len - dt * 520);
        sh.curl = lerp(sh.curl, 1, 1 - Math.exp(-dt * 6));
        sh.retreat = Math.min(1, sh.retreat + dt / 1.6);
        if (enc.st === 'gone') sh.aT = 0.3;
      } else if (enc.st === 'lunge') {
        sh.retreat = Math.max(0, sh.retreat - dt * 2.5);
        sh.len += dt * 520;
        sh.curl = 0.1;
        if (sh.pts) sh.len = Math.min(sh.len, sh.pts.total - 50); // the light holds it short of him
      }
      // the lantern keeps it down while Boo is near the curtain
      if (this.lantern > 0.6 && sh.retreat > 0 && enc.st !== 'lunge') sh.retreat = Math.min(1, sh.retreat + dt);
    }
    if (sh.a > 0.01 || live) this.shadowGeo();
    // flakes and frost
    sh.flakes.forEach((f) => { f.x += f.vx * dt; f.y += f.vy * dt; f.vy -= dt * 20; f.life -= dt * 0.9; });
    sh.flakes = sh.flakes.filter((f) => f.life > 0);
    sh.frost.forEach((f) => { f.life -= dt * 0.25; });
    sh.frost = sh.frost.filter((f) => f.life > 0).slice(-80);
    // its keys, now and then, never in rhythm
    if (live && enc.st !== 'gone' && this.phase !== 'exit') {
      enc.keysT -= dt;
      if (enc.keysT <= 0) { enc.keysT = 2.5 + Math.random() * 4; s && s.keysOdd(0.35); }
    }

    // ---- Boo
    const b = this.booS;
    if (b.on) {
      if (b.mode === 'lead') {
        // ahead of Milo toward the door, never far; he waits for the boy
        b.tx = clamp(Math.max(b.x, m.x + 64), 70, DOOR.in);
        if (b.x > m.x + 110) b.tx = b.x;
        const moving = Math.abs(m.vx) > 6;
        enc.idleT = moving ? 0 : enc.idleT + dt;
        if (enc.idleT > 4 && enc.nagged === 0) { enc.nagged = 1; this.say('boo', 'KID. THIS WAY.', 1.3); this.booA.play('point'); }
        if (enc.idleT > 9 && enc.nagged === 1) { enc.nagged = 2; this.say('boo', 'STAY WITH THE LIGHT.', 1.4); this.control = false; this.walkTo(DOOR.stop - 40, 72, () => { this.control = true; }); }
        if (m.x > DOOR.stop - 60 && enc.t > 1.5) this.finalReach(); // the escape always gets its moment
      }
      const d = b.tx - b.x;
      if (Math.abs(d) > 1) {
        b.x += Math.sign(d) * Math.min(Math.abs(d), b.speed * dt);
        if (b.mode === 'lead' || b.mode === 'out') b.face = Math.sign(d);
        if (this.booA.anim !== 'walk') this.booA.play('walk');
      } else if (b.mode === 'come' || b.mode === 'step' || (b.mode === 'lead' && this.booA.anim === 'walk')) {
        b.x = b.tx;
        const cb = b.arrived; b.arrived = null;
        if (b.mode === 'come') b.mode = 'stand';
        else if (b.mode === 'step') { b.mode = 'stand'; this.booA.play('guard'); }
        else this.booA.play(enc.idleT > 4 ? 'point' : 'idle');
        if (cb) cb();
      }
      if (b.mode === 'out' && b.x > DOOR.x) b.aT = 0;
      b.a = lerp(b.a, b.aT, 1 - Math.exp(-dt * 3));
      this.booA.x = b.x; this.booA.footY = FEET + Math.round(Math.sin(this.t * 2.2) * 1) - 1; // never quite on the floor
      this.booA.setFacing(b.face);
      this.booA.alpha = b.a * 0.95;
      this.booA.lit = clamp(this.lantern * 1.15, 0, 1);
      this.booA.update(dt * 1000);
    }
    if (this.phase === 'exit' && m.x > DOOR.x - 20) this.m.shownFade = true;
  },

  inView(x, y, margin = 30) {
    const c = this.cam;
    return Math.abs(x - c.x) < W / 2 - margin && Math.abs(y - c.y) < H / 2 - margin;
  },

  // slow framing: Milo + what the beat is about. Never lets Milo out; smooths its own target so it can't swing.
  encFrame(dt) {
    const m = this.m, sh = this.sh, b = this.booS, st = this.enc.st;
    const pts = [];
    if (this.phase === 'warning') pts.push(CURT.mid);
    else if (this.phase === 'shadow') {
      if (st === 'figure' || st === 'climb') pts.push(sh.fx, sh.head ? sh.head.x : sh.fx);
      else { if (sh.hand) pts.push(sh.hand.x); pts.push(sh.fx); }
    } else if (this.phase === 'rescue') {
      if (sh.hand && sh.len > 20) pts.push(sh.hand.x);
      if (b.on && b.a > 0.05 || this.lantern > 0.2) pts.push(b.on ? b.x : DOOR.x);
      else pts.push(DOOR.x);
      pts.push(sh.fxd === undefined ? sh.fx : sh.fxd);
    } else if (this.phase === 'escape' || this.phase === 'exit') {
      pts.push(b.x);
      if (this.phase === 'exit' && st === 'lunge' && sh.hand) pts.push(sh.hand.x);
    }
    let lo = m.x, hi = m.x;
    for (const x of pts) {
      const nlo = Math.min(lo, x), nhi = Math.max(hi, x);
      if (nhi - nlo <= 520) { lo = nlo; hi = nhi; }
    }
    const goal = clamp((lo + hi) / 2, m.x - 250, m.x + 250);
    if (this.camF === null) this.camF = this.cam.x;
    this.camF = lerp(this.camF, goal, 1 - Math.exp(-dt * 0.9));
    this.camT = { x: this.camF, y: this.camT.y, z: 1 };
  },

  flakeBurst(at, n) {
    const src = at.length ? at : [];
    if (this.sh.pts) { const p = this.sh.pts.list; for (let i = 0; i < p.length; i += 3) src.push(p[i]); }
    for (let i = 0; i < n; i++) {
      const p = src[Math.floor(Math.random() * src.length)];
      if (!p) break;
      this.sh.flakes.push({ x: p.x + (Math.random() - 0.5) * 10, y: p.y + (Math.random() - 0.5) * 10, vx: (Math.random() - 0.5) * 40, vy: -10 - Math.random() * 40, life: 0.6 + Math.random() * 0.6, s: 1 + Math.floor(Math.random() * 3) });
    }
  },

  // ------------------------------------------------------------ drawing
  // the path its arm takes over the room's surfaces, from the shoulder on the curtain to Milo's feet
  shadowPath() {
    const sh = this.sh, m = this.m, dir = sh.dir;
    const fx = sh.fxd === undefined ? sh.fx : sh.fxd, tx = sh.tx, ty = Math.min(FEET, m.y) - 2;
    const S = { x: fx + dir * 13, y: (sh.sTop || 132) + 8 };
    const pts = [S];
    if (sh.lunge || this.enc.st === 'gone') { // along the floor, under the hem
      pts.push({ x: fx + dir * 30, y: CURT.hem - 6 }, { x: fx + dir * 50, y: 306 }, { x: tx - dir * 8, y: ty });
    } else if (Math.abs(tx - fx) > 130) {
      const over = { x: fx + dir * 34, y: 60 };
      let cx = tx - dir * 64;
      if (dir * (cx - over.x) < 10) cx = over.x + dir * 10;
      pts.push(over, { x: cx, y: 44 }, { x: cx + dir * 4, y: 262 }, { x: tx - dir * 7, y: ty });
    } else {
      const hx = fx + dir * clamp(Math.abs(tx - fx) - 14, 8, 54);
      pts.push({ x: fx + dir * Math.min(40, Math.abs(hx - fx)), y: 214 }, { x: hx, y: CURT.hem - 2 }, { x: tx - dir * 7, y: ty });
    }
    // resample every 5 px with cumulative length
    const list = [];
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.round(L / 5));
      for (let k = 0; k < n; k++) list.push({ x: lerp(a.x, b.x, k / n), y: lerp(a.y, b.y, k / n), s: total + L * k / n });
      total += L;
    }
    list.push({ ...pts[pts.length - 1], s: total });
    return { list, total };
  },

  // where its head, arm and hand are this tick (the simulation's truth; drawing only reads it)
  shadowGeo() {
    const sh = this.sh, dir = sh.dir;
    const ret = ease(sh.retreat);
    const hs = (0.55 + 0.45 * ease(sh.rise)) * (1 - ret * 0.35);
    sh.hs = hs; sh.fxd = sh.fx - dir * ret * 30;
    const Y = (y) => CURT.hem - (CURT.hem - y) * hs;
    const c = ease(sh.climb) * (1 - ret);
    sh.c = c; sh.sTop = Y(132);
    sh.head = { x: sh.fxd + dir * (8 + c * 54), y: lerp(Y(104), 38, c) };
    sh.pts = this.shadowPath();
    sh.seg = null; sh.hand = null;
    if (sh.len < 6) return;
    const seg = [];
    for (const p of sh.pts.list) { if (p.s > sh.len) break; seg.push(p); }
    if (seg.length < 2) return;
    const tip = seg[seg.length - 1], prev = seg[Math.max(0, seg.length - 4)];
    sh.seg = seg; sh.tipAng = Math.atan2(tip.y - prev.y, tip.x - prev.x);
    sh.hand = { x: tip.x + Math.cos(sh.tipAng) * 14, y: Math.min(FEET + 4, tip.y + Math.sin(sh.tipAng) * 14) };
  },

  renderShadow() {
    const g = this.shG, sh = this.sh, t = this.t, hg = this.haloG, fl = this.flG;
    g.clear(); hg.clear(); fl.clear(); this.gripG.clear();
    if (sh.grab && sh.seg) {
      const gg = this.gripG, m = this.m, d = sh.dir, ax = Math.round(m.x) + (this.milo.facing > 0 ? -2 : 2), ay = Math.round(m.y) - 9;
      gg.fillStyle(0x000000, 0.88 * sh.a);
      for (let i = 0; i < 3; i++) {
        const y = ay + i * 3 + Math.round(Math.sin(t * 9 + i) * 0.6);
        const x0 = ax - d * 14, x1 = ax + d * (6 + i * 2);
        this.taper(gg, x0, y + 4, x1, y, 1.6, 0.7);
      }
    }
    // bed 8's lamp
    const b8 = this.b8;
    this.b8L.c.setAlpha(b8 * 0.5); this.b8L.s.setAlpha(b8 * 0.3); this.b8L.f.setAlpha(b8 * 0.32);
    // frost it leaves behind
    sh.frost.forEach((f) => { fl.fillStyle(0xcfe6ff, 0.35 * f.life); fl.fillRect(Math.round(f.x), Math.round(f.y), 1, 1); });
    const on = sh.a > 0.01 || this.dent > 0.02;
    if (!on) { this.shRT.setVisible(false); return; }
    this.shRT.setVisible(true);
    g.fillStyle(0x000000, 1);
    // fingers pressing into the curtain from behind (the warning)
    if (this.dent > 0.02) {
      const dx = this.dentX, k = this.dent;
      this.taper(g, dx + 2, 252, dx, 214, 4, 3.4); // wrist down behind the fabric
      this.hand(g, dx, 206 - k * 6, -Math.PI / 2 + 0.08, 0.95 + k * 0.25, 0.55 - k * 0.4, this.t, false);
    }
    if (sh.a > 0.01) this.drawFigure(g, t);
    this.shRT.clear();
    this.shRT.draw(g);
    // the lantern's light eats into it
    if (this.lantern > 0.3 && this.booS.on) {
      const f = this.booA.flame();
      const r = (1.6 + this.flare * 1.6) * this.lantern;
      this.eraser.setScale(r).setAlpha(0.85);
      this.shRT.erase(this.eraser, f.x, f.y);
    }
    this.shRT.render();
    this.shRT.setAlpha(Math.max(sh.a, this.dent * 0.85) * (sh.burn > 0 && Math.random() < 0.25 ? 0.7 : 1));
    // flakes burning off in the light
    sh.flakes.forEach((f) => { fl.fillStyle(f.life > 0.5 ? 0x050308 : 0x3a1e10, Math.min(1, f.life)); fl.fillRect(Math.round(f.x), Math.round(f.y), f.s, f.s); if (f.life > 0.7) { fl.fillStyle(0xffa040, 0.6 * (f.life - 0.7) / 0.3); fl.fillRect(Math.round(f.x) - 1, Math.round(f.y), 1, 1); } });
  },

  // a tapered limb from (x0,y0) to (x1,y1)
  taper(g, x0, y0, x1, y1, w0, w1) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    g.fillPoints([
      { x: x0 + nx * w0, y: y0 + ny * w0 }, { x: x1 + nx * w1, y: y1 + ny * w1 },
      { x: x1 - nx * w1, y: y1 - ny * w1 }, { x: x0 - nx * w0, y: y0 - ny * w0 },
    ], true);
    g.fillCircle(x1, y1, w1); g.fillCircle(x0, y0, w0);
  },

  // the silhouette on the backlit curtain; its head and neck stretch up onto the wall and bend along the ceiling;
  // one arm runs along the room's surfaces to Milo. Proportions are wrong on purpose: too tall, too thin, long hands.
  drawFigure(g, t) {
    const sh = this.sh, dir = sh.dir;
    const fold = (y) => Math.sin(y * 0.05 + t * 1.2) * 1.6 * (1 - sh.climb * 0.5);
    const ret = ease(sh.retreat), hs = sh.hs;
    const Y = (y) => CURT.hem - (CURT.hem - y) * hs;
    const fx = sh.fxd;
    const X = (x, y) => x + fold(y);
    // legs
    this.taper(g, X(fx - 7, Y(206)), Y(206), X(fx - 9, Y(298)), Y(298), 5, 3);
    this.taper(g, X(fx + 6, Y(206)), Y(206), X(fx + 5, Y(298)), Y(298), 5, 3);
    // torso, hunched toward Milo
    const sTop = sh.sTop;
    g.fillPoints([
      { x: X(fx - 17 + dir * 5, sTop), y: sTop + 2 }, { x: X(fx + 15 + dir * 6, sTop), y: sTop - 1 },
      { x: X(fx + 10, Y(210)), y: Y(210) }, { x: X(fx - 10, Y(210)), y: Y(210) },
    ], true);
    // far arm hanging past the knees, the long hand
    const fsx = fx - dir * 15;
    this.taper(g, X(fsx, sTop + 4), sTop + 4, X(fsx - dir * 6, Y(204)), Y(204), 4.5, 3.2);
    this.taper(g, X(fsx - dir * 6, Y(204)), Y(204), X(fsx - dir * 2, Y(262)), Y(262), 3.2, 2.4);
    this.hand(g, X(fsx - dir * 2, Y(262)), Y(262), Math.PI / 2, 0.85, 0.25 + ret * 0.5, t, false);
    // neck + head: on the curtain, then up over the rail onto the wall, bent along the ceiling, leaning at him
    const c = sh.c, head = sh.head;
    const neckBase = { x: fx + dir * 4, y: sTop };
    const warp = (p) => (p.y < 34 ? { x: p.x + dir * (34 - p.y) * 0.9, y: 34 - (34 - p.y) * 0.35 } : p);
    const neckMid = { x: lerp(neckBase.x, head.x, 0.35) - dir * c * 6, y: lerp(neckBase.y, head.y, 0.5) };
    this.taper(g, neckBase.x, neckBase.y, neckMid.x, neckMid.y, 5, 4.2);
    this.taper(g, neckMid.x, neckMid.y, head.x, head.y + 10, 4.2, 3.6);
    const ang = dir * (0.3 + c * 1.0) + Math.sin(t * 0.9) * 0.05;
    const rx = 11, ry = 17 * (1 + c * 0.7);
    const hp = [];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      // a long skull, the jaw hanging a little open on its far side
      const jaw = Math.sin(a) > 0.6 && Math.cos(a) * dir > 0 ? 1.18 : 1;
      const lx = Math.cos(a) * rx * jaw, ly = Math.sin(a) * ry * jaw;
      hp.push(warp({ x: head.x + lx * Math.cos(ang) - ly * Math.sin(ang), y: head.y + lx * Math.sin(ang) + ly * Math.cos(ang) }));
    }
    g.fillPoints(hp, true);
    // the reaching arm (or the near arm resting on the curtain)
    if (!sh.seg) {
      const nsx = fx + dir * 13;
      this.taper(g, X(nsx, sTop + 4), sTop + 4, X(nsx + dir * 7, Y(206)), Y(206), 4.5, 3.2);
      this.taper(g, X(nsx + dir * 7, Y(206)), Y(206), X(nsx + dir * 3, Y(262)), Y(262), 3.2, 2.4);
      this.hand(g, X(nsx + dir * 3, Y(262)), Y(262), Math.PI / 2, 0.85, sh.curl, t, false);
      return;
    }
    const seg = sh.seg, total = sh.len;
    for (let i = 0; i < seg.length - 1; i++) {
      const k0 = seg[i].s / total, k1 = seg[i + 1].s / total;
      const wob = Math.sin(t * 5 + i * 0.7) * 0.6;
      this.taper(g, seg[i].x, seg[i].y + wob, seg[i + 1].x, seg[i + 1].y + wob, lerp(5.5, 3, k0), lerp(5.5, 3, k1));
    }
    const tip = seg[seg.length - 1];
    this.hand(g, tip.x, tip.y, sh.tipAng, 1.25, sh.curl, t, true);
    // a cold halo along the arm: the light shies away from it (so it reads on the dark wall)
    const hgp = seg.filter((_, i) => i % 2 === 0);
    for (let i = 0; i < hgp.length - 1; i++) {
      this.haloG.lineStyle(16, 0x4a6a9a, 0.07 * sh.a); this.haloG.lineBetween(hgp[i].x, hgp[i].y, hgp[i + 1].x, hgp[i + 1].y);
      this.haloG.lineStyle(9, 0x6a8ac0, 0.08 * sh.a); this.haloG.lineBetween(hgp[i].x, hgp[i].y, hgp[i + 1].x, hgp[i + 1].y);
    }
    if (!sh.grab) { this.haloG.fillStyle(0x6a8ac0, 0.06 * sh.a); this.haloG.fillCircle(sh.hand.x, sh.hand.y, 16); }
  },

  // a long-fingered hand: palm at (x,y) pointing along `ang`; curl 0 = spread and reaching, 1 = a closed claw
  hand(g, x, y, ang, size, curl, t, crawl) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const P = (u, v) => ({ x: x + ca * u - sa * v, y: y + sa * u + ca * v });
    g.fillPoints([P(-3, -5), P(7, -6), P(9, 0), P(7, 6), P(-3, 5)].map((p) => p), true);
    const spread = [-0.5, -0.17, 0.17, 0.48];
    spread.forEach((s0, i) => {
      const walk = crawl ? Math.sin(t * 7 + i * 1.9) * 0.18 : 0;
      const a1 = ang + s0 * (1 - curl * 0.6) + walk * 0.4;
      const L1 = (11 + (i === 1 || i === 2 ? 3 : 0)) * size * (1 + walk * 0.3), L2 = 10 * size;
      const b = P(7, (i - 1.5) * 3.2);
      const k = { x: b.x + Math.cos(a1) * L1, y: b.y + Math.sin(a1) * L1 };
      const a2 = a1 + (s0 >= 0 ? 1 : -1) * curl * 1.9 + (s0 >= 0 ? 0.15 : -0.15);
      const e = { x: k.x + Math.cos(a2) * L2 * (1 - curl * 0.25), y: k.y + Math.sin(a2) * L2 * (1 - curl * 0.25) };
      this.taper(g, b.x, b.y, k.x, k.y, 1.9, 1.5);
      this.taper(g, k.x, k.y, e.x, e.y, 1.5, 0.6);
    });
    const tb = P(1, -5), ta = ang - 1.1 - curl * 0.4;
    this.taper(g, tb.x, tb.y, tb.x + Math.cos(ta) * 9 * size, tb.y + Math.sin(ta) * 9 * size, 1.8, 0.8);
  },

  // Boo's light on the room, on Milo and on Boo
  renderLantern() {
    const b = this.booS, la = this.lantern;
    const f = this.booA.flame();
    const fl = la * (0.92 + Math.sin(this.t * 17) * 0.04 + Math.sin(this.t * 7.3) * 0.04);
    const boost = 1 + this.flare * 1.4;
    const vis = b.on ? b.a : 0;
    this.lanL.g.setPosition(f.x, f.y).setAlpha(Math.min(1, fl * 0.7) * vis).setScale(3 * boost);
    this.lanL.f.setPosition(f.x, f.y).setAlpha(this.flare * 0.35 * vis).setScale(4 + this.flare * 3);
    this.lanL.c.setPosition(f.x, f.y).setAlpha(fl * 0.85 * vis).setScale(1 + this.flare * 0.5);
    this.lanL.p.setPosition(f.x - 6, 312).setAlpha(fl * 0.5 * vis).setScale(3.4 * boost, 3.4);
    this.lanL.s.setPosition(f.x, 300).setAlpha(fl * 0.3 * vis);
    // Milo in the lantern's light
    const ms = this.milo.sprite;
    const d = Math.abs(f.x - this.m.x);
    const w = b.on && this.m.shown ? clamp(1 - d / (220 * boost), 0, 1) * fl * vis : 0;
    this.miloWarm.setTexture(ms.texture.key, ms.frame.name).setPosition(ms.x, ms.y).setOrigin(ms.originX, ms.originY)
      .setFlipX(ms.flipX).setAlpha(w * 0.3 * ms.alpha);
  },
};
