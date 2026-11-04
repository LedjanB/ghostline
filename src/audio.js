// Music and SFX, synthesized with Web Audio (audio-design skill):
// buses (music -> duck -> master, sfx -> master), limiter on master for headroom,
// squared slider -> gain, adaptive music layers, varied one-shots, capped polyphony.
import { Save } from './save.js';

let ctx = null;
let master, limiter, musicBus, duckBus, sfxBus, ambBus, noiseBuf;
let ambience = null; // current zone ambience
let ambNodes = [];
let nextAmbEvent = 0;
let layerBase, layerDrive, layerDanger;
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

// Each song: base layer (bass + lead), drive layer (drums + arp, fades in with speed),
// danger layer (low pulse while a banshee warning is up).
const SONGS = {
  menu: {
    bpm: 84,
    bass: seq('A2 . . . . . . . F2 . . . . . . . D2 . . . . . . . E2 . . . . . . .'),
    lead: seq('A5 . E5 . C5 . E5 . A5 . E5 . C5 . B4 . F5 . C5 . A4 . C5 . F5 . E5 . D5 . G#4 . B4 . E5 . G#5 . E5 . B4 . D5 . C5 . B4 .'),
    arp: null,
    leadWave: 'triangle', leadVol: 0.07, bassVol: 0.09, root: 'A3',
  },
  hospital: {
    bpm: 112,
    bass: seq('A2 . A2 . E2 . A2 . F2 . F2 . E2 . E2 .'),
    lead: seq('A4 C5 E5 . D5 C5 B4 . A4 . E4 . G#4 . . . A4 C5 E5 . F5 E5 D5 . C5 B4 A4 . G#4 . . .'),
    arp: seq('A5 E5 C6 E5 A5 E5 C6 E5 F5 C5 A5 C5 E5 B4 G#5 B4'),
    leadWave: 'square', leadVol: 0.035, bassVol: 0.11, root: 'A2',
  },
  forest: {
    bpm: 98,
    bass: seq('D2 . . . A1 . . . A#1 . . . A1 . . .'),
    lead: seq('D5 . F5 . A5 . G5 F5 E5 . C#5 . D5 . . . A4 . D5 . F5 . E5 D5 C#5 . E5 . A4 . . .'),
    arp: seq('D6 A5 F5 A5 D6 A5 F5 A5 A#5 F5 D5 F5 A5 E5 C#5 E5'),
    leadWave: 'triangle', leadVol: 0.07, bassVol: 0.12, root: 'D2',
  },
  sewer: {
    bpm: 128,
    bass: seq('E2 E2 . E2 F2 . E2 . E2 E2 . G2 F2 . E2 .'),
    lead: seq('E5 . F5 E5 . B4 . . E5 . G5 F5 E5 . . . B4 . C5 B4 . A4 . G4 F4 . . E4 . . . .'),
    arp: seq('E6 B5 G5 B5 F6 C6 A5 C6 E6 B5 G5 B5 D6 A5 F5 A5'),
    leadWave: 'square', leadVol: 0.03, bassVol: 0.12, root: 'E2',
  },
};

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
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
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
  const song = SONGS[songName];
  const sixteenth = 60 / song.bpm / 4;
  if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
  while (nextTime < ctx.currentTime + 0.12) {
    const t = nextTime;
    const b = song.bass[step % song.bass.length];
    if (b) tone(t, midi(b), sixteenth * 1.8, 'triangle', song.bassVol, layerBase);
    const l = song.lead[step % song.lead.length];
    if (l) tone(t, midi(l), sixteenth * 1.6, song.leadWave, song.leadVol, layerBase);
    if (song.arp) {
      const a = song.arp[step % song.arp.length];
      if (a && step % 2 === 0) tone(t, midi(a), sixteenth * 0.9, 'square', 0.018, layerDrive);
      if (step % 2 === 0) noise(t, 0.03, step % 4 === 0 ? 0.05 : 0.025, layerDrive, 7000);
      if (step % 8 === 4) noise(t, 0.12, 0.06, layerDrive, 1200, 'bandpass');
      if (step % 8 === 0) tone(t, 90, 0.12, 'sine', 0.16, layerDrive, 45);
      // danger: low throbbing root on every beat
      if (step % 4 === 0) tone(t, midi(N[song.root] - 12) || 55, sixteenth * 3, 'sawtooth', 0.05, layerDanger);
    }
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
  if (name === 'hospital') ambNodes = loopNoise(2500, 'highpass', 0.05, 0.5); // rain on windows
  if (name === 'forest') ambNodes = loopNoise(420, 'bandpass', 0.09, 0.8, 0.13, 0.06); // wind gusts
  if (name === 'sewer') ambNodes = loopNoise(140, 'lowpass', 0.16, 1, 0.07, 0.05); // low rumble
  ambBus.gain.setTargetAtTime(name ? 1 : 0, ctx.currentTime, 0.6);
  nextAmbEvent = ctx.currentTime + 1;
}
function scheduleAmbience() {
  if (!ambience || ctx.currentTime < nextAmbEvent) return;
  const t = ctx.currentTime + 0.02;
  if (ambience === 'hospital') { // distant heart monitor
    tone(t, 1000, 0.08, 'sine', 0.015, ambBus);
    nextAmbEvent = t + 1.4;
  } else if (ambience === 'forest') { // crickets + the odd owl
    if (Math.random() < 0.15) { tone(t, 420, 0.25, 'sine', 0.03, ambBus, 380); tone(t + 0.35, 400, 0.4, 'sine', 0.03, ambBus, 350); }
    else for (let i = 0; i < 3; i++) tone(t + i * 0.06, 4200, 0.03, 'square', 0.006, ambBus);
    nextAmbEvent = t + rand(0.6, 1.6);
  } else if (ambience === 'sewer') { // water drips
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
      case 'best': [0, 3, 7, 10, 15].forEach((s, i) => tone(t + i * 0.09, midi(69 + s), 0.18, 'triangle', 0.08, sfxBus)); break;
    }
  },
};
