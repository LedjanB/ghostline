// v6 phase 3: THE STRETCH's twist in each world (docs/design-v6.md, "Each world gives it a small twist").
// Every world has one trick it does now and then: a telegraph you can read, then one clear answer
// (jump or slide). Each trick lives in this.traps as a trap with `box()` (screen px hitbox or null)
// and `need` ('jump' | 'slide'), so collisions, weapons and the bots handle it like any other trap.
// Skills: level-design (teach, then test: the first trick in a world has a long telegraph and a tip),
// game-feel (rumble, shake and a roar on the tell; "IT MISSED" when you beat it).
import { W, H, CEIL, FLOOR, PLAYER_X, PX_PER_METER, ZONE_LENGTH_M, zoneAt } from './data.js';
import { Audio } from './audio.js';

const S = 2.4; // STRETCH_SCALE in runner.js
export const TRICKS = {
  ward: { id: 'reach', name: 'IT REACHES!', tip: 'reach', need: 'slide' },       // a long arm from behind at head height
  morgue: { id: 'drawer', name: 'FROM THE DRAWER!', tip: 'tdrawer', need: 'jump' }, // its arm sweeps out of a low drawer ahead
  woods: { id: 'canopy', name: 'IT CLIMBED THE TREES!', tip: 'canopy', need: 'jump' }, // drops in front of you, crouched, and lunges
  graveyard: { id: 'burrow', name: 'IT BURROWED!', tip: 'burrow', need: 'jump' },  // a mound races up behind you, then it bursts out
  sewer: { id: 'ceiling', name: 'IT\'S ON THE CEILING!', tip: 'ceiling', need: 'slide' }, // crawls over you, drops ahead: slide between its legs
  catacombs: { id: 'skull', name: 'IT THREW ITS HEAD!', tip: 'skull', need: 'read' }, // its face bounces at you from behind
  carnival: { id: 'ride', name: 'IT RIDES THE RAILS!', tip: 'ride', need: 'jump' },   // a coaster cart from behind
};
const ALL = Object.values(TRICKS);
export const TRICK_EVERY = [10, 15];   // seconds of running between tricks
const FIRST_AT_M = 60;                 // meters into a world before its first trick

