// THE WRONG SIDE OF THE BED: art for the opening room (St. Mercy, bed 7), drawn in code.
// v2: one art pixel = 3 world px (OP_G) for the room AND the actors, and the camera only ever zooms 4/3,
// so one art pixel is 4 screen px everywhere (was 25 at the old close-ups).
// Scale: Milo is 28 art px tall (about 1.7 m), so 1 m is about 16 art px; the bed, table, door and window follow it.
// Palette: midnight navy and charcoal, warm amber brass, pale-blue spectral Milo (docs/art-direction.md).
// Milo is drawn once (letters) and painted twice: living colors for the boy in the bed, ghost colors for his spirit,
// so both are clearly the same person (same hair, face, pajamas, white hospital wristband).

export const OP_G = 3;
export const ROOM_W = 374; // art px (1122 world px)
export const ROOM_H = 120;
export const WALL_BASE = 90; // art y where the back wall meets the floor
export const LAMPS = [90, 160, 267]; // art x of the pendant lamps
export const BODY_AT = { x: 66, y: 86 }; // art px, top-left of the body sprite on the bed
export const SEAM_Y = 104; // the linoleum seam under the bed (art y): the Ghostline goes in here
export const WRISTS = {}; // frame key -> wristband centre, art px from the sprite origin (feet centre), facing right

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

