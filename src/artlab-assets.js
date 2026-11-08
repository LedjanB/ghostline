// ART LAB (Visual Art Benchmark V1): art drawn in code on a 320x180 art grid, shown at 2x (640x360).
// Not used by the game. Milo is built from a skeleton (joints per pose) + a hand-made head with
// per-expression faces, so every pose is a new drawing of the SAME boy; the ghost is the same pixels
// remapped to a spectral ramp. Boo, Bed 7 and THE STRETCH's shadow are drawn the same way.
// See docs/visual-target-v1.md.

export const AW = 320, AH = 180; // art grid (1 art px = 2 screen px)
export const SEAM_Y = 144; // the floor seam under the bed (art y)
export const FLOOR_Y = 116; // back wall meets the floor

// ---------- colors ----------
const cache = new Map();
export function rgb(c) {
  let v = cache.get(c);
  if (!v) { v = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), c.length > 7 ? parseInt(c.slice(7, 9), 16) : 255]; cache.set(c, v); }
  return v;
}
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export function mix(a, b, k) { const A = rgb(a), B = rgb(b); return toHex(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k); }
const lum = (c) => { const [r, g, b] = rgb(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------- a pixel buffer ----------
export class Buf {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Array(w * h).fill(null); this.tag = new Array(w * h).fill(0); }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.in(x, y) ? this.d[y * this.w + x] : null; }
  set(x, y, c, tag = 0) { if (this.in(x, y)) { this.d[y * this.w + x] = c; if (tag) this.tag[y * this.w + x] = tag; } }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  toCanvas() {
    const cv = document.createElement('canvas'); cv.width = this.w; cv.height = this.h;
    const x = cv.getContext('2d'); const img = x.createImageData(this.w, this.h);
    for (let i = 0; i < this.d.length; i++) {
      const c = this.d[i]; if (!c) continue;
      const v = rgb(c); img.data.set(v, i * 4);
    }
    x.putImageData(img, 0, 0);
    return cv;
  }
}
const mask = (w, h) => ({ w, h, m: new Uint8Array(w * h), has(x, y) { return x >= 0 && y >= 0 && x < w && y < h && this.m[y * w + x] === 1; }, add(x, y) { if (x >= 0 && y >= 0 && x < w && y < h) this.m[y * w + x] = 1; } });
function capsule(M, ax, ay, bx, by, r) {
  const x0 = Math.floor(Math.min(ax, bx) - r - 1), x1 = Math.ceil(Math.max(ax, bx) + r + 1);
  const y0 = Math.floor(Math.min(ay, by) - r - 1), y1 = Math.ceil(Math.max(ay, by) + r + 1);
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x + 0.5, py = y + 0.5;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2));
    const ex = ax + dx * t - px, ey = ay + dy * t - py;
    if (ex * ex + ey * ey <= r * r) M.add(x, y);
  }
}
function poly(M, pts) {
  const ys = pts.map((p) => p[1]), xs = pts.map((p) => p[0]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
    const px = x + 0.5, py = y + 0.5; let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) M.add(x, y);
  }
}
function line1(cb, ax, ay, bx, by) { // 1 px line, integer steps
  const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1) * 2;
  let last = '';
  for (let i = 0; i <= n; i++) { const x = Math.round(ax + (bx - ax) * i / n), y = Math.round(ay + (by - ay) * i / n), k = x + ',' + y; if (k !== last) { cb(x, y); last = k; } }
}

// Directional shading of one part: the edge that faces the light gets the highlight,
// the band on the far side the shade (sprite light comes from the front-top: up-right when facing right).
function shadePart(B, M, ramp, { sw = 1, hi = true, lx = 0.7, ly = -0.75, tag = 1 } = {}) {
  for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) {
    if (!M.has(x, y)) continue;
    let c = ramp[1];
    let away = false;
    for (let t = 1; t <= sw; t++) if (!M.has(Math.round(x - lx * t), Math.round(y - ly * t))) { away = true; break; }
    if (away) c = ramp[2];
    else if (hi && !M.has(Math.round(x + lx), Math.round(y + ly))) c = ramp[0];
    B.set(x, y, c, tag);
  }
  // inner line where this part sits on top of something already drawn
}
function innerLine(B, M, col, before) {
  for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) {
    if (M.has(x, y)) continue;
    if (!before.get(x, y)) continue;
    if (M.has(x + 1, y) || M.has(x - 1, y) || M.has(x, y + 1) || M.has(x, y - 1)) B.set(x, y, col);
  }
}
function snapshot(B) { const s = new Buf(B.w, B.h); s.d = B.d.slice(); return s; }
// the outer outline: dark on the shadow side, a darker shade of the neighbour on the lit side (sel-out)
function outline(B, dark) {
  const src = snapshot(B);
  for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) {
    if (src.get(x, y)) continue;
    const l = src.get(x - 1, y), r = src.get(x + 1, y), u = src.get(x, y - 1), d = src.get(x, y + 1);
    if (!(l || r || u || d)) continue;
    const n = d || l || r || u;
    const litSide = (l && !r) || (d && !u); // we are right of or above the sprite: lit side (up-right light)
    B.set(x, y, litSide ? mix(n, dark, 0.55) : dark);
  }
}

// ---------- palettes ----------
export const PAL = {
  skin: ['#f7d6b4', '#e8b38c', '#c3846a', '#8a5446'],
  hair: ['#4e3a31', '#2c201d', '#1b1416', '#0c0809'],
  pj: ['#d3dee4', '#a8bac8', '#7c91a6', '#4f6179'],
  pjFar: ['#a8bac8', '#8a9fb3', '#677c93', '#45566d'],
  skinFar: ['#e8b38c', '#d29f7c', '#ab735c', '#7a4a3e'],
  pjStripe: '#93a8ba', trim: '#5f7894', band: '#ffffff', bandSh: '#b9c2cf',
  eyeW: '#f0efe9', pupil: '#17121a', lid: '#3a2420', brow: '#2b1d19', mouth: '#5a2428', mouthIn: '#2e1216', teeth: '#f2efe6', lip: '#b56a5c', blush: '#e2957f', tear: '#cfe8ff',
  out: '#0d0a12',
};
// the spectral ramp the ghost is painted with (same values, blue light)
const SPIRIT_RAMP = ['#0c1430', '#16275a', '#24408a', '#3a64b6', '#5f8fd8', '#8dbcf0', '#bfe0ff', '#e9f7ff', '#ffffff'];
export function toSpirit(c) {
  if (!c) return c;
  const l = lum(c);
  const k = Math.min(1, Math.max(0, (l - 0.03) / 0.9));
  const f = k * (SPIRIT_RAMP.length - 1), i = Math.floor(f);
  return mix(SPIRIT_RAMP[i], SPIRIT_RAMP[Math.min(i + 1, SPIRIT_RAMP.length - 1)], f - i);
}

