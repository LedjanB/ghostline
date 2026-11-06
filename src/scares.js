// v6 phase 4: one real scare per world (docs/design-v6.md, "Phase 4"). Testers asked for more actual
// fright. A scare is a set beat, never a hazard: it waits for a clear screen, nothing spawns while it
// runs, and it can't hurt you. Shape (audio-design + game-feel): a hush (the music drops away), a
// held breath, then the hit (a sting, a small shake, something you didn't expect), then a release.
// Each world's scare is its own idea, built from that world's things.
import { W, H, CEIL, FLOOR, PLAYER_X, ZONE_LENGTH_M, zoneAt } from './data.js';
import { Audio } from './audio.js';

// when in a world the scare can come (meters into it): after the first trick, before the chasm runway
const WINDOW_M = [105, 185];
export const SCARE_IDS = ['ward', 'morgue', 'woods', 'graveyard', 'sewer', 'catacombs', 'carnival', 'otherside'];
// name (for the results/tests), hush (s before the hit), length (s)
export const SCARES = {
  ward: { name: 'LIGHTS OUT', hush: 1.0, len: 2.6 },      // every light dies; when one flickers back, its face fills the window
  morgue: { name: 'SIT UP', hush: 1.1, len: 2.4 },        // a sheet on a slab in the back sits bolt upright, two red eyes under it
  woods: { name: 'EYES', hush: 1.0, len: 2.6 },           // the woods go black, then a hundred eyes open at once and follow you
  graveyard: { name: 'THE ANKLE', hush: 0.9, len: 2.0 },  // a huge hand bursts up right behind your heels and closes on air
  sewer: { name: 'THE OTHER ONE', hush: 1.1, len: 2.6 },  // a second grin opens in the dark AHEAD of you, then it's gone
  catacombs: { name: 'THEY TURN', hush: 1.0, len: 2.4 },  // every skull in the wall lights up and turns to look at you
  carnival: { name: 'JACK', hush: 1.2, len: 2.0 },        // a giant jack-in-the-box bursts up in the back: HONK
  otherside: { name: "DON'T TURN AROUND", hush: 1.4, len: 2.4 }, // Boo whispers; then its face, full screen, for a blink
};