// rows of letters -> pixels, with a 1px outline (dark for the living, light for the spirit)
function px(scene, key, rows, pal, outline = '#0b0918') {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length)), p = outline ? 1 : 0;
  return cv(scene, key, w + p * 2, h + p * 2, (c) => {
    const solid = (x, y) => y >= 0 && y < h && x >= 0 && x < w && rows[y][x] && rows[y][x] !== '.' && pal[rows[y][x]];
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
export const DIGITS = GLYPH;

// ---- the room (static back plane), art px ----
function drawRoom(c) {
  const r = rng(733);
  const W = ROOM_W, WB = WALL_BASE;
  // ceiling, lost in the dark, with a plaster cornice (old building, high ceiling)
  R(c, 0, 0, W, 10, '#05060b');
  R(c, 0, 10, W, 1, '#1a1f30'); R(c, 0, 11, W, 1, '#0c0f18');
  // upper wall: navy falling into black toward the ceiling, old paint
  for (let y = 12; y < 70; y++) R(c, 0, y, W, 1, mix('#090c16', '#1e2944', Math.pow((y - 12) / 58, 0.75)));
  for (let x = 0; x < W; x++) for (let y = 14; y < 70; y++) {
    const n = (x * 13 + y * 7 + ((x * y) % 11)) % 23;
    if (n === 0) { c.fillStyle = 'rgba(150,170,230,0.06)'; c.fillRect(x, y, 1, 1); } else if (n === 7) { c.fillStyle = 'rgba(0,0,8,0.12)'; c.fillRect(x, y, 1, 1); }
  }
  for (let i = 0; i < 14; i++) { // water stains running down from the ceiling
    const x = Math.floor(r() * W), len = 8 + Math.floor(r() * 22);
    for (let y = 12; y < 12 + len; y++) { c.fillStyle = `rgba(4,5,10,${(0.32 * (1 - (y - 12) / len)).toFixed(3)})`; c.fillRect(x + (y % 9 === 0 ? 1 : 0), y, 1 + (r() < 0.25 ? 1 : 0), 1); }
  }
  // brass chair rail
  R(c, 0, 70, W, 1, '#7a6238'); R(c, 0, 71, W, 1, '#3a2e1c');
  // tiled wainscot (4x4 tiles, grout lines)
  for (let y = 72; y < 88; y++) for (let x = 0; x < W; x++) {
    const ty = (y - 72) % 4, tx = (x + (Math.floor((y - 72) / 4) % 2) * 2) % 4;
    let col = mix('#25364a', '#1a2534', (y - 72) / 16);
    if (ty === 0 || tx === 0) col = '#121a25';
    else if (ty === 1 && tx === 1) col = '#31465a';
    R(c, x, y, 1, 1, col);
  }
  for (let i = 0; i < 26; i++) { const x = Math.floor(r() * W), y = 73 + Math.floor(r() * 14); R(c, x, y, 1, 1, '#0e141c'); if (r() < 0.5) R(c, x + 1, y + 1, 1, 1, '#0e141c'); }
  // skirting
  R(c, 0, 88, W, 2, '#0e1119'); R(c, 0, 88, W, 1, '#2a3042');
  // floor: worn linoleum, rows widening toward us (perspective), darker toward the front
  const rows = [2, 2, 3, 3, 4, 3, 1, 5, 7];
  let y = WB;
  rows.forEach((h, ri) => {
    for (let x = 0; x < W; x++) {
      const k = Math.floor((x + ri * 5) / (9 + ri * 2)) % 2;
      const base = k ? '#171c2c' : '#121622';
      for (let j = 0; j < h; j++) R(c, x, y + j, 1, 1, mix(base, '#07080e', (y + j - WB) / 34));
    }
    y += h;
  });
  R(c, 0, WB, W, 1, '#2c3450');
  c.fillStyle = 'rgba(160,180,255,0.05)'; c.fillRect(0, WB + 1, W, 2);
  // the seam between two linoleum sheets, the whole width of the room
  R(c, 0, SEAM_Y, W, 1, '#04050a'); c.fillStyle = 'rgba(150,170,230,0.10)'; c.fillRect(0, SEAM_Y + 1, W, 1);
  // scuffs
  for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(Math.floor(r() * W), WB + 3 + Math.floor(r() * 26), 2 + Math.floor(r() * 3), 1); }
  // corners
  R(c, 0, 0, 2, WB, '#05060b'); R(c, W - 3, 0, 3, WB, '#05060b');

  // ---- left: a framed print of the fair, the bedside table, the monitor ----
  R(c, 10, 38, 15, 12, '#6a5636'); R(c, 11, 39, 13, 10, '#1b2236'); R(c, 10, 38, 15, 1, '#8a7046');
  for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; R(c, Math.round(17 + Math.cos(t) * 3.4), Math.round(43 + Math.sin(t) * 3.4), 1, 1, '#56608a'); }
  R(c, 17, 43, 1, 5, '#56608a'); R(c, 15, 48, 5, 1, '#3e4562'); R(c, 12, 47, 3, 1, '#2a3048');
  // bedside table: a paper cup, a get-well card (a drawing of the Ferris wheel)
  R(c, 27, 94, 16, 1, '#7a6246'); R(c, 27, 95, 16, 1, '#4a3a2c'); R(c, 28, 96, 14, 7, '#3a2c22');
  R(c, 29, 98, 12, 1, '#2a2018'); R(c, 34, 99, 2, 1, '#9a7c48'); R(c, 28, 103, 1, 3, '#2a2018'); R(c, 41, 103, 1, 3, '#2a2018');
  R(c, 29, 91, 3, 3, '#c8ccd4'); R(c, 29, 91, 3, 1, '#e6e8ee'); // cup
  R(c, 35, 90, 1, 4, '#d8d0bc'); R(c, 36, 89, 1, 5, '#e8e0cc'); R(c, 37, 90, 1, 4, '#d8d0bc'); R(c, 38, 91, 1, 3, '#c8c0aa'); // card
  R(c, 36, 91, 1, 1, '#a04a3a');
  // the monitor on its rolling pole (screen and numbers are live, drawn by the scene)
  R(c, 54, 85, 2, 19, '#3a404e'); R(c, 54, 85, 1, 19, '#565e70');
  R(c, 49, 104, 12, 1, '#2a2f3c'); R(c, 49, 105, 2, 1, '#14161e'); R(c, 59, 105, 2, 1, '#14161e'); R(c, 54, 105, 2, 1, '#14161e');
  R(c, 44, 70, 21, 15, '#272b38'); R(c, 44, 70, 21, 1, '#444a5c'); R(c, 44, 70, 1, 15, '#3a4050'); R(c, 44, 84, 21, 1, '#16181f');
  R(c, 45, 71, 19, 12, '#020807');
  R(c, 56, 71, 1, 12, '#0c1412'); // readout divider
  for (let i = 0; i < 5; i++) R(c, 46 + i * 3, 83, 1, 1, '#52586a');
  // leads from the monitor down to the bed (under the blanket)
  c.fillStyle = 'rgba(120,130,150,0.8)';
  for (let i = 0; i <= 20; i++) { const t = i / 20; c.fillRect(Math.round(62 + (78 - 62) * t), Math.round(85 + (94 - 85) * t + Math.sin(t * Math.PI) * 3), 1, 1); }
  // ---- bed 7: drawn at full resolution in drawBed7() (Milo integration pass) ----
  // the wall behind the bed: oxygen panel, call cord, bed number, the battery lamp's bracket
  R(c, 76, 62, 20, 4, '#26343c'); R(c, 76, 62, 20, 1, '#3c4c56');
  for (let i = 0; i < 4; i++) R(c, 78 + i * 5, 63, 2, 2, '#a08040');
  R(c, 92, 66, 1, 22, '#3a3a44'); R(c, 91, 88, 3, 2, '#6a2a2a');
  R(c, 98, 52, 7, 9, '#c8c4b0'); R(c, 98, 52, 7, 1, '#e0dcc8'); glyphs(c, '7', 100, 54, '#1a1c24');
  R(c, 66, 71, 1, 3, '#6b5426'); R(c, 66, 73, 4, 1, '#8a6a32'); // lamp arm (shade + glow are sprites)
  // IV pole by the foot of the bed; the tube is drawn to his hand by the scene
  R(c, 109, 34, 1, 71, '#56606e'); R(c, 106, 105, 7, 1, '#2a2f3c'); R(c, 106, 34, 7, 1, '#56606e');
  R(c, 106, 35, 4, 7, '#7f9aa8'); R(c, 106, 35, 4, 1, '#b8ccd6'); R(c, 107, 38, 2, 3, '#a8c4d2'); R(c, 107, 42, 1, 3, '#6a8090');
  // ---- curtain rail across bed 7 and bed 8 ----
  R(c, 60, 22, 134, 1, '#8a7040'); R(c, 60, 23, 134, 1, '#3a2e1c');
  for (let x = 62; x < 194; x += 12) R(c, x, 12, 1, 10, '#3a3020');
  // bed 8 behind its curtain: only its wheels show under the hem
  c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(124, 100, 66, 5);
  R(c, 130, 101, 1, 3, '#2f3442'); R(c, 184, 101, 1, 3, '#2f3442'); R(c, 129, 104, 3, 2, '#14161e'); R(c, 183, 104, 3, 2, '#14161e');
  // ---- brass pendant lamps (bulbs are sprites) ----
  for (const lx of LAMPS) {
    R(c, lx, 0, 1, 33, '#262630');
    R(c, lx - 1, 33, 3, 1, '#6b5426'); R(c, lx - 3, 34, 7, 1, '#b08a3a'); R(c, lx - 4, 35, 9, 1, '#8a6a30'); R(c, lx - 5, 36, 11, 1, '#5a4620');
    R(c, lx - 2, 34, 2, 1, '#d8b060');
  }
  // ---- the window (the hole is cleared; the night and the rain show through) ----
  R(c, 206, 32, 36, 40, '#2a2c3a'); R(c, 206, 32, 36, 1, '#40445c'); R(c, 206, 32, 1, 40, '#363a50');
  c.clearRect(208, 34, 32, 36);
  R(c, 223, 34, 2, 36, '#2a2c3a'); R(c, 223, 34, 1, 36, '#40445c');
  R(c, 208, 51, 32, 2, '#2a2c3a'); R(c, 208, 51, 32, 1, '#40445c');
  R(c, 204, 71, 40, 2, '#3a3a4c'); R(c, 204, 71, 40, 1, '#5c627c'); R(c, 205, 73, 38, 1, '#1a1c26');
  for (let x = 209; x < 239; x += 2) { R(c, x, 76, 1, 11, '#363d4e'); R(c, x + 1, 76, 1, 11, '#262c3a'); } // radiator
  R(c, 209, 76, 30, 1, '#4c546a'); R(c, 209, 86, 30, 1, '#1c202a'); R(c, 211, 87, 1, 2, '#2a2f3c'); R(c, 236, 87, 1, 2, '#2a2f3c');
  // ---- right: notice board, light switch, EXIT, the door, a laundry cart ----
  R(c, 276, 52, 15, 12, '#5a4636'); R(c, 277, 53, 13, 10, '#7a6448');
  R(c, 278, 54, 4, 5, '#c8c4b0'); R(c, 283, 55, 5, 4, '#b8b4a2'); R(c, 279, 60, 6, 2, '#a8a492'); R(c, 280, 54, 1, 1, '#a03030'); R(c, 285, 55, 1, 1, '#3050a0');
  R(c, 297, 74, 2, 3, '#c8c4b0'); R(c, 297, 75, 2, 1, '#8a8a80');
  R(c, 306, 40, 20, 8, '#140808'); R(c, 306, 40, 20, 1, '#2a1414'); glyphs(c, 'EXIT', 308, 42, '#4a1210');
  R(c, 302, 50, 30, 40, '#2a2e40'); R(c, 302, 50, 30, 1, '#424862'); R(c, 302, 50, 1, 40, '#3a405a'); R(c, 331, 50, 1, 40, '#1a1d2a');
  R(c, 304, 52, 26, 38, '#05060a');
  for (let i = 0; i < 8; i++) { c.fillStyle = `rgba(30,36,56,${(0.5 - i * 0.055).toFixed(3)})`; c.fillRect(304 + i, 82 + i, 26 - i * 2, 1); }
  R(c, 313, 64, 8, 12, '#0b0e18'); R(c, 314, 65, 6, 1, '#161b2a'); // far end of the corridor
  // laundry cart
  R(c, 342, 78, 20, 1, '#4c5266'); R(c, 342, 79, 20, 18, '#2a2f3c'); R(c, 343, 76, 18, 3, '#7a8094'); R(c, 345, 75, 12, 1, '#9096aa');
  R(c, 343, 97, 1, 7, '#3a3f4c'); R(c, 360, 97, 1, 7, '#3a3f4c'); R(c, 342, 104, 3, 2, '#14161e'); R(c, 359, 104, 3, 2, '#14161e');
  // furniture shadows on the floor
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(26, 105, 18, 2); c.fillRect(48, 105, 14, 2); c.fillRect(341, 105, 22, 2);
}

