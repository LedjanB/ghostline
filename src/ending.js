// v6 phase 3: the door at the end of world 8, the ending, and endless mode (docs/design-v6.md,
// "The ending is hard to reach"). The door on the Other Side only opens when you own every journal
// page (the whole unlock track) AND a run gets you to it. Without every page it stays shut: Boo
// pulls you back and the results tell you how many pages are missing. After the ending the door
// is open in every run, and beyond it the Other Side never ends (endless mode, also a menu mode
// that starts right at the door).
import { W, H, CEIL, FLOOR, PLAYER_X, PX_PER_METER, ZONE_LENGTH_M, ZONES } from './data.js';
import { LAYER_KEYS } from './zones.js';
import { Audio } from './audio.js';
import { Save } from './save.js';
import { text } from './ui.js';
import { owned, PAGES, TRACK, costFor } from './unlocks.js';

export const DOOR_M = ZONES.length * ZONE_LENGTH_M; // 3200
export const DEPTH_M = ZONE_LENGTH_M;              // beyond the door: a new depth every 400 m
// phase 4: the ending scene, in four beats (testers: "what did it all mean?"):
//   the door opens and the light takes you (0 to 3.4 s);
//   THE JOURNAL: the twelve pages fly together into one picture, and say what they add up to;
//   THE STRETCH, close up, and the light reaching it;
//   THE WARD, lit up: every lamp comes back on, and Boo can finally clock out.
// One line of text at a time, like the rest of the game.