// ---------- Milo's head: 16x16, facing right, three-quarter view ----------
// Fringe: where the hair stops on each face column (messy, uneven).
const FRINGE = { 5: 10, 6: 8, 7: 7, 8: 6, 9: 5, 10: 6, 11: 5, 12: 6, 13: 5, 14: 5, 15: 6 };
const TUFTS = [[5, 0], [6, 0], [10, 0], [11, -1], [12, 0], [3, 1], [14, 2], [15, 3], [1, 4], [0, 6], [15, 5], [9, -1]];
// face grids (8 wide x 9 tall) placed at head (7,5): '.' keep, B brow, L lid, P pupil, W white, M mouth, m mouth corner/shadow,
// T teeth, s shade, S skin, k blush, H hair, t tear/sweat
export const FACES = {
  neutral: [
    '........',
    '.BBB.BB.',
    '.LLP.LP.',
    '.WPP.PW.',
    '.......s',
    '......ss',
    '...mMm..',
    '........',
    '........',
  ],
  confused: [ // far brow up, near brow pulled down, eyes off to the side, mouth pushed to one side
    '.....BB.',
    '.....s..',
    '.BBB.LP.',
    '.LPW.PW.',
    '.PP....s',
    '......ss',
    '....mMM.',
    '......m.',
    '........',
  ],
  shocked: [ // brows high, whites all round, small pupils, mouth dropped open
    '.BBB.BB.',
    '........',
    '.WLW.WL.',
    '.WPW.PW.',
    '.WWW.WW.',
    '......ss',
    '...MM...',
    '...MM...',
    '...mm...',
  ],
  frightened: [ // brows tilted up in the middle, eyes wide and looking back, teeth clenched
    '...BB.B.',
    '.BB..B..',
    '.WWL.WL.',
    '.PWW.PW.',
    '.WWW.WW.',
    '......ss',
    '..MTTM..',
    '...mm...',
    '........',
  ],
  reach: [ // soft, sad: inner brows up, lids heavy, looking down at his hand, lips parted
    '........',
    '..BB.B..',
    '.B...B..',
    '.LLL.LL.',
    '.WPP.PP.',
    '......ss',
    '...mM...',
    '........',
    '........',
  ],
  recoil: [ // eyes squeezed, brows crushed down, mouth pulled wide
    '.BBB.BB.',
    '..BB.B..',
    '.LLL.LL.',
    '..LL..L.',
    '.......s',
    '......ss',
    '..MMMM..',
    '..mTTm..',
    '........',
  ],
  asleep: [
    '........',
    '.BBB.BB.',
    '........',
    '.LLL.LL.',
    '.......s',
    '......ss',
    '....m...',
    '........',
    '........',
  ],
};
function head(expr, { look = 0 } = {}) {
  const B = new Buf(18, 18), O = 1; // 1 px margin for tufts above
  const hairM = mask(18, 18), skinM = mask(18, 18);
  const ell = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const px = x + 0.5, py = y + 0.5;
    const inHair = ell(px, py, 7.2, 6.6, 7.3, 6.7);
    let inFace = ell(px, py, 9.4, 8.9, 5.4, 6.3) && !(y > 11 && px < 5.5 + (y - 11) * 1.25);
    if (x === 15 && (y === 9 || y === 10)) inFace = true; // nose tip
    if (x === 15 && y > 10) inFace = false;
    const fr = FRINGE[x] ?? (x > 15 ? 6 : 99);
    if (inFace && y >= fr + look) skinM.add(x, y + O);
    else if (inHair || (inFace && y < fr + look)) hairM.add(x, y + O);
  }
  for (const [x, y] of TUFTS) hairM.add(x, y + O);
  // ear
  for (const [x, y] of [[4, 8], [5, 8], [4, 9], [5, 9], [5, 10], [4, 10]]) { skinM.add(x, y + O); hairM.m[(y + O) * 18 + x] = 0; }
  shadePart(B, hairM, PAL.hair, { sw: 2 });
  shadePart(B, skinM, PAL.skin, { sw: 1, hi: false });
  // hair clumps: dark strands and a little sheen
  for (const [x, y, c] of [[4, 4, 3], [8, 3, 3], [11, 4, 3], [3, 8, 3], [7, 1, 0], [8, 1, 0], [9, 2, 0], [10, 1, 0], [11, 1, 0], [12, 2, 0], [4, 2, 0], [5, 2, 0], [6, 3, 0], [13, 3, 0], [2, 10, 3]]) {
    if (hairM.has(x, y + O)) B.set(x, y + O, PAL.hair[c]);
  }
  // fringe shadow on the forehead, ear detail
  for (let x = 6; x < 16; x++) { const fy = (FRINGE[x] ?? 6) + look + O; if (skinM.has(x, fy)) B.set(x, fy, PAL.skin[2]); }
  B.set(4, 9 + O, PAL.skin[2]); B.set(5, 10 + O, PAL.skin[2]);
  // cheek and jaw shade (the side away from the light)
  for (const [x, y] of [[6, 11], [6, 12], [7, 13], [8, 14], [9, 15]]) if (skinM.has(x, y + O)) B.set(x, y + O, PAL.skin[2]);
  // the face
  const F = FACES[expr] || FACES.neutral, map = { B: PAL.brow, L: PAL.lid, P: PAL.pupil, W: PAL.eyeW, M: PAL.mouthIn, m: PAL.mouth, T: PAL.teeth, s: PAL.skin[2], S: PAL.skin[1], k: PAL.blush, H: PAL.hair[1], t: PAL.tear };
  F.forEach((row, fy) => [...row].forEach((ch, fx) => { if (ch !== '.' && map[ch]) B.set(7 + fx, 5 + fy + look + O, map[ch]); }));
  return B;
}

