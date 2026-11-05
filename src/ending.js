// v6 phase 3: the door at the end of world 8, the ending, and endless mode (docs/design-v6.md,
// "The ending is hard to reach"). The door on the Other Side only opens when you own every journal
// page (the whole unlock track) AND a run gets you to it. Without every page it stays shut: Boo
// pulls you back and the results tell you how many pages are missing. After the ending the door
// is open in every run, and beyond it the Other Side never ends (endless mode, also a menu mode
// that starts right at the door).
import { W, H, CEIL, FLOOR, PLAYER_X, PX_PER_METER, ZONE_LENGTH_M, ZONES } from './data.js';
import { Audio } from './audio.js';
import { Save } from './save.js';
import { text } from './ui.js';
import { owned, PAGES } from './unlocks.js';

export const DOOR_M = ZONES.length * ZONE_LENGTH_M; // 3200
export const DEPTH_M = ZONE_LENGTH_M;              // beyond the door: a new depth every 400 m
const ENDING_LINES = [
  ['THE DOOR KNEW YOUR NAME.', 3.4],
  ['BOO HELD ON. SO DID YOU.', 5.6],
  ['AND THE LIGHTS CAME BACK ON.', 7.8],
];

export function pagesOwned(save = Save.get()) { return owned(save.unlocks.got).pages.length; }
export function doorOpens(save = Save.get()) { return save.ending.seen || pagesOwned(save) >= PAGES.length; }