// ---- the fine pass (world px = screen px): what stands next to the new Milo is drawn at his resolution ----
// Bed 7 in world px. The sleeping Milo (assets/milo/milo-sleep.png) lies on it: his frame's top-left is BED7.sleep,
// the frame's mattress row lands on BED7.mattress.
export const BED7 = { x0: 192, x1: 318, mattress: 285, sleep: { x: 198, y: 216 } };
const FINE = { tileY0: 216, tileY1: 264 };
function drawFine(c) {
  const Wd = c.canvas.width, Hd = c.canvas.height;
  drawBed7(c);
  const img = c.getImageData(0, 0, Wd, Hd), d = img.data;
  // wainscot: 12 px tiles with 1 px grout and a 1 px bevel (was 4 art px tiles with 3 px grout). Only pixels that are
  // still bare tile get redrawn, so the furniture in front of the tiles stays.
  const rgbOf = (s) => (s[0] === '#' ? hex(s) : s.slice(4, -1).split(',').map(Number));
  const tileCols = new Set(['#121a25', '#31465a', '#0e141c'].map((s) => rgbOf(s).join(',')));
  for (let y = 72; y < 88; y++) tileCols.add(rgbOf(mix('#25364a', '#1a2534', (y - 72) / 16)).join(','));
  const key = (i) => `${d[i]},${d[i + 1]},${d[i + 2]}`;
  const tile = (x, y) => {
    const row = Math.floor((y - FINE.tileY0) / 12), ty = (y - FINE.tileY0) % 12, tx = (x + (row % 2) * 6) % 12;
    const base = mix('#25364a', '#1a2534', (y - FINE.tileY0) / 48);
    if (ty === 0 || tx === 0) return '#111824';
    if (ty === 1 || tx === 1) return mix(base, '#3a5068', 0.55);
    if (ty === 11 || tx === 11) return mix(base, '#0e141c', 0.45);
    let h = (x * 2654435761 + y * 40503) >>> 0; h = (h ^ (h >>> 15)) >>> 0;
    return h % 97 === 0 ? '#0e141c' : base; // chipped glaze
  };
  const memo = new Map(), tileRgb = (s) => { if (!memo.has(s)) memo.set(s, rgbOf(s)); return memo.get(s); };
  for (let y = 30; y < Hd; y++) for (let x = 0; x < Wd; x++) {
    const i = (y * Wd + x) * 4;
    if (d[i + 3] === 0) continue; // the window hole
    if (y >= FINE.tileY0 && y < FINE.tileY1 && tileCols.has(key(i))) {
      const t = tileRgb(tile(x, y)); d[i] = t[0]; d[i + 1] = t[1]; d[i + 2] = t[2];
      continue;
    }
    // grain: a 1 px dither over plaster and linoleum so no surface reads as flat 3 px blocks
    let h = (x * 374761393 + y * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
    const n = ((h & 255) / 255 - 0.5) * (y > 270 ? 0.16 : 0.12);
    d[i] = Math.max(0, Math.min(255, d[i] * (1 + n))); d[i + 1] = Math.max(0, Math.min(255, d[i + 1] * (1 + n))); d[i + 2] = Math.max(0, Math.min(255, d[i + 2] * (1 + n)));
  }
  c.putImageData(img, 0, 0);
}

// hospital bed 7, side view: steel tube head and foot boards, mattress and sheet, pillow, frame, casters, chart
function drawBed7(c) {
  const { x0, x1, mattress: M } = BED7;
  const F = 320; // floor line
  const tube = (x, y, w, h, vert = true) => { // steel tube with a lit edge and a dark edge
    R(c, x, y, w, h, '#46506a');
    if (vert) { R(c, x + 1, y, 1, h, '#8a94aa'); R(c, x + w - 1, y, 1, h, '#262c3a'); } else { R(c, x, y, w, 1, '#8a94aa'); R(c, x, y + h - 1, w, 1, '#262c3a'); }
  };
  // shadow under the bed
  c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(x0 + 4, M + 13, x1 - x0 - 8, F - M - 13);
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x0 - 2, F - 2, x1 - x0 + 6, 4);
  // headboard: two posts (the far one darker), a panel with two rails
  tube(x0 + 4, 232, 4, F - 6 - 232); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x0 + 4, 232, 4, F - 6 - 232);
  tube(x0, 228, 5, F - 4 - 228); R(c, x0 - 1, 227, 7, 2, '#9aa4ba'); R(c, x0 - 1, 229, 7, 1, '#3a4050');
  R(c, x0 + 5, 246, 6, 38, '#2c3444'); R(c, x0 + 5, 246, 6, 1, '#56607a'); R(c, x0 + 5, 262, 6, 1, '#3c4658');
  // frame rail under the mattress, legs and casters
  tube(x0 + 2, M + 7, x1 - x0 - 4, 6, false);
  R(c, x0 + 14, M + 13, 2, F - M - 19, '#2f3442'); R(c, x1 - 18, M + 13, 2, F - M - 19, '#2f3442');
  R(c, x0 + 12, M + 18, x1 - x0 - 28, 2, '#262b38'); R(c, x0 + 12, M + 18, x1 - x0 - 28, 1, '#3c4456'); // lower bar
  for (const wx of [x0 + 15, x1 - 17]) {
    R(c, wx - 4, F - 7, 8, 6, '#14161e'); R(c, wx - 3, F - 8, 6, 1, '#3a3f4c'); R(c, wx - 1, F - 5, 2, 2, '#4a505e');
  }
  // mattress under a fitted sheet (pale, cool), a soft lit top edge, the sheet tucked under its side
  R(c, x0 + 3, M - 1, x1 - x0 - 8, 8, '#8c93a2');
  R(c, x0 + 3, M - 1, x1 - x0 - 8, 1, '#c4c9d2'); R(c, x0 + 3, M, x1 - x0 - 8, 1, '#a9afbc');
  for (let x = x0 + 3; x < x1 - 5; x++) if ((x * 7) % 23 < 2) R(c, x, M + 2, 1, 4, '#7b8292'); // sheet creases
  R(c, x0 + 3, M + 6, x1 - x0 - 8, 1, '#5c6272');
  // pillow under his head: soft, dented where the head rests
  const px0 = x0 + 8, pw = 34;
  for (let i = 0; i < pw; i++) {
    const k = i / (pw - 1), hump = Math.round(Math.sin(k * Math.PI) * 6 - (k > 0.25 && k < 0.7 ? 3 : 0));
    const top = M - 4 - Math.max(1, hump);
    R(c, px0 + i, top, 1, M - top, '#b6bccb');
    R(c, px0 + i, top, 1, 1, '#dde1ea');
    R(c, px0 + i, M - 2, 1, 2, '#8d93a4');
  }
  R(c, px0, M - 5, 1, 4, '#8d93a4'); R(c, px0 + pw - 1, M - 5, 1, 4, '#8d93a4');
  // footboard and the chart hanging on it
  tube(x1 - 8, 250, 5, F - 4 - 250); R(c, x1 - 9, 249, 7, 2, '#9aa4ba'); R(c, x1 - 9, 251, 7, 1, '#3a4050');
  R(c, x1 - 3, 256, 5, 28, '#2c3444'); R(c, x1 - 3, 256, 5, 1, '#56607a');
  R(c, x1 + 1, 262, 12, 20, '#c8c4b0'); R(c, x1 + 1, 262, 12, 1, '#e4e0cc'); R(c, x1 + 4, 260, 6, 3, '#8a7040');
  for (let j = 0; j < 5; j++) R(c, x1 + 3, 266 + j * 3, 8 - (j % 2) * 3, 1, '#7a7a70');
  R(c, x1 + 12, 263, 1, 19, '#8e8a78');
}

