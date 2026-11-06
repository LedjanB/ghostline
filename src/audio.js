// Music and SFX, synthesized with Web Audio (audio-design skill):
// buses (music -> duck -> master, sfx -> master), limiter on master for headroom,
// squared slider -> gain, adaptive music layers, varied one-shots, capped polyphony.
import { Save } from './save.js';

let ctx = null;
let master, limiter, musicBus, duckBus, sfxBus, ambBus, noiseBuf;
let ambience = null; // current zone ambience
let ambNodes = [];
let nextAmbEvent = 0;
let layerBase, layerDrive, layerDanger, layerCombo;
let comboTier = 1; // music layers stack with the combo (Bit.Trip Runner)
let heardTier = 1;
let fadeUntil = 0;
let thrust = null; // looping whoosh while Boo pulls
let songName = null;
let step = 0;
let nextTime = 0;
let voices = 0;
const MAX_VOICES = 28;

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const N = {};
['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach((name, i) => {
  for (let o = 0; o < 8; o++) N[name + o] = 12 * (o + 1) + i;
});
const seq = (s) => s.split(' ').map((t) => (t === '.' ? null : N[t]));
const sliderGain = (s) => s * s; // squared so the slider feels even over its travel

// ---- music: a small seeded composer (audio-design: adaptive layers) ----
// Each song is a spec (key, scale, chord progression, styles). It is expanded once into
// 8 bars of 16th-note steps: bass + pad + lead in the base layer, arp + drums in the drive
// layer (fades in with speed), and a low throb in the danger layer.
const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11], dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], major: [0, 2, 4, 5, 7, 9, 11],
};
const SPECS = {
  menu: { bpm: 76, root: 57, scale: 'harmonic', prog: [0, 5, 3, 4], bass: 'drone', arp: 'music', lead: 'triangle', drums: null, seed: 1, leadOct: 1 },
  ward: { bpm: 108, root: 57, scale: 'harmonic', prog: [0, 5, 3, 4], bass: 'pulse', arp: 'up', lead: 'square', drums: 'basic', seed: 2 },
  morgue: { bpm: 90, root: 52, scale: 'phrygian', prog: [0, 1, 0, 6], bass: 'drone', arp: 'sparse', lead: 'triangle', drums: 'tick', seed: 3 },
  woods: { bpm: 100, root: 50, scale: 'dorian', prog: [0, 3, 0, 6], bass: 'walk', arp: 'updown', lead: 'triangle', drums: 'basic', seed: 4 },
  graveyard: { bpm: 118, root: 48, scale: 'minor', prog: [0, 3, 5, 4], bass: 'pulse', arp: 'broken', lead: 'square', drums: 'shuffle', seed: 5 },
  sewer: { bpm: 128, root: 52, scale: 'phrygian', prog: [0, 0, 1, 6], bass: 'drive', arp: 'up', lead: 'square', drums: 'drive', seed: 6 },
  catacombs: { bpm: 96, root: 59, scale: 'minor', prog: [0, 5, 2, 6], bass: 'drone', arp: 'organ', lead: 'triangle', drums: 'tick', seed: 7 },
  carnival: { bpm: 136, root: 50, scale: 'harmonic', prog: [0, 3, 4, 0], bass: 'oompah', arp: 'calliope', lead: 'square', drums: 'oompah', seed: 8 },
  otherside: { bpm: 110, root: 54, scale: 'lydian', prog: [0, 1, 5, 4], bass: 'drone', arp: 'shimmer', lead: 'triangle', drums: 'basic', seed: 9, leadOct: 1 },
};
const DRUMS = {
  basic: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
  tick: { k: 'x...............', s: '............x...', h: '..x...x...x...x.' },
  shuffle: { k: 'x.....x...x.....', s: '....x.......x..x', h: 'x..x.xx..x.xx..x' },
  drive: { k: 'x...x...x...x...', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' },
  oompah: { k: 'x.......x.......', s: '....x.......x...', h: '..x...x...x...x.' },
};
const RHYTHMS = ['x.x.x...x.xx....', 'x...x.x.x...x...', 'x.xx..x.x...x.x.', 'x..x..x.x.x.....', 'x...x...xx.x....'];

function makeRand(seed) {
  let s = seed * 9301 + 49297;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function compose(spec) {
  const r = makeRand(spec.seed);
  const sc = SCALES[spec.scale];
  const note = (deg, oct = 0) => spec.root + sc[((deg % 7) + 7) % 7] + 12 * (oct + Math.floor(deg / 7));
  const bars = 8;
  const steps = bars * 16;
  const bass = new Array(steps).fill(null), pad = new Array(steps).fill(null), lead = new Array(steps).fill(null), arp = new Array(steps).fill(null);
  const chordOf = (bar) => spec.prog[bar % spec.prog.length];
  for (let bar = 0; bar < bars; bar++) {
    const c = chordOf(bar);
    const tones = [note(c, -1), note(c + 2, -1), note(c + 4, -1)];
    const o = bar * 16;
    pad[o] = [note(c), note(c + 2), note(c + 4)];
    for (let i = 0; i < 16; i++) {
      const st = o + i;
      switch (spec.bass) {
        case 'pulse': if (i % 2 === 0) bass[st] = i % 8 === 6 ? tones[2] : tones[0]; break;
        case 'drive': bass[st] = i % 4 === 3 ? tones[0] + 12 : tones[0]; break;
        case 'walk': if (i % 4 === 0) bass[st] = [tones[0], tones[1], tones[2], note(c + 5, -1)][i / 4]; break;
        case 'oompah': if (i % 4 === 0) bass[st] = i % 8 === 0 ? tones[0] : tones[2] - 12; break;
        default: if (i === 0) bass[st] = tones[0]; if (i === 8) bass[st] = tones[2] - 12;
      }
      const up = [note(c, 1), note(c + 2, 1), note(c + 4, 1), note(c + 7, 1)];
      switch (spec.arp) {
        case 'up': if (i % 2 === 0) arp[st] = up[(i / 2) % 4]; break;
        case 'updown': if (i % 2 === 0) arp[st] = [0, 1, 2, 3, 2, 1, 0, 1].map((k) => up[k])[(i / 2) % 8]; break;
        case 'broken': if (i % 2 === 0) arp[st] = [0, 2, 1, 3][(i / 2) % 4] !== undefined ? up[[0, 2, 1, 3][(i / 2) % 4]] : null; break;
        case 'sparse': if (i % 6 === 0) arp[st] = up[(i / 6) % 4]; break;
        case 'organ': if (i % 4 === 0) arp[st] = up[(i / 4) % 3]; break;
        case 'calliope': arp[st] = up[[0, 1, 2, 1][i % 4]] + (i >= 8 ? 12 : 0); break;
        case 'shimmer': arp[st] = up[i % 4] + 12; break;
        case 'music': if (i % 4 === 0) arp[st] = up[(i / 4) % 4] + 12; break;
        default: break;
      }
    }
  }
  // lead: a 2-bar motif, played A A' B A (variation on bar 4, new motif in bars 5-6)
  const motif = (seedOffset) => {
    const rr = makeRand(spec.seed * 31 + seedOffset);
    const rhythm = RHYTHMS[Math.floor(rr() * RHYTHMS.length)] + RHYTHMS[Math.floor(rr() * RHYTHMS.length)];
    let deg = Math.floor(rr() * 3) * 2;
    return rhythm.split('').map((ch) => {
      if (ch !== 'x') return null;
      deg += [-2, -1, -1, 1, 1, 2, 0, 3][Math.floor(rr() * 8)];
      deg = Math.max(-2, Math.min(9, deg));
      return deg;
    });
  };
  const A = motif(1), B = motif(2);
  const plan = [A, A, B, A];
  const lo = spec.leadOct ?? 0;
  plan.forEach((m, p) => {
    for (let i = 0; i < 32; i++) {
      const d = m[i];
      if (d === null) continue;
      const bar = p * 2 + Math.floor(i / 16);
      const c = chordOf(bar);
      // strong beats snap to a chord tone so the melody sits on the harmony
      let deg = d;
      if (i % 8 === 0) { const ct = [c, c + 2, c + 4, c + 7]; deg = ct.reduce((a, b) => (Math.abs(b - d) < Math.abs(a - d) ? b : a)); }
      if (p === 1 && i >= 24) deg += 1; // A' ends higher, like a question
      lead[p * 32 + i] = note(deg, lo);
    }
  });
  return { bassN: bass, padN: pad, leadN: lead, arpN: arp, steps, drumN: spec.drums ? DRUMS[spec.drums] : null };
}

const SONGS = {};
for (const [k, spec] of Object.entries(SPECS)) SONGS[k] = { ...spec, ...compose(spec) };

function init() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6; limiter.knee.value = 4; limiter.ratio.value = 12;
  limiter.attack.value = 0.003; limiter.release.value = 0.15;
  master = ctx.createGain();
  master.gain.value = 0.85; // headroom below 0 dBFS
  master.connect(limiter); limiter.connect(ctx.destination);
  duckBus = ctx.createGain(); duckBus.gain.value = 1; duckBus.connect(master);
  musicBus = ctx.createGain(); musicBus.connect(duckBus);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  ambBus = ctx.createGain(); ambBus.gain.value = 0; ambBus.connect(sfxBus);
  layerBase = ctx.createGain(); layerBase.gain.value = 1; layerBase.connect(musicBus);
  layerDrive = ctx.createGain(); layerDrive.gain.value = 0; layerDrive.connect(musicBus);
  layerDanger = ctx.createGain(); layerDanger.gain.value = 0; layerDanger.connect(musicBus);
  layerCombo = ctx.createGain(); layerCombo.gain.value = 0; layerCombo.connect(musicBus);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // thrust: band-passed noise that opens up while you hold (lives on the SFX bus)
  {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 650; f.Q.value = 0.9;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(sfxBus); src.start();
    thrust = { f, g };
  }
  applySettings();
  setInterval(schedule, 25);
}

function applySettings() {
  if (!ctx) return;
  const s = Save.get().settings;
  const t = ctx.currentTime;
  musicBus.gain.setTargetAtTime(s.muted ? 0 : sliderGain(s.music), t, 0.03);
  sfxBus.gain.setTargetAtTime(s.muted ? 0 : sliderGain(s.sfx), t, 0.03);
}

function unlock() {
  init();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);
window.addEventListener('touchstart', unlock);
window.addEventListener('gamepadconnected', unlock);

function tone(t, freq, dur, wave, vol, bus, slideTo, detuneCents = 0) {
  if (voices >= MAX_VOICES) return;
  voices++;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = wave;
  o.frequency.setValueAtTime(freq, t);
  o.detune.value = detuneCents;
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus);
  o.onended = () => { voices--; g.disconnect(); };
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(t, dur, vol, bus, freq = 3000, type = 'highpass') {
  if (voices >= MAX_VOICES) return;
  voices++;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(bus);
  s.onended = () => { voices--; g.disconnect(); };
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

// Music timing reads the audio clock (ctx.currentTime), never frame time.
function schedule() {
  if (!ctx) return;
  scheduleAmbience();
  if (!songName) return;
  const song = SONGS[songName] || SONGS.menu;
  const sixteenth = 60 / song.bpm / 4;
  if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
  while (nextTime < ctx.currentTime + 0.12) {
    const t = nextTime;
    const i = step % song.steps;
    const j = i % 16;
    const b = song.bassN[i];
    if (b) tone(t, midi(b), sixteenth * (song.bass === 'drone' ? 7 : 1.8), 'triangle', 0.11, layerBase);
    if (song.padN[i]) song.padN[i].forEach((n) => tone(t, midi(n), sixteenth * 15, 'sine', 0.018, layerBase));
    const l = song.leadN[i];
    if (l) tone(t, midi(l + 12), sixteenth * 1.7, song.lead, song.lead === 'square' ? 0.03 : 0.06, layerBase);
    const a = song.arpN[i];
    if (a) tone(t, midi(a), sixteenth * 0.9, song.arp === 'organ' ? 'triangle' : 'square', 0.016, layerDrive);
    const d = song.drumN;
    if (d) {
      if (d.k[j] === 'x') tone(t, 95, 0.13, 'sine', 0.17, layerDrive, 42);
      if (d.s[j] === 'x') noise(t, 0.11, 0.06, layerDrive, 1300, 'bandpass');
      if (d.h[j] === 'x') noise(t, 0.03, j % 4 === 0 ? 0.04 : 0.022, layerDrive, 7000);
    }
    if (j % 4 === 0) tone(t, midi(song.root - 24), sixteenth * 3, 'sawtooth', 0.05, layerDanger);
    // combo layers: x2 sparkle echo of the lead, x3 claps + 16th hats, x4 bass octave, x5 lifted arp
    const ht = ctx.currentTime < fadeUntil ? Math.max(heardTier, comboTier) : comboTier;
    if (ht >= 2 && l) tone(t + sixteenth * 2, midi(l + 24), sixteenth * 1.2, 'triangle', 0.022, layerCombo);
    if (ht >= 3) {
      if (j === 4 || j === 12) noise(t, 0.09, 0.07, layerCombo, 1800, 'bandpass');
      if (j % 2 === 1) noise(t, 0.025, 0.018, layerCombo, 9000);
    }
    if (ht >= 4 && b) tone(t, midi(b + 12), sixteenth * 1.4, 'sawtooth', 0.025, layerCombo);
    if (ht >= 5 && a) tone(t, midi(a + 12), sixteenth * 0.8, 'triangle', 0.02, layerCombo);
    nextTime += sixteenth;
    step++;
  }
}

const rand = (a, b) => a + Math.random() * (b - a);

// ---- zone ambience (audio-design: soundscapes under the music) ----
function loopNoise(freq, type, vol, q = 0.7, lfoRate = 0, lfoDepth = 0) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(ambBus);
  const nodes = [s, f, g];
  if (lfoRate) {
    const lfo = ctx.createOscillator(); lfo.frequency.value = lfoRate;
    const lg = ctx.createGain(); lg.gain.value = lfoDepth;
    lfo.connect(lg); lg.connect(g.gain); lfo.start();
    nodes.push(lfo, lg);
  }
  s.start();
  return nodes;
}
function setAmbience(name) {
  if (!ctx || ambience === name) return;
  ambNodes.forEach((n) => { try { n.stop && n.stop(); } catch (e) { /* already stopped */ } n.disconnect && n.disconnect(); });
  ambNodes = [];
  ambience = name;
  const AMB = {
    ward: () => loopNoise(2500, 'highpass', 0.05, 0.5), // rain on windows
    morgue: () => loopNoise(90, 'lowpass', 0.12, 1, 0.05, 0.03), // fridge hum
    woods: () => loopNoise(420, 'bandpass', 0.09, 0.8, 0.13, 0.06), // wind gusts
    graveyard: () => loopNoise(600, 'bandpass', 0.07, 0.6, 0.09, 0.05), // cold wind
    sewer: () => loopNoise(140, 'lowpass', 0.16, 1, 0.07, 0.05), // low rumble
    catacombs: () => loopNoise(200, 'lowpass', 0.08, 1, 0.04, 0.03), // deep room tone
    carnival: () => loopNoise(1200, 'bandpass', 0.03, 0.4, 0.2, 0.02), // distant crowd hiss
    otherside: () => loopNoise(3000, 'bandpass', 0.03, 2, 0.05, 0.02), // glassy shimmer
  };
  if (AMB[name]) ambNodes = AMB[name]();
  ambBus.gain.setTargetAtTime(name ? 1 : 0, ctx.currentTime, 0.6);
  nextAmbEvent = ctx.currentTime + 1;
}
function scheduleAmbience() {
  if (!ambience || ctx.currentTime < nextAmbEvent) return;
  const t = ctx.currentTime + 0.02;
  if (ambience === 'ward') { // distant heart monitor
    tone(t, 1000, 0.08, 'sine', 0.015, ambBus);
    nextAmbEvent = t + 1.4;
  } else if (ambience === 'woods' || ambience === 'graveyard') { // crickets + the odd owl or crow
    if (Math.random() < 0.15) { tone(t, 420, 0.25, 'sine', 0.03, ambBus, 380); tone(t + 0.35, 400, 0.4, 'sine', 0.03, ambBus, 350); }
    else for (let i = 0; i < 3; i++) tone(t + i * 0.06, 4200, 0.03, 'square', 0.006, ambBus);
    nextAmbEvent = t + rand(0.6, 1.6);
  } else if (ambience === 'sewer' || ambience === 'catacombs') { // water drips
    tone(t, rand(900, 1400), 0.12, 'sine', 0.03, ambBus, 500);
    nextAmbEvent = t + rand(0.4, 1.8);
  }
}

export const Audio = {
  music(name) {
    init();
    if (songName === name) return;
    songName = name;
    step = 0;
    if (ctx) nextTime = ctx.currentTime + 0.1;
  },
  // 0..1: how hard the run is going; fades the drive layer in
  intensity(v) {
    if (!ctx) return;
    layerDrive.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, 0.5);
  },
  // combo tier 1..5: each tier adds a music layer; dropping back fades them out
  combo(tier) {
    if (!ctx) { comboTier = tier; return; }
    if (tier < comboTier) { heardTier = comboTier; fadeUntil = ctx.currentTime + 0.9; }
    comboTier = tier;
    layerCombo.gain.setTargetAtTime(tier >= 2 ? 1 : 0, ctx.currentTime, tier >= 2 ? 0.05 : 0.3);
  },
  // the whoosh of Boo pulling you up
  thrust(on) {
    if (!ctx || !thrust) return;
    const t = ctx.currentTime;
    thrust.g.gain.setTargetAtTime(on ? 0.07 : 0, t, on ? 0.04 : 0.12);
    thrust.f.frequency.setTargetAtTime(on ? 1100 : 500, t, on ? 0.15 : 0.2);
  },
  danger(on) {
    if (!ctx) return;
    layerDanger.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, on ? 0.05 : 0.4);
  },
  // ducks a separate bus so it never overwrites the player's music volume
  duck(on) {
    if (!ctx) return;
    duckBus.gain.setTargetAtTime(on ? 0.3 : 1, ctx.currentTime, on ? 0.08 : 0.35);
  },
  applySettings,
  ambience(name) { init(); setAmbience(name); },
  // silence right before a scare so it hits harder
  hush(sec) {
    if (!ctx) return;
    const t = ctx.currentTime;
    duckBus.gain.cancelScheduledValues(t);
    duckBus.gain.setTargetAtTime(0.08, t, 0.05);
    duckBus.gain.setTargetAtTime(1, t + sec, 0.2);
  },
  sfx(name, opts = {}) {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.005;
    const dt = rand(-60, 60); // +/- ~half a semitone of variation on repeated sounds
    const vv = rand(0.85, 1.1); // and +/- ~1 dB of volume
    switch (name) {
      case 'candle': {
        const c = Math.min(opts.combo || 0, 12); // rising pitch on a candle streak
        const base = 880 * Math.pow(2, c / 12);
        tone(t, base, 0.07, 'square', 0.045 * vv, sfxBus, null, dt);
        tone(t + 0.045, base * 1.5, 0.11, 'square', 0.045 * vv, sfxBus, null, dt);
        break;
      }
      case 'float': tone(t, 260, 0.25, 'sine', 0.06 * vv, sfxBus, 420, dt); break;
      case 'jump': tone(t, 300, 0.12, 'square', 0.04 * vv, sfxBus, 620, dt); break;
      case 'slide': noise(t, 0.22, 0.05 * vv, sfxBus, 600, 'lowpass'); break;
      case 'stumble': noise(t, 0.12, 0.09, sfxBus, 400, 'lowpass'); tone(t, 180, 0.2, 'square', 0.06, sfxBus, 90); break;
      // THE STRETCH: a heavy, soft step (louder the closer it is), a wet breath, a roar when you stumble
      case 'step': { const v = opts.v ?? 0.5; tone(t, rand(55, 70), 0.09, 'triangle', 0.05 * v * vv, sfxBus, 40); noise(t, 0.05, 0.02 * v, sfxBus, 300, 'lowpass'); break; }
      case 'breath': { const v = opts.v ?? 0.6; noise(t, 0.55, 0.035 * v, sfxBus, 700, 'bandpass'); noise(t + 0.6, 0.45, 0.025 * v, sfxBus, 500, 'bandpass'); break; }
      case 'hiss': noise(t, 0.5, 0.05, sfxBus, 2600, 'bandpass'); tone(t, 90, 0.4, 'sawtooth', 0.03, sfxBus, 60); break; // phase 4: it's close now
      case 'click2': tone(t, 1300, 0.015, 'square', 0.03, sfxBus); tone(t + 0.07, 1100, 0.015, 'square', 0.03, sfxBus); break; // its joints, nearer
      case 'sting': { // phase 4 scares: a dissonant stab after a hush
        [0, 1, 6, 11].forEach((st) => tone(t, midi(57 + st), 0.9, 'sawtooth', 0.035, sfxBus, midi(57 + st) * 0.94));
        noise(t, 0.35, 0.09, sfxBus, 1800, 'bandpass'); tone(t, 70, 0.6, 'square', 0.06, sfxBus, 40);
        break;
      }
      case 'whisper': noise(t, 0.9, 0.03, sfxBus, 3200, 'bandpass'); noise(t + 0.25, 0.7, 0.025, sfxBus, 2400, 'bandpass'); break;
      case 'honk': tone(t, 230, 0.18, 'square', 0.07, sfxBus, 200); tone(t + 0.2, 180, 0.3, 'square', 0.07, sfxBus, 150); break;
      case 'creak': tone(t, 90, 0.9, 'sawtooth', 0.025, sfxBus, 140); noise(t, 0.8, 0.02, sfxBus, 400, 'bandpass'); break;
      case 'roar': tone(t, 220, 0.45, 'sawtooth', 0.05, sfxBus, 70, dt); noise(t, 0.35, 0.05, sfxBus, 500, 'lowpass'); break;
      case 'flame': noise(t, 0.16, 0.035 * vv, sfxBus, 900, 'lowpass'); break;
      case 'holy': tone(t, 880, 0.08, 'sine', 0.05 * vv, sfxBus, 1320, dt); noise(t, 0.06, 0.03, sfxBus, 4000); break;
      case 'salt': noise(t, 0.07, 0.07 * vv, sfxBus, 3000, 'highpass'); tone(t, 220, 0.06, 'square', 0.03, sfxBus, 110, dt); break;
      case 'warn':
        tone(t, 1040, 0.07, 'square', 0.05, sfxBus);
        tone(t + 0.1, 1040, 0.07, 'square', 0.05, sfxBus);
        break;
      case 'scream':
        tone(t, 1400, 0.7, 'sawtooth', 0.05 * vv, sfxBus, 300, dt);
        tone(t, 1480, 0.7, 'sawtooth', 0.04 * vv, sfxBus, 320, dt);
        noise(t, 0.5, 0.06, sfxBus, 2500, 'bandpass');
        break;
      case 'hand':
        tone(t, 120, 0.2, 'square', 0.08 * vv, sfxBus, 50, dt);
        noise(t, 0.2, 0.12 * vv, sfxBus, 600, 'lowpass');
        break;
      case 'swoosh': noise(t, 0.25, 0.05 * vv, sfxBus, rand(700, 1100), 'bandpass'); break;
      case 'close':
        tone(t, 1500, 0.08, 'triangle', 0.06, sfxBus, 2400);
        noise(t, 0.12, 0.05, sfxBus, 5000);
        break;
      case 'hit':
        noise(t, 0.3, 0.2, sfxBus, 800, 'lowpass');
        tone(t, 300, 0.5, 'square', 0.08, sfxBus, 50);
        break;
      case 'shield':
        tone(t, 600, 0.3, 'triangle', 0.1, sfxBus, 1200);
        noise(t, 0.2, 0.08, sfxBus, 4000);
        break;
      case 'rebirth':
        [0, 7, 12, 19].forEach((st, i) => tone(t + i * 0.08, midi(64 + st), 0.25, 'triangle', 0.08, sfxBus));
        noise(t, 0.4, 0.05, sfxBus, 3000);
        break;
      case 'rush':
        [0, 3, 7, 12, 15, 19, 24].forEach((st, i) => tone(t + i * 0.04, midi(60 + st), 0.14, 'sawtooth', 0.04, sfxBus));
        noise(t, 0.5, 0.08, sfxBus, 2000, 'bandpass');
        break;
      case 'soul':
        tone(t, 660, 0.2, 'sine', 0.07, sfxBus, 1320);
        tone(t + 0.08, 990, 0.25, 'triangle', 0.05, sfxBus, 1980);
        break;
      case 'letter': tone(t, 784, 0.12, 'square', 0.05, sfxBus); tone(t + 0.1, 1175, 0.18, 'square', 0.05, sfxBus); break;
      case 'boo':
        [0, 4, 7, 12, 16].forEach((st, i) => tone(t + i * 0.07, midi(67 + st), 0.2, 'square', 0.05, sfxBus));
        tone(t, 110, 0.6, 'sawtooth', 0.06, sfxBus, 55);
        break;
      case 'powerup': [0, 5, 9, 14].forEach((st, i) => tone(t + i * 0.05, midi(72 + st), 0.12, 'triangle', 0.07, sfxBus)); break;
      case 'powerdown': tone(t, 700, 0.3, 'triangle', 0.06, sfxBus, 250); break;
      case 'mission':
        tone(t, midi(76), 0.1, 'square', 0.05, sfxBus); tone(t + 0.1, midi(83), 0.25, 'square', 0.05, sfxBus);
        break;
      case 'levelup': [0, 4, 7, 12, 7, 12, 16].forEach((st, i) => tone(t + i * 0.09, midi(64 + st), 0.2, 'triangle', 0.08, sfxBus)); break;
      case 'laserCharge': tone(t, 200, 1.4, 'sawtooth', 0.025, sfxBus, 900); break;
      case 'laserFire': noise(t, 0.9, 0.08, sfxBus, 1800, 'bandpass'); tone(t, 140, 0.9, 'square', 0.04, sfxBus, 120); break;
      case 'thunder': noise(t, 1.8, 0.14, sfxBus, 180, 'lowpass'); break;
      case 'ghoul': tone(t, rand(900, 1200), 0.18, 'square', 0.035, sfxBus, 1700, dt); break;
      case 'grab': noise(t, 0.3, 0.08, sfxBus, 1200, 'bandpass'); tone(t, 330, 0.3, 'sine', 0.08, sfxBus, 660); break;
      case 'tick': tone(t, 1800, 0.02, 'square', 0.02, sfxBus); break;
      case 'win': [0, 4, 7, 12].forEach((st, i) => tone(t + i * 0.06, midi(76 + st), 0.16, 'square', 0.05, sfxBus)); break;
      case 'lose': tone(t, 300, 0.25, 'triangle', 0.05, sfxBus, 150); break;
      case 'gift': [0, 7, 12, 16, 19].forEach((st, i) => tone(t + i * 0.07, midi(72 + st), 0.2, 'triangle', 0.07, sfxBus)); break;
      case 'bounce': tone(t, 140, 0.1, 'square', 0.06 * vv, sfxBus, 70, dt); break;
      case 'buy': [0, 4, 7, 12].forEach((s, i) => tone(t + i * 0.07, midi(72 + s), 0.12, 'square', 0.05, sfxBus)); break;
      case 'deny': tone(t, 200, 0.15, 'square', 0.06, sfxBus, 150); break;
      case 'click': tone(t, 660, 0.05, 'square', 0.04, sfxBus, null, dt); break;
      case 'move': tone(t, 520, 0.04, 'square', 0.03, sfxBus, null, dt); break;
      case 'zone':
        tone(t, 110, 1.2, 'triangle', 0.15, sfxBus, 90);
        tone(t, 165, 1.2, 'sine', 0.08, sfxBus, 130);
        break;
      case 'comboUp': {
        const k = Math.min(5, opts.tier || 2);
        [0, 4, 7, 12].forEach((st, i) => tone(t + i * 0.045, midi(64 + k * 2 + st), 0.14, 'square', 0.045, sfxBus));
        noise(t, 0.25, 0.04, sfxBus, 6000);
        break;
      }
      case 'comboEnd': tone(t, midi(84), 0.12, 'triangle', 0.05, sfxBus); tone(t + 0.08, midi(91), 0.2, 'triangle', 0.05, sfxBus); break;
      case 'splat': noise(t, 0.05, 0.035 * vv, sfxBus, rand(500, 900), 'lowpass'); break;
      case 'unlock': [0, 7, 12, 16, 19, 24].forEach((st, i) => tone(t + i * 0.08, midi(67 + st), 0.25, 'triangle', 0.07, sfxBus)); noise(t, 0.6, 0.04, sfxBus, 5000); break;
      case 'best': [0, 3, 7, 10, 15].forEach((s, i) => tone(t + i * 0.09, midi(69 + s), 0.18, 'triangle', 0.08, sfxBus)); break;
    }
  },
};