// ---------- Milo's body from joints ----------
// Frame 40x52, feet on row 51, centre x 20, facing right. Near arm = his left arm (the wristband arm, in front).
export const FW = 40, FH = 52;
const P = {}; // poses
const base = {
  head: [12, 2], neck: [20, 18], sF: [15.5, 21], sN: [24.5, 21], hF: [17, 33], hN: [23.5, 33], hem: 1.5,
  aF: [[16, 22], [14.5, 28], [14.5, 33.5], [14.5, 35.5]], aN: [[24, 22], [25.5, 28], [25.5, 33.5], [25.5, 35.5]],
  lF: [[18, 33], [18, 41.5], [18, 49]], lN: [[22, 33], [22.2, 41.5], [22.5, 49]],
  fF: 1, fN: 1, handF: 'rest', handN: 'rest', face: 'neutral', look: 0,
};
const pose = (o) => ({ ...base, ...o });
P.neutral = pose({});
P.confused = pose({ // tilted head, hand scratching the back of it, weight on one hip
  head: [12, 3], tilt: 1, face: 'confused', sF: [15, 21], sN: [24.5, 21.5], neck: [20, 19],
  aF: [[15.5, 22], [10, 17], [13, 12], [14, 11]], handF: 'scratch',
  aN: [[24, 22.5], [26, 28.5], [25.5, 33.5], [25.5, 35.5]],
  hF: [16.5, 33.5], hN: [23.5, 33], lF: [[18, 33.5], [17, 41.5], [16.5, 49]], lN: [[22, 33], [23, 41.5], [23.5, 49]],
});
P.shocked = pose({ // stiff, up on his toes and leaning back, shoulders up, hands thrown open
  head: [10, 0], face: 'shocked', neck: [19, 16.5], sF: [14, 19.5], sN: [23, 19.5], hF: [16.5, 32], hN: [23, 32],
  aF: [[14.5, 20.5], [10.5, 25], [8.5, 29], [7.5, 30.5]], handF: 'splay',
  aN: [[23, 20.5], [28.5, 25], [31, 28.5], [32.5, 29.5]], handN: 'splay',
  lF: [[17.5, 32], [16.5, 41], [16, 48.5]], lN: [[22, 32], [23.5, 41], [24.5, 49]], tufts: true,
});
P.frightened = pose({ // hunched, knees bent, shoulders to the ears, hands up at his mouth, looking back
  head: [11, 7], face: 'frightened', neck: [19.5, 23], sF: [15, 24.5], sN: [24, 24.5], hF: [16, 35], hN: [23, 35],
  aF: [[15.5, 25.5], [17, 31], [22, 28], [24, 26]], handF: 'fist',
  aN: [[23.5, 25.5], [26, 31], [27, 26], [27, 24]], handN: 'fist',
  lF: [[17.5, 35], [14, 42], [15.5, 49]], lN: [[22, 35], [25.5, 42], [24, 49]],
});
P.reach = pose({ // leaning in, arm out toward his own body, fingers open, head down
  head: [14, 5], face: 'reach', look: 0, neck: [21.5, 21], sF: [17, 23.5], sN: [26, 23.5], hF: [17.5, 34], hN: [24, 34],
  aF: [[17.5, 24.5], [14.5, 29.5], [13, 34], [12.5, 36]], handF: 'rest',
  aN: [[25.5, 24.5], [30.5, 27.5], [35.5, 29.5], [38, 30]], handN: 'open',
  lF: [[18, 34], [17, 41.5], [15.5, 49]], lN: [[23, 34], [24.5, 41.5], [25.5, 49]],
});
P.recoil = pose({ // thrown back from it: torso leans away, palm out at it, other arm flung back, one foot behind
  head: [7, 3], face: 'recoil', tilt: -1, neck: [15.5, 19], sF: [11, 21.5], sN: [20, 21], hF: [15, 33], hN: [21, 33],
  aF: [[11.5, 22.5], [7, 26], [3.5, 25.5], [2, 24.5]], handF: 'splay',
  aN: [[20, 22], [25, 20.5], [29.5, 17], [31.5, 15]], handN: 'palm',
  lF: [[16, 33], [11.5, 41], [8, 48.5]], lN: [[20.5, 33], [22, 41.5], [23, 49]],
});
// breath frame: chest and head down one pixel
for (const k of Object.keys(P)) {
  const b = P[k], d = 1, sh = (p) => [p[0], p[1] + d];
  P[k + '_b'] = { ...b, head: sh(b.head), neck: sh(b.neck), sF: sh(b.sF), sN: sh(b.sN), aF: [sh(b.aF[0]), sh(b.aF[1]), ...b.aF.slice(2).map(sh)], aN: [sh(b.aN[0]), sh(b.aN[1]), ...b.aN.slice(2).map(sh)] };
  // (wrists ride along with the breath so the Ghostline stays on them)
}
export const POSES = P;
export const POSE_ORDER = ['neutral', 'confused', 'shocked', 'frightened', 'reach', 'recoil'];
export const POSE_NAMES = { neutral: 'NEUTRAL', confused: 'CONFUSED', shocked: 'SHOCKED', frightened: 'FRIGHTENED', reach: 'REACHING', recoil: 'RECOILING' };

function drawHand(M, wr, hd, kind) {
  const [wx, wy] = wr, [hx, hy] = hd;
  const dx = hx - wx, dy = hy - wy, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  capsule(M, wx, wy, hx, hy, 1.25);
  const f = (a, b, len) => { const ex = hx + (ux * a + nx * b) * len, ey = hy + (uy * a + ny * b) * len; line1((x, y) => M.add(x, y), Math.floor(hx), Math.floor(hy), Math.floor(ex), Math.floor(ey)); };
  if (kind === 'open') { f(1, 0, 2.5); f(1, 0.6, 2.4); f(0.9, -0.9, 2); }
  else if (kind === 'splay') { f(1, 0, 2.5); f(0.8, 0.8, 2.4); f(0.8, -0.8, 2.4); f(0.2, 1, 2); }
  else if (kind === 'palm') { f(1, 0, 3); f(1, 0.5, 2.6); f(0.4, -1, 2); M.add(Math.floor(hx + nx * 1.5), Math.floor(hy + ny * 1.5)); }
  else if (kind === 'scratch') { f(1, 0.3, 2); f(1, -0.4, 2); }
  else if (kind === 'fist') { capsule(M, hx, hy, hx + ux, hy + uy, 1.4); }
  else { f(1, 0, 1.5); }
}