// ---- outside the window: sky, hills, the dead fair and its wheel ----
function drawOutside(c, w, h) {
  for (let y = 0; y < h; y++) R(c, 0, y, w, 1, mix('#070b18', '#1a253f', y / (h - 4)));
  const r = rng(51);
  for (let i = 0; i < 110; i++) { const a = r() * Math.PI * 2, d = Math.pow(r(), 0.6) * 14; c.fillStyle = 'rgba(120,140,190,0.10)'; c.fillRect(Math.round(110 + Math.cos(a) * d * 1.6), Math.round(7 + Math.sin(a) * d * 0.7), 1, 1); }
  for (let i = 0; i < 9; i++) { const cy = 3 + i * 4, cx = r() * w; c.fillStyle = 'rgba(6,9,20,0.55)'; c.fillRect(Math.round(cx - 30), cy, 40 + Math.round(r() * 40), 2); }
  const hx = 76, hy = 22, rad = 15; // the wheel, two gondolas missing
  for (let a = 0; a < 110; a++) { const t = a / 110 * Math.PI * 2; R(c, Math.round(hx + Math.cos(t) * rad), Math.round(hy + Math.sin(t) * rad), 1, 1, '#2c3450'); }
  for (let s = 0; s < 10; s++) {
    const t = s / 10 * Math.PI * 2 + 0.2;
    for (let d = 1; d < rad; d++) R(c, Math.round(hx + Math.cos(t) * d), Math.round(hy + Math.sin(t) * d), 1, 1, '#1f263c');
    if (s === 2 || s === 6) continue;
    const gx = Math.round(hx + Math.cos(t) * rad), gy = Math.round(hy + Math.sin(t) * rad);
    R(c, gx - 1, gy + 1, 4, 3, '#262e48'); R(c, gx, gy, 1, 1, '#1f263c');
  }
  R(c, hx - 1, hy - 1, 3, 3, '#3a4262');
  for (let d = 0; d < 22; d++) { R(c, Math.round(hx - d * 0.55), hy + d, 1, 1, '#1a2034'); R(c, Math.round(hx + d * 0.55), hy + d, 1, 1, '#1a2034'); }
  for (let i = 0; i < 10; i++) R(c, 100 + i, 38 - Math.min(i, 9 - i), 1, 1 + Math.min(i, 9 - i), '#141a2c'); // a dead tent
  for (let x = 0; x < w; x++) {
    const hh = 37 + Math.round(Math.sin(x * 0.06) * 2 + Math.sin(x * 0.17 + 1) * 1.2);
    R(c, x, hh, 1, h - hh, '#080b16');
  }
  for (let i = 0; i < 16; i++) { const x = Math.floor(r() * w), bw = 4 + Math.floor(r() * 6), bh = 3 + Math.floor(r() * 5); R(c, x, 40 - bh, bw, bh + 4, '#06080f'); }
  R(c, 22, 26, 1, 14, '#06080f'); R(c, 21, 25, 3, 1, '#06080f'); // a steeple
}

