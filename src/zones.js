// The journey: 8 zones in a fixed order, each a one-way step deeper into the night.
// Every zone is 5 parallax layers painted in code (sky, far, mid, near, edge) plus a gate
// set piece you fly through to reach the next one. Art rules live in docs/art-direction.md:
// dithered gradients, atmospheric perspective (far layers lighter and hazier), one accent
// light color per zone, actors outlined but backgrounds never.

export const ZONE_LENGTH_M = 400;

export const ZONES = [
  {
    id: 'ward', name: 'ST. MERCY WARD', flavor: '3:33 AM. THE LIGHTS ARE DYING.', song: 'ward',
    swing: 'lamp', weather: 'dust', ghoul: 0xffffff, giant: 'shadow', accent: 0xb8d8ff, // v6: off the hazard green
  },
  {
    id: 'morgue', name: 'THE COLD ROOM', flavor: 'EVERYONE HERE IS VERY QUIET.', song: 'morgue',
    swing: 'hook', weather: 'frost', ghoul: 0xb8d8ff, giant: 'shadow', accent: 0x9fe8ff,
  },
  {
    id: 'woods', name: 'THE HOLLOW WOODS', flavor: 'THE TREES ARE WATCHING. REALLY.', song: 'woods',
    swing: 'axe', weather: 'fireflies', ghoul: 0xd0c0ff, giant: 'eyes', accent: 0xffd75e,
  },
  {
    id: 'graveyard', name: 'CROWSREST CEMETERY', flavor: 'BLOOD MOON. OF COURSE.', song: 'graveyard',
    swing: 'axe', weather: 'leaves', ghoul: 0xffb0b0, giant: 'eyes', accent: 0xff6b6b,
  },
  {
    id: 'sewer', name: 'THE DRIPPING DARK', flavor: 'DO NOT LICK ANYTHING.', song: 'sewer',
    swing: 'hook', weather: 'drips', ghoul: 0xb0ffb0, giant: 'tentacle', accent: 0x9cff6b,
  },
  {
    id: 'catacombs', name: 'THE BONE HALLS', flavor: 'SIX MILLION ROOMMATES.', song: 'catacombs',
    swing: 'lamp', weather: 'embers', ghoul: 0xffd8a0, giant: 'shadow', accent: 0xffb040,
  },
  {
    id: 'carnival', name: 'THE DEAD CARNIVAL', flavor: 'NO REFUNDS. NO EXITS.', song: 'carnival',
    swing: 'lamp', weather: 'confetti', ghoul: 0xffc0f0, giant: 'eyes', accent: 0xff6bb5,
  },
  {
    id: 'otherside', name: 'THE OTHER SIDE', flavor: 'YOU WERE NEVER SUPPOSED TO GET THIS FAR.', song: 'otherside',
    swing: 'hook', weather: 'sparkles', ghoul: 0xc0fff8, giant: 'tentacle', accent: 0x7ff0ff,
  },
];
export const zoneAt = (i) => ZONES[Math.max(0, Math.min(i, ZONES.length - 1))];
export const LAYER_KEYS = ['sky', 'far', 'mid', 'near', 'edge'];
const FACTORS = { sky: 0.03, far: 0.1, mid: 0.3, near: 0.6, edge: 1 };
const DEPTHS = { sky: 0, far: 0.2, mid: 1, near: 3, edge: 15 };