// phase 4c: each journal page has its own drawing (the ending shows them before they fit together).
// 80 x 60 px, pencil on old paper, one red accent. The drawing matches the page's lines in PAGES.
function drawJournalPage(c, i) {
  const ink = '#4a3018', red = '#a02020', W8 = 80, H6 = 60;
  c.fillStyle = '#efe2c2'; c.fillRect(0, 0, W8, H6);
  c.fillStyle = '#d8c39a'; c.fillRect(0, 0, W8, 2); c.fillRect(0, H6 - 2, W8, 2); c.fillRect(0, 0, 2, H6); c.fillRect(W8 - 2, 0, 2, H6);
  c.fillStyle = '#c9b48a'; for (let y = 12; y < H6; y += 9) c.fillRect(6, y, W8 - 12, 1); // ruled lines
  c.strokeStyle = ink; c.fillStyle = ink; c.lineWidth = 2; c.lineCap = 'round'; c.lineJoin = 'round';
  const L = (pts) => { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let j = 2; j < pts.length; j += 2) c.lineTo(pts[j], pts[j + 1]); c.stroke(); };
  const O = (x, y, r, fill) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); if (fill) c.fill(); else c.stroke(); };
  const dot = (x, y, col = red) => { c.fillStyle = col; c.fillRect(x, y, 3, 3); c.fillStyle = ink; };
  switch (i) {
    case 0: // the night janitor: a mop and bucket, and a ghost leaning on it
      L([22, 10, 34, 50]); L([28, 50, 40, 50]); for (let x = 29; x < 40; x += 3) L([x, 50, x - 2, 55]);
      L([44, 36, 60, 36, 57, 52, 47, 52, 44, 36]); L([46, 33, 52, 28, 58, 33]);
      O(18, 22, 7); L([11, 22, 11, 34, 14, 31, 17, 34, 20, 31, 23, 34, 25, 22]); dot(15, 20, ink); dot(19, 20, ink); break;
    case 1: // the cold room clock at 3:33
      O(40, 30, 18); for (let a = 0; a < 12; a++) { const r = a * Math.PI / 6; L([40 + Math.cos(r) * 15, 30 + Math.sin(r) * 15, 40 + Math.cos(r) * 17, 30 + Math.sin(r) * 17]); }
      L([40, 30, 40 + Math.cos(0.3) * 9, 30 + Math.sin(0.3) * 9]); c.strokeStyle = red; L([40, 30, 40 + Math.cos(1.89) * 14, 30 + Math.sin(1.89) * 14]); c.strokeStyle = ink;
      L([60, 14, 66, 10]); L([62, 18, 70, 16]); break; // it hums
    case 2: // the park's trees, still waiting: one has eyes
      for (const [x, h] of [[16, 30], [40, 40], [64, 32]]) { L([x, 54, x, 54 - h]); L([x, 54 - h * 0.6, x - 9, 54 - h * 0.9]); L([x, 54 - h * 0.7, x + 8, 54 - h]); }
      dot(36, 26); dot(42, 26); L([10, 54, 72, 54]); L([52, 54, 52, 46, 60, 46]); break; // and an empty bench
    case 3: // 400 graves, 399 quiet: one is open
      for (let n = 0; n < 4; n++) { const x = 8 + n * 18, open = n === 2; c.beginPath(); c.moveTo(x, 50); c.lineTo(x, 32); c.arc(x + 6, 32, 6, Math.PI, 0); c.lineTo(x + 12, 50); c.stroke(); if (open) { c.strokeStyle = red; L([x + 6, 27, x + 4, 36, x + 8, 42]); c.strokeStyle = ink; L([x - 2, 52, x + 14, 52]); } }
      L([4, 50, 76, 50]); break;
    case 4: // the dark is hungry; candles taste bad to it
      for (let x = 4; x < 80; x += 6) L([x, 4, x - 20, 56]);
      c.fillStyle = '#efe2c2'; c.fillRect(30, 18, 20, 38); c.fillStyle = ink;
      c.strokeRect(35, 30, 10, 22); L([40, 30, 40, 26]); c.fillStyle = '#d07a20'; c.beginPath(); c.ellipse(40, 21, 4, 6, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = ink; break;
    case 5: // the sewers, older than the city: an arch under a street
      L([4, 18, 76, 18]); for (let x = 10; x < 76; x += 14) L([x, 18, x, 12, x + 6, 12, x + 6, 18]);
      c.beginPath(); c.arc(40, 50, 22, Math.PI, 0); c.stroke(); for (let a = 0; a < 6; a++) { const r = Math.PI + a * Math.PI / 5; L([40 + Math.cos(r) * 22, 50 + Math.sin(r) * 22, 40 + Math.cos(r) * 28, 50 + Math.sin(r) * 28]); }
      dot(34, 40); dot(44, 40); break; // something looks back out
    case 6: // the list of names; Milo's isn't on it yet
      for (let y = 12; y < 50; y += 7) { if (y === 47) continue; L([10, y, 22 + ((y * 7) % 30), y]); }
      c.strokeStyle = red; L([10, 50, 60, 50]); c.strokeStyle = ink; L([64, 44, 68, 40, 70, 46]); dot(66, 50, ink); break;
    case 7: // the carnival, 1931: a carousel, and notes still playing
      L([16, 24, 40, 8, 64, 24, 16, 24]); for (let x = 22; x < 64; x += 8) L([x, 24, x, 48]); L([12, 48, 68, 48]);
      O(30, 38, 3); O(48, 34, 3); c.strokeStyle = red; L([66, 12, 66, 4, 72, 6]); O(64, 12, 2); c.strokeStyle = ink; break;
    case 8: // a banshee, late for something
      L([30, 52, 26, 20]); c.beginPath(); c.arc(38, 20, 12, Math.PI, 0); c.stroke(); L([50, 20, 54, 52, 46, 48, 40, 54, 34, 48, 30, 52]);
      O(38, 24, 4); dot(33, 16, ink); dot(41, 16, ink); L([56, 14, 66, 10]); L([58, 22, 70, 22]); L([56, 30, 66, 34]); break;
    case 9: // Boo can't hold on forever: a ghost's hand and a boy's hand
      O(24, 18, 8); L([16, 18, 16, 30, 32, 30, 32, 18]); L([32, 26, 42, 32]); // Boo reaching
      O(58, 30, 5); L([58, 35, 58, 48]); L([58, 48, 54, 56]); L([58, 48, 62, 56]); L([58, 40, 46, 34]); // Milo reaching back
      c.strokeStyle = red; L([42, 32, 46, 34]); c.strokeStyle = ink; break;
    case 10: // the door that forgot to close
      c.strokeRect(26, 10, 26, 44); c.fillStyle = '#f6d880'; c.beginPath(); c.moveTo(52, 10); c.lineTo(78, 4); c.lineTo(78, 60); c.lineTo(52, 54); c.fill(); c.fillStyle = ink;
      L([26, 10, 16, 14, 16, 58, 26, 54]); dot(18, 34, ink); break;
    case 11: // the lights come back on. probably.
      O(40, 24, 11); L([34, 34, 34, 42, 46, 42, 46, 34]); L([35, 45, 45, 45]); L([37, 48, 43, 48]);
      for (let a = 0; a < 8; a++) { const r = a * Math.PI / 4; L([40 + Math.cos(r) * 15, 24 + Math.sin(r) * 15, 40 + Math.cos(r) * 20, 24 + Math.sin(r) * 20]); }
      L([66, 50, 70, 46]); dot(64, 52); dot(70, 52); break; // (two red dots, in the corner)
  }
}

