// THE WRONG SIDE OF THE BED: the opening's soundscape (audio-design skill).
// Loops: rain, ventilation, a quiet supernatural pad, the cold drone, the lantern's hum.
// One-shots: monitor beep, power failure, relay clunk, the rise, hand through, the Ghostline,
// distant keys, curtain, thunder, match strike, text blips. All on the SFX bus (volume setting applies).
import { Audio } from './audio.js';

const NOOP = new Proxy({}, { get: () => () => {} });

export function makeOpeningAudio() {
  const raw = Audio.raw();
  if (!raw) return NOOP;
  const { ctx, out, noiseBuf } = raw;
  const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(out);
  const nodes = [];
  const now = () => ctx.currentTime + 0.01;
  const set = (param, v, tc = 0.2, at = now()) => { param.cancelScheduledValues(at); param.setTargetAtTime(v, at, tc); };

  function noiseLoop(freq, type, q, vol, dest = bus) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(dest); s.start(0, Math.random());
    nodes.push(s, f, g);
    return { s, f, g };
  }
  function osc(freq, wave, vol, dest = bus) {
    const o = ctx.createOscillator(); o.type = wave; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    o.connect(g); g.connect(dest); o.start();
    nodes.push(o, g);
    return { o, g };
  }
  function lfo(rate, depth, param) {
    const o = ctx.createOscillator(); o.frequency.value = rate;
    const g = ctx.createGain(); g.gain.value = depth;
    o.connect(g); g.connect(param); o.start();
    nodes.push(o, g);
  }
  // one-shots
  function tone(t, f, dur, wave, vol, slide, dest = bus, attack = 0.008) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = wave; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
    o.onended = () => g.disconnect();
  }
  function hiss(t, dur, vol, freq, type = 'bandpass', q = 1, sweepTo = 0, dest = bus, attack = 0.005) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    s.onended = () => g.disconnect();
  }
  // a little room: everything distant goes through a short feedback echo
  const far = ctx.createGain(); far.gain.value = 1;
  const farLp = ctx.createBiquadFilter(); farLp.type = 'lowpass'; farLp.frequency.value = 1600;
  const dl = ctx.createDelay(1); dl.delayTime.value = 0.17;
  const fb = ctx.createGain(); fb.gain.value = 0.35;
  far.connect(farLp); farLp.connect(bus); farLp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(bus);
  nodes.push(far, farLp, dl, fb);

  // ---- loops ----
  const rainBus = ctx.createGain(); rainBus.gain.value = 0; rainBus.connect(bus);
  const rainLp = ctx.createBiquadFilter(); rainLp.type = 'lowpass'; rainLp.frequency.value = 9000; rainLp.connect(rainBus);
  nodes.push(rainBus, rainLp);
  noiseLoop(3200, 'highpass', 0.4, 0.05, rainLp); // hiss on the glass
  const patter = noiseLoop(1100, 'bandpass', 0.7, 0.035, rainLp);
  lfo(0.13, 0.012, patter.g.gain);
  const vent = noiseLoop(240, 'lowpass', 0.9, 0, bus);
  const ventTone = osc(58, 'sine', 0, bus);
  lfo(0.07, 0.006, vent.g.gain);
  const padBus = ctx.createGain(); padBus.gain.value = 0; padBus.connect(bus); nodes.push(padBus);
  [110, 164.8, 220.6, 329.2].forEach((f, i) => { const o = osc(f, 'sine', 0.012 - i * 0.002, padBus); lfo(0.05 + i * 0.03, 1.2, o.o.detune); });
  noiseLoop(2600, 'bandpass', 7, 0.012, padBus);
  const coldBus = ctx.createGain(); coldBus.gain.value = 0; coldBus.connect(bus); nodes.push(coldBus);
  const drone = osc(41, 'sawtooth', 0.05, coldBus);
  lfo(0.3, 3, drone.o.detune);
  const droneLp = ctx.createBiquadFilter(); droneLp.type = 'lowpass'; droneLp.frequency.value = 160;
  drone.g.disconnect(); drone.g.connect(droneLp); droneLp.connect(coldBus); nodes.push(droneLp);
  const whistle = noiseLoop(2300, 'bandpass', 14, 0.03, coldBus);
  lfo(0.21, 300, whistle.f.frequency);
  const humBus = ctx.createGain(); humBus.gain.value = 0; humBus.connect(bus); nodes.push(humBus);
  osc(98, 'triangle', 0.03, humBus); osc(147, 'triangle', 0.018, humBus); osc(196.5, 'sine', 0.01, humBus);
  // the first encounter: a presence you feel more than hear (two low sines beating against each other + a sub)
  const presBus = ctx.createGain(); presBus.gain.value = 0; presBus.connect(bus); nodes.push(presBus);
  const presLp = ctx.createBiquadFilter(); presLp.type = 'lowpass'; presLp.frequency.value = 120; presLp.connect(presBus); nodes.push(presLp);
  osc(36, 'sine', 0.09, presLp); osc(37.6, 'sine', 0.08, presLp); osc(27, 'sine', 0.07, presLp);
  const presAir = noiseLoop(90, 'lowpass', 0.7, 0.05, presLp);
  lfo(0.19, 0.02, presAir.g.gain);

  let ventOn = false;
  const api = {
    rain(v, muffled = false, tc = 0.6) { set(rainBus.gain, v, tc); set(rainLp.frequency, muffled ? 900 : 9000, 0.4); },
    vent(on, { abrupt = false, weak = false } = {}) {
      ventOn = on;
      const t = now();
      if (abrupt) { vent.g.gain.cancelScheduledValues(t); vent.g.gain.setValueAtTime(0, t); ventTone.g.gain.cancelScheduledValues(t); ventTone.g.gain.setValueAtTime(0, t); hiss(t, 0.05, 0.03, 300, 'lowpass'); return; }
      set(vent.g.gain, on ? (weak ? 0.035 : 0.05) : 0, 0.5);
      set(ventTone.g.gain, on ? (weak ? 0.012 : 0.018) : 0, 0.5);
      set(ventTone.o.frequency, weak ? 52 : 58, 0.6);
    },
    pad(v, tc = 1.2) { set(padBus.gain, v, tc); },
    cold(v, tc = 1) { set(coldBus.gain, v, tc); },
    hum(v, tc = 0.3) { set(humBus.gain, v, tc); },

    presence(v, tc = 1.5) { set(presBus.gain, v, tc); },
    beep({ battery = false, loud = false, urgent = false } = {}) {
      const t = now();
      if (urgent) { tone(t, 1180, 0.07, 'sine', 0.06); tone(t, 59, 0.14, 'sine', 0.07, 40); return; }
      tone(t, battery ? 940 : 980, 0.09, 'sine', loud ? 0.07 : 0.045);
      if (loud) tone(t, 60, 0.18, 'sine', 0.06, 40); // a low thump under it: his heart
    },
    flip() { const t = now(); tone(t, 2200, 0.012, 'square', 0.02); tone(t + 0.04, 1500, 0.012, 'square', 0.015); },
    // the power dies: a buzz that stutters with the lamps, a thunk, the vent sags
    fail() {
      const t = now();
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 100;
      const g = ctx.createGain(); g.gain.value = 0;
      [[0, 0.04], [0.12, 0], [0.2, 0.05], [0.3, 0], [0.42, 0.035], [0.5, 0.06], [0.62, 0]].forEach(([dt, v]) => g.gain.setValueAtTime(v, t + dt));
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.7);
      for (let i = 0; i < 6; i++) hiss(t + i * 0.1 + Math.random() * 0.05, 0.04, 0.05, 3000 + Math.random() * 2000, 'bandpass', 2);
      hiss(t + 0.62, 0.35, 0.12, 180, 'lowpass');
      tone(t + 0.62, 90, 0.4, 'sine', 0.08, 35);
      set(vent.g.gain, 0.008, 0.25, t + 0.62); set(ventTone.o.frequency, 30, 0.4, t + 0.62); set(ventTone.g.gain, 0.004, 0.3, t + 0.62);
    },
    batteryChirp() { const t = now(); tone(t, 1320, 0.05, 'square', 0.02); tone(t + 0.09, 1320, 0.05, 'square', 0.02); },
    clunk() { const t = now(); hiss(t, 0.08, 0.08, 900, 'bandpass', 1.5); tone(t, 140, 0.12, 'square', 0.03, 70); tone(t + 0.1, 120, 1.2, 'sine', 0.025, 118, bus, 0.2); },
    // the rise: a cluster that swells slowly, air under it
    rise() {
      const t = now();
      [440, 523.3, 659.3, 784, 987.8].forEach((f, i) => tone(t + i * 0.18, f, 3.2 - i * 0.2, 'sine', 0.014, f * 1.06, bus, 1.1));
      hiss(t, 3, 0.03, 1800, 'bandpass', 3, 4200, bus, 1.4);
    },
    through() { const t = now(); hiss(t, 0.5, 0.09, 500, 'lowpass', 1, 120); tone(t, 220, 0.6, 'sine', 0.06, 55); tone(t + 0.05, 1760, 0.4, 'sine', 0.01, 880); },
    line() {
      const t = now();
      tone(t, 2637, 0.25, 'sine', 0.025); tone(t + 0.02, 3951, 0.18, 'sine', 0.012);
      const o = ctx.createOscillator(); o.frequency.value = 1760; const g = ctx.createGain(); g.gain.value = 0;
      const v = ctx.createOscillator(); v.frequency.value = 6; const vg = ctx.createGain(); vg.gain.value = 14;
      v.connect(vg); vg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.02, t + 0.3); g.gain.setTargetAtTime(0.0001, t + 1.2, 0.4);
      o.frequency.setTargetAtTime(880, t + 0.6, 0.8); // it bends down, into the floor
      o.connect(g); g.connect(bus); o.start(t); v.start(t); o.stop(t + 3); v.stop(t + 3);
    },
    // v2 Ghostline: a thin glassy shimmer that travels (wrist to wrist), a tiny tick at his living wrist,
    // then a falling tone that sinks into the floor. Delicate, no music.
    pulse() {
      const t = now();
      [1975.5, 2637, 3520].forEach((f, i) => tone(t + i * 0.16, f, 0.9 - i * 0.15, 'sine', 0.012 - i * 0.003, f * 1.02, bus, 0.12));
      hiss(t, 0.8, 0.012, 5200, 'bandpass', 9, 7000, bus, 0.3);
    },
    tick() { const t = now(); tone(t, 3951, 0.18, 'sine', 0.02); tone(t + 0.01, 1318.5, 0.3, 'sine', 0.01); },
    descend() {
      const t = now();
      const o = ctx.createOscillator(); o.frequency.value = 1568; const g = ctx.createGain(); g.gain.value = 0;
      const v = ctx.createOscillator(); v.frequency.value = 7; const vg = ctx.createGain(); vg.gain.value = 10;
      v.connect(vg); vg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.014, t + 0.15); g.gain.setTargetAtTime(0.0001, t + 0.9, 0.35);
      o.frequency.exponentialRampToValueAtTime(392, t + 1.3);
      o.connect(g); g.connect(far); o.start(t); v.start(t); o.stop(t + 2.6); v.stop(t + 2.6);
    },
    door() { const t = now(); tone(t, 70, 1.4, 'sawtooth', 0.012, 110, far, 0.3); hiss(t + 0.2, 1.0, 0.02, 700, 'bandpass', 2, 400, far, 0.3); },
    bump() { const t = now(); tone(t, 75, 0.2, 'sine', 0.06, 50); hiss(t, 0.08, 0.03, 300, 'lowpass'); },
    keys(v = 0.5) { const t = now(); for (let i = 0; i < 5; i++) tone(t + i * 0.045 + Math.random() * 0.02, 2400 + Math.random() * 1200, 0.025, 'square', 0.03 * v, null, far); },
    curtain(v = 1) { const t = now(); hiss(t, 0.7, 0.05 * v, 1600, 'bandpass', 0.8, 900, bus, 0.15); },
    creak() { const t = now(); tone(t, 85, 1.1, 'sawtooth', 0.02, 130, far, 0.2); },
    thunder(v = 1) { const t = now(); hiss(t, 2.6, 0.14 * v, 140, 'lowpass', 1, 60, bus, 0.25); hiss(t + 0.1, 1.2, 0.05 * v, 500, 'lowpass', 1, 150, bus, 0.05); },
    breath(v = 1) { const t = now(); hiss(t, 1.1, 0.04 * v, 600, 'bandpass', 2, 380, far, 0.4); },
    strike() { const t = now(); hiss(t, 0.09, 0.09, 4200, 'highpass', 0.7); hiss(t + 0.03, 0.06, 0.06, 6000, 'highpass', 0.7); },
    ignite() { const t = now(); hiss(t, 0.6, 0.09, 300, 'bandpass', 1.2, 1500, bus, 0.04); tone(t, 196, 0.8, 'triangle', 0.04, 220, bus, 0.1); tone(t + 0.12, 2637, 0.4, 'sine', 0.012); },
    recoil() { const t = now(); hiss(t, 0.7, 0.07, 2400, 'bandpass', 3, 900); tone(t, 70, 0.6, 'sawtooth', 0.04, 40); },
    lunge() { const t = now(); hiss(t, 0.35, 0.06, 400, 'lowpass', 1, 200); tone(t, 55, 0.4, 'sawtooth', 0.04, 45); },
    // ---- the first encounter (THE STRETCH's shadow, Boo's lantern) ----
    // keys behind the curtain: a few clicks, never in rhythm
    keysOdd(v = 0.5) { const t = now(); const n = 2 + Math.floor(Math.random() * 3); let dt = 0; for (let i = 0; i < n; i++) { dt += 0.04 + Math.random() * 0.14; tone(t + dt, 2200 + Math.random() * 1600, 0.03, 'square', 0.028 * v, null, far); } },
    // fingertips on plaster: dry little ticks, far away
    crawl(v = 0.5) { const t = now(); for (let i = 0; i < 3; i++) hiss(t + i * 0.07 + Math.random() * 0.03, 0.03, 0.03 * v, 2600 + Math.random() * 1500, 'bandpass', 6, 0, far); },
    // the door swings shut by itself
    slam() { const t = now(); tone(t, 90, 0.9, 'sawtooth', 0.012, 60, far, 0.25); hiss(t + 0.75, 0.25, 0.09, 220, 'lowpass'); tone(t + 0.75, 70, 0.35, 'sine', 0.09, 38); },
    // it has him: a cold grip and a crack of frost
    grip() { const t = now(); tone(t, 48, 0.9, 'sawtooth', 0.05, 30); hiss(t, 0.5, 0.06, 3200, 'highpass', 0.7, 0, bus, 0.01); for (let i = 0; i < 5; i++) hiss(t + 0.05 + i * 0.05, 0.02, 0.05, 4500, 'bandpass', 4); },
    // a match from the corridor (far, small)
    farStrike() { const t = now(); hiss(t, 0.09, 0.07, 4200, 'highpass', 0.7, 0, far); hiss(t + 0.03, 0.06, 0.05, 6000, 'highpass', 0.7, 0, far); tone(t + 0.1, 196, 0.5, 'triangle', 0.015, 210, far, 0.08); },
    // the lantern flares: air rushes into the flame, a warm swell
    flare() { const t = now(); hiss(t, 0.9, 0.12, 250, 'bandpass', 0.9, 1800, bus, 0.05); tone(t, 146.8, 1.6, 'triangle', 0.05, 196, bus, 0.08); tone(t + 0.05, 293.7, 1.4, 'sine', 0.025, 392, bus, 0.1); tone(t + 0.1, 2349, 0.6, 'sine', 0.012); },
    // the shadow burns back from the light: a hiss that tears downward, a low groan under it, crackle
    burn() {
      const t = now();
      hiss(t, 1.1, 0.13, 5200, 'bandpass', 2.5, 600, bus, 0.01);
      tone(t, 92, 1.2, 'sawtooth', 0.05, 33);
      tone(t + 0.04, 61, 1.0, 'sawtooth', 0.035, 29);
      for (let i = 0; i < 9; i++) hiss(t + 0.05 + Math.random() * 0.8, 0.02, 0.06, 3000 + Math.random() * 3000, 'bandpass', 5);
    },
    blip(pitch) { const t = now(); tone(t, pitch, 0.035, 'square', 0.014); },
    jump() { const t = now(); hiss(t, 0.18, 0.025, 1200, 'bandpass', 2, 2400); },
    land() { const t = now(); hiss(t, 0.1, 0.02, 500, 'lowpass'); },
    // fade the whole opening out (end panel, leaving the scene)
    fade(v, tc = 0.5) { set(bus.gain, v, tc); },
    stop() {
      try { bus.gain.setTargetAtTime(0, ctx.currentTime, 0.1); } catch (e) { /* closed */ }
      setTimeout(() => nodes.forEach((n) => { try { n.stop && n.stop(); } catch (e) { /* already stopped */ } try { n.disconnect(); } catch (e) { /* ignore */ } }), 600);
      setTimeout(() => { try { bus.disconnect(); } catch (e) { /* ignore */ } }, 700);
    },
    get ventOn() { return ventOn; },
  };
  return api;
}