// ---------------------------------------------------------------- pixel buffer helpers
const hex = (c) => {
  const n = typeof c === 'number' ? c : parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

class Buf {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  px(x, y, c, a = 1) {
    x = Math.floor(x); y = Math.floor(y);
    if (y < 0 || y >= this.h) return;
    x = ((x % this.w) + this.w) % this.w; // every layer tiles horizontally
    const i = (y * this.w + x) * 4;
    const [r, g, b] = Array.isArray(c) ? c : hex(c);
    if (a >= 1) { this.d[i] = r; this.d[i + 1] = g; this.d[i + 2] = b; this.d[i + 3] = 255; return; }
    const ea = this.d[i + 3] / 255;
    const oa = a + ea * (1 - a);
    if (oa <= 0) return;
    this.d[i] = (r * a + this.d[i] * ea * (1 - a)) / oa;
    this.d[i + 1] = (g * a + this.d[i + 1] * ea * (1 - a)) / oa;
    this.d[i + 2] = (b * a + this.d[i + 2] * ea * (1 - a)) / oa;
    this.d[i + 3] = oa * 255;
  }
  rect(x, y, w, h, c, a = 1) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c, a); }
  // dithered vertical gradient through color stops (pixel-art style banding)
  grad(y0, y1, stops) {
    const cols = stops.map(hex);
    for (let y = y0; y < y1; y++) {
      const f = ((y - y0) / Math.max(1, y1 - y0 - 1)) * (cols.length - 1);
      const i = Math.min(cols.length - 2, Math.floor(f));
      const t = f - i;
      for (let x = 0; x < this.w; x++) {
        const pick = t * 16 > BAYER[y % 4][x % 4] ? cols[i + 1] : cols[i];
        this.px(x, y, pick);
      }
    }
  }
  circle(cx, cy, r, c, a = 1) {
    r = Math.floor(r);
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) this.px(cx + x, cy + y, c, a);
  }
  // soft dithered glow that fades out from the center
  glow(cx, cy, r, c, strength = 0.5) {
    cx = Math.floor(cx); cy = Math.floor(cy); r = Math.floor(r);
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d = Math.sqrt(x * x + y * y) / r;
        if (d > 1) continue;
        const a = (1 - d) * (1 - d) * strength;
        if (a * 16 > BAYER[(cy + y + 64) % 4][(cx + x + 64) % 4] * 0.6) this.px(cx + x, cy + y, c, Math.min(1, a * 1.5));
      }
    }
  }
  line(x0, y0, x1, y1, c, t = 1, a = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n, y = y0 + ((y1 - y0) * k) / n;
      this.rect(x - t / 2, y - t / 2, t, t, c, a);
    }
  }
  // filled silhouette below a seamless noisy ridge line
  ridge(base, amp, waves, c, seed, spikes = 0) {
    const r = rng(seed);
    const ph = waves.map(() => r() * Math.PI * 2);
    for (let x = 0; x < this.w; x++) {
      let y = base;
      waves.forEach((f, k) => { y += Math.sin((x / this.w) * Math.PI * 2 * f + ph[k]) * amp / (k + 1); });
      if (spikes && r() < spikes) y -= 4 + r() * 10;
      for (let yy = Math.floor(y); yy < this.h; yy++) this.px(x, yy, c);
    }
  }
  stars(n, seed, maxY, cols = ['#ffffff', '#8a80b0']) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) this.px(r() * this.w, r() * maxY, cols[r() < 0.2 ? 0 : 1]);
  }
  // a gnarled tree: trunk plus recursive branches
  tree(x, ground, h, c, seed, thick = 4) {
    const r = rng(seed);
    const branch = (bx, by, ang, len, t, depth) => {
      const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
      this.line(bx, by, ex, ey, c, Math.max(1, t));
      if (depth <= 0 || len < 4) return;
      const n = 2 + (r() < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) branch(ex, ey, ang + (r() - 0.5) * 1.5, len * (0.6 + r() * 0.2), t * 0.65, depth - 1);
    };
    this.rect(x - thick / 2, ground - h * 0.5, thick, h * 0.5, c);
    branch(x, ground - h * 0.45, -Math.PI / 2 + (r() - 0.5) * 0.3, h * 0.35, thick, 4);
    for (let k = 0; k < 4; k++) this.line(x, ground - 2, x + (r() - 0.5) * thick * 6, ground + 1, c, 2); // roots
  }
}

// tiny 3x5 font for signs on gates
const F3 = {
  A: '.X.X.XXXXX.XX.X', B: 'XX.X.XXX.X.XXX.', C: '.XXX..X..X...XX', D: 'XX.X.XX.XX.XXX.', E: 'XXXX..XX.X..XXX',
  G: '.XXX..X.XX.X.XX', I: 'XXX.X..X..X.XXX', L: 'X..X..X..X..XXX', M: 'X.XXXXX.XX.XX.X', N: 'XX.X.XX.XX.XX.X',
  O: '.X.X.XX.XX.X.X.', R: 'XX.X.XXX.X.XX.X', S: '.XXX...X...XXX.', T: 'XXX.X..X..X..X.', U: 'X.XX.XX.XX.X.X.',
  W: 'X.XX.XX.XXXXX.X', 2: 'XX...X.X.X..XXX', 1: '.X.XX..X..X.XXX', '!': '.X..X..X.....X.', ' ': '...............',
  K: 'X.XX.XXX.X.XX.X', X: 'X.XX.X.X.X.XX.X', F: 'XXXX..XX.X..X..', Y: 'X.XX.X.X..X..X.', P: 'XX.X.XXX.X..X..', V: 'X.XX.XX.XX.X.X.', H: 'X.XX.XXXXX.XX.X',
};
function sign(b, str, x, y, c) {
  [...str].forEach((ch, i) => {
    const g = F3[ch] || F3[' '];
    for (let k = 0; k < 15; k++) if (g[k] === 'X') b.px(x + i * 4 + (k % 3), y + Math.floor(k / 3), c);
  });
}

// ---------------------------------------------------------------- zone painters
// Each returns { sky, far, mid, near, edge } Bufs. Layers are 320x180 logical (shown at 2x).
const W0 = 320, H0 = 180, FLOOR0 = 162, CEIL0 = 18;