// Draw one Milo frame. Returns { buf, wrist: [x,y] } (wrist = the wristband centre, frame px, facing right).
export function miloFrame(name) {
  const p = POSES[name];
  const B = new Buf(FW, FH);
  const M = () => mask(FW, FH);
  const S = PAL;
  // far arm (behind the torso)
  {
    const sl = M(), arm = M();
    const [s, e, w, h] = p.aF;
    const mid = [s[0] + (e[0] - s[0]) * 0.45, s[1] + (e[1] - s[1]) * 0.45];
    capsule(arm, mid[0], mid[1], e[0], e[1], 1.15); capsule(arm, e[0], e[1], w[0], w[1], 1.1); drawHand(arm, w, h, p.handF);
    capsule(sl, s[0], s[1], mid[0], mid[1], 2.1);
    shadePart(B, arm, S.skinFar); shadePart(B, sl, S.pjFar);
  }
  // legs (far then near), feet
  const leg = (l, ramp, skinR) => {
    const m = M(), ft = M();
    capsule(m, l[0][0], l[0][1], l[1][0], l[1][1], 2.3); capsule(m, l[1][0], l[1][1], l[2][0], l[2][1] - 1, 2.1);
    const [ax, ay] = l[2];
    capsule(ft, ax - 0.5, ay + 1.2, ax + 2.5, ay + 1.6, 1.0);
    const before = snapshot(B);
    shadePart(B, ft, skinR, { hi: false });
    shadePart(B, m, ramp, { sw: 2 });
    innerLine(B, m, ramp[3], before);
    // cuff and knee crease
    B.set(Math.round(l[1][0] + 1), Math.round(l[1][1]), ramp[2]);
    for (let x = -2; x <= 2; x++) if (m.has(Math.round(ax + x), Math.round(ay - 1))) B.set(Math.round(ax + x), Math.round(ay - 1), ramp[2]);
  };
  leg(p.lF, S.pjFar, S.skinFar);
  leg(p.lN, S.pj, S.skin);
  // torso: a loose pajama top
  {
    const before = snapshot(B);
    const t = M();
    const hem = p.hem;
    poly(t, [[p.sF[0], p.sF[1] - 0.5], [p.sN[0], p.sN[1] - 0.5], [p.sN[0] + 0.6, p.sN[1] + 3], [p.hN[0] + hem, p.hN[1] + 1], [p.hF[0] - hem, p.hF[1] + 1], [p.sF[0] - 0.6, p.sF[1] + 3]]);
    capsule(t, p.sF[0], p.sF[1] + 0.8, p.sN[0], p.sN[1] + 0.8, 1.6);
    shadePart(B, t, S.pj, { sw: 3 });
    innerLine(B, t, S.pj[3], before);
    // stripes, hem, collar, pocket
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) if (t.has(x, y) && x % 3 === 1 && B.get(x, y) === S.pj[1]) B.set(x, y, S.pjStripe);
    const nx = Math.round(p.neck[0]), ny = Math.round(p.neck[1]);
    // V neck: skin in the opening, trim around it
    for (const [dx, dy, c] of [[-1, 1, 'T'], [0, 1, 's'], [1, 1, 's'], [2, 1, 'T'], [0, 2, 's'], [1, 2, 'T'], [-1, 2, 'T'], [0, 3, 'T']]) B.set(nx + dx, ny + dy, c === 's' ? S.skin[2] : S.trim);
    const px = Math.round((p.sN[0] + p.hN[0]) / 2) - 1, py = Math.round(p.sN[1]) + 5;
    for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2], [2, 1], [2, 2], [1, 3]]) if (t.has(px + dx, py + dy)) B.set(px + dx, py + dy, S.pj[2]);
    for (let x = 0; x < FW; x++) { const y = Math.round(Math.max(p.hF[1], p.hN[1]) + 1); if (t.has(x, y)) B.set(x, y, S.pj[2]); }
  }
  // neck
  { const n = M(); capsule(n, p.neck[0], p.neck[1] - 1, p.neck[0], p.neck[1] + 0.5, 1.4); const before = snapshot(B); shadePart(B, n, S.skin, { hi: false }); void before; for (let x = 0; x < FW; x++) if (n.has(x, Math.round(p.neck[1]) - 1)) B.set(x, Math.round(p.neck[1]) - 1, S.skin[2]); }
  // head
  {
    const H = head(p.face, { look: p.look });
    const before = snapshot(B);
    const hm = M();
    const [ox, oy] = p.head;
    for (let y = 0; y < H.h; y++) for (let x = 0; x < H.w; x++) {
      const c = H.get(x, y); if (!c) continue;
      let ty = y - 1 + oy;
      if (p.tilt) ty += p.tilt > 0 ? (x > 8 ? 1 : 0) : (x < 7 ? 1 : 0);
      const tx = x + ox;
      B.set(tx, ty, c); hm.add(tx, ty);
    }
    if (p.tufts) for (const [x, y] of [[6, -1], [10, -2], [13, -1]]) { B.set(x + ox, y + oy, S.hair[1]); hm.add(x + ox, y + oy); }
    innerLine(B, hm, S.hair[3], before);
  }
  // near arm (in front)
  let wrist;
  {
    const before = snapshot(B);
    const sl = M(), arm = M();
    const [s, e, w, h] = p.aN;
    const mid = [s[0] + (e[0] - s[0]) * 0.45, s[1] + (e[1] - s[1]) * 0.45];
    capsule(arm, mid[0], mid[1], e[0], e[1], 1.15); capsule(arm, e[0], e[1], w[0], w[1], 1.1); drawHand(arm, w, h, p.handN);
    capsule(sl, s[0], s[1], mid[0], mid[1], 2.1);
    shadePart(B, arm, S.skin);
    const b2 = snapshot(B);
    shadePart(B, sl, S.pj, { sw: 2 });
    innerLine(B, arm, S.skin[3], before);
    innerLine(B, sl, S.pj[3], b2);
    // the white patient wristband, just above the wrist
    const bx = e[0] + (w[0] - e[0]) * 0.78, by = e[1] + (w[1] - e[1]) * 0.78;
    const dx = w[0] - e[0], dy = w[1] - e[1], L = Math.hypot(dx, dy) || 1;
    for (let k = -1.6; k <= 1.6; k += 0.5) {
      const x = Math.floor(bx - dy / L * k), y = Math.floor(by + dx / L * k);
      if (arm.has(x, y)) B.set(x, y, k > 0.6 ? S.bandSh : S.band);
      const x2 = Math.floor(bx - dy / L * k + dx / L * 0.8), y2 = Math.floor(by + dx / L * k + dy / L * 0.8);
      if (arm.has(x2, y2)) B.set(x2, y2, k > 0.6 ? S.bandSh : S.band);
    }
    wrist = [bx + dx / L * 0.4, by + dy / L * 0.4];
  }
  outline(B, S.out);
  return { buf: B, wrist };
}

// recolor a finished frame to the spirit palette (same pixels: same boy)
export function spiritOf(buf) {
  const S = new Buf(buf.w, buf.h);
  for (let i = 0; i < buf.d.length; i++) {
    const c = buf.d[i];
    if (!c) continue;
    S.d[i] = c === PAL.out ? '#6fa8e8' : toSpirit(c);
  }
  // a light outer rim so the spirit separates from the dark room
  const src = snapshot(S);
  for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) {
    if (src.get(x, y)) continue;
    if (src.get(x - 1, y) || src.get(x + 1, y) || src.get(x, y - 1) || src.get(x, y + 1)) S.set(x, y, '#2a4c8c80');
  }
  return S;
}

// ---------- the living boy asleep in the bed (head on the pillow, arm on the blanket) ----------
// Returns { buf, wrist, hand } in its own frame (60x22): head at left, feet toward the right.
export function sleeperFrame() {
  const W = 50, H = 26;
  const B = new Buf(W, H);
  const hd = head('asleep');
  // the head rests back on the raised pillow, face turned up toward the ceiling (same head, eyes shut)
  for (let y = 0; y < hd.h; y++) for (let x = 0; x < hd.w; x++) {
    const c = hd.get(x, y); if (!c) continue;
    B.set(2 + x, y - 1 + (x < 8 ? 1 : 0) + (x < 4 ? 1 : 0), c);
  }
  // shoulder in the pajama top, then the blanket over the body
  const M = () => mask(W, H);
  const sh = M(); capsule(sh, 18, 15, 24, 15, 3.2);
  const before0 = snapshot(B);
  shadePart(B, sh, PAL.pj, { sw: 2 }); innerLine(B, sh, PAL.pj[3], before0);
  const bl = M();
  poly(bl, [[19, 12], [26, 10], [33, 9.5], [40, 10.5], [46, 12.5], [49.5, 14], [49.5, 25.5], [19, 25.5]]);
  const BL = ['#c9d2de', '#9fadc2', '#73829c', '#4b5872'];
  const before = snapshot(B);
  shadePart(B, bl, BL, { sw: 3, lx: 0.3, ly: -1 });
  innerLine(B, bl, BL[3], before);
  // blanket folds and the turned-down hem
  for (let x = 20; x < 50; x++) { if (bl.has(x, 16)) B.set(x, 16, BL[0]); if (bl.has(x, 17)) B.set(x, 17, BL[2]); }
  for (const [x0, y0, x1, y1] of [[30, 19, 28, 25], [40, 19, 38, 25], [47, 18, 46, 25], [33, 11, 36, 15], [42, 12, 45, 15]]) line1((x, y) => { if (bl.has(x, y)) B.set(x, y, BL[2]); }, x0, y0, x1, y1);
  // his near arm lying on top of the blanket: sleeve, forearm, hand by the edge, wristband
  const arm = M(), sl = M();
  capsule(sl, 20, 15.5, 24, 16.5, 2);
  capsule(arm, 24, 16.5, 29, 18, 1.15); capsule(arm, 29, 18, 34, 19, 1.1); capsule(arm, 34, 19, 36, 20, 1.3);
  line1((x, y) => arm.add(x, y), 36, 20, 38, 21); line1((x, y) => arm.add(x, y), 36, 21, 38, 22);
  const b2 = snapshot(B);
  shadePart(B, arm, PAL.skin); innerLine(B, arm, PAL.skin[3], b2);
  const b3 = snapshot(B);
  shadePart(B, sl, PAL.pj, { sw: 1 }); innerLine(B, sl, PAL.pj[3], b3);
  for (const [x, y, c] of [[32, 18, PAL.band], [32, 19, PAL.band], [33, 19, PAL.band], [32, 20, PAL.bandSh], [33, 20, PAL.bandSh], [33, 18, PAL.band]]) B.set(x, y, c);
  outline(B, PAL.out);
  return { buf: B, wrist: [32.8, 19.3], hand: [37, 21] };
}

