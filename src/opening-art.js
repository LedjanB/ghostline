// THE WRONG SIDE OF THE BED: art for the opening room (St. Mercy, bed 7), drawn in code.
// One art pixel = 5 screen px (OP_L), the same as Milo at 5x, so the room and the actors share one grid.
// Palette: midnight navy and charcoal, warm amber brass, pale-blue spectral Milo (docs/art-direction.md).

export const OP_L = 5;
export const ROOM_W = 224; // art px (1120 screen px)
export const ROOM_H = 72;

function cv(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const t = scene.textures.createCanvas(key, w, h);
  const c = t.context;
  c.imageSmoothingEnabled = false;
  draw(c, w, h);
  t.refresh();
  return t;
}
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, k) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`; };
function rng(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// rows of letters -> pixels (1px dark outline like every actor in the game)
function px(scene, key, rows, pal, outline = '#0b0918') {
  const h = rows.length, w = rows[0].length, p = outline ? 1 : 0;
  return cv(scene, key, w + p * 2, h + p * 2, (c) => {
    const solid = (x, y) => y >= 0 && y < h && x >= 0 && x < w && rows[y][x] !== '.' && pal[rows[y][x]];
    if (outline) for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) R(c, x + p, y + p, 1, 1, outline);
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (solid(x, y)) R(c, x + p, y + p, 1, 1, pal[rows[y][x]]);
  });
}

// 3x5 digits and the few letters we need
const GLYPH = {
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'], 8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'], E: ['111', '100', '110', '100', '111'], X: ['101', '101', '010', '101', '101'],
  I: ['111', '010', '010', '010', '111'], T: ['111', '010', '010', '010', '010'], ':': ['0', '1', '0', '1', '0'],
};
export function glyphs(c, str, x, y, col, ghost) {
  let cx = x;
  for (const ch of str) {
    const g = GLYPH[ch];
    if (!g) { cx += 2; continue; }
    g.forEach((row, j) => [...row].forEach((b, i) => {
      if (b === '1') R(c, cx + i, y + j, 1, 1, col);
      else if (ghost) R(c, cx + i, y + j, 1, 1, ghost);
    }));
    cx += g[0].length + 1;
  }
  return cx;
}

// ---- the room (static back plane) ----
function drawRoom(c) {
  const r = rng(733);
  const W = ROOM_W;
  // ceiling, lost in the dark
  R(c, 0, 0, W, 5, '#06070d');
  R(c, 0, 4, W, 1, '#141828');
  // upper wall: navy falling into black toward the ceiling
  for (let y = 5; y < 30; y++) R(c, 0, y, W, 1, mix('#080a13', '#1a2238', Math.pow((y - 5) / 25, 0.8)));
  c.fillStyle = 'rgba(140,160,220,0.05)';
  for (let x = 1; x < W; x += 5) for (let y = 9; y < 30; y++) if ((x * 7 + y * 13) % 9 !== 0) c.fillRect(x, y, 1, 1);
  // water stains running down from the ceiling
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(r() * W), len = 6 + Math.floor(r() * 14);
    for (let y = 5; y < 5 + len; y++) { c.fillStyle = `rgba(4,5,10,${0.35 * (1 - (y - 5) / len)})`; c.fillRect(x + (y % 7 === 0 ? 1 : 0), y, 1 + (r() < 0.3 ? 1 : 0), 1); }
  }
  // brass chair rail
  R(c, 0, 30, W, 1, '#6b5634'); R(c, 0, 31, W, 1, '#2c2418');
  // tiles
  for (let y = 32; y < 48; y++) {
    for (let x = 0; x < W; x++) {
      const ty = (y - 32) % 4, tx = (x + (Math.floor((y - 32) / 4) % 2) * 3) % 6;
      let col = mix('#223240', '#18222e', (y - 32) / 16);
      if (ty === 0 || tx === 0) col = '#121a24';
      else if (ty === 1 && tx === 1) col = '#2c3e4e';
      R(c, x, y, 1, 1, col);
    }
  }
  for (let i = 0; i < 14; i++) { const x = Math.floor(r() * W), y = 33 + Math.floor(r() * 14); R(c, x, y, 1, 1, '#0e141c'); R(c, x + 1, y + 1, 1, 1, '#0e141c'); }
  // skirting
  R(c, 0, 48, W, 2, '#0e1119'); R(c, 0, 48, W, 1, '#272c3c');
  // floor: worn linoleum checker, darker toward the front
  const rows = [2, 2, 3, 3, 4, 4, 4];
  let y = 50;
  rows.forEach((h, ri) => {
    for (let x = 0; x < W; x++) {
      const k = Math.floor((x + ri * 4) / (8 + ri)) % 2;
      const base = k ? '#151a2a' : '#10141f';
      for (let j = 0; j < h; j++) R(c, x, y + j, 1, 1, mix(base, '#07080e', (y + j - 50) / 26));
    }
    y += h;
  });
  R(c, 0, 50, W, 1, '#2a3148');
  c.fillStyle = 'rgba(160,180,255,0.04)'; c.fillRect(0, 51, W, 2);
  // corners
  R(c, 0, 0, 3, 50, '#05060b'); R(c, W - 4, 0, 4, 50, '#05060b');

  // ---- left: framed print of the fair, monitor stand, bedside table ----
  R(c, 24, 15, 11, 9, '#5a4a30'); R(c, 25, 16, 9, 7, '#1d2436');
  for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; R(c, Math.round(29 + Math.cos(t) * 2.6), Math.round(19 + Math.sin(t) * 2.6), 1, 1, '#4a5274'); }
  R(c, 29, 19, 1, 3, '#4a5274'); R(c, 28, 22, 3, 1, '#3a4058'); R(c, 24, 15, 11, 1, '#7a6440');
  // monitor on its rolling pole (the screen itself is live, drawn by the scene)
  R(c, 13, 32, 2, 25, '#3a404e'); R(c, 13, 32, 1, 25, '#4c5464');
  R(c, 9, 56, 10, 1, '#2a2f3c'); R(c, 9, 57, 2, 1, '#14161e'); R(c, 17, 57, 2, 1, '#14161e');
  R(c, 6, 20, 16, 13, '#262a36'); R(c, 6, 20, 16, 1, '#3c4252'); R(c, 6, 20, 1, 13, '#343a48');
  R(c, 7, 21, 14, 10, '#03090a');
  for (let i = 0; i < 4; i++) R(c, 8 + i * 3, 32, 1, 1, '#4a5060');
  R(c, 4, 26, 2, 1, '#3a404e'); R(c, 3, 27, 1, 14, '#2a2e3a'); // cable down the wall
  // bedside table
  R(c, 22, 44, 17, 1, '#6a5440'); R(c, 22, 45, 17, 1, '#4a3a2c'); R(c, 23, 46, 15, 6, '#3a2c22');
  R(c, 24, 48, 13, 1, '#2a2018'); R(c, 29, 49, 3, 1, '#8a7040'); R(c, 23, 52, 1, 5, '#2a2018'); R(c, 37, 52, 1, 5, '#2a2018');
  // ---- bed 7 ----
  R(c, 66 - 26, 36, 2, 22, '#3a4152'); R(c, 40, 36, 1, 22, '#535c70'); // head post
  R(c, 42, 38, 1, 9, '#2c3240');
  R(c, 42, 45, 20, 3, '#7c8296'); R(c, 42, 45, 20, 1, '#9aa0b4'); // mattress
  R(c, 42, 48, 20, 2, '#454c5e'); R(c, 42, 48, 20, 1, '#5c6478'); // frame
  c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(42, 50, 20, 7); // under the bed
  R(c, 43, 50, 1, 7, '#2f3442'); R(c, 60, 50, 1, 7, '#2f3442');
  R(c, 42, 57, 3, 1, '#14161e'); R(c, 59, 57, 3, 1, '#14161e');
  R(c, 60, 40, 2, 18, '#3a4152'); R(c, 61, 40, 1, 18, '#535c70'); R(c, 58, 42, 2, 5, '#2c3240'); R(c, 58, 42, 4, 1, '#5c6478');
  R(c, 42, 42, 7, 3, '#8c92a6'); R(c, 43, 42, 5, 1, '#aeb4c6'); // pillow
  R(c, 52, 47, 9, 4, '#3a4a68'); R(c, 52, 50, 9, 1, '#2c3850'); // blanket hanging over the side
  // chart clipped to the footboard
  R(c, 62, 43, 3, 4, '#a8a89a'); R(c, 62, 43, 3, 1, '#6a5440');
  // oxygen panel + call button behind the bed
  R(c, 43, 29, 17, 3, '#26343a'); R(c, 43, 29, 17, 1, '#3a4a52');
  for (let i = 0; i < 4; i++) R(c, 45 + i * 4, 30, 2, 1, '#a08040');
  R(c, 56, 33, 1, 4, '#3a3a44'); R(c, 55, 37, 3, 2, '#5a2a2a');
  // emergency lamp bracket (lit glass is a sprite)
  R(c, 49, 23, 5, 1, '#8a6a32'); R(c, 51, 21, 1, 2, '#6b5426'); R(c, 50, 24, 3, 3, '#2e2818'); R(c, 49, 24, 1, 3, '#8a6a32'); R(c, 53, 24, 1, 3, '#8a6a32'); R(c, 49, 27, 5, 1, '#6b5426');
  // bed number
  R(c, 64, 25, 5, 7, '#c8c4b0'); glyphs(c, '7', 65, 26, '#1a1c24');
  // IV pole and bag, the line drooping to his hand
  R(c, 66, 13, 1, 44, '#4c5464'); R(c, 64, 57, 5, 1, '#2a2f3c'); R(c, 64, 13, 5, 1, '#4c5464');
  R(c, 63, 14, 3, 5, '#7f9aa8'); R(c, 63, 14, 3, 1, '#a8c0cc'); R(c, 64, 19, 1, 2, '#6a8090');
  c.fillStyle = 'rgba(150,180,200,0.55)';
  for (let i = 0; i <= 24; i++) { const t = i / 24; const xx = 64 + (57 - 64) * t, yy = 21 + (42 - 21) * t + Math.sin(t * Math.PI) * 6; c.fillRect(Math.round(xx), Math.round(yy), 1, 1); }

  // ---- curtain rail across bed 7 and bed 8 ----
  R(c, 38, 8, 82, 1, '#8a7040'); R(c, 38, 9, 82, 1, '#3a2e1c');
  for (let x = 40; x < 120; x += 16) R(c, x, 5, 1, 3, '#5a4a2c');
  // bed 8 behind its curtain: only the wheels show under the hem
  R(c, 78, 54, 1, 3, '#2f3442'); R(c, 108, 54, 1, 3, '#2f3442'); R(c, 77, 57, 3, 1, '#14161e'); R(c, 107, 57, 3, 1, '#14161e');
  c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(74, 54, 40, 4);

  // ---- brass pendant lamps (bulbs are sprites) ----
  for (const lx of LAMPS) {
    R(c, lx, 0, 1, 12, '#2a2a30');
    R(c, lx - 2, 12, 5, 1, '#8a6a30'); R(c, lx - 4, 13, 9, 1, '#b08a3a'); R(c, lx - 5, 14, 11, 1, '#8a6a30'); R(c, lx - 5, 15, 11, 1, '#4a3a1c');
    R(c, lx - 3, 13, 2, 1, '#d0aa58');
  }

  // ---- window (hole is cleared; the night and the rain show through) ----
  R(c, 121, 11, 26, 26, '#2a2c3a'); R(c, 121, 11, 26, 1, '#3c4058'); R(c, 121, 11, 1, 26, '#34384c');
  c.clearRect(123, 13, 22, 22);
  R(c, 133, 13, 2, 22, '#2a2c3a'); R(c, 133, 13, 1, 22, '#3c4058');
  R(c, 123, 23, 22, 2, '#2a2c3a'); R(c, 123, 23, 22, 1, '#3c4058');
  R(c, 119, 36, 30, 2, '#3a3a4c'); R(c, 119, 36, 30, 1, '#585e78'); R(c, 120, 38, 28, 1, '#1a1c26');
  // radiator
  for (let x = 124; x < 145; x += 2) { R(c, x, 40, 1, 8, '#343b4c'); R(c, x + 1, 40, 1, 8, '#262c3a'); }
  R(c, 124, 40, 21, 1, '#4a5266'); R(c, 124, 47, 21, 1, '#1c202a'); R(c, 126, 48, 1, 3, '#2a2f3c'); R(c, 142, 48, 1, 3, '#2a2f3c');

  // ---- right: wall chart, door to the corridor, laundry cart ----
  R(c, 168, 21, 7, 10, '#5a4a3a'); R(c, 169, 23, 5, 7, '#8a8a80'); R(c, 170, 20, 3, 2, '#9a9a9a');
  for (let i = 0; i < 3; i++) R(c, 170, 24 + i * 2, 3, 1, '#4a4a48');
  R(c, 178, 29, 2, 3, '#c8c4b0'); R(c, 178, 30, 2, 1, '#8a8a80'); // light switch, dead now
  // EXIT sign box (letters lit by a sprite)
  R(c, 181, 4, 19, 8, '#140808'); R(c, 181, 4, 19, 1, '#2a1414');
  glyphs(c, 'EXIT', 183, 6, '#4a1210');
  // door frame + transom + the dark corridor beyond
  R(c, 182, 12, 17, 39, '#2a2e40'); R(c, 182, 12, 17, 1, '#3e4460'); R(c, 182, 12, 1, 39, '#383e56');
  R(c, 184, 13, 13, 4, '#0c111e'); R(c, 184, 15, 13, 1, '#2a2e40');
  R(c, 184, 18, 13, 33, '#05060a');
  for (let i = 0; i < 6; i++) { c.fillStyle = `rgba(30,36,56,${0.5 - i * 0.07})`; c.fillRect(184 + i, 44 + i, 13 - i * 2, 1); }
  R(c, 188, 27, 5, 9, '#0b0e18'); R(c, 189, 28, 3, 1, '#151a28'); // the far end of the corridor
  // door leaf, swung open into the room
  R(c, 199, 17, 6, 34, '#2e2a3a'); R(c, 199, 17, 1, 34, '#463f58'); R(c, 200, 22, 4, 8, '#121826'); R(c, 203, 34, 1, 2, '#b08a3a');
  // laundry cart in the corner
  R(c, 206, 38, 12, 1, '#4a5064'); R(c, 206, 39, 12, 10, '#2a2f3c'); R(c, 207, 36, 10, 3, '#7a8094'); R(c, 208, 35, 7, 1, '#9096aa');
  R(c, 207, 49, 1, 7, '#3a3f4c'); R(c, 216, 49, 1, 7, '#3a3f4c'); R(c, 206, 56, 3, 1, '#14161e'); R(c, 215, 56, 3, 1, '#14161e');
  // furniture shadows on the floor
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(5, 57, 16, 2); c.fillRect(22, 56, 17, 2); c.fillRect(40, 58, 23, 2); c.fillRect(205, 57, 14, 2);
}
export const LAMPS = [54, 96, 160];

// ---- outside the window: sky, hills, the dead fair and its wheel ----
function drawOutside(c, w, h) {
  for (let y = 0; y < h; y++) R(c, 0, y, w, 1, mix('#070b18', '#18223c', y / (h - 4)));
  const r = rng(51);
  // moonlight behind cloud
  for (let i = 0; i < 70; i++) { const a = r() * Math.PI * 2, d = Math.pow(r(), 0.6) * 9; c.fillStyle = 'rgba(120,140,190,0.10)'; c.fillRect(Math.round(70 + Math.cos(a) * d * 1.6), Math.round(4 + Math.sin(a) * d * 0.7), 1, 1); }
  // cloud bands
  for (let i = 0; i < 6; i++) { const cy = 2 + i * 3, cx = r() * w; c.fillStyle = 'rgba(6,9,20,0.55)'; c.fillRect(Math.round(cx - 20), cy, 30 + Math.round(r() * 25), 2); }
  // the wheel (centre 44,12, radius 9): rim, spokes, gondolas, two missing
  const hx = 44, hy = 12, rad = 9;
  for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2; R(c, Math.round(hx + Math.cos(t) * rad), Math.round(hy + Math.sin(t) * rad), 1, 1, '#2c3450'); }
  for (let s = 0; s < 8; s++) {
    const t = s / 8 * Math.PI * 2 + 0.2;
    for (let d = 1; d < rad; d++) R(c, Math.round(hx + Math.cos(t) * d), Math.round(hy + Math.sin(t) * d), 1, 1, '#1f263c');
    if (s === 2 || s === 5) continue;
    const gx = Math.round(hx + Math.cos(t) * rad), gy = Math.round(hy + Math.sin(t) * rad);
    R(c, gx - 1, gy + 1, 3, 2, '#262e48'); R(c, gx, gy, 1, 1, '#1f263c');
  }
  R(c, hx - 1, hy - 1, 3, 3, '#3a4262');
  for (let d = 0; d < 13; d++) { R(c, Math.round(hx - d * 0.55), hy + d, 1, 1, '#1a2034'); R(c, Math.round(hx + d * 0.55), hy + d, 1, 1, '#1a2034'); }
  // a small dead tent and a fence
  for (let i = 0; i < 6; i++) R(c, 58 + i, 22 - Math.min(i, 5 - i), 1, 1 + Math.min(i, 5 - i), '#141a2c');
  // hills and the town, no lights anywhere
  for (let x = 0; x < w; x++) {
    const hh = 21 + Math.round(Math.sin(x * 0.09) * 1.5 + Math.sin(x * 0.23 + 1) * 0.8);
    R(c, x, hh, 1, h - hh, '#080b16');
  }
  for (let i = 0; i < 9; i++) { const x = Math.floor(r() * w), bw = 3 + Math.floor(r() * 4), bh = 2 + Math.floor(r() * 3); R(c, x, 23 - bh, bw, bh + 3, '#06080f'); }
  R(c, 12, 15, 1, 9, '#06080f'); R(c, 11, 14, 3, 1, '#06080f'); // a chimney or a steeple
}

// ---- actors ----
const BODY = ['....HHHH....', '...HHHHHH...', '...HHSSSSS..', '...HSSSESE..', '...HSSSSSS..', '....SSSSS...', '....TTTTT...', '...TTTTTTT..', '..STTTTTTTS.', '..S.TTTTT.S.'];
const MILO_PAL = { H: '#5a3a22', S: '#f1c7a0', E: '#1a1010', T: '#c0392b', P: '#2e4a7a', B: '#2b2b2b', C: '#c89a7c', W: '#e8eef4', R: '#7a1f1a' };
const IDLE_LEGS = ['....PPPP....', '....PPPP....', '....PP.PP...', '....PP.PP...', '....BB.BB...', '....BB.BBB..'];

// pale-blue spirit version of any Milo frame: outline turns to light, colors to a blue ramp
function ghostify(scene, srcKey, key) {
  const src = scene.textures.get(srcKey).getSourceImage();
  const w = src.width, h = src.height;
  cv(scene, key, w, h, (c) => {
    c.drawImage(src, 0, 0);
    const d = c.getImageData(0, 0, w, h);
    for (let i = 0; i < d.data.length; i += 4) {
      if (d.data[i + 3] === 0) continue;
      const [r, g, b] = [d.data[i], d.data[i + 1], d.data[i + 2]];
      let out;
      if (r === 11 && g === 9 && b === 24) out = [176, 228, 255];
      else {
        const Y = 0.3 * r + 0.59 * g + 0.11 * b;
        out = Y < 32 ? [22, 38, 74] : Y < 70 ? [52, 86, 146] : Y < 120 ? [92, 140, 208] : Y < 175 ? [150, 198, 244] : [226, 244, 255];
      }
      d.data[i] = out[0]; d.data[i + 1] = out[1]; d.data[i + 2] = out[2];
    }
    c.putImageData(d, 0, 0);
  });
}
function silhouette(scene, srcKey, key) {
  if (!scene.textures.exists(srcKey)) return false;
  const src = scene.textures.get(srcKey).getSourceImage();
  cv(scene, key, src.width, src.height, (c) => {
    c.drawImage(src, 0, 0);
    c.globalCompositeOperation = 'source-in';
    R(c, 0, 0, src.width, src.height, '#000000');
  });
  return true;
}
function radial(scene, key, size, color, squash = 1) {
  cv(scene, key, size, Math.round(size * squash), (c, w, h) => {
    const [r, g, b] = hex(color);
    c.save(); c.scale(1, squash);
    const gr = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(0.35, `rgba(${r},${g},${b},0.45)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    c.fillStyle = gr; c.fillRect(0, 0, size, size); c.restore();
  });
}