function blank() { return new Buf(W0, H0); }

function ceilingAndFloor(b, ceil, floor, opts = {}) {
  b.grad(0, CEIL0, ceil);
  b.grad(FLOOR0, H0, floor);
  b.rect(0, FLOOR0, W0, 1, opts.floorEdge || floor[0]);
  b.rect(0, CEIL0 - 1, W0, 1, opts.ceilEdge || ceil[ceil.length - 1]);
}

const PAINT = {
  ward() {
    const r = rng(101);
    const sky = blank(); sky.grad(0, H0, ['#141f24', '#1f3036', '#2a3f44', '#1b282c']);
    const far = blank();
    for (let x = 0; x < W0; x += 80) {
      // tall windows with a rainy night outside and moonlight shafts falling in
      far.rect(x + 14, 30, 44, 70, '#0b1428');
      for (let i = 0; i < 18; i++) far.px(x + 15 + r() * 42, 31 + r() * 68, '#1d2b55');
      far.rect(x + 35, 30, 2, 70, '#141f24'); far.rect(x + 14, 64, 44, 2, '#141f24');
      far.rect(x + 12, 28, 48, 2, '#2e4248'); far.rect(x + 12, 100, 48, 3, '#2e4248');
      if (x % 160 === 0) { far.rect(x + 62, 40, 17, 7, '#0c2a18'); sign(far, 'EXIT', x + 63, 41, '#b8d8ff'); }
      for (let k = 0; k < 60; k++) far.line(x + 20 + k * 0.6, 102, x - 10 + k * 0.6, 162, '#b8d8e8', 1, 0.04);
    }
    far.circle(48, 44, 6, '#e8e4c8'); far.glow(48, 44, 16, '#c8d8e8', 0.4);
    const mid = blank();
    for (let x = 0; x < W0; x += 106) {
      // hospital curtain on its rail, then a bed
      mid.rect(x, 40, 52, 2, '#3d4f54');
      for (let k = 0; k < 52; k += 6) mid.rect(x + k, 42, 5, 72 + Math.sin(k) * 4, k % 12 ? '#2f4a46' : '#29413d');
      mid.rect(x + 60, 136, 40, 6, '#101a1e'); mid.rect(x + 60, 126, 14, 10, '#101a1e');
      mid.rect(x + 62, 142, 2, 20, '#101a1e'); mid.rect(x + 96, 142, 2, 20, '#101a1e');
    }
    const near = blank();
    for (let x = 0; x < W0; x += 160) {
      near.rect(x + 120, 18, 10, 144, '#070c0e'); near.rect(x + 116, 18, 18, 6, '#070c0e');
      near.rect(x + 40, 96, 2, 66, '#070c0e'); near.rect(x + 32, 96, 18, 2, '#070c0e'); near.rect(x + 34, 98, 5, 10, '#0a1418');
    }
    const edge = blank();
    ceilingAndFloor(edge, ['#2c3b40', '#38494e'], ['#2f3b3d', '#202a2c']);
    for (let x = 0; x < W0; x += 8) for (let y = FLOOR0 + 2; y < H0; y += 8) if (((x + y) / 8) % 2 === 0) edge.rect(x, y, 8, 8, '#3a4749');
    for (let x = 20; x < W0; x += 80) { edge.rect(x, 12, 24, 4, '#e4f7ff'); edge.glow(x + 12, 18, 14, '#c8f0ff', 0.35); }
    return { sky, far, mid, near, edge };
  },

  morgue() {
    const r = rng(202);
    const sky = blank(); sky.grad(0, H0, ['#0b141c', '#142430', '#1d3242', '#122028']);
    const far = blank();
    for (let y = 34; y < 150; y += 20) {
      for (let x = 0; x < W0; x += 28) {
        const ajar = r() < 0.08;
        far.rect(x + 2, y, 24, 17, ajar ? '#05090c' : '#2a4252');
        if (!ajar) { far.rect(x + 2, y, 24, 1, '#3c5a6c'); far.rect(x + 11, y + 7, 6, 2, '#8aa8b8'); far.rect(x + 18, y + 3, 5, 3, '#c8d8e0'); }
        else far.rect(x + 2, y + 15, 24, 2, '#3c5a6c');
      }
    }
    far.glow(160, 20, 60, '#9fe8ff', 0.15);
    const mid = blank();
    for (let x = 0; x < W0; x += 107) {
      // covered body on a gurney, feet poking out with a toe tag
      mid.rect(x + 10, 130, 60, 4, '#0c151b'); mid.rect(x + 14, 134, 2, 28, '#0c151b'); mid.rect(x + 64, 134, 2, 28, '#0c151b');
      for (let k = 0; k < 56; k++) mid.rect(x + 12 + k, 124 + Math.sin(k / 8) * 3 - (k > 8 && k < 18 ? 3 : 0), 1, 7, '#6a7c88');
      mid.rect(x + 66, 125, 4, 5, '#8a7a70'); mid.rect(x + 70, 128, 4, 3, '#a89a60');
    }
    const near = blank();
    for (let x = 0; x < W0; x += 80) {
      const len = 30 + (x % 3) * 18;
      for (let y = 18; y < 18 + len; y += 4) near.rect(x + 50, y, 2, 3, '#05090c');
      near.rect(x + 46, 18 + len, 2, 6, '#05090c'); near.rect(x + 48, 24 + len, 5, 2, '#05090c');
    }
    const edge = blank();
    ceilingAndFloor(edge, ['#1a2a34', '#26404e'], ['#34485a', '#1e2c36']);
    for (let x = 0; x < W0; x += 6) edge.rect(x, FLOOR0 + 2, 1, 16, '#16222a');
    for (let x = 0; x < W0; x += 4) edge.rect(x, 8, 4, 4, x % 8 ? '#3e5a68' : '#4a6a7a');
    for (let x = 0; x < W0; x += 9) edge.rect(x, 12, 1, 2 + (x % 5), '#dff6ff');
    return { sky, far, mid, near, edge };
  },

  woods() {
    const sky = blank();
    sky.grad(0, H0, ['#08051a', '#140b30', '#24133f', '#3d1f4f', '#5a2a55']);
    sky.stars(90, 303, 110);
    sky.glow(230, 46, 40, '#f3e7c0', 0.3); sky.circle(230, 46, 15, '#f3e7c0'); sky.circle(224, 42, 4, '#d8cba0'); sky.circle(236, 52, 3, '#d8cba0');
    const far = blank();
    far.ridge(122, 10, [2, 5, 11], '#3a2050', 31, 0.06);
    far.ridge(132, 8, [3, 7, 13], '#2a1742', 32, 0.12);
    const mid = blank();
    for (let i = 0; i < 4; i++) mid.tree(30 + i * 82, FLOOR0, 120 + (i % 2) * 20, '#150c26', 330 + i, 6);
    const near = blank();
    const r = rng(34);
    for (let x = 0; x < W0; x++) if (r() < 0.25) near.line(x, FLOOR0, x + (r() - 0.5) * 6, FLOOR0 - 8 - r() * 16, '#07040e', 1);
    near.tree(250, FLOOR0 + 10, 210, '#06030c', 35, 9);
    const edge = blank();
    ceilingAndFloor(edge, ['#07040e', '#0f1f14'], ['#1e3a1e', '#2a1d14', '#1d140e']);
    for (let x = 0; x < W0; x++) { const d = 4 + Math.sin(x * 0.2) * 2 + (x % 7 === 0 ? 8 : 0); edge.rect(x, CEIL0, 1, d, '#0f1f14'); }
    for (let x = 40; x < W0; x += 97) { edge.rect(x, 157, 6, 3, '#b0303a'); edge.rect(x + 2, 160, 2, 2, '#e8dcc8'); edge.px(x + 1, 158, '#ffffff'); }
    return { sky, far, mid, near, edge };
  },

  graveyard() {
    const sky = blank();
    sky.grad(0, H0, ['#0c0206', '#22060f', '#3a0d1a', '#5a1a22', '#7a2a2a']);
    sky.stars(40, 404, 80, ['#ffd0d0', '#7a4050']);
    sky.glow(90, 54, 50, '#e04848', 0.35); sky.circle(90, 54, 20, '#d84040'); sky.circle(84, 48, 5, '#b83030'); sky.circle(98, 60, 4, '#b83030');
    for (let i = 0; i < 6; i++) { const x = 150 + i * 23, y = 30 + (i % 3) * 9; sky.line(x, y, x + 3, y + 2, '#12040a'); sky.line(x + 3, y + 2, x + 6, y, '#12040a'); }
    const far = blank();
    far.ridge(130, 8, [2, 4], '#30101a', 41);
    // chapel with spire
    far.rect(200, 92, 44, 40, '#30101a'); far.rect(214, 60, 16, 32, '#30101a');
    for (let k = 0; k < 18; k++) far.rect(222 - k / 2, 42 + k, k + 1, 1, '#30101a');
    far.rect(221, 34, 2, 10, '#30101a'); far.rect(218, 37, 8, 2, '#30101a');
    far.rect(219, 72, 6, 9, '#ff9a5a'); far.glow(222, 76, 10, '#ff9a5a', 0.3);
    const mid = blank();
    const r = rng(42);
    for (let x = 0; x < W0; x += 22 + Math.floor(r() * 18)) {
      const kind = r();
      const h = 14 + r() * 12;
      if (kind < 0.4) { mid.rect(x, FLOOR0 - h, 12, h, '#14050a'); mid.circle(x + 6, FLOOR0 - h, 6, '#14050a'); }
      else if (kind < 0.7) { mid.rect(x + 5, FLOOR0 - h - 6, 3, h + 6, '#14050a'); mid.rect(x, FLOOR0 - h, 13, 3, '#14050a'); }
      else mid.rect(x, FLOOR0 - h * 0.7, 16, h * 0.7, '#14050a');
    }
    for (let x = 0; x < W0; x += 5) mid.rect(x, FLOOR0 - 26 - (x % 15 === 0 ? 4 : 0), 1, 26, '#1c070e');
    mid.rect(0, FLOOR0 - 20, W0, 1, '#1c070e');
    const near = blank();
    near.tree(60, FLOOR0 + 20, 220, '#080204', 43, 8);
    for (let x = 0; x < W0; x++) if (r() < 0.3) near.line(x, FLOOR0, x + 2, FLOOR0 - 6 - r() * 12, '#0a0205', 1);
    const edge = blank();
    ceilingAndFloor(edge, ['#0a0205', '#1a060a'], ['#3a1a14', '#24100c', '#180a08']);
    for (let x = 0; x < W0; x++) { edge.rect(x, FLOOR0 - (x % 3 === 0 ? 2 : 0), 1, 3, '#4a1a1a'); }
    for (let x = 0; x < W0; x += 13) edge.line(x, CEIL0, x + 4, CEIL0 + 6 + (x % 4) * 3, '#0a0205', 1);
    return { sky, far, mid, near, edge };
  },

  sewer() {
    const r = rng(505);
    const sky = blank(); sky.grad(0, H0, ['#070a07', '#101a10', '#1a241a', '#0c120c']);
    const far = blank();
    for (let y = 18; y < 162; y += 8) {
      const off = (y / 8) % 2 ? 8 : 0;
      for (let x = -8; x < W0; x += 16) far.rect(x + off + 1, y + 1, 14, 6, r() < 0.15 ? '#2c3a2a' : '#222c20');
    }
    for (let x = 0; x < W0; x += 160) {
      for (let y = 70; y < 162; y++) {
        const half = y < 95 ? Math.sqrt(Math.max(0, 625 - (95 - y) * (95 - y))) : 25;
        far.rect(x + 100 - half, y, half * 2, 1, '#050805');
      }
      far.glow(x + 100, 120, 18, '#9cff6b', 0.18);
    }
    const mid = blank();
    mid.rect(0, 46, W0, 10, '#2e3e2c'); mid.rect(0, 46, W0, 2, '#4a5e46');
    for (let x = 18; x < W0; x += 64) { mid.rect(x, 44, 8, 14, '#24321f'); mid.rect(x + 2, 58, 3, 6 + (x % 5) * 3, '#3f6b2a'); }
    for (let x = 0; x < W0; x += 160) {
      mid.rect(x + 40, 56, 12, 106, '#1a2618'); mid.rect(x + 38, 100, 16, 4, '#2e3e2c');
      mid.circle(x + 46, 90, 5, '#3a2a18'); mid.rect(x + 41, 89, 10, 2, '#5a4a28');
    }
    const near = blank();
    for (let x = 0; x < W0; x += 160) {
      for (let k = 0; k < 6; k++) near.rect(x + 100 + k * 6, 18, 2, 144, '#030503');
      near.rect(x + 98, 60, 38, 3, '#030503'); near.rect(x + 98, 120, 38, 3, '#030503');
    }
    const edge = blank();
    ceilingAndFloor(edge, ['#121a10', '#1c2618'], ['#3a352c', '#1f3b2a', '#16301f']);
    for (let i = 0; i < 50; i++) edge.rect(r() * W0, 170 + r() * 8, 3 + r() * 4, 1, '#4f8b5a');
    for (let x = 10; x < W0; x += 37) edge.rect(x, CEIL0, 1, 2 + (x % 5), '#3f6b2a');
    return { sky, far, mid, near, edge };
  },

  catacombs() {
    const sky = blank(); sky.grad(0, H0, ['#120904', '#201208', '#3a2210', '#24140a']);
    const far = blank();
    // walls of skulls, stacked in rows
    for (let y = 24; y < 156; y += 9) {
      for (let x = (y / 9) % 2 ? 4 : 0; x < W0; x += 8) {
        far.rect(x + 1, y + 1, 6, 5, '#5a3e26'); far.rect(x + 2, y + 6, 4, 2, '#5a3e26');
        far.px(x + 2, y + 3, '#1a0e06'); far.px(x + 5, y + 3, '#1a0e06');
      }
    }
    const mid = blank();
    for (let x = 0; x < W0; x += 80) {
      mid.rect(x, 18, 18, 144, '#22140a'); mid.rect(x - 2, 18, 22, 6, '#2c1a0e');
      for (let y = 40; y < 150; y += 30) {
        mid.rect(x + 30, y, 20, 18, '#0e0804');
        mid.rect(x + 38, y + 10, 4, 6, '#f3e6c4'); mid.px(x + 39, y + 8, '#ffd75e'); mid.px(x + 40, y + 7, '#ff8a2a');
        mid.glow(x + 40, y + 10, 14, '#ffb040', 0.35);
      }
    }
    const near = blank();
    const r = rng(66);
    for (let x = 0; x < W0; x += 106) {
      for (let k = 0; k < 30; k++) {
        const bx = x + 20 + r() * 40, by = FLOOR0 - r() * 14 * (1 - Math.abs(bx - x - 40) / 30);
        if (r() < 0.3) near.rect(bx, by - 5, 6, 5, '#120a04'); else near.rect(bx, by - 2, 7, 2, '#120a04');
      }
    }
    const edge = blank();
    ceilingAndFloor(edge, ['#1a0e06', '#2c1a0e'], ['#4a3420', '#2c1e12']);
    for (let x = 0; x < W0; x += 12) edge.rect(x, CEIL0 - 4, 11, 3, '#38220f');
    for (let i = 0; i < 30; i++) edge.rect(r() * W0, FLOOR0 + 3 + r() * 12, 4, 1, '#d8c8a0');
    return { sky, far, mid, near, edge };
  },

  carnival() {
    const sky = blank();
    sky.grad(0, H0, ['#120724', '#2a0f40', '#6a1f4a', '#b0403a', '#e0703a']);
    sky.stars(50, 707, 60);
    const far = blank();
    // ferris wheel
    const cx = 220, cy = 92, R = 52;
    for (let a = 0; a < 360; a += 2) { const t = (a * Math.PI) / 180; far.rect(cx + Math.cos(t) * R, cy + Math.sin(t) * R, 2, 2, '#2a0f2a'); }
    for (let a = 0; a < 360; a += 30) {
      const t = (a * Math.PI) / 180;
      far.line(cx, cy, cx + Math.cos(t) * R, cy + Math.sin(t) * R, '#2a0f2a');
      far.rect(cx + Math.cos(t) * R - 3, cy + Math.sin(t) * R, 7, 6, '#2a0f2a');
    }
    far.line(cx, cy, cx - 20, 162, '#2a0f2a', 3); far.line(cx, cy, cx + 20, 162, '#2a0f2a', 3);
    // circus tents
    for (const [tx, tw] of [[40, 70], [110, 50]]) {
      for (let k = 0; k < tw; k++) {
        const h = 40 * (1 - Math.abs(k - tw / 2) / (tw / 2)) + 30;
        far.rect(tx + k, 162 - h, 1, h, '#2a0f2a');
      }
      far.rect(tx + tw / 2, 162 - 74, 1, 6, '#2a0f2a');
    }
    const mid = blank();
    for (let x = 0; x < W0; x += 80) {
      mid.rect(x + 10, 112, 50, 50, '#1a0a1a');
      for (let k = 0; k < 50; k += 10) { mid.rect(x + 10 + k, 104, 10, 10, (k / 10) % 2 ? '#5a1830' : '#a89880'); }
      mid.rect(x + 18, 124, 34, 16, '#0c050c'); mid.glow(x + 35, 132, 14, '#ffd75e', 0.2);
    }
    const near = blank();
    for (let s = 0; s < 2; s++) {
      for (let x = 0; x < W0; x++) {
        const y = 30 + s * 30 + Math.sin((x / W0) * Math.PI * 4) * 10;
        near.px(x, y, '#120510');
        if (x % 12 === 0) { const c = ['#ffd75e', '#ff6bb5', '#7ff0ff'][(x / 12) % 3]; near.rect(x - 1, y + 1, 3, 3, c); near.glow(x, y + 2, 6, c, 0.4); }
      }
    }
    const edge = blank();
    ceilingAndFloor(edge, ['#120510', '#1f0a1a'], ['#5a3a22', '#3a2416']);
    for (let x = 0; x < W0; x += 14) edge.rect(x, FLOOR0 + 1, 1, 17, '#2a180e');
    for (let x = 0; x < W0; x += 10) { const c = (x / 10) % 2 ? '#a02040' : '#d8c070'; for (let k = 0; k < 6; k++) edge.rect(x + k / 2, CEIL0 + k, 6 - k, 1, c); }
    return { sky, far, mid, near, edge };
  },

  otherside() {
    const r = rng(808);
    const sky = blank();
    sky.grad(0, H0, ['#04080f', '#0b1030', '#1a0f3a', '#3a1060', '#1a0f3a']);
    sky.stars(120, 809, 170, ['#ffffff', '#7ff0ff']);
    // aurora ribbons
    for (const [col, base, ph] of [['#7fffc0', 40, 0], ['#ff7ff0', 56, 2]]) {
      for (let x = 0; x < W0; x++) {
        const y = base + Math.sin((x / W0) * Math.PI * 6 + ph) * 8;
        for (let k = 0; k < 18; k++) sky.px(x, y + k, col, 0.18 * (1 - k / 18));
      }
    }
    // the eye in the sky
    sky.glow(90, 70, 34, '#d8f0ff', 0.25);
    for (let y = -8; y <= 8; y++) for (let x = -18; x <= 18; x++) if ((x * x) / 324 + (y * y) / 64 <= 1) sky.px(90 + x, 70 + y, '#e8f4ff');
    sky.circle(90, 70, 6, '#7f40ff'); sky.circle(90, 70, 3, '#050510'); sky.px(88, 68, '#ffffff');
    const far = blank();
    for (let x = 0; x < W0; x += 106) {
      // upside-down floating island hanging from the dark
      const w = 40 + (x % 3) * 8, y = 30 + (x % 2) * 16;
      for (let k = 0; k < w; k++) { const d = (1 - Math.abs(k - w / 2) / (w / 2)) * 26; far.rect(x + 20 + k, y, 1, d, '#1a1440'); }
      far.rect(x + 20, y - 2, w, 3, '#3a2a7a');
      for (let k = 0; k < 4; k++) far.line(x + 26 + k * (w / 4), y - 1, x + 24 + k * (w / 4), y - 6 - (k % 2) * 4, '#1a1440', 1);
    }
    const mid = blank();
    for (let x = 0; x < W0; x += 53) {
      const h = 30 + r() * 40, w = 10 + r() * 8;
      for (let k = 0; k < w; k++) { const hh = h * (1 - Math.abs(k - w / 2) / (w / 2)); mid.rect(x + k, FLOOR0 - hh, 1, hh, '#0f0a28'); }
      mid.line(x + w / 2, FLOOR0 - h, x + w, FLOOR0, '#7ff0ff', 1, 0.6);
      mid.glow(x + w / 2, FLOOR0 - h, 10, '#7ff0ff', 0.3);
    }
    const near = blank();
    for (let i = 0; i < 6; i++) {
      const x = r() * W0, y = 30 + r() * 100, s = 3 + r() * 6;
      for (let k = 0; k < s; k++) near.rect(x - k, y + k, k * 2 + 1, 1, '#06041a');
      for (let k = 0; k < s; k++) near.rect(x - (s - k), y + s + k, (s - k) * 2 + 1, 1, '#06041a');
    }
    const edge = blank();
    ceilingAndFloor(edge, ['#06041a', '#1a1040'], ['#3a2a6a', '#1a1040', '#0b0820']);
    for (let x = 0; x < W0; x += 3) edge.rect(x, FLOOR0 - 2 - (x % 9 === 0 ? 3 : 0), 1, 3, '#7ff0ff', 0.8);
    for (let x = 6; x < W0; x += 17) for (let k = 0; k < 6; k++) edge.rect(x + k / 2, CEIL0 + k, 6 - k, 1, '#ff7ff0', 0.7);
    return { sky, far, mid, near, edge };
  },
};