// ---------- BOO: Tobias Boone, night janitor, 31 years on shift ----------
// 46x58 frame. Stout old man from the waist up, a wisp below. Cap, mustache, work jacket with a name patch,
// key ring on his belt, lantern held out in front (to the right). He has no shadow.
export const BOO_LANTERN = [40, 25]; // lantern glass centre in the frame (facing right)
export function booFrame(t = 0) {
  const W = 50, H = 60;
  const B = new Buf(W, H);
  const M = () => mask(W, H);
  const ecto = ['#f2fbf6', '#cde2d8', '#93b0a8', '#5d7a7a'];
  const coat = ['#7fa0a8', '#58797f', '#3d5a63', '#26404a'];
  const cap = ['#4d6380', '#33455f', '#222f44', '#141c2b'];
  // the wisp tail (sways)
  {
    const m = M();
    const sw = Math.sin(t * Math.PI * 2) * 2;
    capsule(m, 20, 38, 18 + sw * 0.3, 46, 7);
    capsule(m, 18 + sw * 0.3, 46, 14 + sw, 52, 4.5);
    capsule(m, 14 + sw, 52, 9 + sw * 1.4, 56, 2.5);
    capsule(m, 9 + sw * 1.4, 56, 5 + sw * 1.6, 57, 1);
    shadePart(B, m, ecto, { sw: 2 });
  }
  // far arm, spread back behind (sheltering whoever is behind him)
  {
    const m = M(), hand = M();
    capsule(m, 14, 24, 7, 29, 2.6); capsule(m, 7, 29, 3, 33, 2.3);
    capsule(hand, 3, 33, 1.5, 35.5, 1.8); line1((x, y) => hand.add(x, y), 1, 35, 0, 37);
    shadePart(B, hand, ecto.map((c) => mix(c, '#5d7a7a', 0.25)));
    shadePart(B, m, coat.map((c) => mix(c, '#26404a', 0.3)), { sw: 2 });
  }
  // the body: work jacket, round old belly, slumped shoulders
  {
    const m = M();
    poly(m, [[13, 20], [28, 19], [32, 24], [33, 32], [30, 40], [14, 41], [10, 34], [10, 25]]);
    const before = snapshot(B);
    shadePart(B, m, coat, { sw: 3 });
    innerLine(B, m, coat[3], before);
    // jacket front edge, buttons, pocket and the name patch
    line1((x, y) => { if (m.has(x, y)) B.set(x, y, coat[3]); }, 26, 22, 25, 40);
    for (const y of [26, 31, 36]) B.set(26, y, '#b8c4c0');
    B.rect(14, 26, 6, 3, '#e4ece4'); B.rect(15, 27, 4, 1, '#7b4a3a'); // name patch: TOBY
    B.rect(13, 25, 8, 1, coat[2]);
    for (let x = 28; x <= 31; x++) B.set(x, 33, coat[3]);
    // belt
    for (let x = 10; x < 33; x++) if (m.has(x, 37)) B.set(x, 37, '#2a2620');
    B.set(19, 37, '#c9a24c'); B.set(20, 37, '#8a6428');
  }
  // collar and head
  {
    const m = M();
    poly(m, [[13, 20], [19, 23], [26, 23], [31, 19], [29, 17], [15, 17]]);
    shadePart(B, m, coat.map((c) => mix(c, '#ffffff', 0.1)), { sw: 1 });
    const HG = [
      '....llllllll....',
      '..llleeeeeeeel..',
      '.leeeeeeeeeeeee.',
      '.deeeeeGGGeGGGGe',
      'ddeeeeeKKgeKKge.',
      'dEeeeeeKKeeKKNe.',
      'dEdeeeeeeeeNNNNn',
      '.ddeeeeeeeeNNNn.',
      '.ddeeeWWWWWWWWWw',
      '..ddWWWWWWWWWWWW',
      '..ddWwwWWWWwwWWw',
      '...ddewwmmmmwwd.',
      '....ddeeeeeeed..',
      '.....dddddddd...',
    ];
    const HC = { l: '#eef6f2', e: '#cfe0d8', d: '#8eaaa2', E: '#6d8a86', G: '#f6f8f6', g: '#8eaaa2', K: '#0e161c', N: '#d7b2a8', n: '#a07c76', W: '#fbfcfa', w: '#a3b2ae', m: '#5a6c6c' };
    HG.forEach((row, y) => [...row].forEach((ch, x) => { if (HC[ch]) B.set(15 + x, 6 + y, HC[ch]); }));
    // the janitor cap: crown, band, brass badge, a long brim forward
    const c = M();
    capsule(c, 18, 4.5, 28, 4.5, 3.6);
    poly(c, [[15, 6], [31, 6], [31, 8.5], [15, 8.5]]);
    const before = snapshot(B);
    shadePart(B, c, cap, { sw: 2 });
    innerLine(B, c, cap[3], before);
    for (let x = 15; x <= 31; x++) B.set(x, 7, x % 2 ? cap[2] : cap[1]);
    for (let x = 26; x <= 36; x++) { B.set(x, 8, x < 28 ? cap[2] : cap[3]); }
    B.set(23, 3, '#f0c868'); B.set(24, 3, '#c9a24c'); B.set(23, 4, '#a57a2c'); B.set(24, 4, '#8a6428');
    B.set(23, 1, cap[0]); B.set(24, 1, cap[0]);
  }
  // key ring on the belt: a brass ring and five keys
  {
    const ring = [[14, 38], [15, 38], [16, 38], [13, 39], [17, 39], [13, 40], [17, 40], [14, 41], [15, 41], [16, 41]];
    for (const [x, y] of ring) B.set(x, y, '#d6a84a');
    B.set(15, 37, '#8a6428');
    const sw = Math.round(Math.sin(t * Math.PI * 2 + 1) * 1);
    for (const [k, [x, y, len, col]] of [[0, [13, 42, 4, '#b8c0c8']], [1, [15, 42, 5, '#d6a84a']], [2, [17, 42, 3, '#9aa3ad']], [3, [12, 41, 3, '#c8ccd0']], [4, [18, 41, 4, '#b8c0c8']]].entries()) {
      void k;
      for (let i = 0; i < len; i++) B.set(x + (i > 1 ? sw : 0), y + i, col);
      B.set(x + 1 + (len > 2 ? sw : 0), y + len - 1, col);
    }
  }
  // near arm reaching forward, holding the lantern out by its bail
  {
    const m = M(), hand = M();
    capsule(m, 28, 22, 33, 24, 2.7); capsule(m, 33, 24, 37, 18, 2.4);
    capsule(hand, 37, 18, 38, 16, 2);
    const before = snapshot(B);
    shadePart(B, m, coat, { sw: 2 });
    innerLine(B, m, coat[3], before);
    shadePart(B, hand, ecto, { hi: false });
    line1((x, y) => B.set(x, y, coat[0]), 34, 21, 36, 18);
  }
  // the lantern: bail, cap, glass with a flame, base
  {
    const L = BOO_LANTERN, x = L[0] - 3, y = L[1] - 6;
    for (const [dx, dy] of [[2, -3], [3, -4], [4, -4], [5, -3], [1, -2], [6, -2], [1, -1], [6, -1]]) B.set(x + dx, y + dy, '#8a6a34');
    B.rect(x + 1, y, 6, 2, '#b8893a'); B.rect(x + 2, y - 1, 4, 1, '#d9a74a'); B.rect(x + 1, y + 1, 6, 1, '#7a5626');
    B.rect(x, y + 2, 8, 8, '#ffe4a0');
    B.rect(x + 1, y + 3, 6, 6, '#fff3cf');
    B.set(x + 3, y + 4, '#ffd27a'); B.set(x + 4, y + 4, '#ffffff'); B.set(x + 3, y + 5, '#ffb648'); B.set(x + 4, y + 5, '#fff6e0'); B.set(x + 3, y + 6, '#ff9a3a'); B.set(x + 4, y + 6, '#ffc060'); B.set(x + 3, y + 7, '#e07a2a'); B.set(x + 4, y + 7, '#e07a2a');
    for (let j = 2; j < 10; j++) { B.set(x, y + j, '#9a7030'); B.set(x + 7, y + j, '#6a4c22'); }
    for (let j = 3; j < 9; j++) B.set(x + 4 + (j % 2 ? 2 : 0) - 1, y + j, B.get(x + 4, y + j));
    B.rect(x, y + 10, 8, 2, '#b8893a'); B.rect(x + 1, y + 11, 6, 1, '#6a4c22');
  }
  outline(B, '#0d1016');
  return B;
}

