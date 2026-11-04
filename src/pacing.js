// Run pacing (level-design + procedural-gen skills).
// - Difficulty rises in a sawtooth: each 320m segment opens with a candle-only breather,
//   then ramps up; the overall baseline climbs until ~2600m.
// - Teach, then test: each hazard unlocks at a set distance, and its first appearance
//   in a run is an easy, telegraphed version with candles guiding the safe line.

export const SEGMENT_M = 320;
export const BREATHER = 0.12; // first 12% of each segment

// distance (m) where each hazard first appears
export const UNLOCK = {
  beam: 0,
  swing: 140,
  hands: 260,
  banshee: 380,
  beamPair: 560,
  rotor: 760,
  movingBeam: 300,
  laser: 450,
  swarm: 900,
};

// Canabalt-style speed: rises fast early, then slower the faster you go
export function speedAt(m) {
  return 230 + 300 * (1 - Math.exp(-m / 1100));
}

export function difficulty(m) {
  const base = Math.min(1, m / 2600);
  const p = (m % SEGMENT_M) / SEGMENT_M;
  const breather = m < 35 || (m > SEGMENT_M * 0.5 && p < BREATHER);
  const ramp = 0.15 * p;
  return { diff: Math.min(1, base * 0.85 + ramp), breather, p };
}

// weighted spawn table for the current point in the run
export function spawnTable(m, diff, breather) {
  if (breather) return [['candles', 1]];
  const t = [['candles', 26], ['beam', 26], ['beamCandles', 10]];
  if (m >= UNLOCK.swing) t.push(['swing', 12]);
  if (m >= UNLOCK.hands) t.push(['hands', 16]);
  if (m >= UNLOCK.beamPair) t.push(['beamPair', 6 + 8 * diff]);
  if (m >= UNLOCK.rotor) t.push(['rotor', 5 + 8 * diff]);
  if (m >= UNLOCK.movingBeam) t.push(['movingBeam', 8 + 6 * diff]);
  if (m >= UNLOCK.laser) t.push(['laser', 7 + 5 * diff]);
  return t;
}

// space after a pattern, in px: shrinks as difficulty rises
export function gapAfter(diff, rand) {
  return 330 - 160 * diff + rand.range(0, 90);
}

// seconds until the next banshee
export function bansheeDelay(diff, rand) {
  return 9 - 5.5 * diff + rand.range(0, 4);
}

export function createIntroTracker() {
  const seen = new Set();
  return {
    // true the first time a hazard appears this run
    first(kind) {
      if (seen.has(kind)) return false;
      seen.add(kind);
      return true;
    },
  };
}