export const GLOWS = { amber: '#ffb24a', warm: '#ffd890', blue: '#8fd0ff', cold: '#5a7ab0', green: '#4cff96', red: '#ff3a2a', silver: '#dfe8ff' };

export function makeOpeningArt(scene) {
  if (scene.textures.exists('op_room')) return;
  cv(scene, 'op_room', ROOM_W, ROOM_H, drawRoom);
  cv(scene, 'op_outside', 90, 26, drawOutside);
  for (const [k, col] of Object.entries(GLOWS)) {
    radial(scene, `op_glow_${k}`, 128, col);
    radial(scene, `op_pool_${k}`, 128, col, 0.22);
    cv(scene, `op_streak_${k}`, 16, 64, (c) => {
      const [r, g, b] = hex(col);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 16; x++) {
        const a = (1 - y / 64) * Math.max(0, 1 - Math.abs(x - 7.5) / 8) * 0.9 * (y % 3 === 2 ? 0.5 : 1); // broken by floor seams
        c.fillStyle = `rgba(${r},${g},${b},${a.toFixed(3)})`; c.fillRect(x, y, 1, 1);
      }
    });
  }
  cv(scene, 'op_vignette', 160, 90, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, 95);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.6, 'rgba(2,2,8,0.25)'); g.addColorStop(1, 'rgba(2,2,8,0.85)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  cv(scene, 'op_px', 1, 1, (c) => R(c, 0, 0, 1, 1, '#ffffff'));

  // bedside clock radio: 3:32, 3:33 and dead
  for (const [k, str] of [['32', '3:32'], ['33', '3:33'], ['off', '']]) {
    cv(scene, `op_clock_${k}`, 17, 8, (c) => {
      R(c, 0, 0, 17, 8, '#1c1e28'); R(c, 0, 0, 17, 1, '#30344a'); R(c, 1, 1, 15, 7, '#070506');
      glyphs(c, '8:88', 2, 2, '#1a0808');
      if (str) glyphs(c, str, 2, 2, '#ff4a3a');
      R(c, 14, 6, 1, 1, str ? '#5a1410' : '#120606');
    });
  }
  // bulbs and the emergency lamp's glass
  px(scene, 'op_bulb_on', ['WYYW', '.YY.'], { W: '#fff2c8', Y: '#ffd890' }, null);
  px(scene, 'op_bulb_off', ['WYYW', '.YY.'], { W: '#4a4030', Y: '#3a3020' }, null);
  px(scene, 'op_bulb_ember', ['WYYW', '.YY.'], { W: '#ff9a4a', Y: '#a04a1a' }, null);
  px(scene, 'op_elamp_on', ['YYY', 'YWY', 'YYY'], { W: '#fff2c8', Y: '#ffc060' }, null);
  cv(scene, 'op_exit_lit', 19, 8, (c) => glyphs(c, 'EXIT', 2, 2, '#ff5a48'));

  // the boy in the bed: head on the pillow (Milo's own head, turned), arm on the blanket, blanket
  // his head on the pillow, turned toward us, eyes shut
  px(scene, 'op_body_head', ['.HHHH...', 'HHHHHSS.', 'HHHSSSSS', 'HHHSCSCS', 'HHHSSSSS', '.HHSSSS.', '..HHSS..'], MILO_PAL);
  px(scene, 'op_body_arm', ['TTTSSSWSS', 'TTTSSSWSS'], MILO_PAL);
  px(scene, 'op_blanket', [
    '..LLLL.......',
    '.LBBBBBL..LL.',
    'LBBBBBBBLLBBL',
    'BBBBBBBBBBBBB',
    'DBBBBBBBBBBBD',
    'DDDDDDDDDDDDD',
  ], { L: '#8aa0c8', B: '#61789f', D: '#40527a' });
  // shirt collar peeking above the blanket
  px(scene, 'op_body_collar', ['TT', 'TT', 'TT'], MILO_PAL, null);

  // the spirit: every running frame, a standing frame, jump and fall
  px(scene, 'op_milo_idle_src', [...BODY, ...IDLE_LEGS], MILO_PAL);
  ghostify(scene, 'op_milo_idle_src', 'op_milo_idle');
  for (const f of ['run0', 'run1', 'run2', 'run3', 'jump', 'fall']) ghostify(scene, `survivor_${f}`, `op_milo_${f}`);

  // its shadow (THE STRETCH's own frames, only ever drawn black)
  for (let i = 0; i < 4; i++) if (!silhouette(scene, `stretch_walk${i}`, `op_sil${i}`)) cv(scene, `op_sil${i}`, 12, 40, (c) => R(c, 3, 0, 6, 40, '#000'));

  // curtains: bed 8's closed panels and bed 7's bunched one
  const panel = (w, folds, key) => cv(scene, key, w, 45, (c) => {
    for (let x = 0; x < w; x++) {
      const f = folds[x % folds.length];
      const col = f === 'L' ? '#5b6e66' : f === 'D' ? '#2f3c37' : '#44554d';
      for (let y = 0; y < 45; y++) R(c, x, y, 1, 1, mix(col, '#1a2220', Math.max(0, (y - 20) / 60)));
    }
    for (let x = 0; x < w; x += 3) R(c, x, 0, 1, 1, '#8a7040');
    R(c, 0, 43, w, 2, '#56685f'); R(c, 0, 44, w, 1, '#3a4842');
    const r = rng(w * 7 + folds.length);
    for (let i = 0; i < 4; i++) { c.fillStyle = 'rgba(20,24,18,0.35)'; c.fillRect(Math.floor(r() * w), 25 + Math.floor(r() * 16), 2, 3); }
  });
  panel(10, 'MLMMDMLMMD', 'op_curtain');
  panel(5, 'LDMDL', 'op_curtain_bunch');

  // the visitor's chair (front plane; seat is a ledge)
  px(scene, 'op_chair', [
    'WW......',
    'WD......',
    'WD......',
    'WD......',
    'WD......',
    'WD......',
    'WD......',
    'WD......',
    'WD......',
    'WD......',
    'WWWWWWWW',
    'DDDDDDDD',
    'D.....D.',
    'D.....D.',
    'D.....D.',
    'D.....D.',
    'D.....D.',
    'D.....D.',
  ], { W: '#6a5238', D: '#3a2c20' });

  // BOO: the round ghost from the runner, with the janitor's cap he died in and his key ring
  for (const i of [0, 1]) {
    const src = scene.textures.get(`ghost${i}`).getSourceImage();
    cv(scene, `op_boo${i}`, src.width + 2, src.height + 4, (c) => {
      c.drawImage(src, 1, 4);
      const cap = { O: '#0b0918', C: '#3c4a6a', H: '#56688e', B: '#222a40', Y: '#d0a84a' };
      ['....OOOOOOOOO.....', '...OCCHHCCCCO.....', '..OCCCCYCCCCCO....', '..OBBBBBBBBBBBOOO.', '..OOOOOOOOOOOOBBBO', '................OO'].forEach((row, y) => [...row].forEach((ch, x) => { if (cap[ch]) R(c, x, y, 1, 1, cap[ch]); }));
      R(c, 2, 13, 3, 1, '#9aa0b0'); R(c, 1, 14, 1, 2, '#9aa0b0'); R(c, 5, 14, 1, 2, '#9aa0b0'); R(c, 2, 16, 3, 1, '#9aa0b0');
      R(c, 3, 17, 1, 2, '#c0a050'); R(c, 4, 17, 1, 3, '#8a8a96');
    });
  }
  const LANT = ['..H...', '.H.H..', 'KKKKK.', 'BYYYB.', 'BYOYB.', 'BYOYB.', 'BYYYB.', 'KKKKK.', '.KKK..'].map((r) => r.slice(0, 5));
  px(scene, 'op_lantern_on', LANT, { H: '#8a7040', K: '#b08a3a', B: '#6b5426', Y: '#ffe08a', O: '#ff9a3a' });
  px(scene, 'op_lantern_off', LANT, { H: '#8a7040', K: '#8a6a30', B: '#4a3a1c', Y: '#2a2620', O: '#201c18' });
}