// ---- Milo, drawn once ----
// Letters: H hair, h hair light, S skin, s skin shade, E eye, M mouth, P pajamas, p pajama shade, a sleeve light,
// d pajama seam/dark, W the hospital wristband. Facing right. Every frame is centred on his body (col CX).
const LIVING = { H: '#4a2e1c', h: '#73492c', S: '#f1c7a0', s: '#c9946e', E: '#1a1010', M: '#9a5048', P: '#9fb4c8', p: '#6c8298', a: '#c2d2e0', d: '#4d6178', W: '#f6f6ee' };
const SPIRIT = { H: '#3c62a6', h: '#6a92d4', S: '#e2f4ff', s: '#a9cff2', E: '#16264e', M: '#5a7cc0', P: '#86b2e6', p: '#5a84c4', a: '#b2d6f8', d: '#3c64a2', W: '#ffffff' };
const SPIRIT_OUT = '#9fdcff';
const HEAD = [
  '....HHHHH....',
  '..HHHHHHHHH..',
  '.HHHHHhhHHHH.',
  '.HHHHhhHHHHHH',
  '.HHHHHHHHSHSH',
  '..HHHHSSSSSSS',
  '..HHHsSSSSESSS',
  '..HHHsSSSSESSS',
  '...HsSSSSSSMS',
  '....ssSSSSSS',
];
const HEAD_DOWN = [ // looking down at the bed: chin tucked, eye lower
  '.............',
  '....HHHHH....',
  '..HHHHHHHHH..',
  '.HHHHHhhHHHH.',
  '.HHHHhhHHHHHH',
  '.HHHHHHHHSHHH',
  '..HHHHSSSSSSH',
  '..HHHsSSSSSSS',
  '..HHHsSSSSESSS',
  '...HsSSSSSMS',
];
// torso rows 10..19 (neck, collar, shirt, hands), legs 20..27; X marks where the arm is drawn per frame
const NECK = '......sSSs...';
const COLLAR = '.....dPPPPd..';
const SHIRT = ['....PPPPPPPP.', '....pPPPPPPP.', '....pPPPPPPP.', '....pPPPPPPP.', '....pPPPPPPd.', '....pPPPPPPd.', '.....dddddd..'];
const LEGS_STAND = ['.....PPPdPP..', '.....PPPdPP..', '.....PPPdPP..', '.....PPPdPP..', '.....PPPdPP..', '.....pPPdPp..', '.....pPPdPp..', '....SSSS.SSSS'];
const LEGS_STEP = ['.....PPPPPP..', '....PPPPPPPP.', '....PPP.dPPP.', '...PPP...PPP.', '...PPp....PPp', '..pPP.....PPp', '..PP.......PP', '.SSS.......SSS'];
const LEGS_PASS = ['.....PPPPPP..', '.....PPPdPP..', '.....PPPdPP..', '.....PPPdPP..', '.....PPdPPp..', '....PPd.PPp..', '....pP..SPP..', '...SSS...SS..'];
const LEGS_TUCK = ['.....PPPPPP..', '....PPPPPPPP.', '...PPPPPPPPP.', '...PPPdPPPP..', '....PPP.PPS..', '....SSS..SS..', '.............', '.............'];
const LEGS_HANG = ['.....PPPPPP..', '.....PPPdPP..', '.....PPPdPP..', '.....PPPdPP..', '.....PPd.PP..', '.....pP..Pp..', '.....SS..SS..', '....SS....SS.'];
const CX = 8; // body centre column in the rows above
// arms: list of [col, row, letter] relative to the same grid (rows 10..)
const line = (pts, l) => pts.map(([x, y]) => [x, y, l]);
const ARMS = {
  side: [...line([[7, 12], [8, 12], [7, 13], [8, 13], [7, 14], [8, 14], [7, 15], [8, 15], [7, 16], [8, 16], [7, 17], [8, 17]], 'a'), [9, 13, 'p'], [9, 14, 'p'], [9, 15, 'p'], [9, 16, 'p'], [9, 17, 'p'], [7, 18, 'W'], [8, 18, 'W'], [7, 19, 'S'], [8, 19, 'S'], [8, 20, 's'], [7, 20, 'S']],
  back: [...line([[7, 12], [8, 12], [6, 13], [7, 13], [6, 14], [7, 14], [5, 15], [6, 15], [5, 16], [6, 16]], 'a'), [4, 17, 'W'], [5, 17, 'W'], [3, 18, 'S'], [4, 18, 'S'], [3, 19, 's']],
  fwd: [...line([[8, 12], [9, 12], [9, 13], [10, 13], [9, 14], [10, 14], [10, 15], [11, 15], [10, 16], [11, 16]], 'a'), [11, 17, 'W'], [12, 17, 'W'], [12, 18, 'S'], [13, 18, 'S'], [13, 19, 's']],
  up: [...line([[8, 12], [9, 12], [9, 11], [10, 11], [10, 10], [11, 10]], 'a'), [12, 9, 'W'], [12, 10, 'W'], [13, 8, 'S'], [13, 9, 'S'], [14, 8, 's']],
  // hesitating: forearm comes up in front of the chest, fingers curled
  unsure: [...line([[7, 12], [8, 12], [7, 13], [8, 13], [8, 14], [9, 14], [9, 15], [10, 15]], 'a'), [9, 16, 'p'], [11, 15, 'W'], [11, 14, 'W'], [12, 14, 'S'], [12, 13, 'S'], [13, 14, 's']],
  // reaching for his own hand: half, full, and through it
  reach1: [...line([[8, 12], [9, 12], [9, 13], [10, 13], [11, 13], [11, 14], [12, 14]], 'a'), [10, 14, 'p'], [13, 14, 'W'], [13, 15, 'W'], [14, 14, 'S'], [14, 15, 'S'], [15, 15, 'S'], [15, 16, 's']],
  reach2: [...line([[8, 12], [9, 12], [10, 12], [11, 12], [11, 13], [12, 13], [13, 13], [14, 13]], 'a'), [10, 13, 'p'], [12, 14, 'p'], [15, 13, 'W'], [15, 14, 'W'], [16, 13, 'S'], [17, 13, 'S'], [16, 14, 'S'], [17, 14, 'S'], [18, 14, 's']],
  reach3: [...line([[8, 12], [9, 12], [9, 13], [10, 13], [10, 14], [11, 14], [11, 15], [12, 15], [12, 16], [13, 16]], 'a'), [10, 15, 'p'], [11, 16, 'p'], [14, 16, 'W'], [14, 17, 'W'], [15, 17, 'S'], [15, 18, 'S'], [16, 18, 'S'], [16, 19, 's'], [17, 19, 's'], [17, 20, 's']],
  // snatched back to his chest
  recoil: [...line([[6, 12], [7, 12], [6, 13], [7, 13], [7, 14], [8, 14]], 'a'), [9, 14, 'W'], [9, 13, 'W'], [10, 12, 'S'], [10, 13, 'S'], [11, 12, 's']],
};
function milo(head, legs, arm, { lean = 0 } = {}) {
  const rows = [...head, NECK, COLLAR, ...SHIRT, ...legs].map((r) => r.padEnd(14, '.'));
  const grid = rows.map((r) => [...r]);
  for (const [x, y, l] of ARMS[arm]) { if (grid[y]) grid[y][x] = l; }
  if (lean) for (let y = 0; y < 12; y++) grid[y] = lean > 0 ? ['.', ...grid[y]].slice(0, 14) : [...grid[y].slice(1), '.'];
  // centre on CX: pad so the body centre sits in the middle of a 26 wide frame
  const out = grid.map((g) => ('.'.repeat(13 - CX) + g.join('')).padEnd(26, '.'));
  return out;
}
const FRAMES = {
  idle: milo(HEAD, LEGS_STAND, 'side'),
  look: milo(HEAD_DOWN, LEGS_STAND, 'side'),
  unsure: milo(HEAD_DOWN, LEGS_STAND, 'unsure'),
  reach1: milo(HEAD_DOWN, LEGS_STAND, 'reach1'),
  reach2: milo(HEAD_DOWN, LEGS_STAND, 'reach2', { lean: 1 }),
  reach3: milo(HEAD_DOWN, LEGS_STAND, 'reach3', { lean: 1 }),
  recoil: milo(HEAD, LEGS_STAND, 'recoil', { lean: -1 }),
  run0: milo(HEAD, LEGS_STEP, 'back'),
  run1: milo(HEAD, LEGS_PASS, 'side'),
  run2: milo(HEAD, LEGS_STEP, 'fwd'),
  run3: milo(HEAD, LEGS_PASS, 'side'),
  jump: milo(HEAD, LEGS_TUCK, 'up'),
  fall: milo(HEAD, LEGS_HANG, 'fwd'),
};
// sitting up out of the body (legs along the bed, to the right)
const SIT = [
  ...HEAD.map((r) => r.padEnd(14, '.')),
  '......sSSs....',
  '.....dPPPPd...',
  '....PPPPaaPP..',
  '....pPPPaapP..',
  '....pPPPWWPP..',
  '....pPPPSSPPPPPPPPPP....',
  '....pPPPPPPPPPPPPPPPPSS.',
  '.....dddddddddddddddSSS.',
].map((r) => ('.'.repeat(13 - CX) + r).padEnd(30, '.'));
// the boy in the bed: head on the pillow, face up, eyes shut; his near arm on the blanket, hand by the edge
// L/B/D/K blanket (light top, body, front fold, hem). Origin = BODY_AT (art px).
const BODY_ROWS = [
  '.........s............................',
  '...hHH..sSSs..........................',
  '..HHHHHSSSSSs.........................',
  '.HHHHHSSEESSSs......LLLLLL............',
  'HHhHHHSSSSSMSs....LLLBBBBBBLLL........',
  'HHHHHHsSSSSSSs..LLLBBBBBBBBBLLLLL.LLL.',
  '.HHHHHHssSSSsPPLLaaaaaaaaaWBBBBBBLBBB.',
  '..HHHHHHHssddPPBBpppppppppWBBBBBBBBBB.',
  '...HHHH.....DDDDDDDDDDDDDDDDDDDDDDDDD.',
  '............DDDDDDDDDDDDDDDDDDDDDDDDD.',
  '............KKKKKKKKKKKKKKKKKKKKKKKKK.',
];
const BLANKET = { L: '#a2b2d0', B: '#6c82aa', D: '#4c5e86', K: '#38476a' };
export const BODY_HAND = { x: 27, y: 6 }; // where the hand sprite sits on the body (art px in the body sprite)
export const BODY_WRIST = { x: 26.5, y: 7 }; // the living wristband (art px in the body sprite)
export const BODY_CHEST = { x: 20, y: 2 }; // the breath strip
const HAND = [['SSSs', 'SSSS', '.s.s'], ['SSSs', 'SSSs', '..s.']];