// ---------------------------------------------------------------- gates between zones
// A wall you fly through. 80x180 logical, fully opaque so the zone swap behind it never shows.
function gate(i) {
  const b = new Buf(80, H0);
  const C = [
    { wall: '#3a4c52', dark: '#0a1012', trim: '#56686b', label: 'B2', lc: '#7dffb0' }, // elevator to the morgue
    { wall: '#3c5664', dark: '#05090c', trim: '#6a8a9a', label: '', lc: '#9fe8ff', broken: true }, // smashed wall
    { wall: '#1a1030', dark: '#07040e', trim: '#2a2a3a', label: 'CROWSREST', lc: '#ff6b6b', iron: true },
    { wall: '#3a2a2a', dark: '#050303', trim: '#5a4040', label: 'REST', lc: '#9cff6b' }, // mausoleum, steps down
    { wall: '#2e3a2a', dark: '#0a0604', trim: '#4a5a40', label: '', lc: '#ffb040', broken: true }, // crumbling brick
    { wall: '#4a3420', dark: '#0a0604', trim: '#6a4c30', label: 'ADMIT ONE', lc: '#ff6bb5' },
    { wall: '#6a1830', dark: '#1a0640', trim: '#d8c070', label: 'BEYOND', lc: '#7ff0ff', portal: true },
  ][i];
  b.rect(0, 0, 80, H0, C.wall);
  for (let y = 0; y < H0; y += 8) for (let x = (y / 8) % 2 ? 0 : 6; x < 80; x += 12) b.rect(x, y, 11, 1, C.trim, 0.4);
  // the doorway
  if (C.iron) {
    b.rect(0, 0, 80, H0, '#06030c');
    for (let x = 4; x < 80; x += 8) { b.rect(x, 24, 2, 138, '#2a2a3a'); b.rect(x - 1, 20, 4, 4, '#3a3a4a'); }
    b.rect(0, 40, 80, 3, '#2a2a3a'); b.rect(0, 120, 80, 3, '#2a2a3a');
  } else {
    b.rect(10, 24, 60, 138, C.dark);
    if (C.broken) {
      const r = rng(1234 + i);
      for (let y = 24; y < 162; y += 2) { const j = r() * 8; b.rect(6 + j, y, 4, 2, C.wall); b.rect(70 - j, y, 4, 2, C.wall); }
      for (let k = 0; k < 14; k++) b.rect(10 + r() * 60, 150 + r() * 10, 3 + r() * 4, 2, C.trim);
    } else {
      b.rect(8, 22, 64, 3, C.trim); b.rect(8, 22, 3, 140, C.trim); b.rect(69, 22, 3, 140, C.trim);
    }
    if (C.portal) {
      for (let k = 0; k < 40; k++) {
        const a = k * 0.6, rr = k * 1.4;
        b.px(40 + Math.cos(a) * rr, 92 + Math.sin(a) * rr * 1.6, '#7ff0ff');
        b.px(40 + Math.cos(a + 3) * rr, 92 + Math.sin(a + 3) * rr * 1.6, '#ff7ff0');
      }
      for (let x = 0; x < 80; x += 8) b.rect(x, 0, 4, 22, '#d8c070');
    }
    b.glow(40, 100, 30, C.lc, 0.15);
  }
  b.rect(0, 0, 80, 18, C.trim); b.rect(0, 162, 80, 18, C.trim);
  if (C.label) { // v6: on a plate over the doorway, below the ceiling band (the HUD row stays clean)
    b.rect(40 - C.label.length * 2 - 3, 27, C.label.length * 4 + 5, 9, '#06050a');
    sign(b, C.label, 40 - C.label.length * 2, 29, C.lc);
  }
  return b;
}