export const EndingFeatures = {
  endingInit(save) {
    this.finish = null;
    this.doorWX = DOOR_M * PX_PER_METER;
    this.doorOpen = save.ending.seen; // after the ending you just run through
    this.beyond = false; this.depth = 0;
    this.pagesHave = pagesOwned(save);
    this.startX = 0; this.endlessMode = false;
    if (save.mode === 'endless' && save.ending.seen) { // endless: start just past the door
      this.endlessMode = true;
      this.worldX = this.doorWX + 260; this.startX = this.worldX;
      this.zoneIndex = ZONES.length - 1;
      this.nextSpawn = this.worldX + 520;
      this.bestPx = 0;
      this.beyond = true;
      this.beyondFromX = this.doorWX;
    }
  },

  endingCreate() {
    this.doorGfx = this.add.graphics().setDepth(8.1);
    this.doorLight = this.add.graphics().setDepth(20.5);
    this.finishDim = this.add.graphics().setDepth(26);
  },

  // the door comes into view at the end of world 8
  stepDoor() {
    if (this.creative || this.dead || this.finish) return;
    if (this.beyond) {
      const d = Math.floor((this.worldX - this.beyondFromX) / PX_PER_METER / DEPTH_M);
      if (d > this.depth) { this.depth = d; this.headline(`DEPTH ${d + 1}`, 'IT KEEPS GOING. SO DO YOU.'); this.addCombo('gate', PLAYER_X + 40, H / 2); Audio.sfx('zone'); }
      return;
    }
    const x = this.sx(this.doorWX);
    if (x > PLAYER_X + 40 + this.speed / 4 + 20 || this.flying) return; // you skid to a stop right in front of it (the flight always lands first)
    if (this.doorOpen) { // through it: beyond the door
      this.beyond = true; this.beyondFromX = this.doorWX;
      this.headline('BEYOND THE DOOR', 'IT NEVER ENDS. NEITHER DO YOU.', 2.4);
      this.addCombo('gate', PLAYER_X + 40, H / 2); Audio.sfx('zone');
      this.tracker?.add('doors', 1);
      return;
    }
    // first time with every page: the ending. Otherwise the door stays shut.
    this.startFinish(doorOpens() ? 'ending' : 'locked');
  },

  startFinish(kind) {
    this.finish = { kind, t: 0, said: 0, x0: this.worldX };
    this.dead = true; // stops spawns, collisions and the chaser; stepDeath hands over to stepFinish
    this.lastHitKind = kind === 'ending' ? 'ending' : 'door';
    this.heads = [];
    this.resetCombo();
    this.deathM = Math.floor(this.worldX / PX_PER_METER);
    this.tracker?.add('doors', 1);
    this.clearAround(W + 300);
    for (const t of this.traps) if (t.kind !== 'chasm') this.dropTrap(t);
    this.traps = this.traps.filter((t) => !t.gone); this.trick = null;
    if (this.weapon) { this.weapon = null; this.events.emit('power', null); }
    Audio.thrust(false);
    if (kind === 'ending') { Audio.sfx('rebirth'); Audio.music('otherside'); }
    else { Audio.sfx('stumble'); this.shake(200, 0.008); }
  },

  // the run stops at the door; then either the light, or Boo pulling you away
  stepFinish(dt) {
    const f = this.finish;
    f.t += dt;
    this.speed *= Math.exp(-4 * dt); if (this.speed < 10) this.speed = 0;
    this.gap = Math.max(RUN_CAUGHT + 30, this.gap - 20 * dt); this.gapVis += (this.gap - this.gapVis) * Math.min(1, dt * 4);
    if (f.kind === 'locked') {
      if (f.t > 0.6 && f.said === 0) { f.said = 1; this.say("THE DOOR WON'T OPEN.", 120, '#ff8a9a'); this.shake(160, 0.006); Audio.sfx('bounce'); }
      if (f.t > 1.8 && f.said === 1) { f.said = 2; this.say(`IT NEEDS EVERY JOURNAL PAGE: ${this.pagesHave}/${PAGES.length}`, 150, '#cfe0ff', 8); }
      if (f.t > 3.0 && f.said === 2) { f.said = 3; this.say('BOO PULLS YOU BACK. FIND THE REST.', 172, '#a99fd0', 8); Audio.sfx('grab'); }
      if (f.t > 4.6 && !this.ended) { this.ended = true; this.time.delayedCall(200, () => this.afterDeath()); }
    } else {
      for (let i = 0; i < ENDING_LINES.length; i++) if (f.said === i && f.t > ENDING_LINES[i][1]) { f.said++; this.say(ENDING_LINES[i][0], 140 + i * 26, '#2a1f4a', i === 2 ? 16 : 8, true, '#fff6d8'); }
      if (f.t > 10.2 && f.said === ENDING_LINES.length) { f.said++; this.say('THE END', H / 2 + 10, '#2a1f4a', 24, true, '#fff6d8'); Audio.sfx('zone'); }
      if (f.t > 11.4 && f.said === ENDING_LINES.length + 1) { f.said++; this.say('(PROBABLY.)', H / 2 + 44, '#6a5a8a', 8, true, '#fff6d8'); }
      if (f.t > 13.4 && !this.ended) {
        this.ended = true;
        Save.update((s) => { s.ending.seen = true; s.ending.runs = s.runs + 1; });
        this.time.delayedCall(300, () => this.afterDeath());
      }
    }
  },

  say(str, y, color, size = 8, over = false, stroke = '#07060d') {
    const t = text(this, W / 2, y, str, size, color).setDepth(over ? 27 : 31).setStroke(stroke, size > 8 ? 6 : 3).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 500 });
    return t;
  },

  // ---------------- drawing ----------------
  renderDoor(lead) {
    const g = this.doorGfx, L = this.doorLight;
    g.clear(); L.clear();
    if (this.creative) return;
    const x = Math.round(this.sx(this.doorWX) - lead);
    if (x < -120 || x > W + 120) { if (!this.finish) return; }
    const f = this.finish;
    const open = this.doorOpen || (f && f.kind === 'ending');
    const k = f && f.kind === 'ending' ? Math.min(1, f.t / 2.2) : this.doorOpen ? 1 : 0; // how far it has opened
    const top = CEIL + 30, w = 74;
    // the frame: tall, old, too tall for any house
    g.fillStyle(0x0b0918, 1); g.fillRect(x - w / 2 - 10, top - 10, w + 20, FLOOR - top + 10);
    g.fillStyle(0x2c2540, 1); g.fillRect(x - w / 2 - 6, top - 6, w + 12, FLOOR - top + 6);
    g.fillStyle(0x463c63, 1); g.fillRect(x - w / 2 - 6, top - 6, w + 12, 4);
    // the doorway: dark when shut, light pouring out as it opens
    g.fillStyle(0x07060d, 1); g.fillRect(x - w / 2, top, w, FLOOR - top);
    if (open) {
      L.fillStyle(0xfff2b0, 0.9 * k); L.fillRect(x - w / 2 + (w / 2) * (1 - k), top, w * k, FLOOR - top);
      for (let i = 1; i <= 6; i++) { L.fillStyle(0xfff2b0, 0.08 * k * (1 - i / 7)); L.fillRect(x - w / 2 - i * 18, top - i * 4, w + i * 36, FLOOR - top + i * 4); }
    } else {
      // two door leaves, chains across, light leaking from the cracks
      g.fillStyle(0x1d1a2c, 1); g.fillRect(x - w / 2 + 2, top + 2, w / 2 - 3, FLOOR - top - 2); g.fillRect(x + 1, top + 2, w / 2 - 3, FLOOR - top - 2);
      L.fillStyle(0xfff2b0, 0.45 + 0.2 * Math.sin(this.clock * 3)); L.fillRect(x - 1, top + 4, 2, FLOOR - top - 4);
      const shake = f ? Math.sin(f.t * 60) * Math.max(0, 1 - f.t) * 3 : 0;
      for (const cy of [top + 70, top + 150]) {
        g.lineStyle(4, 0x8a8aa0, 1); g.lineBetween(x - w / 2 - 4 + shake, cy - 10, x + w / 2 + 4 + shake, cy + 10); g.lineBetween(x - w / 2 - 4 + shake, cy + 10, x + w / 2 + 4 + shake, cy - 10);
      }
      g.fillStyle(0xffd75e, 1); g.fillRect(x - 7 + shake, top + 104, 14, 12); g.fillStyle(0x8a6a2a, 1); g.fillRect(x - 2 + shake, top + 108, 4, 5);
      // twelve page slots over the frame: the ones you own glow
      for (let i = 0; i < PAGES.length; i++) {
        const px = x - w / 2 + 3 + i * ((w - 6) / PAGES.length), have = i < this.pagesHave;
        g.fillStyle(have ? 0xfff2b0 : 0x3a3450, 1); g.fillRect(px, top - 18, 4, 6);
      }
    }
    if (f) this.renderFinish(x, top, w, k);
  },

  renderFinish(x, top, w, k) {
    const f = this.finish, d = this.finishDim;
    d.clear();
    // Milo walks up to the door
    const mx = f.kind === 'ending' ? Math.min(x, PLAYER_X + f.t * 40) : PLAYER_X;
    this.player.setVisible(true).setAlpha(f.kind === 'ending' ? Math.max(0, 1 - Math.max(0, f.t - 2.6) / 0.8) : 1);
    if (f.kind === 'ending' && f.t < 2.6) {
      const key = `${this.char.id}_run`;
      if (this.player.anims.currentAnim?.key !== key || !this.player.anims.isPlaying) this.player.play(key);
    } else if (this.player.anims.isPlaying) { this.player.anims.stop(); this.player.setTexture(`${this.char.id}_${f.kind === 'locked' && f.t > 3 ? 'jump' : 'fall'}`); }
    const lift = f.kind === 'locked' && f.t > 3 ? Math.pow((f.t - 3) / 1.2, 2) * 200 : 0;
    this.player.setPosition(mx, FLOOR - 22 - lift).setRotation(0);
    this.ghost.setVisible(true).setAlpha(0.92).setPosition(mx - 4, FLOOR - 68 - lift);
    this.ghostGlow.setPosition(mx - 4, FLOOR - 68 - lift);
    // THE STRETCH: it stops at the edge of the light; at the ending it waves goodbye
    const s = this.stretch;
    if (f.kind === 'ending') {
      s.anims.stop(); s.setTexture(f.t > 4 && Math.floor(f.t * 3) % 2 ? 'stretch_reach' : 'stretch_grab');
      s.setPosition(Math.round(PLAYER_X - 90 - Math.max(0, f.t - 6) * 20), FLOOR + 2).setAlpha(Math.max(0, 1 - Math.max(0, f.t - 7) / 1.5)).setVisible(true);
      // the light fills the screen, then the room comes back, lit
      const white = Math.min(1, Math.max(0, f.t - 2.4) / 1.0) * (f.t > 9.4 ? Math.max(0.35, 1 - (f.t - 9.4) / 1.2) : 1);
      d.fillStyle(0xfff6d8, white); d.fillRect(0, 0, W, H);
    } else {
      s.setAlpha(1).setVisible(true);
      const dark = Math.max(0, f.t - 3.4) / 1.2;
      d.fillStyle(0x07060d, Math.min(0.9, dark)); d.fillRect(0, 0, W, H);
    }
  },
};

const RUN_CAUGHT = 22;