export const END_T = { white: 2.6, pages: 3.4, face: 9.6, ward: 13.8, end: 19.4, out: 22.2 };
const ENDING_LINES = [
  [4.6, 'BOO KEPT THE LIGHTS ON AT ST. MERCY.'],
  [6.2, 'THE NIGHT HE DIED, THEY ALL WENT OUT.'],
  [7.8, 'A DOOR OPENED. IT NEVER CLOSED.'],
  [10.0, 'THE STRETCH CAME THROUGH IT.'],
  [11.9, 'IT WAS ONLY EVER THE DARK.'],
  [14.8, 'THE LIGHTS ARE BACK ON.'],
  [16.8, 'BOO CAN CLOCK OUT NOW.'],
];
const TILES = { cols: 4, rows: 3, tw: 80, th: 60, scale: 1.45 }; // the journal picture: 12 pages = 12 tiles of the ward

// points that take the unlock bar up to (and including) the next journal page
function pointsToNextPage(save = Save.get()) {
  const u = save.unlocks;
  let need = -u.points;
  for (let i = u.got; i < TRACK.length; i++) { need += costFor(i); if (TRACK[i].kind === 'page') return Math.max(0, need); }
  return 0;
}
export function pagesOwned(save = Save.get()) { return owned(save.unlocks.got).pages.length; }
export function doorOpens(save = Save.get()) { return save.ending.seen || pagesOwned(save) >= PAGES.length; }