export const ScareFeatures = {
  scaresInit() {
    this.scare = null; this.scareHold = false;
    this.scareZones = new Set(); // one per world per run
    this.scaresDone = 0;
  },

  scaresCreate() {
    this.scareBack = this.add.graphics().setDepth(4.47);   // over the backgrounds and their darkness, under every hazard
    this.scareDim = this.add.graphics().setDepth(8.9);     // the room going dark (Milo and THE STRETCH stay lit)
    this.scareFront = this.add.graphics().setDepth(9.2);   // things by Milo that never touch him
    this.scareTop = this.add.graphics().setDepth(26);      // the full-screen blink
    this.scareFace = this.add.image(W / 2, H / 2, 'stretch_face').setDepth(4.475).setVisible(false);
    this.scareHand = this.add.image(0, 0, 'grave_hand_open').setOrigin(0.5, 1).setScale(4.5).setDepth(10.5).setVisible(false);
    this.events.once('shutdown', () => { this.scareFace.destroy(); this.scareHand.destroy(); });
  },

  // returns true while a scare runs (tricks and the spawner wait)
  stepScares(dt, meters) {
    if (this.scare) {
      const s = this.scare;
      s.t += dt;
      if (this.dead || this.flying) { this.endScare(); return false; }
      if (!s.hit && s.t >= s.def.hush) { s.hit = true; this.scareHit(s); }
      if (s.t >= s.def.len) this.endScare();
      return !!this.scare;
    }
    if (this.dead || this.flying || this.chasm || this.gate || this.grab || this.trick || !this.started || this.finish || this.creative) return false;
    if (this.beyond || this.endlessMode) return false;
    const id = zoneAt(this.zoneIndex).id;
    if (!SCARES[id] || this.scareZones.has(this.zoneIndex)) return false;
    const zoneM = meters % ZONE_LENGTH_M;
    this.scareHold = false;
    if (zoneM < WINDOW_M[0] || zoneM > WINDOW_M[1]) return false;
    // a scare needs the screen to itself: the spawner holds off until the screen is clear,
    // and it never lands while one more stumble would get you
    this.scareHold = true;
    if (this.lastStrike !== null && this.lastStrike !== undefined) return true;
    if (this.traps.some((t) => !t.gone && !t.passed && t.kind !== 'chasm' && this.sx(t.wx) < W + 60 && this.sx(t.wx) > PLAYER_X - 60)) return true;
    this.scareHold = false;
    this.startScare(id);
    return true;
  },

  startScare(id) {
    const def = SCARES[id];
    this.scareZones.add(this.zoneIndex);
    this.scare = { id, def, t: 0, hit: false, seed: 97 + this.zoneIndex * 131 }; // not from this.rand: a scare never changes the run's layout
    // nothing comes at you until it's over, and a clear stretch after it
    this.nextTrapX = Math.max(this.nextTrapX, this.worldX + this.speed * (def.len + 0.9));
    this.nextTrickT = Math.max(this.nextTrickT || 0, 3);
    Audio.hush(def.hush + 0.15);
    this.clearHeadline(); this.clearMessages(); this.quietUntil = this.clock + def.len; // nothing talks over a scare
    if (id === 'ward') Audio.sfx('powerdown');
    if (id === 'morgue' || id === 'catacombs') Audio.sfx('creak');
    if (id === 'otherside') this.time.delayedCall(250, () => { if (this.scare?.id === 'otherside' && !this.scare.hit) { Audio.sfx('whisper'); this.scareWhisper(); } });
    this.tracker?.add('scares', 1);
  },

  scareWhisper() {
    // Boo, very quietly (his bubble is the one message up)
    if (this.bubble) this.bubble.forEach((o) => o.destroy());
    this.quietUntil = 0; this.quipCooldown = 0;
    this.quip('whisper', true);
    this.quietUntil = this.clock + 9;
  },

  scareHit(s) {
    this.clearMessages(); // the hit has the screen to itself (Boo's whisper too)
    Audio.sfx(s.id === 'carnival' ? 'honk' : 'sting');
    if (s.id === 'carnival') this.time.delayedCall(90, () => Audio.sfx('sting'));
    this.shake(s.id === 'otherside' || s.id === 'graveyard' ? 260 : 180, s.id === 'otherside' ? 0.012 : 0.007);
    this.buzz(90);
    if (s.id === 'graveyard') this.burst(PLAYER_X - 24, FLOOR - 4, 0x6a5a40, 14, 40, 420);
  },

  endScare() {
    const s = this.scare;
    this.scare = null;
    [this.scareBack, this.scareDim, this.scareFront, this.scareTop].forEach((g) => g.clear());
    this.scareFace.setVisible(false);
    if (!s) return;
    // a breath after it: THE STRETCH doesn't pounce the moment a scare ends
    if (!this.beyond) this.trickZone = this.zoneIndex;
    this.nextTrickT = Math.max(this.nextTrickT || 0, 2.5);
    this.scaresDone++;
    this.quietUntil = 0; this.quipCooldown = 0;
    if (!this.dead && s.hit) this.quip('scared', true);
  },

  // ---------------- drawing ----------------
  renderScare() {
    const s = this.scare;
    const B = this.scareBack, D = this.scareDim, F = this.scareFront, T = this.scareTop;
    B.clear(); D.clear(); F.clear(); T.clear();
    this.scareFace.setVisible(false); this.scareHand.setVisible(false);
    if (!s) return;
    const t = s.t, h = s.def.hush, k = t - h; // k < 0: the hush; k >= 0: after the hit
    const out = Math.max(0, Math.min(1, (s.def.len - t) / 0.5)); // fade at the end
    const ease = (v) => Math.max(0, Math.min(1, v));
    const flick = this.settings.flicker;
    switch (s.id) {
      case 'ward': {
        // every light dies (the room goes black, only Milo and IT stay), then one flickers back on:
        // its face is pressed against the far window, huge. Then the lights hold, and it's gone.
        let dark = ease(t / 0.35);
        if (k >= 0 && k < 0.7) dark = flick ? (Math.floor(k * 14) % 3 === 0 ? 0.15 : 0.9) : 0.35;
        if (k >= 0.7) dark = ease(1 - (k - 0.7) / 0.5) * 0.9;
        D.fillStyle(0x020205, dark * 0.92 * out); D.fillRect(0, CEIL, W, FLOOR - CEIL);
        if (k >= 0 && k < 0.85) {
          const lit = flick ? Math.floor(k * 14) % 3 === 0 : true;
          this.scareFace.setTexture('stretch_face').setScale(9).setPosition(W * 0.66, CEIL + 128).setAlpha(lit ? 1 : 0.35).setVisible(true).setDepth(8.95);
          B.fillStyle(0x1a2a3a, 0.6); B.fillRect(W * 0.66 - 150, CEIL + 10, 300, 230); // the window it's behind
        }
        break;
      }
      case 'morgue': {
        // a slab in the back with a sheet over a body; at the hit, it sits bolt upright
        const x = W * 0.68 - Math.max(0, t) * 30, y = FLOOR - 70;
        const up = k < 0 ? 0 : ease(k / 0.09);
        B.fillStyle(0x020205, 0.75 * out); B.fillRect(0, CEIL, W, FLOOR - CEIL);
        B.fillStyle(0x6a7a88, out); B.fillRect(x - 70, y + 18, 140, 8); B.fillRect(x - 64, y + 26, 6, 40); B.fillRect(x + 58, y + 26, 6, 40); // the slab
        B.fillStyle(0xdfe6ea, out);
        B.fillRect(x - 64, y + 6, 128, 13);                       // the sheet, lying flat
        if (up > 0) {
          B.fillRect(x - 64, y + 6 - 120 * up, 46, 126 * up);        // sitting bolt upright (sheet over the head), taller than Milo
          B.fillCircle(x - 41, y + 4 - 124 * up, 26 * up);
          if (up >= 1) { B.fillStyle(0xff3a4a, 1); B.fillRect(x - 54, y - 126, 7, 6); B.fillRect(x - 36, y - 126, 7, 6); }
        } else {
          B.fillCircle(x - 50, y + 6, 9);                          // the head, under the sheet
        }
        break;
      }
      case 'woods': {
        // the woods go black, then a hundred eyes open at once, all turned to you; they blink out in a wave
        const dark = ease(t / 0.5) * out;
        B.fillStyle(0x020205, 0.85 * dark); B.fillRect(0, CEIL, W, FLOOR - CEIL);
        if (k >= 0) {
          let a = s.seed;
          const rnd = () => { a = (a * 9301 + 49297) % 233280; return a / 233280; };
          for (let i = 0; i < 70; i++) {
            const ex = rnd() * W, ey = CEIL + 10 + rnd() * (FLOOR - CEIL - 60), gone = k > 1.0 + (ex / W) * 0.6;
            if (gone) continue;
            const look = ex > PLAYER_X ? -1 : 1, open = ease(k / 0.06);
            B.fillStyle(rnd() < 0.2 ? 0xff3a4a : 0xfff2b0, 0.95);
            B.fillRect(ex, ey, 4, 3 * open); B.fillRect(ex + 9, ey, 4, 3 * open);
            B.fillStyle(0x020205, 1); B.fillRect(ex + 1 + look, ey, 2, 2 * open); B.fillRect(ex + 10 + look, ey, 2, 2 * open);
          }
        }
        break;
      }
      case 'graveyard': {
        // dirt shivers behind your heels; then a huge hand bursts up, grabs at your ankle, closes on air
        const hx = PLAYER_X - 46; // right behind his heels, never over him
        D.fillStyle(0x07060d, 0.35 * ease(t / 0.6) * out); D.fillRect(0, CEIL, W, FLOOR - CEIL);
        if (k < 0) { F.fillStyle(0x4a3a2a, 1); for (let i = 0; i < 5; i++) F.fillRect(hx - 12 + i * 6 + Math.sin(t * 40 + i) * 2, FLOOR - 3 - (i % 2) * 2, 4, 3); break; }
        const rise = ease(k / 0.1), sink = ease((k - 0.9) / 0.5);
        // pixel art, 4.5x: ~90 px, twice Milo. It rises out of the floor (the floor band covers what's below)
        this.scareHand.setTexture(k < 0.3 ? 'grave_hand_open' : 'grave_hand_shut')
          .setPosition(hx + (k < 0.3 ? 0 : 3), FLOOR + 22 * 4.5 * (1 - rise + sink) - 8).setAlpha(out).setVisible(true);
        F.fillStyle(0x4a3a2a, out); F.fillRect(hx - 34, FLOOR - 5, 68, 5);          // the broken ground
        break;
      }
      case 'sewer': {
        // the far end goes dark... and a second grin opens there, AHEAD of you, red eyes. A blink, and it's gone.
        const dark = ease(t / 0.6) * out;
        for (let i = 0; i < 8; i++) { B.fillStyle(0x020205, 0.75 * dark * (i / 8)); B.fillRect(W - 280 + i * 35, CEIL, 36, FLOOR - CEIL); }
        if (k >= 0 && k < 0.95) {
          const gx = W - 120, gy = FLOOR - 120 - Math.sin(k * 3) * 6, open = ease(k / 0.08), shut = ease((k - 0.75) / 0.2);
          B.fillStyle(0xff3a4a, 1 - shut); B.fillRect(gx - 22, gy - 26, 8, 5); B.fillRect(gx + 14, gy - 26, 8, 5);
          B.fillStyle(0xece8f2, (1 - shut) * open);
          B.fillRect(gx - 40, gy, 80, 4); B.fillRect(gx - 34, gy + 10, 68, 3);
          B.fillStyle(0x020205, 1);
          for (let i = 0; i < 10; i++) B.fillRect(gx - 38 + i * 8, gy + 1, 2, 3);
        }
        break;
      }
      case 'catacombs': {
        // the wall behind you is skulls. At the hit, every socket lights red, all at once, and they turn to you
        const x0 = -((this.worldX * 0.3) % 34);
        B.fillStyle(0x07060d, 0.4 * ease(t / 0.6) * out); B.fillRect(0, CEIL, W, FLOOR - CEIL);
        for (let r = 0; r < 3; r++) for (let c = 0; c < 21; c++) {
          const x = x0 + c * 34 + (r % 2) * 17, y = CEIL + 70 + r * 34;
          B.fillStyle(0xd8d0bc, 0.55 * out); B.fillCircle(x, y, 11); B.fillRect(x - 6, y + 6, 12, 8);
          const lit = k >= 0 && k < 1.3;
          const look = Math.sign(PLAYER_X - x) * (lit ? 2 : 0), dn = lit ? 1 : 0;
          B.fillStyle(lit ? 0xff3a4a : 0x07060d, lit ? 1 : 0.8 * out);
          B.fillRect(x - 6 + look, y - 3 + dn, 4, 4); B.fillRect(x + 2 + look, y - 3 + dn, 4, 4);
        }
        break;
      }
      case 'carnival': {
        // a box in the back shakes to its tune (the hush), then a giant clown head on a spring: HONK
        const bx = W * 0.62 - t * 25, by = FLOOR - 40;
        B.fillStyle(0x07060d, 0.3 * out); B.fillRect(0, CEIL, W, FLOOR - CEIL);
        const wob = k < 0 ? Math.sin(t * 30) * (t / h) * 3 : 0;
        B.fillStyle(0xc0303a, out); B.fillRect(bx - 36 + wob, by - 10, 72, 50);
        B.fillStyle(0xffd75e, out); B.fillRect(bx - 36 + wob, by - 10, 72, 6); B.fillRect(bx - 4 + wob, by + 6, 8, 8);
        if (k >= 0) {
          const pop = ease(k / 0.1), bob = Math.sin(k * 18) * 10 * (1 - ease(k / 1.2));
          const hy = by - 20 - 150 * pop + bob;
          B.lineStyle(4, 0x8a8aa0, out);
          for (let i = 0; i < 6; i++) B.lineBetween(bx - 10, by - 10 + (hy - by + 10) * (i / 6), bx + 10, by - 10 + (hy - by + 10) * ((i + 0.5) / 6));
          B.fillStyle(0xf4f0f4, out); B.fillCircle(bx, hy, 54 * pop);                       // the face
          B.fillStyle(0xff4d8a, out); B.fillCircle(bx - 56 * pop, hy - 20, 20 * pop); B.fillCircle(bx + 56 * pop, hy - 20, 20 * pop); // hair
          B.fillStyle(0xe0303a, out); B.fillCircle(bx, hy + 6, 9 * pop);                    // the nose
          B.fillStyle(0x07060d, out); B.fillRect(bx - 24, hy - 22, 12, 10); B.fillRect(bx + 12, hy - 22, 12, 10); // eyes
          B.fillStyle(0xff3a4a, out); B.fillRect(bx - 20, hy - 19, 4, 4); B.fillRect(bx + 16, hy - 19, 4, 4);
          B.fillStyle(0xc0303a, out); B.fillRect(bx - 34, hy + 20, 68, 12);                 // the grin
          B.fillStyle(0xffffff, out); for (let i = 0; i < 8; i++) B.fillRect(bx - 32 + i * 8, hy + 20, 5, 5);
        }
        break;
      }
      case 'otherside': {
        // everything goes quiet and dim while Boo whispers; then its face, the whole screen, for a blink
        D.fillStyle(0x020205, 0.55 * ease(t / 0.8) * out); D.fillRect(0, CEIL, W, FLOOR - CEIL);
        if (k >= 0 && k < 0.22) {
          T.fillStyle(0x020205, 1); T.fillRect(0, 0, W, H);
          this.scareFace.setTexture('stretch_face').setScale(15).setPosition(W / 2, H / 2 + 40 - k * 40).setAlpha(1).setDepth(26.5).setVisible(true);
        }
        break;
      }
    }
  },
};