// the wristband centre of a frame, relative to the sprite origin (bottom centre), facing right
function wristOf(rows) {
  let sx = 0, sy = 0, n = 0;
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'W') { sx += x + 0.5; sy += y + 0.5; n++; } }));
  const w = rows[0].length, h = rows.length;
  return n ? { x: sx / n - w / 2, y: sy / n - h } : { x: 0, y: -10 };
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
  cv(scene, key, size, Math.round(size * squash), (c) => {
    const [r, g, b] = hex(color);
    c.save(); c.scale(1, squash);
    const gr = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(0.35, `rgba(${r},${g},${b},0.45)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    c.fillStyle = gr; c.fillRect(0, 0, size, size); c.restore();
  });
}

export const GLOWS = { amber: '#ffb24a', warm: '#ffd890', blue: '#8fd0ff', cold: '#5a7ab0', green: '#4cff96', red: '#ff3a2a', silver: '#dfe8ff' };

export function makeOpeningArt(scene) {
  if (scene.textures.exists('op2_room')) return;
  // the room is rendered at full resolution (1 world px = 1 screen px, the camera no longer zooms) so the
  // fine pass can add 1 px detail where the new Milo stands: Bed 7, the tiles, grain on the plaster and floor
  cv(scene, 'op2_room', ROOM_W * OP_G, ROOM_H * OP_G, (c) => { c.save(); c.scale(OP_G, OP_G); drawRoom(c); c.restore(); drawFine(c); });
  cv(scene, 'op_outside', 200, 52, drawOutside);
  for (const [k, col] of Object.entries(GLOWS)) {
    radial(scene, `op_glow_${k}`, 128, col);
    radial(scene, `op_pool_${k}`, 128, col, 0.22);
    cv(scene, `op_streak_${k}`, 16, 64, (c) => {
      const [r, g, b] = hex(col);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 16; x++) {
        const a = (1 - y / 64) * Math.max(0, 1 - Math.abs(x - 7.5) / 8) * 0.9 * (y % 3 === 2 ? 0.5 : 1);
        c.fillStyle = `rgba(${r},${g},${b},${a.toFixed(3)})`; c.fillRect(x, y, 1, 1);
      }
    });
  }
  cv(scene, 'op_vignette', 160, 90, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, 95);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.6, 'rgba(2,2,8,0.25)'); g.addColorStop(1, 'rgba(2,2,8,0.85)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  // wall clock: 3:32, 3:33 and dead
  for (const [k, str] of [['32', '3:32'], ['33', '3:33'], ['off', '']]) {
    cv(scene, `op_clock_${k}`, 19, 9, (c) => {
      R(c, 0, 0, 19, 9, '#1c1e28'); R(c, 0, 0, 19, 1, '#34384e'); R(c, 1, 1, 17, 7, '#070506');
      glyphs(c, '8:88', 3, 2, '#1c0909');
      if (str) glyphs(c, str, 3, 2, '#ff4a3a');
    });
  }
  px(scene, 'op_bulb_on', ['WYYW', '.YY.'], { W: '#fff2c8', Y: '#ffd890' }, null);
  px(scene, 'op_bulb_off', ['WYYW', '.YY.'], { W: '#4a4030', Y: '#3a3020' }, null);
  px(scene, 'op_bulb_ember', ['WYYW', '.YY.'], { W: '#ff9a4a', Y: '#a04a1a' }, null);
  // the battery reading lamp over the bed (shade, lit and dark)
  px(scene, 'op_elamp_on', ['.KKKK.', 'KKKKKK', 'YWWWWY'], { K: '#8a6a32', Y: '#ffc060', W: '#fff2c8' }, null);
  px(scene, 'op_elamp_off', ['.KKKK.', 'KKKKKK', 'YWWWWY'], { K: '#5a4622', Y: '#3a3020', W: '#4a4030' }, null);
  cv(scene, 'op_exit_lit', 20, 8, (c) => glyphs(c, 'EXIT', 2, 2, '#ff5a48'));
  // the door: shut (before he knows) and swung open
  cv(scene, 'op_door_shut', 26, 38, (c) => {
    R(c, 0, 0, 26, 38, '#2e2a3a'); R(c, 0, 0, 26, 1, '#463f58'); R(c, 12, 0, 2, 38, '#1e1a28'); R(c, 13, 0, 1, 38, '#3a3448');
    R(c, 3, 5, 7, 10, '#121826'); R(c, 16, 5, 7, 10, '#121826'); R(c, 3, 5, 7, 1, '#22283a'); R(c, 16, 5, 7, 1, '#22283a');
    R(c, 10, 20, 1, 3, '#b08a3a'); R(c, 15, 20, 1, 3, '#b08a3a'); R(c, 0, 37, 26, 1, '#14121c');
  });
  cv(scene, 'op_door_open', 7, 38, (c) => { R(c, 0, 0, 7, 38, '#2e2a3a'); R(c, 0, 0, 1, 38, '#463f58'); R(c, 2, 5, 3, 10, '#121826'); R(c, 5, 20, 1, 3, '#b08a3a'); });

  // ---- Milo: the living boy and his spirit, from the same drawing ----
  for (const [k, rows] of Object.entries(FRAMES)) {
    px(scene, `op_milo_${k}`, rows, SPIRIT, SPIRIT_OUT);
    WRISTS[`op_milo_${k}`] = wristOf(rows);
  }
  px(scene, 'op_milo_sit', SIT, SPIRIT, SPIRIT_OUT);
  // his spirit still lying in the body (no blanket), for the first moment of the separation
  const noBlanket = BODY_ROWS.map((r) => r.replace(/[LBDK]/g, '.'));
  px(scene, 'op_milo_lie', noBlanket, SPIRIT, SPIRIT_OUT);
  px(scene, 'op_body', BODY_ROWS, { ...LIVING, ...BLANKET });
  px(scene, 'op_body_breath', ['LLLLLL'], BLANKET, null);
  HAND.forEach((rows, i) => px(scene, `op_hand${i}`, rows, LIVING, null));

  // its shadow (THE STRETCH's own frames, only ever drawn black)
  for (let i = 0; i < 4; i++) if (!silhouette(scene, `stretch_walk${i}`, `op_sil${i}`)) cv(scene, `op_sil${i}`, 12, 40, (c) => R(c, 3, 0, 6, 40, '#000'));

  // curtains: bed 8's closed panels and bed 7's bunched one (art px, 3 world px each)
  const panel = (w, h, folds, key) => cv(scene, key, w, h, (c) => {
    for (let x = 0; x < w; x++) {
      const f = folds[x % folds.length];
      const col = f === 'L' ? '#5e7268' : f === 'l' ? '#526459' : f === 'D' ? '#2c3934' : '#44554d';
      for (let y = 0; y < h; y++) R(c, x, y, 1, 1, mix(col, '#1a2220', Math.max(0, (y - 30) / 90)));
    }
    for (let x = 1; x < w; x += 4) R(c, x, 0, 1, 1, '#9a8048');
    R(c, 0, h - 3, w, 2, '#5a6c62'); R(c, 0, h - 1, w, 1, '#3a4842');
    const r = rng(w * 7 + folds.length);
    for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(20,24,18,0.3)'; c.fillRect(Math.floor(r() * w), 40 + Math.floor(r() * 30), 2, 4); }
  });
  panel(17, 77, 'LlMMDMlLMMDDM', 'op_curtain');
  panel(8, 77, 'LDlMDL', 'op_curtain_bunch');

  // the visitor's chair (front plane; the seat is a ledge 8 art px up)
  px(scene, 'op_chair', [
    'WW............',
    'WD............',
    'WD............',
    'WD............',
    'WD............',
    'WD............',
    'WD............',
    'WD............',
    'WD............',
    'WD............',
    'WD............',
    'WWWWWWWWWWWWWW',
    'DDDDDDDDDDDDDD',
    'D...........D.',
    'D...........D.',
    'D...........D.',
    'D...........D.',
    'D...........D.',
    'D...........D.',
    'D...........D.',
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
