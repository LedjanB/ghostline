// v6: Boo's flights: the chasm and the orb, the hand-made set pieces (setpieces.js), landing, air hits. Mixed into PlayScene via RunnerFeatures.
import { W, FLOOR, PLAYER_X, PX_PER_METER, ZONE_LENGTH_M, zoneAt } from './data.js';
import { Audio } from './audio.js';
import { SET_PIECES } from './setpieces.js';

import { BOTTOM, RUN } from './runner-const.js';

export const FlightFeatures = {
  // ---------------- Boo's flights ----------------
  startFlight(kind) {
    this.flying = true; this.flyKind = kind; this.flights++;
    this.flyT = RUN.ORB_TIME * this.perk.fly + this.perk.flyPlus; this.landingGap = RUN.LAND_GAP; this.airHits = 0;
    this.tracker?.add('flights', 1);
    this.grounded = false; this.slide = 0;
    this.vy = -360;
    this.crFlyT = 0; this.crFlyX = PLAYER_X - this.gapVis;
    this.stretch.anims.stop(); this.stretch.setTexture('stretch_reach');
    // ground traps ahead fade out: the air is the game now
    for (const t of this.traps) {
      if (t.kind === 'chasm') continue;
      const x = this.sx(t.wx);
      if (x > PLAYER_X - 20) { this.burst(x + t.w / 2, FLOOR - 16, 0x9fb8e8, 8, 30, 400); this.dropTrap(t); } // remove the sprites too, or they freeze on screen
    }
    for (const sw of this.swings) if (sw.x > PLAYER_X - 20) { if (sw.hx !== undefined) this.burst(sw.hx, sw.hy, 0x9fb8e8, 8, 30, 400); sw.x = -1e5; }
    this.nextSpawn = this.worldX + this.speed * 0.9;
    this.nextBanshee = 1.6;
    this.setPiece = kind === 'section' ? this.makeSetPiece(this.pieceHere()) : null;
    if (this.setPiece) this.nextSpawn = this.worldX + this.speed * 0.35;
    Audio.sfx('grab'); Audio.thrust(true);
    this.shake(140, 0.006); this.flash(120, 200, 220, 255);
    this.addCombo('power', PLAYER_X + 40, this.py - 40);
    this.flyPop(kind === 'orb' ? 'BOO!' : this.setPiece ? this.setPiece.title : 'HOLD ON!');
    this.quip('grab', true);
  },

  // ---------------- flight set pieces (setpieces.js) ----------------
  // this world's piece; beyond the door, any of them
  pieceHere() {
    if (!this.beyond) return SET_PIECES[zoneAt(this.zoneIndex).id];
    const key = this.chasmKey();
    if (this.beyondPiece?.key !== key) this.beyondPiece = { key, piece: SET_PIECES[this.rand.pick(Object.keys(SET_PIECES))] };
    return this.beyondPiece.piece;
  },
  // 0 in worlds 1 to 4, then up to 1 in world 8 and beyond: the second half of the journey is the hard half
  lateK() { return this.beyond ? 1 : Math.max(0, (this.zoneIndex - 3) / 4); },
  chasmKey() { return this.beyond ? 100 + this.depth : this.zoneIndex; },
  // where this world's chasm opens (m into the world): 220 m, or earlier when the flight is long,
  // so you always land with room to spare before the gate (and before the door at the end of world 8)
  chasmAtM(v = this.speed) {
    const flightM = (v * this.pieceSeconds(this.pieceHere(), v)) / PX_PER_METER;
    return Math.max(120, Math.min(RUN.CHASM_AT_M, ZONE_LENGTH_M - 80 - flightM));
  },
  // seconds of flight a piece needs: its last segment has to reach you and pass
  pieceSeconds(piece, v) {
    if (!piece) return RUN.CHASM_S;
    const n = piece.segs.length;
    if (piece.time) return 0.35 + n * piece.every + 1.0;
    return 0.35 + (n - 1) * piece.every + (W + 60 - PLAYER_X) / v + 0.7;
  },

  stepRunnerFlight(dt) {
    if (!this.flying || this.dead) return;
    this.jumpLatch = false; this.slideLatch = false; // presses in the air don't carry over to the landing
    if (this.py > BOTTOM) { this.py = BOTTOM; if (this.vy > 0) this.vy = 0; }
    // Boo never lets you drop into a chasm
    if (this.pitUnder() && this.py > BOTTOM - 26) { this.py = BOTTOM - 26; if (this.vy > 0) this.vy = 0; this.grounded = false; }
    if (this.flyKind === 'orb') {
      this.flyT -= dt;
      if (this.chasm && this.sx(this.chasm.wx) < PLAYER_X + 30) this.flyKind = 'section';
      else if (this.flyT <= 0 && !this.pitUnder()) this.endFlight();
    } else if (!this.chasm || this.sx(this.chasm.wx + this.chasm.w) < PLAYER_X - 30) {
      this.endFlight();
    }
  },

  endFlight() {
    this.flying = false; this.flyKind = '';
    this.clearAround(W + 400); // the air hazards go away with Boo
    this.gap = this.landingGap; this.gapVis = -30;
    this.crEnter = 0; this.catchUpT = 1.4;
    this.stretch.play('stretch_crawl');
    this.nextTrapX = this.worldX + this.speed * 1.1;
    this.slide = 0; this.buffer = 0;
    if (this.chasm && this.sx(this.chasm.wx + this.chasm.w) < PLAYER_X) this.chasm = null;
    Audio.thrust(false);
    if (this.gap <= RUN.CAUGHT) { this.caught('caught'); return; }
    if (this.airHits === 0) { // a clean flight earns real distance
      this.tracker?.add('cleanLands', 1);
      this.addCombo('power', PLAYER_X + 40, this.py - 40);
      this.popup(this.setPiece ? this.setPiece.done : 'CLEAN LANDING!', '#9fe8ff');
    }
    this.setPiece = null;
    this.flyPop(this.gap - RUN.CAUGHT < 40 ? 'IT\'S RIGHT THERE' : 'IT\'S COMING');
    this.booUntil = this.clock + 1.1; // Boo sets you down and goes
    this.quip('landed');
  },

  airHit(kind) {
    if (this.invuln > 0 || this.dead) return;
    this.buzz(120);
    if (this.shield) { this.stumble(kind); return; } // the shield code path is shared
    this.airHits++;
    this.lastHitKind = 'air:' + kind;
    this.landingGap -= RUN.AIR_HIT;
    this.flyT -= 1;
    this.invuln = 1.0;
    this.breakCombo();
    this.deathCause = kind;
    Audio.sfx('stumble');
    this.shake(160, 0.008); this.hurtEdge();
    this.burst(PLAYER_X, this.py, 0xcfe0ff, 10, 40, 400);
    const left = this.landingGap - RUN.CAUGHT;
    this.popup(left <= 0 ? 'IT WILL CATCH YOU' : left < 40 ? 'CAREFUL!' : 'OUCH!', '#ff8a9a');
  },

  // every hit goes through here (v5 collide in the air, tests, the ground traps)
  runnerHit(kind) {
    if (this.flying) this.airHit(kind); else this.stumble(kind);
  },

  flyPop(str) { this.headline(str, '', 0.9, true); },

  // phase 4: ONE message on screen at a time. The headline (up top) and the popup (by Milo) share
  // one slot: a headline clears the popup and Boo's bubble; a popup waits out a headline unless it
  // is a danger call (prio 2+), which clears the headline. A headline is one short line; what used
  // to be its second line goes to the small corner note (note()).
};