export const EndingFeatures = {
  endingInit(save) {
    this.finish = null;
    this.doorWX = DOOR_M * PX_PER_METER;
    this.doorOpen = save.ending.seen; // after the ending you just run through
    this.beyond = false; this.depth = 0;
    this.pagesHave = pagesOwned(save);
    this.startX = 0; this.endlessMode = false; this.doorPoints = 0;
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
    this.endGfx = this.add.graphics().setDepth(26.8);     // the ending's paper, black and light
    this.endLamps = this.add.graphics().setDepth(8.2);    // the ward's lamps, behind Milo and Boo
    this.endTop = this.add.graphics().setDepth(26.97);    // over the journal's picture: Boo's lit window
    this.endTiles = null; this.endFace = null; this.endText = null;
    for (let i = 0; i < 12; i++) if (!this.textures.exists(`journal_page_${i}`)) {
      const tex = this.textures.createCanvas(`journal_page_${i}`, 80, 60); drawJournalPage(tex.context, i); tex.refresh();
    }
    // the journal's picture: the whole ward (every layer but the floor) in one texture
    if (!this.textures.exists('ward_journal')) {
      const tex = this.textures.createCanvas('ward_journal', 320, 180);
      for (const k of ['sky', 'far', 'mid', 'near']) tex.context.drawImage(this.textures.get(`ward_${k}`).getSourceImage(), 0, 0);
      tex.refresh();
    }
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
    if (this.scare) this.endScare();
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
    for (const p of [...this.runPickups, ...(this.pickups || [])]) { p.s.destroy(); p.glow.destroy(); }
    this.runPickups = []; this.pickups = [];
    if (this.tutorial?.active) this.tutorial.setVisible(false);
    if (this.tutorial2?.active) this.tutorial2.setVisible(false);
    Audio.thrust(false);
    if (kind === 'ending') { Audio.sfx('rebirth'); Audio.music('otherside'); }
    else { Audio.sfx('stumble'); this.shake(200, 0.008); this.doorPoints = pointsToNextPage(); }
    this.scene.get('hud')?.cameras?.main?.setVisible(false); // nothing over the door scene
    if (this.headObjs) { this.headObjs.forEach((o) => o.destroy()); this.headObjs = null; }
    this.heads = []; this.headUntil = this.clock + 99;
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
      if (f.t > 2.6 && f.said === 2) { f.said = 3; this.say('A PAGE WAS PINNED TO IT. YOU TAKE IT.', 172, '#fff2b0', 8); Audio.sfx('unlock'); }
      if (f.t > 3.4 && f.said === 3) { f.said = 4; this.say('BOO PULLS YOU BACK. FIND THE REST.', 194, '#a99fd0', 8); Audio.sfx('grab'); }
      if (f.t > 4.6 && !this.ended) { this.ended = true; this.time.delayedCall(200, () => this.afterDeath()); }
    } else {
      const T = END_T;
      for (let i = 0; i < ENDING_LINES.length; i++) if (f.said === i && f.t > ENDING_LINES[i][0]) {
        f.said++;
        const at = ENDING_LINES[i][0], dark = at >= T.face && at < T.ward;
        this.endLine(ENDING_LINES[i][1], dark ? '#ece8f2' : '#2a1f4a', dark ? '#07060d' : '#fff6d8', 16, at >= T.ward ? 74 : H - 36); // in the ward: up top, clear of Milo
      }
      if (f.t > T.pages && !f.pagesIn) { f.pagesIn = true; Audio.sfx('unlock'); }
      if (f.t > T.face && !f.faceIn) { f.faceIn = true; Audio.sfx('breath', { v: 1 }); Audio.hush(1.6); }
      if (f.t > 11.4 && !f.lit) { f.lit = true; Audio.sfx('holy'); Audio.sfx('scream'); this.shake(300, 0.01); }
      if (f.t > T.ward && !f.wardIn) { f.wardIn = true; this.endWard(); Audio.music('ward'); }
      if (f.t > T.end && f.said === ENDING_LINES.length) { f.said++; this.endLine('THE END', '#2a1f4a', '#fff6d8', 24, H / 2 - 20); Audio.sfx('zone'); }
      if (f.t > T.end + 1.2 && f.said === ENDING_LINES.length + 1) { f.said++; this.say('(PROBABLY.)', H / 2 + 14, '#6a5a8a', 8, true, '#fff6d8'); Audio.sfx('creak'); }
      if (f.t > T.out && !this.ended) {
        this.ended = true;
        Save.update((s) => { s.ending.seen = true; s.ending.runs = s.runs + 1; });
        this.time.delayedCall(300, () => this.afterDeath());
      }
    }
  },

  // one line at a time: the new one replaces the old
  endLine(str, color, stroke, size = 16, y = H - 36) {
    if (this.endText) { this.tweens.killTweensOf(this.endText); this.endText.destroy(); }
    this.endText = this.say(str, y, color, size, true, stroke);
    this.endText.setDepth(28);
  },

  // the ward, lit: the world behind becomes St. Mercy again
  endWard() {
    LAYER_KEYS.forEach((k) => this.layers.A[k].setTexture(`ward_${k}`));
    this.layers.setLook(0xfff0d8);
    this.dark?.setVisible(false);
    this.setWeather('ward');
    this.doorGfx.clear(); this.doorLight.clear();
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
    if (f && f.kind === 'ending' && f.t > END_T.ward) { this.renderFinish(x, CEIL + 30, 74, 1); return; } // the door is gone: the ward
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
    s.clearTint().setRotation(0);
    if (f.kind === 'ending') {
      const T = END_T;
      s.anims.stop(); s.setTexture(f.t > 4 && Math.floor(f.t * 3) % 2 ? 'stretch_reach' : 'stretch_grab');
      s.setPosition(Math.round(PLAYER_X - 90), FLOOR + 2).setAlpha(f.t < T.white ? 1 : 0).setVisible(f.t < T.pages);
      // the light fills the screen
      const white = f.t < T.face ? Math.min(1, Math.max(0, f.t - 2.4) / 1.0) : 0;
      d.fillStyle(0xfff6d8, white); d.fillRect(0, 0, W, H);
      this.renderEndBeats(f);
    } else {
      s.setAlpha(1).setVisible(true);
      const dark = Math.max(0, f.t - 3.4) / 1.2;
      d.fillStyle(0x07060d, Math.min(0.9, dark)); d.fillRect(0, 0, W, H);
    }
  },

  // the journal, the close-up and the lit ward
  renderEndBeats(f) {
    const T = END_T, g = this.endGfx, L = this.endLamps, t = f.t;
    g.clear(); L.clear(); this.endTop.clear();
    const clamp = (v) => Math.max(0, Math.min(1, v));
    // THE JOURNAL: twelve pages, each one piece of the same picture, fly in and fit together
    const inPages = t > T.pages && t < T.face;
    if (inPages && !this.endTiles) {
      this.endTiles = [];
      for (let i = 0; i < TILES.cols * TILES.rows; i++) {
        const c = i % TILES.cols, r = Math.floor(i / TILES.cols);
        const img = this.add.image(0, 0, 'ward_journal').setOrigin(0).setScale(TILES.scale).setDepth(26.9)
          .setCrop(c * TILES.tw, r * TILES.th, TILES.tw, TILES.th).setTint(0xc89a5a);
        const ang = (i * 2.399) % (Math.PI * 2);
        const page = this.add.image(0, 0, `journal_page_${i}`).setOrigin(0).setScale(TILES.scale).setDepth(26.91);
        this.endTiles.push({ img, page, c, r, sx: W / 2 + Math.cos(ang) * 420, sy: H / 2 + Math.sin(ang) * 300, rot: ((i % 5) - 2) * 0.06 });
      }

    }
    if (this.endTiles) {
      const pw = TILES.cols * TILES.tw * TILES.scale, ph = TILES.rows * TILES.th * TILES.scale;
      const ox = (W - pw) / 2, oy = 22;
      for (const [i, p] of this.endTiles.entries()) {
        const k = Phaser.Math.Easing.Cubic.Out(clamp((t - T.pages - 0.15 * i) / 0.7));
        // setCrop keeps the image's origin at the full texture's corner, so place by the texture's 0,0
        const tx = ox, ty = oy, fx = p.sx - (p.c * TILES.tw + TILES.tw / 2) * TILES.scale, fy = p.sy - (p.r * TILES.th + TILES.th / 2) * TILES.scale;
        // first you see each page's own drawing; then, one by one, they turn into the piece of the picture they are
        const turn = clamp((t - T.pages - 3.0 - 0.08 * i) / 0.45);
        const ix = Phaser.Math.Linear(fx, tx, k), iy = Phaser.Math.Linear(fy, ty, k);
        p.img.setPosition(ix, iy).setRotation(p.rot * (1 - k)).setAlpha(k > 0 ? turn : 0).setVisible(inPages);
        p.page.setPosition(ix + p.c * TILES.tw * TILES.scale, iy + p.r * TILES.th * TILES.scale).setRotation(p.rot * (1 - k))
          .setAlpha(k > 0 ? 1 - turn : 0).setVisible(inPages);
      }
      // once they fit, the picture comes alive: sepia to color, and one window lit (Boo's)
      const whole = clamp((t - T.pages - 4.4) / 0.8); // after the last page has turned
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0xc89a5a), Phaser.Display.Color.ValueToColor(0xffffff), 1, whole);
      this.endTiles.forEach((p) => p.img.setTint(Phaser.Display.Color.GetColor(col.r, col.g, col.b)));
      if (inPages) {
        g.fillStyle(0xf3e9cf, clamp((t - T.pages) / 0.4)); g.fillRect(0, 0, W, H);                    // the journal's paper
        g.lineStyle(3, 0x8a6a3a, whole); g.strokeRect(ox - 4, oy - 4, pw + 8, ph + 8);                  // and its frame
        if (whole > 0) { const G = this.endTop; // Boo's window, lit, with him in it
          const wx = ox + pw * 0.56, wy = oy + ph * 0.2;
          G.fillStyle(0xfff2b0, whole * 0.25); G.fillRect(wx - 16, wy - 16, 70, 92);
          G.fillStyle(0xfff2b0, whole * (0.85 + 0.15 * Math.sin(t * 6))); G.fillRect(wx, wy, 38, 60);
          G.fillStyle(0x9fb8e8, whole); G.fillCircle(wx + 19, wy + 26, 10); G.fillRect(wx + 9, wy + 26, 20, 18);
          G.fillStyle(0x1b1630, whole); G.fillRect(wx + 14, wy + 22, 3, 4); G.fillRect(wx + 22, wy + 22, 3, 4);
        }
      }
      if (!inPages) { this.endTiles.forEach((p) => { p.img.destroy(); p.page.destroy(); }); this.endTiles = null; }
    }
    // THE STRETCH, close up: out of the black, too close, grinning; then the light reaches it
    const inFace = t >= T.face && t < T.ward;
    if (inFace) {
      if (!this.endFace) this.endFace = this.add.image(W / 2, H / 2 - 20, 'stretch_face').setDepth(26.85);
      const k = (t - T.face) / (T.ward - T.face);
      const lit = clamp((t - 11.4) / 0.25);
      g.fillStyle(0x020205, 1); g.fillRect(0, 0, W, H);
      const jit = lit < 1 ? (Math.random() - 0.5) * 3 : 0;
      const sc = 9 + k * 3 - lit * 2; // the face is 26 px tall: it fills the screen, the biggest it ever gets
      this.endFace.setTexture(lit > 0.5 ? 'stretch_face_lit' : 'stretch_face').setScale(sc).setPosition(W / 2 + jit - (1 - clamp(k * 4)) * 200, H / 2 - 24 + jit)
        .setAlpha(clamp(k * 5) * (1 - clamp((t - 12.6) / 1.0))).setVisible(true);
      if (t > 11.2) { // the light: a wedge from the right, from the open door
        const w = W * 0.42 * clamp((t - 11.2) / 0.3); // a beam from the right, not a flood: the dark stays around it
        g.fillStyle(0xfff6d8, 0.9); g.fillTriangle(W, 0, W, H, W - w, H / 2);
        g.fillStyle(0xfff6d8, 0.3); g.fillTriangle(W, -60, W, H + 60, W - w - 60, H / 2);
      }
      if (lit > 0) { // it cracks in the light (drawn OVER the face), and splinters
        const C = this.endTop, fade = 1 - clamp((t - 12.6) / 1.0);
        C.lineStyle(Math.max(2, sc * 0.7), 0x07060d, lit * fade);
        const cx = W / 2 + sc, cy = H / 2 - 24 - 11 * sc;
        C.lineBetween(cx, cy, cx - 10, cy + 40 * lit); C.lineBetween(cx - 10, cy + 40 * lit, cx + 8, cy + 80 * lit); C.lineBetween(cx + 8, cy + 80 * lit, cx - 4, cy + 120 * lit);
        C.lineBetween(cx - 10, cy + 40 * lit, cx - 40 * lit, cy + 60 * lit); C.lineBetween(cx + 8, cy + 80 * lit, cx + 44 * lit, cy + 100 * lit);
        if (t > 12.0) { C.fillStyle(0xece8f2, fade); for (let i = 0; i < 10; i++) { const a = i * 0.63, r = (t - 12.0) * 260; C.fillRect(cx + Math.cos(a) * r, cy + 80 + Math.sin(a) * r * 0.7, 6, 6); } } // shards
      }
    } else if (this.endFace) { this.endFace.destroy(); this.endFace = null; }
    // THE WARD, lit up: it comes out of the dark, the lamps come on one by one, Boo waves and floats away
    if (t >= T.ward) {
      const k = t - T.ward;
      g.fillStyle(0x020205, 1 - clamp(k / 0.9)); g.fillRect(0, 0, W, H);
      for (let i = 0; i < 6; i++) {
        const lx = 50 + i * 108, on = k > 0.7 + i * 0.32;
        const off = i === 5 && t > T.end + 1.2 && t < T.end + 1.7; // (probably): the last one flickers off...
        L.fillStyle(0x3a3450, 1); L.fillRect(lx - 14, CEIL, 28, 6);
        if (on && !off) {
          L.fillStyle(0xfff2b0, 1); L.fillRect(lx - 10, CEIL + 6, 20, 3);
          L.fillStyle(0xfff2b0, 0.16); L.fillTriangle(lx - 10, CEIL + 9, lx + 10, CEIL + 9, lx + 60, FLOOR); L.fillTriangle(lx - 10, CEIL + 9, lx - 60, FLOOR, lx + 60, FLOOR);
        }
        if (off) { L.fillStyle(0xff3a4a, 1); L.fillRect(lx - 8, CEIL + 130, 3, 3); L.fillRect(lx + 5, CEIL + 130, 3, 3); } // ...and something's still there
        if (on && (f.lamps || 0) <= i) { f.lamps = i + 1; Audio.sfx('tick'); }
      }
      const mx = W / 2 - 30;
      this.player.anims.stop(); this.player.setTexture(`${this.char.id}_run0`).setAlpha(1).setVisible(true).setPosition(mx, FLOOR - 22);
      const up = clamp((t - 17.4) / 1.6);
      const wave = t > 16.8 && t < 17.6 ? Math.sin((t - 16.8) * 20) * 6 : 0;
      this.ghost.setVisible(true).setAlpha(0.92 * (1 - up)).setPosition(mx + 40 + wave, FLOOR - 70 - up * 160);
      this.ghostGlow.setPosition(mx + 40 + wave, FLOOR - 70 - up * 160);
      this.stretch.setVisible(false);
    }
  },
};

const RUN_CAUGHT = 22;