export const TrickFeatures = {
  tricksInit() {
    this.trick = null;          // the one running now
    this.nextTrickT = 0;        // running seconds until the next one
    this.trickZone = -1;        // the world whose first (teaching) trick is done
    this.tricksBeat = 0;
    this.tricksSeen = new Set();
  },

  // the trick for this world (the Other Side, and beyond the door: any of them, faster)
  trickDef() {
    const id = zoneAt(this.zoneIndex).id;
    if (TRICKS[id]) return { ...TRICKS[id], fast: !!this.beyond };
    return { ...this.rand.pick(ALL), fast: true };
  },

  // called from the ground spawner; returns true when it started a trick (the spawner skips that step)
  stepTricks(dt, meters, toGate) {
    if (this.dead || this.flying || this.chasm || this.gate || this.grab || !this.started || this.finish) return false;
    if (this.trick) return true;
    const zoneM = meters % ZONE_LENGTH_M;
    if (this.safeRun && meters < 300) return false; // first runs: learn the traps first
    const zoneEnd = this.beyond ? Infinity : toGate;
    if (zoneEnd < 70) return false;
    const at = this.chasmAtM();
    const nearChasm = zoneM > at - 80 && zoneM < at + 60 && !this.chasmZones.has(this.chasmKey());
    if (nearChasm) return false;
    if (this.trickZone !== this.zoneIndex) {
      if (zoneM < FIRST_AT_M && !this.beyond) return false;
      this.trickZone = this.zoneIndex;
      this.nextTrickT = 0;
    }
    this.nextTrickT -= dt;
    if (this.nextTrickT > 0) return false;
    // the next ground trap must be far enough off that the trick has the screen to itself
    if (this.traps.some((t) => !t.gone && !t.passed && t.kind !== 'chasm' && this.sx(t.wx) < W + 40 && this.sx(t.wx) > PLAYER_X - 40)) return false;
    const teach = !this.tricksSeen.has(this.trickDef().id) && !this.beyond;
    this.startTrick(teach);
    this.nextTrickT = this.rand.range(TRICK_EVERY[0], TRICK_EVERY[1]) * (1 - 0.35 * this.lateK());
    return true;
  },

  startTrick(teach) {
    const def = this.trickDef();
    this.tricksSeen.add(def.id);
    const tell = (teach ? 1.5 : def.fast ? 0.85 : 1.05); // seconds of warning before it can hurt you
    const v = this.speed;
    const t = { kind: 'trick', trick: def.id, need: def.need, wx: this.worldX, w: 30, hit: false, gone: false, passed: false, t: 0, tell, teach, phase: 'tell' };
    this.trick = t;
    // the spawner waits until it's over
    this.nextTrapX = Math.max(this.nextTrapX, this.worldX + v * (tell + 2.2));
    Audio.sfx('roar'); this.shake(120, 0.004);
    // it needs saying now: if a headline is up, the popup takes it
    if (this.clock < this.headUntil) this.popup(def.name, '#ff8a9a', 120, 3);
    else this.headline(def.name, teach ? this.trickHow(def) : '', teach ? 1.4 : 0.7, true);
    this.tip(def.tip);
    const edge = this.worldX + (W - PLAYER_X); // world x of the right edge of the screen
    switch (def.id) {
      case 'reach': // it rears up behind you, then a long arm shoots past at head height
        t.reach = 0; break;
      case 'drawer': { // a low drawer ahead; its arm sweeps out at ankle height as you get close
        t.wx = edge + 40; t.w = 40; t.arm = 0; t.s = this.add.image(0, FLOOR - 9, 'drawer').setScale(1.8, 1.6).setOrigin(0, 0.5).setDepth(8);
        break;
      }
      case 'canopy': // it climbs out of sight behind, then drops in front of you and crawls at you
        t.dropAt = tell; t.lead = 0; break;
      case 'burrow': // it dives into the ground; a mound comes up behind you; then it bursts out
        t.mx = PLAYER_X - this.gapVis * 0.72 - 20; t.erupt = -1; break;
      case 'ceiling': // it climbs onto the ceiling, crawls over you and drops in front of you, legs wide
        t.cx = PLAYER_X - this.gapVis * 0.72; t.dropped = false; break;
      case 'skull': // it throws its porcelain face; it bounces along the floor from behind
        t.sx = PLAYER_X - this.gapVis * 0.72 - 10; t.sy = FLOOR - 120; t.svx = 0; t.svy = 0; t.thrown = false; t.bounceV = () => skullBounce(t); break;
      case 'ride': // it jumps into a coaster cart behind you and rides the rails past you
        t.cx = -60; t.rolling = false; t.s = this.add.image(-80, FLOOR + 2, 'cart').setScale(2.6, 2).setOrigin(0, 1).setDepth(9.5); break;
    }
    this.traps.push(t);
  },

  trickHow(def) { return def.need === 'slide' ? 'SLIDE!' : def.need === 'jump' ? 'JUMP!' : 'HIGH: SLIDE. LOW: JUMP.'; },

  // screen-space hitbox of a trick right now (null = can't hurt you this step)
  trickBox(t) {
    const x = this.sx(t.wx);
    switch (t.trick) {
      case 'reach': return t.phase === 'strike' && t.reach > 0.3 && t.t < t.tell + 0.38 ? { l: 0, r: PLAYER_X + 40 * t.reach, t: FLOOR - 50, b: FLOOR - 27 } : null;
      case 'drawer': return t.arm > 0.3 ? { l: x - 70 * t.arm, r: x + 10, t: FLOOR - 18, b: FLOOR } : null;
      case 'canopy': return t.phase === 'strike' ? { l: x + 6, r: x + 62, t: FLOOR - 34, b: FLOOR } : null;
      case 'burrow': return t.erupt >= 0 && t.erupt < 0.28 ? { l: t.mx - 16, r: t.mx + 16, t: FLOOR - 44, b: FLOOR } : null;
      case 'ceiling': return t.dropped ? { l: x - 22, r: x + 22, t: FLOOR - 150, b: FLOOR - 25 } : null;
      case 'skull': return t.thrown ? { l: t.sx - 9, r: t.sx + 9, t: t.sy - 9, b: t.sy + 9 } : null;
      case 'ride': return t.rolling ? { l: t.cx + 2, r: t.cx + 50, t: FLOOR - 32, b: FLOOR } : null;
    }
    return null;
  },

  stepTrick(t, dt) {
    t.t += dt;
    // a trick that comes from behind stays with you (its world x only matters once it's on the floor ahead)
    const anchored = t.trick === 'drawer' || (t.trick === 'canopy' && t.phase === 'strike') || (t.trick === 'ceiling' && t.dropped);
    if (!anchored) t.wx = this.worldX;
    const v = this.speed, x = this.sx(t.wx);
    const tell = t.t < t.tell;
    switch (t.trick) {
      case 'reach':
        if (!tell && t.phase === 'tell') { t.phase = 'strike'; Audio.sfx('swoosh'); this.shake(80, 0.004); }
        if (t.phase === 'strike') { t.reach = t.t < t.tell + 0.38 ? Math.min(1, t.reach + dt / 0.12) : Math.max(0, t.reach - dt / 0.2); if (t.t > t.tell + 0.6) this.endTrick(t, true); }
        break;
      case 'drawer':
        if (x - PLAYER_X < 150 + v * 0.1 && t.arm === 0) { t.arm = 0.01; Audio.sfx('swoosh'); }
        if (t.arm > 0) t.arm = Math.min(1, t.arm + dt / 0.2);
        if (x + t.w < PLAYER_X - 60) this.endTrick(t, true);
        break;
      case 'canopy':
        if (!tell && t.phase === 'tell') { // it lands just ahead and crawls at you
          t.phase = 'strike'; t.wx = this.worldX + (W - 120 - PLAYER_X) + 0; t.walk = 140;
          Audio.sfx('bounce'); this.shake(160, 0.007); this.burst(W - 90, FLOOR - 4, 0x6a4a2a, 12, 40, 400);
        }
        if (t.phase === 'strike') { t.wx -= t.walk * dt; if (x + 70 < PLAYER_X - 40) this.endTrick(t, true); }
        break;
      case 'burrow': {
        // the mound closes in from behind; it bursts out when it reaches you
        const target = PLAYER_X;
        if (t.erupt < 0) {
          const speed = t.t < t.tell * 0.5 ? 40 : (target - t.mx) / Math.max(0.05, t.tell - t.t);
          t.mx = Math.min(target, t.mx + speed * dt);
          if (Math.floor(t.t * 10) !== t.tick) { t.tick = Math.floor(t.t * 10); this.burst(t.mx, FLOOR - 2, 0x6a4a2a, 3, 18, 250, 2); }
          if (!tell) { t.erupt = 0; Audio.sfx('hand'); this.shake(140, 0.008); this.burst(t.mx, FLOOR - 6, 0x6a4a2a, 16, 50, 450); }
        } else {
          t.erupt += dt;
          if (t.erupt > 0.8) this.endTrick(t, true);
        }
        break;
      }
      case 'ceiling':
        if (!t.dropped) {
          // up the wall and along the ceiling, past you, to the drop point
          const k = Math.min(1, t.t / t.tell);
          t.cx = Phaser.Math.Linear(PLAYER_X - this.gapVis * 0.72, PLAYER_X + 200, k);
          if (!tell) { t.dropped = true; t.wx = this.worldX + 200; Audio.sfx('bounce'); this.shake(160, 0.007); }
        } else if (x < PLAYER_X - 70) this.endTrick(t, true);
        break;
      case 'skull':
        if (!t.thrown && !tell) { t.thrown = true; t.sx = PLAYER_X - this.gapVis * 0.72; t.sy = FLOOR - 70; t.svx = 300; t.svy = -120; Audio.sfx('swoosh'); }
        if (t.thrown) {
          t.sx += t.svx * dt; t.svy += 1400 * dt; t.sy += t.svy * dt;
          if (t.sy > FLOOR - 9) { t.sy = FLOOR - 9; t.svy = -t.bounceV(); Audio.sfx('bounce'); this.burst(t.sx, FLOOR - 2, 0xece8f2, 4, 16, 200, 2); }
          if (t.sx > W + 30) this.endTrick(t, true);
        }
        break;
      case 'ride':
        if (!t.rolling && !tell) { t.rolling = true; t.cx = -60; Audio.sfx('swoosh'); }
        if (t.rolling) { t.cx += 330 * dt; if (t.cx > W + 20) { this.endTrick(t, true); this.gap = Math.min(this.gap + 16, 140); this.popup('IT CRASHED!', '#ffd0a0'); } }
        break;
    }
  },

  endTrick(t, done) {
    if (t.gone) return;
    const clean = !t.hit && done && !this.dead;
    this.dropTrap(t);
    if (this.trick === t) this.trick = null;
    this.crEnter = Math.min(this.crEnter, 0.25); // it comes back in from the left
    if (clean) {
      this.tricksBeat++; this.tracker?.add('tricks', 1);
      this.addCombo('dodge', PLAYER_X + 40, this.py - 40);
      this.popup('IT MISSED!', '#9fe8ff');
    }
  },

  // a weapon broke the trick (bone behind you, holy water ahead)
  smashTrick(t) {
    this.burst(this.trickCenter(t).x, this.trickCenter(t).y, 0xece8f2, 14, 40, 420);
    this.gap = Math.min(this.gap + 12, 140);
    Audio.sfx('ghoul'); this.shake(120, 0.006);
    this.popup('KNOCKED BACK!', '#ece8f2');
    this.kills++; this.tracker?.add('kills', 1);
    this.addCombo('ghoul', PLAYER_X + 40, this.py - 40);
    t.hit = true; // no "IT MISSED" bonus on top
    this.endTrick(t, false);
  },

  trickCenter(t) {
    const b = this.trickBox(t);
    if (b) return { x: (b.l + b.r) / 2, y: (b.t + b.b) / 2 };
    return { x: this.sx(t.wx), y: FLOOR - 30 };
  },

  // ---------------- drawing ----------------
  // returns true when the trick owns THE STRETCH sprite this frame
  renderTrick(t, x, tg, pg) {
    const s = this.stretch;
    const g = this.trickGfx;
    const back = PLAYER_X - 8 - this.gapVis * 0.72 - 14;
    const tellK = Math.min(1, t.t / t.tell);
    const blink = Math.floor(this.clock * 10) % 2 === 0;
    const arrowL = (y) => { if (!blink) return; g.fillStyle(this.hz.warn, 0.9); g.fillTriangle(6, y, 18, y - 8, 18, y + 8); };
    switch (t.trick) {
      case 'reach': {
        s.setTexture(t.phase === 'tell' ? 'stretch_reach' : 'stretch_grab').setPosition(back, FLOOR + 2).setScale(S, S + 0.15 * tellK).setVisible(true);
        if (t.phase === 'tell') { arrowL(FLOOR - 38); g.fillStyle(this.hz.warn, 0.18 + 0.2 * tellK); g.fillRect(0, FLOOR - 50, PLAYER_X + 40, 23); }
        else { // the arm: long bones at head height
          const tip = PLAYER_X + 40 * t.reach;
          g.lineStyle(7, 0x0b0918, 1); g.lineBetween(back + 10, FLOOR - 70, tip, FLOOR - 38);
          g.lineStyle(4, 0x2c2540, 1); g.lineBetween(back + 10, FLOOR - 70, tip, FLOOR - 38);
          g.fillStyle(0xece8f2, 1); g.fillRect(tip - 2, FLOOR - 44, 12, 3); g.fillRect(tip - 2, FLOOR - 38, 12, 3); g.fillRect(tip + 8, FLOOR - 44, 3, 9);
        }
        return true;
      }
      case 'drawer': {
        t.s.setPosition(x, FLOOR - 9);
        tg.fillStyle(0x07060d, 0.9); tg.fillRect(x - 2, FLOOR - 20, 46, 20);
        tg.fillStyle(0xff5a3a, 0.25 + 0.2 * Math.abs(Math.sin(this.clock * 7))); tg.fillRect(x - 4, FLOOR - 22, 50, 3);
        if (t.arm > 0) { // a pale arm sweeping out along the floor
          const tip = x - 70 * t.arm;
          g.fillStyle(0x0b0918, 1); g.fillRect(tip, FLOOR - 14, x - tip + 4, 9);
          g.fillStyle(0xece8f2, 1); g.fillRect(tip - 8, FLOOR - 16, 10, 3); g.fillRect(tip - 8, FLOOR - 11, 10, 3); g.fillRect(tip - 8, FLOOR - 6, 10, 3);
        }
        return false;
      }
      case 'canopy': {
        if (t.phase === 'tell') { // it climbs up and out of sight; a shadow grows where it will land
          s.setTexture('stretch_reach').setPosition(back + 20 * tellK, FLOOR + 2 - tellK * 260).setScale(S).setVisible(true);
          tg.fillStyle(0x000000, 0.2 + 0.4 * tellK); tg.fillEllipse(W - 90, FLOOR - 1, 30 + 50 * tellK, 6);
          if (blink) { g.fillStyle(this.hz.warn, 0.9); g.fillTriangle(W - 90, FLOOR - 70, W - 98, FLOOR - 84, W - 82, FLOOR - 84); }
        } else {
          if (s.anims.currentAnim?.key !== 'stretch_crawl' || !s.anims.isPlaying) s.play('stretch_crawl');
          s.setFlipX(true).setPosition(x + 34, FLOOR + 2).setScale(S * 0.95).setVisible(true);
          tg.fillStyle(0xff5a3a, 0.28); tg.fillEllipse(x + 34, FLOOR - 1, 80, 7);
        }
        return true;
      }
      case 'burrow': {
        s.setVisible(false);
        // the mound: a hump of dirt with crumbs, racing in under the floor
        const h = t.erupt < 0 ? 8 + 8 * tellK : 0;
        if (h) { // a big hump of light dirt breaking the floor, with its fingers poking through
          g.fillStyle(0x07060d, 1); g.fillEllipse(t.mx, FLOOR + 1, 44, h * 2 + 4);
          g.fillStyle(0x9a6a3a, 1); g.fillEllipse(t.mx, FLOOR + 1, 40, h * 2);
          g.fillStyle(0xc8925a, 1); g.fillEllipse(t.mx - 4, FLOOR - h * 0.5, 18, h * 0.7);
          g.fillStyle(0xece8f2, 1); for (const k of [-8, 0, 8]) g.fillRect(t.mx + k - 1, FLOOR - h - 3 + Math.sin(this.clock * 30 + k) * 2, 3, 5);
          if (Math.floor(t.t * 12) !== t.dust) { t.dust = Math.floor(t.t * 12); this.burst(t.mx, FLOOR - 4, 0x9a6a3a, 2, 30, 260, 2); }
        }
        if (t.erupt < 0) { arrowL(FLOOR - 16); g.fillStyle(this.hz.warn, 0.2 + 0.3 * tellK); g.fillRect(t.mx - 16, FLOOR - 44, 32, 44 - h); }
        else { // its arms burst up out of the ground
          const k = Math.min(1, t.erupt / 0.08) * (t.erupt > 0.28 ? Math.max(0, 1 - (t.erupt - 0.28) / 0.3) : 1);
          g.fillStyle(0x0b0918, 1); g.fillRect(t.mx - 12, FLOOR - 48 * k, 7, 48 * k); g.fillRect(t.mx + 5, FLOOR - 42 * k, 7, 42 * k);
          g.fillStyle(0xece8f2, 1); g.fillRect(t.mx - 14, FLOOR - 48 * k - 3, 11, 3); g.fillRect(t.mx + 3, FLOOR - 42 * k - 3, 11, 3);
        }
        return true;
      }
      case 'ceiling': {
        if (!t.dropped) { // upside down, crawling along the ceiling over your head
          if (s.anims.currentAnim?.key !== 'stretch_crawl' || !s.anims.isPlaying) s.play('stretch_crawl');
          s.setFlipY(true).setFlipX(false).setOrigin(0.5, 0).setPosition(t.cx, CEIL - 2).setScale(S * 0.9).setVisible(true);
          tg.fillStyle(0x000000, 0.18 + 0.3 * tellK); tg.fillEllipse(PLAYER_X + 200, FLOOR - 1, 30 + 40 * tellK, 6);
          if (blink && tellK > 0.4) { g.fillStyle(this.hz.warn, 0.9); g.fillTriangle(PLAYER_X + 200, FLOOR - 60, PLAYER_X + 192, FLOOR - 74, PLAYER_X + 208, FLOOR - 74); }
        } else { // standing over the floor, legs wide: the gap between them is the way through
          s.setFlipY(false).setOrigin(0.5, 1).setTexture('stretch_grab').setPosition(x, FLOOR - 24).setScale(S * 1.3, S * 1.15).setVisible(true);
          g.lineStyle(6, 0x0b0918, 1); g.lineBetween(x - 6, FLOOR - 30, x - 34, FLOOR); g.lineBetween(x + 6, FLOOR - 30, x + 34, FLOOR);
          g.lineStyle(3, 0x2c2540, 1); g.lineBetween(x - 6, FLOOR - 30, x - 34, FLOOR); g.lineBetween(x + 6, FLOOR - 30, x + 34, FLOOR);
          pg.fillStyle(this.hz.core, 0.35 + Math.sin(this.clock * 8) * 0.2); for (let k = -1; k <= 1; k++) pg.fillRect(x + k * 10 - 3, FLOOR + 3, 6, 2);
        }
        return true;
      }
      case 'skull': {
        s.setTexture(t.thrown ? 'stretch_grab' : 'stretch_reach').setPosition(back, FLOOR + 2).setScale(S).setVisible(true);
        const fx = t.thrown ? t.sx : back + 4, fy = t.thrown ? t.sy : FLOOR - 92 + Math.sin(this.clock * 20) * 2;
        if (!t.thrown) arrowL(FLOOR - 50);
        // its face: porcelain white, a wide grin
        g.fillStyle(0x0b0918, 1); g.fillCircle(fx, fy, 10);
        g.fillStyle(0xece8f2, 1); g.fillCircle(fx, fy, 8.5);
        g.fillStyle(0x0b0918, 1); g.fillRect(fx - 5, fy - 3, 3, 3); g.fillRect(fx + 2, fy - 3, 3, 3); g.fillRect(fx - 5, fy + 2, 10, 2);
        if (t.thrown) { tg.fillStyle(0x000000, 0.3); tg.fillEllipse(fx, FLOOR - 1, 14, 4); }
        return true;
      }
      case 'ride': {
        // the rails, then the cart with its long arms and grin peeking over the edge
        tg.fillStyle(0x8a8aa0, 0.8); tg.fillRect(0, FLOOR - 3, W, 2);
        if (!t.rolling) {
          s.setTexture('stretch_reach').setPosition(back, FLOOR + 2 - 30 * tellK).setScale(S).setVisible(true);
          arrowL(FLOOR - 20);
          t.s.setPosition(back - 20, FLOOR + 2);
        } else {
          s.setVisible(false);
          t.s.setPosition(t.cx, FLOOR + 2 + (Math.floor(this.clock * 20) % 2));
          g.fillStyle(0xece8f2, 1); g.fillCircle(t.cx + 30, FLOOR - 30, 7);
          g.fillStyle(0x0b0918, 1); g.fillRect(t.cx + 26, FLOOR - 32, 2, 2); g.fillRect(t.cx + 32, FLOOR - 32, 2, 2); g.fillRect(t.cx + 26, FLOOR - 28, 8, 1);
          g.fillStyle(0xff5a3a, 0.28); g.fillEllipse(t.cx + 26, FLOOR - 1, 60, 7);
        }
        return true;
      }
    }
    return false;
  },

  resetStretchSprite() {
    const s = this.stretch;
    if (s.flipX || s.flipY || s.originY !== 1) s.setFlipX(false).setFlipY(false).setOrigin(0.5, 1);
  },
};

// the skull's bounce: high and low bounces alternate, so you read each one
export function skullBounce(t) {
  t.bounces = (t.bounces || 0) + 1;
  return t.bounces % 2 ? 560 : 380;
}
