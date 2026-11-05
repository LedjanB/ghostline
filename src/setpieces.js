// v6 phase 3: a hand-made flight set piece for every world (level-design skill: authored showpiece
// beats). Boo carries you over the world's chasm and the random air spawner is replaced by a
// sequence of segments, one every `every` seconds. Candles always mark a safe line.
// Segment kinds (built from the v5 air hazards):
//   gate   beams from the ceiling and the floor with a gap at y (THREAD THE NEEDLE)
//   pinch  hands from the floor and the ceiling that close to a gap at y
//   sway   a vertical branch that sways up and down; it is at `at` (top|bottom) when it reaches you
//   wave   banshees on every lane but one (`open`)
//   laser  a laser row on the given lanes (0 top, 1 middle, 2 bottom)
//   wheel  a spinning bone wheel centred at y
//   track  a stretch of broken coaster track: a tube from y to the next y
import { W, H, CEIL, FLOOR, PLAYER_X } from './data.js';
import { Audio } from './audio.js';

const TOP = CEIL + 16, BOTTOM = FLOOR - 22;
export const WAVE_LANES = [72, 125, 177, 229, 282];
export const LASER_Y = [80, 180, 280];

export const SET_PIECES = {
  ward: { title: 'THREAD THE NEEDLE!', done: 'NEEDLE THREADED!', every: 1.0,
    segs: [176, 150, 206, 160, 214].map((y) => ({ k: 'gate', y, half: 74 })) },
  morgue: { title: 'THE COLD HANDS!', done: 'SLIPPED THROUGH!', every: 0.95,
    segs: [205, 160, 125, 175, 222].map((y) => ({ k: 'pinch', y, half: 66 })) },
  woods: { title: 'THE SWAYING PINES!', done: 'OUT OF THE WOODS!', every: 0.9,
    segs: ['top', 'bottom', 'top', 'bottom', 'top', 'bottom'].map((at) => ({ k: 'sway', at })) },
  graveyard: { title: 'CROW STORM!', done: 'STORM WEATHERED!', every: 1.3, // two lanes open each wave; move with the gap
    segs: [[2, 3], [3, 4], [1, 2], [2, 3], [0, 1]].map((open) => ({ k: 'wave', open })) },
  sewer: { title: 'PIPE BURST!', done: 'STILL DRY!', every: 1.95, time: true, // one row at a time, never two
    segs: [[0, 2], [1], [0, 1], [1, 2]].map((lanes) => ({ k: 'laser', lanes })) },
  catacombs: { title: 'THE BONE WHEELS!', done: 'NOT A SCRATCH!', every: 1.0,
    segs: [125, 235, 125, 235, 180].map((y) => ({ k: 'wheel', y })) },
  carnival: { title: 'THE BROKEN COASTER!', done: 'WHAT A RIDE!', every: 0.55,
    segs: [240, 190, 135, 110, 150, 215, 250, 200, 160].map((y) => ({ k: 'track', y, half: 60 })) },
  otherside: { title: 'THE LAST CROSSING!', done: 'ALMOST THERE...', every: 1.05,
    segs: [{ k: 'gate', y: 170, half: 70 }, { k: 'wheel', y: 235 }, { k: 'pinch', y: 145, half: 64 }, { k: 'wave', open: [2, 3] },
      { k: 'sway', at: 'bottom' }, { k: 'gate', y: 215, half: 68 }] },
};