// ---------- Bed 7: the room at midnight (base colors before light) ----------
// Scale: Milo is 46 art px = 1.7 m, so 1 m = 27 art px. Bed 2.1 m long, mattress 0.6 m up, door 2.1 m, ceiling 3.4 m.
export const BED = { x0: 100, x1: 162, top: 127 };
export const SLEEPER_AT = [101, 104]; // top-left of the sleeper frame in the room
export const LAMP_AT = [81, 114]; // bedside lamp bulb
export const MONITOR = { x: 108, y: 69, w: 17, h: 11 };
export const DOOR = { x: 262, y: 59, w: 32, h: 57 };
export function drawRoom(opts = {}) {
  const { lampOn = true } = opts;
  const B = new Buf(AW, AH);
  const r = rng(77);
  const R = (x, y, w, h, c) => B.rect(x, y, w, h, c);
  // ceiling lost in the dark, then an old plaster cornice
  for (let y = 0; y < 24; y++) for (let x = 0; x < AW; x++) B.set(x, y, mix('#07080d', '#12141b', y / 24 + (bayer(x, y) - 0.5) * 0.2));
  for (let x = 0; x < AW; x += 64) R(x, 0, 6, 22, '#0d0f15');
  R(0, 24, AW, 1, '#3a3e46'); R(0, 25, AW, 1, '#262a32'); R(0, 26, AW, 1, '#15171d');
  // aged grey wall, darker up high, stains and flaking paint
  for (let y = 27; y < 91; y++) for (let x = 0; x < AW; x++) {
    const k = (y - 27) / 64;
    B.set(x, y, mix('#33373e', '#5a5e5c', Math.pow(k, 0.85) + (bayer(x, y) - 0.5) * 0.08));
  }
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(r() * AW), len = 6 + Math.floor(r() * 26), w = 1 + Math.floor(r() * 3);
    for (let y = 27; y < 27 + len; y++) for (let j = 0; j < w; j++) { const c = B.get(x + j, y); if (c && bayer(x + j, y) < 0.75 - (y - 27) / len * 0.7) B.set(x + j, y, mix(c, '#3a3420', 0.28)); }
  }
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(r() * AW), y = 34 + Math.floor(r() * 50);
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [2, 1], [1, 1]]) { const c = B.get(x + dx, y + dy); if (c) B.set(x + dx, y + dy, mix(c, '#7e8078', 0.35)); }
    const c = B.get(x + 1, y + 2); if (c) B.set(x + 1, y + 2, mix(c, '#000000', 0.35));
  }
  { let x = 232; for (let y = 27; y < 60; y++) { x += (r() < 0.3 ? 1 : 0) - (r() < 0.2 ? 1 : 0); B.set(x, y, '#24262a'); if (r() < 0.2) B.set(x + 1, y, '#2c2e32'); } }
  // chair rail, the darker wainscot, skirting
  R(0, 91, AW, 1, '#7e817a'); R(0, 92, AW, 1, '#4c4f4e'); R(0, 93, AW, 1, '#2c302f');
  for (let y = 94; y < 113; y++) for (let x = 0; x < AW; x++) B.set(x, y, mix('#3c4842', '#2a332f', (y - 94) / 19 + (bayer(x, y) - 0.5) * 0.12));
  for (let x = 6; x < AW; x += 28) for (let y = 94; y < 113; y++) { B.set(x, y, '#26302b'); B.set(x + 1, y, '#46524b'); }
  R(0, 113, AW, 1, '#4a504c'); R(0, 114, AW, 2, '#1c2220');
  // floor: old linoleum at an angle, seams widening toward us, tiles converging
  for (let y = FLOOR_Y; y < AH; y++) for (let x = 0; x < AW; x++) {
    const k = (y - FLOOR_Y) / (AH - FLOOR_Y);
    let c = mix('#2e302b', '#46473e', k + (bayer(x, y) - 0.5) * 0.1);
    if (((x * 3 + y * 7) % 23) === 0) c = mix(c, '#5a5a4e', 0.3);
    B.set(x, y, c);
  }
  for (const y of [121, 128, 136, 155, 168]) for (let x = 0; x < AW; x++) B.set(x, y, mix(B.get(x, y), '#1a1b16', 0.7));
  for (let x = 0; x < AW; x++) { B.set(x, SEAM_Y - 1, '#58584a'); B.set(x, SEAM_Y, '#121310'); B.set(x, SEAM_Y + 1, '#1d1e19'); }
  for (let i = -14; i < 24; i++) {
    const vx = 160, vy = -150;
    for (let y = FLOOR_Y; y < AH; y++) { const x = Math.round(vx + (i * 20 - vx + 10) * (y - vy) / (FLOOR_Y + 40 - vy)); if (x >= 0 && x < AW) B.set(x, y, mix(B.get(x, y), '#1a1b16', 0.55)); }
  }
  // curtain rail and two privacy curtains (gathered left, half drawn past the bed)
  R(0, 30, AW, 1, '#8a887c'); R(0, 31, AW, 1, '#3c3c36');
  const curtain = (x0, w, y1, folds, seed) => {
    const rr = rng(seed);
    for (let x = 0; x < w; x++) {
      const f = folds[x % folds.length];
      const col = f === 'L' ? '#8c9c90' : f === 'l' ? '#76877c' : f === 'D' ? '#3a4640' : '#5c6c62';
      const hem = y1 - (x % 5 === 0 ? 1 : 0);
      for (let y = 32; y < hem; y++) B.set(x0 + x, y, mix(col, '#20282a', Math.max(0, (y - 60) / 90)));
      B.set(x0 + x, hem, '#2a3430'); B.set(x0 + x, hem - 1, mix(col, '#ffffff', 0.06));
      if (x % 4 === 1) { B.set(x0 + x, 32, '#b4ae94'); B.set(x0 + x, 33, '#4a4a40'); }
    }
    for (let i = 0; i < 6; i++) { const x = x0 + Math.floor(rr() * w), y = 50 + Math.floor(rr() * 50); B.set(x, y, '#2a3330'); B.set(x, y + 1, '#2a3330'); }
  };
  curtain(4, 34, 117, 'LlMMDDMlLLlMDDM', 3);
  curtain(196, 18, 117, 'MLlDDMLlMD', 5);
  // the door at the end: frame, leaf, wired glass, kick plate, handle, cold light under it
  const D = DOOR;
  R(D.x - 3, D.y - 3, D.w + 6, D.h + 3, '#5c5c54'); R(D.x - 3, D.y - 3, D.w + 6, 1, '#7c7c72'); R(D.x - 1, D.y - 1, D.w + 2, D.h + 1, '#262724');
  for (let y = D.y; y < D.y + D.h; y++) for (let x = D.x; x < D.x + D.w; x++) {
    let c = mix('#4e4c46', '#3a3934', (x - D.x) / D.w);
    if (x === D.x) c = '#625f58';
    if (x === D.x + D.w - 1) c = '#24231f';
    B.set(x, y, c);
  }
  {
    const wx = D.x + 6, wy = D.y + 8, ww = 12, wh = 18;
    R(wx - 1, wy - 1, ww + 2, wh + 2, '#24231f'); R(wx, wy, ww, wh, '#18202e');
    for (let y = wy; y < wy + wh; y++) for (let x = wx; x < wx + ww; x++) if ((x - wx + y - wy) % 4 === 0 || (x - wx - (y - wy) + 40) % 4 === 0) B.set(x, y, '#28324a');
    R(wx, wy, ww, 1, '#3a465c');
    R(D.x + 2, D.y + D.h - 9, D.w - 4, 7, '#5c5a52'); R(D.x + 2, D.y + D.h - 9, D.w - 4, 1, '#7a786e');
    R(D.x + D.w - 6, D.y + 30, 3, 2, '#b49a5a'); R(D.x + D.w - 6, D.y + 32, 1, 2, '#6a5a34');
  }
  R(D.x, D.y + D.h - 1, D.w, 1, '#8aa4c8');
  // room plate (7) and the clock over the door, stopped at 3:33
  R(D.x - 13, D.y + 10, 8, 10, '#22252a'); R(D.x - 12, D.y + 11, 6, 8, '#c9c6b4');
  for (const [x, y] of [[1, 1], [2, 1], [3, 1], [4, 1], [4, 2], [3, 3], [3, 4], [2, 5], [2, 6]]) B.set(D.x - 12 + x, D.y + 11 + y, '#1a1a1a');
  R(D.x + 5, D.y - 14, 22, 10, '#15161a'); R(D.x + 5, D.y - 14, 22, 1, '#3a3c44'); R(D.x + 6, D.y - 13, 20, 8, '#050505');
  glyphs(B, '3:33', D.x + 9, D.y - 12, '#ff4a3a');
  // wall fittings over the bed: oxygen panel, call-button cord
  R(132, 84, 18, 6, '#6a6d68'); R(132, 84, 18, 1, '#8a8c86'); R(132, 89, 18, 1, '#3a3c3a');
  B.rect(135, 86, 2, 2, '#3c8a5a'); B.rect(140, 86, 2, 2, '#e8e8e2'); B.rect(145, 86, 2, 2, '#5a6a8a');
  for (let y = 90; y < 118; y++) B.set(152 + (y > 108 ? 1 : 0), y, '#262624');
  R(151, 117, 4, 4, '#c8c4b0'); B.set(152, 118, '#c03a2a'); B.set(153, 118, '#c03a2a');
  // a notice and a wall outlet
  R(222, 56, 13, 16, '#2a2620'); R(223, 57, 11, 14, '#b8b29a');
  for (let y = 60; y < 70; y += 2) R(225, y, 5 + ((y * 7) % 4), 1, '#6a665a');
  R(225, 58, 7, 1, '#8a3a32');
  R(64, 104, 5, 6, '#8a8a80'); B.set(66, 106, '#1a1a1a'); B.set(66, 108, '#1a1a1a');
  // the monitor on its wall arm (screen drawn live)
  const Mo = MONITOR;
  for (let x = 98; x < Mo.x; x++) { B.set(x, 75, '#5a5c5a'); B.set(x, 76, '#2a2c2a'); }
  R(96, 71, 3, 9, '#6a6c68');
  R(Mo.x - 2, Mo.y - 2, Mo.w + 4, Mo.h + 6, '#2e3034'); R(Mo.x - 2, Mo.y - 2, Mo.w + 4, 1, '#4c4f54'); R(Mo.x - 2, Mo.y + Mo.h + 3, Mo.w + 4, 1, '#16171a');
  R(Mo.x, Mo.y, Mo.w, Mo.h, '#050a0a');
  for (let i = 0; i < 4; i++) B.set(Mo.x + 1 + i * 3, Mo.y + Mo.h + 1, i === 0 ? '#3ad67a' : '#4c4f54');
  // bedside table: drawer, a cup, the lamp
  R(69, 127, 24, 2, '#6a5238'); R(69, 127, 24, 1, '#8c6e4a');
  R(70, 129, 22, 13, '#4a3828'); R(70, 129, 1, 13, '#5e4834'); R(91, 129, 1, 13, '#2e2218');
  R(72, 131, 18, 5, '#56412e'); R(72, 136, 18, 1, '#2e2218'); R(79, 133, 3, 1, '#b49a5a');
  R(70, 142, 2, 2, '#2a2018'); R(90, 142, 2, 2, '#2a2018');
  R(87, 123, 3, 4, '#c8ccd4'); R(87, 123, 3, 1, '#e8ecf0'); R(89, 124, 1, 3, '#8a8e96');
  R(76, 125, 10, 2, '#2e2a26'); R(77, 124, 8, 1, '#4a443c');
  R(80, 114, 2, 10, '#6a5a3a');
  for (let y = 0; y < 9; y++) { const w = 8 + y; for (let x = 0; x < w; x++) B.set(81 - Math.floor(w / 2) + x, 105 + y, lampOn ? (x % 3 === 0 ? '#c88a42' : '#ecb464') : (x % 3 === 0 ? '#3a2e22' : '#4a3a28')); }
  R(73, 114, 17, 1, lampOn ? '#fff2c8' : '#3a3024');
  // the bed: steel tubes, mattress, frame rail, legs and wheels; dark under it
  const bx = BED.x0, bx1 = BED.x1;
  R(bx + 3, 138, bx1 - bx - 4, 13, '#0f1014');
  const tube = (x, y0, y1) => { R(x, y0, 2, y1 - y0, '#9aa0a8'); R(x, y0, 1, y1 - y0, '#d4dae0'); B.set(x + 1, y0, '#e4e8ec'); };
  tube(bx, 104, 151); tube(bx + 8, 112, 127);
  for (const y of [106, 113, 120]) { R(bx, y, 10, 1, '#c4cad0'); R(bx, y + 1, 10, 1, '#6a7078'); }
  tube(bx1 - 2, 114, 152); tube(bx1 - 10, 118, 127);
  for (const y of [116, 122]) { R(bx1 - 10, y, 10, 1, '#c4cad0'); R(bx1 - 10, y + 1, 10, 1, '#6a7078'); }
  R(bx1 - 9, 124, 6, 8, '#d8d2b8'); R(bx1 - 9, 124, 6, 1, '#f0ead0'); R(bx1 - 7, 123, 2, 2, '#8a8a8a');
  for (let y = 127; y < 131; y += 2) R(bx1 - 8, y, 4, 1, '#7a7464');
  R(bx + 2, 127, bx1 - bx - 4, 2, '#e4e6ea'); R(bx + 2, 129, bx1 - bx - 4, 6, '#c4c8ce'); R(bx + 2, 134, bx1 - bx - 4, 1, '#8a8e96');
  R(bx + 2, 135, bx1 - bx - 4, 3, '#7a8088'); R(bx + 2, 135, bx1 - bx - 4, 1, '#b8bec6'); R(bx + 2, 137, bx1 - bx - 4, 1, '#3a3e44');
  for (const lx of [bx + 5, bx1 - 8]) { R(lx, 138, 2, 11, '#6a7078'); R(lx, 138, 1, 11, '#9aa0a8'); R(lx - 1, 149, 4, 3, '#1c1d22'); R(lx, 149, 2, 1, '#4a4c52'); }
  for (const lx of [bx + 10, bx1 - 13]) { R(lx, 138, 1, 5, '#3a3e44'); R(lx - 1, 143, 3, 2, '#151619'); }
  // pillow (raised head of the bed)
  for (let y = 0; y < 12; y++) for (let x = 0; x < 16; x++) {
    if (((x - 7.5) / 8.2) ** 2 + ((y - 6) / 6.4) ** 2 <= 1) B.set(bx + 2 + x, 116 + y, y < 3 ? '#f2f2ec' : y < 8 ? '#d6d6ce' : '#a6a8a6');
  }
  // the blanket hanging over the front of the mattress
  for (let x = bx + 18; x < bx1 - 2; x++) {
    const hang = 137 + ((x * 13) % 7 === 0 ? 1 : 0);
    for (let y = 128; y < hang; y++) B.set(x, y, y < 130 ? '#9fadc2' : mix('#73829c', '#4b5872', (y - 130) / 8));
    B.set(x, hang, '#343e58');
  }
  for (const x of [bx + 27, bx + 36, bx + 45, bx + 53]) for (let y = 131; y < 137; y++) B.set(x + ((y >> 2) & 1), y, '#4b5872');
  return B;
}