function toTexture(scene, key, buf) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, buf.w, buf.h);
  tex.context.putImageData(new ImageData(buf.d, buf.w, buf.h), 0, 0);
  tex.refresh();
}

export const DEBUG_PAINT = { PAINT, gate };

export function makeZoneArt(scene) {
  for (const z of ZONES) {
    const layers = PAINT[z.id]();
    for (const k of LAYER_KEYS) toTexture(scene, `${z.id}_${k}`, layers[k]);
  }
  for (let i = 0; i < ZONES.length - 1; i++) toTexture(scene, `gate_${i}`, gate(i));
}

// ---------------------------------------------------------------- parallax with seamless zone swaps
// Two layer sets: A (current zone) and B (next). During a gate, A is drawn left of the seam and
// B right of it. TileSprite widths are cut at the seam, so both stay locked to the same world.
export class ZoneLayers {
  constructor(scene, zoneId, depthOffset = 0) {
    this.scene = scene;
    const mk = (z) => Object.fromEntries(LAYER_KEYS.map((k) => [k,
      scene.add.tileSprite(0, 0, 320, 180, `${z}_${k}`).setOrigin(0).setScale(2).setDepth(DEPTHS[k] + depthOffset)]));
    this.A = mk(zoneId);
    this.B = mk(zoneId);
    this.zone = zoneId;
    this.next = null;
    this.look = 0xffffff;
    LAYER_KEYS.forEach((k) => this.B[k].setVisible(false));
  }
  // a character's world look: a color grade multiplied into every layer
  setLook(tint) { this.look = tint; }
  beginSwap(nextId) {
    this.next = nextId;
    LAYER_KEYS.forEach((k) => this.B[k].setTexture(`${nextId}_${k}`).setVisible(true));
  }
  endSwap() {
    LAYER_KEYS.forEach((k) => { this.A[k].setTexture(`${this.next}_${k}`); this.B[k].setVisible(false); });
    this.zone = this.next;
    this.next = null;
  }
  // scroll: world px scrolled; seam: screen x where B starts (or null)
  render(scroll, seam, tint) {
    for (const k of LAYER_KEYS) {
      const base = (scroll * FACTORS[k]) / 2;
      const a = this.A[k], b = this.B[k];
      const cut = seam === null ? 640 : Math.max(0, Math.min(640, seam));
      a.setVisible(cut > 0);
      a.setSize(Math.max(1, cut / 2), 180);
      a.tilePositionX = base;
      if (seam !== null && cut < 640) {
        b.setPosition(cut, 0).setSize(Math.max(1, (640 - cut) / 2), 180).setVisible(true);
        b.tilePositionX = base + cut / 2;
      }
      const tt = k === 'edge' && tint !== undefined ? tint : this.look;
      a.setTint(tt); b.setTint(tt);
    }
  }
}