export const SetPieceFeatures = {
  // runner.js calls this from startFlight for a 'section' flight
  makeSetPiece(piece) {
    if (!piece) return null;
    return { ...piece, i: 0, step: this.speed * piece.every, nextT: this.clock + 0.35 };
  },

  // replaces the phase 2 version in runner.js (mixed in after it)
  stepSetPiece() {
    const sp = this.setPiece;
    if (sp.i >= sp.segs.length) return;
    if (sp.time ? this.clock < sp.nextT : this.worldX < this.nextSpawn) return;
    const seg = sp.segs[sp.i++];
    const next = sp.segs[sp.i];
    const x0 = W + 60;
    this.spawnSeg(seg, next, x0, sp);
    this.nextSpawn = this.worldX + sp.step;
    sp.nextT = this.clock + sp.every;
  },

  spawnSeg(seg, next, x0, sp) {
    const lineTo = (y0, y1, from, n = 4) => { for (let k = 1; k <= n; k++) this.addCandle(from + k * (sp.step / (n + 1)), y0 + (y1 - y0) * (k / (n + 1))); };
    const safeY = (s) => !s ? null : s.k === 'gate' || s.k === 'pinch' || s.k === 'track' ? s.y
      : s.k === 'wave' ? (WAVE_LANES[s.open[0]] + WAVE_LANES[s.open[1]]) / 2 : s.k === 'wheel' ? (s.y < H / 2 ? s.y + 95 : s.y - 95)
      : s.k === 'sway' ? (s.at === 'top' ? BOTTOM - 30 : TOP + 30) : s.k === 'laser' ? laserSafe(s.lanes) : null;
    const here = safeY(seg), there = safeY(next);
    const arrive = (x0 - PLAYER_X) / this.speed; // seconds until something at x0 reaches Milo
    switch (seg.k) {
      case 'gate': {
        const beam = (y1, y2) => this.spawnBeam(x0, 0, Math.PI / 2, false, (y1 + y2) / 2, null, y2 - y1);
        beam(CEIL + 22, seg.y - seg.half); // the top node stays clear of the HUD row
        beam(seg.y + seg.half, FLOOR - 8);
        break;
      }
      case 'pinch': { // hands from both sides that close to the gap as you come in
        const mk = (fromFloor, reach) => {
          const s = this.add.image(x0, 0, 'hand').setScale(2).setDepth(5);
          if (fromFloor) s.setOrigin(0.5, 0); else s.setOrigin(0.5, 1).setFlipY(true);
          const hidden = fromFloor ? FLOOR + 6 : CEIL - 6;
          this.hands.push({ x: x0, s, fromFloor, reach, state: 'wait', t: 0, y: hidden, hidden, from: hidden, trigger: 300, riseTime: 0.3 });
        };
        mk(true, FLOOR - (seg.y + seg.half));
        mk(false, seg.y - seg.half - CEIL);
        break;
      }
      case 'sway': { // a branch (vertical beam) swaying; it is at the top or bottom when it reaches you
        const len = 100, amp = 55, w = 1.9, base = H / 2 - 6;
        const target = seg.at === 'top' ? -Math.PI / 2 : Math.PI / 2;
        const ph = target - w * (this.clock + arrive);
        this.spawnBeam(x0, 0, Math.PI / 2, false, base, null, len);
        const b = this.beams[this.beams.length - 1];
        b.baseY = base; b.osc = { amp, w, ph };
        break;
      }
      case 'wave': // banshees on every lane but one, after a warning
        WAVE_LANES.forEach((y, i) => { if (!seg.open.includes(i)) this.addWarning(0, 1.05, y); });
        break;
      case 'laser': {
        const lanes = seg.lanes.map((i) => LASER_Y[i]);
        const emitters = lanes.flatMap((y) => [
          this.add.image(-20, y, 'emitter').setScale(2).setDepth(17),
          this.add.image(W + 20, y, 'emitter').setScale(2).setDepth(17).setFlipX(true),
        ]);
        this.lasers.push({ lanes, t: 0, warn: 1.15, fire: 0.7, phase: 'warn', emitters, hit: false });
        Audio.sfx('laserCharge');
        // candles in the safe lane, right in front of you
        for (let k = 0; k < 6; k++) this.addCandle(PLAYER_X + 60 + k * 30, here);
        return;
      }
      case 'wheel':
        this.spawnBeam(x0, 0, 0, true, seg.y, 1.3, 120);
        break;
      case 'track': { // the tube: one beam under the line and one over it, along the slope to the next point
        if (!next) break;
        const dx = sp.step, dy = next.y - seg.y, ang = Math.atan2(dy, dx), len = Math.hypot(dx, dy) - 6;
        const cx = x0 + dx / 2, cy = seg.y + dy / 2;
        for (const off of [-seg.half, seg.half]) {
          const yy = cy + off;
          if (yy - Math.abs(Math.sin(ang)) * len / 2 < TOP - 10 || yy + Math.abs(Math.sin(ang)) * len / 2 > BOTTOM + 14) continue; // off the edge: the ceiling or floor is the wall
          this.spawnBeam(cx - Math.abs(Math.cos(ang)) * len / 2, 0, ang, false, yy, null, len);
        }
        for (let k = 0; k < 3; k++) this.addCandle(x0 + k * (dx / 3), seg.y + dy * (k / 3));
        return;
      }
    }
    // candles: three through this one, then a bend to the next
    for (let k = -1; k <= 1; k++) this.addCandle(x0 + k * 30, here);
    if (there !== null && there !== undefined) lineTo(here, there, x0 + 30);
    else for (let k = 0; k < 8; k++) this.addCandle(x0 + 120 + k * 22, here - Math.sin(k / 7 * Math.PI) * 50);
  },
};

// the middle of the widest free band between laser lanes
function laserSafe(lanes) {
  const blocked = lanes.map((i) => LASER_Y[i]);
  const edges = [TOP + 8, ...blocked.flatMap((y) => [y - 26, y + 26]), BOTTOM - 4].sort((a, b) => a - b);
  let best = H / 2, bw = -1;
  const cuts = [TOP + 8, ...[...blocked].sort((a, b) => a - b), BOTTOM - 4];
  for (let i = 0; i < cuts.length - 1; i++) {
    const lo = i === 0 ? cuts[i] : cuts[i] + 26, hi = i === cuts.length - 2 ? cuts[i + 1] : cuts[i + 1] - 26;
    if (hi - lo > bw) { bw = hi - lo; best = (lo + hi) / 2; }
  }
  void edges;
  return best;
}