// 3x5 digits for the clock and the monitor
const GLYPH = {
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'], 8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'], ':': ['0', '1', '0', '1', '0'],
};
export function glyphs(B, str, x, y, col) {
  let cx = x;
  for (const ch of str) {
    const g = GLYPH[ch];
    if (!g) { cx += 2; continue; }
    g.forEach((row, j) => [...row].forEach((b, i) => { if (b === '1') B.set(cx + i, y + j, col); }));
    cx += g[0].length + 1;
  }
  return cx;
}

// ---------- the light pass: baked midnight light with dithered bands ----------
// lights: { x, y, r, col: [r,g,b] 0..1, k, cone?: fn(x,y)->0..1 }. Returns a new canvas.
export function light(baseBuf, lights, ambient = [0.13, 0.15, 0.24], { blocked = null } = {}) {
  const cv = document.createElement('canvas'); cv.width = baseBuf.w; cv.height = baseBuf.h;
  const ctx = cv.getContext('2d'); const img = ctx.createImageData(baseBuf.w, baseBuf.h);
  const STEP = 1 / 7;
  for (let y = 0; y < baseBuf.h; y++) for (let x = 0; x < baseBuf.w; x++) {
    const c = baseBuf.d[y * baseBuf.w + x]; if (!c) continue;
    let L = [ambient[0], ambient[1], ambient[2]];
    for (const l of lights) {
      if (blocked && l.block && blocked(x, y)) continue;
      const d = Math.hypot((x - l.x) / (l.sx || 1), (y - l.y) / (l.sy || 1));
      let f = Math.max(0, 1 - d / l.r); f = (l.lin ? f : f * f) * l.k;
      if (l.cone) f *= l.cone(x, y);
      if (f > 0) { L[0] += l.col[0] * f; L[1] += l.col[1] * f; L[2] += l.col[2] * f; }
    }
    const th = bayer(x, y);
    const v = rgb(c), o = (y * baseBuf.w + x) * 4;
    for (let i = 0; i < 3; i++) {
      const q = L[i] / STEP, lo = Math.floor(q), fr = q - lo;
      const lq = (fr > th ? lo + 1 : lo) * STEP;
      img.data[o + i] = Math.min(255, v[i] * Math.min(1.7, lq));
    }
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// ---------- THE STRETCH: only its shadow ----------
// Thrown up the back wall by a cold corridor light low and off screen to the right (BEAM_FROM).
// Legs rise from the floor at the right, the back folds over onto the ceiling, the head hangs down over the room,
// one arm comes down the wall toward the boy and the fingers stop where Boo's lantern light begins.
// Room art px. t = seconds (slow breathing, fingers testing the light).
export const BEAM_FROM = [372, 150];
export function stretchShadow(t = 0) {
  const s = Math.sin(t * 1.1) * 1.2, r = Math.sin(t * 0.6) * 2.5;
  const pts = [
    // near leg up from the floor, the knee bent backwards, the hip, the back up the wall
    [322, 180], [316, 160], [312, 140], [315, 124], [308, 106], [302, 88], [300, 70], [296, 50], [290, 34], [284, 27],
    // the back folds onto the ceiling (a shadow bending where no body could)
    [272, 20], [252, 14], [228, 12], [208, 15], [196, 19],
    // a thin neck bends down; the head hangs over the room, tilted, a ridge on it like a cap brim
    [190, 22], [186, 26], [186, 30], [182, 32], [175, 34], [171, 35], [176, 37], [177, 42], [178 + s, 48], [181 + s, 53], [186, 56], [190, 53], [192, 47], [194, 40], [197, 33], [199, 30],
    // shoulder, the elbow out, the forearm coming down and in toward the bed
    [202, 30], [203, 38], [208, 50], [216, 62], [220, 72], [214, 84], [202 + r, 93], [190 + r, 98],
  ];
  // the hand: four long fingers and a thumb, spread, testing the edge of the light
  const hx = 180 + r, hy = 102;
  const F = [[-24, -10, 0], [-29, -2, 1], [-27, 6, 2], [-21, 13, 3], [-6, 13, 4]];
  pts.push([hx + 2, hy - 5]);
  for (const [fx, fy, i] of F) {
    const w = Math.sin(t * 1.7 + i * 1.3) * 1.6;
    const kx = hx + fx * 0.5, ky = hy + fy * 0.5 - 1.4; // knuckle
    pts.push([kx, ky], [kx + fx * 0.22 + w * 0.5, ky + fy * 0.1 - 1.2 + w * 0.3], [hx + fx + w, hy + fy + w * 0.4], [kx + fx * 0.22 + 1, ky + fy * 0.1 + 1.6 + w * 0.3], [kx + 0.6, ky + 2.6]);
  }
  pts.push([hx + 4, hy + 7]);
  // under the arm, the armpit, the thin torso along the ceiling and down the wall, the far leg, the gap, the near leg
  pts.push([196 + r, 106], [210, 98], [222, 88], [228, 74], [222, 58], [216, 44], [214, 34], [230, 30], [252, 30], [270, 36], [280, 52], [282, 76],
    [276, 104], [270, 124], [272, 140], [266, 160], [262, 180], [272, 180], [278, 160], [280, 140], [282, 120], [288, 100], [291, 96],
    [296, 112], [300, 132], [302, 152], [308, 180]);
  return pts;
}

export function polyMask(w, h, pts) { const M = mask(w, h); poly(M, pts); return M; }
