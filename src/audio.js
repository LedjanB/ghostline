// Music and sound effects, all synthesized with the Web Audio API (no sound files).
import { Save } from './save.js';

let ctx = null;
let master, musicBus, sfxBus, noiseBuf;
let songName = null;
let step = 0;
let nextTime = 0;
let timer = null;

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// note names -> midi numbers
const N = {};
['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach((name, i) => {
  for (let o = 0; o < 8; o++) N[name + o] = 12 * (o + 1) + i;
});
const seq = (s) => s.split(' ').map((t) => (t === '.' ? null : N[t]));

const SONGS = {
  menu: {
    bpm: 84,
    bass: seq('A2 . . . . . . . F2 . . . . . . . D2 . . . . . . . E2 . . . . . . .'),
    lead: seq('A5 . E5 . C5 . E5 . A5 . E5 . C5 . B4 . F5 . C5 . A4 . C5 . F5 . E5 . D5 . G#4 . B4 . E5 . G#5 . E5 . B4 . D5 . C5 . B4 .'),
    leadWave: 'triangle', leadVol: 0.07, bassVol: 0.09, hat: false,
  },
  hospital: {
    bpm: 112,
    bass: seq('A2 . A2 . E2 . A2 . F2 . F2 . E2 . E2 .'),
    lead: seq('A4 C5 E5 . D5 C5 B4 . A4 . E4 . G#4 . . . A4 C5 E5 . F5 E5 D5 . C5 B4 A4 . G#4 . . .'),
    leadWave: 'square', leadVol: 0.035, bassVol: 0.11, hat: true,
  },
  forest: {
    bpm: 98,
    bass: seq('D2 . . . A1 . . . A#1 . . . A1 . . .'),
    lead: seq('D5 . F5 . A5 . G5 F5 E5 . C#5 . D5 . . . A4 . D5 . F5 . E5 D5 C#5 . E5 . A4 . . .'),
    leadWave: 'triangle', leadVol: 0.07, bassVol: 0.12, hat: true,
  },
  sewer: {
    bpm: 128,
    bass: seq('E2 E2 . E2 F2 . E2 . E2 E2 . G2 F2 . E2 .'),
    lead: seq('E5 . F5 E5 . B4 . . E5 . G5 F5 E5 . . . B4 . C5 B4 . A4 . G4 F4 . . E4 . . . .'),
    leadWave: 'square', leadVol: 0.03, bassVol: 0.12, hat: true,
  },
};

function init() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = Save.get().muted ? 0 : 1;
  master.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.8; musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  timer = setInterval(schedule, 25);
}

function unlock() {
  init();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);
window.addEventListener('touchstart', unlock);

function tone(t, freq, dur, wave, vol, bus, slideTo) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = wave;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(t, dur, vol, bus, freq = 3000, type = 'highpass') {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(bus);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

function schedule() {
  if (!ctx || !songName) return;
  const song = SONGS[songName];
  const sixteenth = 60 / song.bpm / 4;
  if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
  while (nextTime < ctx.currentTime + 0.12) {
    const b = song.bass[step % song.bass.length];
    if (b) tone(nextTime, midi(b), sixteenth * 1.8, 'triangle', song.bassVol, musicBus);
    const l = song.lead[step % song.lead.length];
    if (l) tone(nextTime, midi(l), sixteenth * 1.6, song.leadWave, song.leadVol, musicBus);
    if (song.hat && step % 2 === 0) noise(nextTime, 0.03, step % 4 === 0 ? 0.05 : 0.025, musicBus, 7000);
    if (song.hat && step % 8 === 4) noise(nextTime, 0.12, 0.06, musicBus, 1200, 'bandpass');
    nextTime += sixteenth;
    step++;
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
  stopMusic() { songName = null; },
  duck(on) {
    if (!ctx) return;
    musicBus.gain.setTargetAtTime(on ? 0.25 : 0.8, ctx.currentTime, 0.1);
  },
  setMuted(m) {
    Save.update((s) => { s.muted = m; });
    if (ctx) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.02);
  },
  muted: () => Save.get().muted,
  sfx(name) {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.005;
    switch (name) {
      case 'candle':
        tone(t, 880, 0.08, 'square', 0.05, sfxBus);
        tone(t + 0.05, 1320, 0.12, 'square', 0.05, sfxBus);
        break;
      case 'float':
        tone(t, 260, 0.25, 'sine', 0.06, sfxBus, 420);
        break;
      case 'warn':
        tone(t, 1040, 0.07, 'square', 0.05, sfxBus);
        tone(t + 0.1, 1040, 0.07, 'square', 0.05, sfxBus);
        break;
      case 'scream':
        tone(t, 1400, 0.7, 'sawtooth', 0.05, sfxBus, 300);
        tone(t, 1480, 0.7, 'sawtooth', 0.04, sfxBus, 320);
        noise(t, 0.5, 0.06, sfxBus, 2500, 'bandpass');
        break;
      case 'hand':
        tone(t, 120, 0.2, 'square', 0.08, sfxBus, 50);
        noise(t, 0.2, 0.12, sfxBus, 600, 'lowpass');
        break;
      case 'swoosh':
        noise(t, 0.25, 0.05, sfxBus, 900, 'bandpass');
        break;
      case 'hit':
        noise(t, 0.3, 0.2, sfxBus, 800, 'lowpass');
        tone(t, 300, 0.5, 'square', 0.08, sfxBus, 50);
        break;
      case 'shield':
        tone(t, 600, 0.3, 'triangle', 0.1, sfxBus, 1200);
        noise(t, 0.2, 0.08, sfxBus, 4000);
        break;
      case 'bounce':
        tone(t, 140, 0.1, 'square', 0.06, sfxBus, 70);
        break;
      case 'buy':
        [0, 4, 7, 12].forEach((s, i) => tone(t + i * 0.07, midi(72 + s), 0.12, 'square', 0.05, sfxBus));
        break;
      case 'deny':
        tone(t, 200, 0.15, 'square', 0.06, sfxBus, 150);
        break;
      case 'click':
        tone(t, 660, 0.05, 'square', 0.04, sfxBus);
        break;
      case 'zone':
        tone(t, 110, 1.2, 'triangle', 0.15, sfxBus, 90);
        tone(t, 165, 1.2, 'sine', 0.08, sfxBus, 130);
        break;
      case 'best':
        [0, 3, 7, 10, 15].forEach((s, i) => tone(t + i * 0.09, midi(69 + s), 0.18, 'triangle', 0.08, sfxBus));
        break;
    }
  },
};
