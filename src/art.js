import { HATS } from './unlocks.js';
// All pixel art is drawn in code here, so the game needs no image files.
// Each sprite is a list of text rows; each letter is a color from its palette.
// '.' means transparent.

// Every actor sprite gets a 1px dark outline (art direction: actors outlined,
// backgrounds not), so silhouettes read against any zone.
const OUTLINE = '#0b0918';
function px(scene, key, rows, pal, outline = true) {
  const h = rows.length;
  const w = rows[0].length;
  const pad = outline ? 1 : 0;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w + pad * 2, h + pad * 2);
  const ctx = tex.context;
  const solid = (x, y) => y >= 0 && y < h && x >= 0 && x < w && rows[y][x] !== '.' && pal[rows[y][x]];
  if (outline) {
    ctx.fillStyle = OUTLINE;
    for (let y = -1; y <= h; y++) {
      for (let x = -1; x <= w; x++) {
        if (solid(x, y)) continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) ctx.fillRect(x + pad, y + pad, 1, 1);
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      ctx.fillStyle = pal[rows[y][x]];
      ctx.fillRect(x + pad, y + pad, 1, 1);
    }
  }
  tex.refresh();
  return tex;
}

function canvas(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  draw(tex.context, w, h);
  tex.refresh();
  return tex;
}

// Small seeded random so backgrounds look the same every time.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function R(ctx, x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// ---------------- characters ----------------
const BODY = [
  '....HHHH....',
  '...HHHHHH...',
  '...HHSSSSS..',
  '...HSSSESE..',
  '...HSSSSSS..',
  '....SSSSS...',
  '....TTTTT...',
  '...TTTTTTT..',
  '..STTTTTTTS.',
  '..S.TTTTT.S.',
];
const LEGS = {
  run0: [
    '....PPPP....',
    '....PPPP....',
    '...PP..PP...',
    '..PP....PP..',
    '..BB....BB..',
    '..BBB...BBB.',
  ],
  run1: [
    '....PPPP....',
    '....PPPP....',
    '....PPPP....',
    '....PP.PP...',
    '....BB.BB...',
    '....BBB.BBB.',
  ],
  fly: [
    '....PPPP....',
    '....PPPP....',
    '....PP.PP...',
    '....PP.PP...',
    '....BB.BB...',
    '...BB..BB...',
  ],
  // v6 running frames: a 4-step cycle (stride, passing, stride, knee up), a tucked jump and a dangling fall
  run2: [
    '....PPPP....',
    '...PPPPP....',
    '..PP...PP...',
    '.PP.....PP..',
    '.BB......BB.',
    'BB.......BBB',
  ],
  run3: [
    '....PPPP....',
    '....PPPPP...',
    '....PP.PPP..',
    '....PP...BB.',
    '....PP...B..',
    '....BBB.....',
  ],
  jump: [
    '....PPPPP...',
    '...PPPPPPP..',
    '...PP...PP..',
    '...BB...BB..',
    '..BBB..BBB..',
    '............',
  ],
  fall: [
    '....PPPP....',
    '...PP..PP...',
    '..PP....PP..',
    '..PP....PP..',
    '..BB....BB..',
    '.BB......BB.',
  ],
};
// arms thrown up (jump, fall, stumble): hands move from the hips to the shoulders
const ARMS_UP = (body) => {
  const b = body.slice();
  const set = (r, c, ch) => { b[r] = b[r].slice(0, c) + ch + b[r].slice(c + 1); };
  for (const c of [2, 10]) {
    if (b[8][c] !== '.') set(8, c, '.');
    if (b[9][c] !== '.') set(9, c, '.');
    set(3, c === 2 ? 1 : 11, 'S'); // hands up beside the head
    set(4, c === 2 ? 1 : 11, 'S');
    set(5, c, 'T');
    set(6, c, 'T');
  }
  return b;
};

const CHAR_LOOKS = {
  survivor: {
    pal: { H: '#5a3a22', S: '#f1c7a0', E: '#1a1010', T: '#c0392b', P: '#2e4a7a', B: '#2b2b2b' },
    rows: {},
  },
  nurse: {
    pal: { H: '#2a1a14', S: '#e8b48c', E: '#1a1010', T: '#3bb3a6', P: '#2c8a80', B: '#dddddd', W: '#f4f4f4', R: '#e0303a' },
    rows: { 0: '....WWWW....', 1: '...WWRWWW...' },
  },
  hunter: {
    pal: { H: '#3a2a1a', S: '#d9a77c', E: '#1a1010', T: '#8a7a4a', P: '#4a4030', B: '#2a2018', K: '#5b4026', G: '#6b7280' },
    rows: { 0: '....KKKK....', 1: '..KKKKKKKKK.', 7: '.GGTTTTTTT..', 8: '.GSTTTTTTTS.', 9: '.GS.TTTTT.S.' },
  },
  mummy: {
    pal: { H: '#e6dcc2', S: '#d8cca8', E: '#ffd75e', T: '#e6dcc2', P: '#c8bb98', B: '#b8ab8a', D: '#8a7e60' },
    rows: { 0: '....HHHH....', 1: '...HDHHDH...', 2: '...HHSSSSS..', 3: '...HSDSESE..', 4: '...HSSSSDS..', 5: '....SDSSS...', 6: '....TDTTT...', 7: '...TTTDTTT..', 8: '..STDTTTDTS.' },
  },
  vampire: {
    pal: { H: '#0b0b12', S: '#e8e0e8', E: '#c0102a', T: '#1a1020', P: '#120a14', B: '#0b0b12', R: '#a01028', W: '#f4f4f4' },
    rows: { 0: '....HHHH....', 1: '...HHHHHH...', 2: '...HHSHSHS..', 3: '...HSSSESE..', 4: '...RSSSWSW..', 5: '..RR.SSSS...', 6: '..RRTWWTT...', 7: '.RRTTTTTTT..', 8: '.RSTTTTTTTS.', 9: '.RS.TTTTT.S.' },
  },
  skeleton: {
    pal: { H: '#e8e4d8', S: '#e8e4d8', E: '#0b0918', T: '#d8d4c8', P: '#b8b4a8', B: '#e8e4d8', K: '#0b0918' },
    rows: { 0: '....HHHH....', 1: '...HHHHHH...', 2: '...HHSSSSS..', 3: '...HSSKEKE..', 4: '...HSSSSSS..', 5: '....SKSKS...', 6: '.....TTT....', 7: '...TKTKTKT..', 8: '..S.TKTKT.S.', 9: '..S..TTT..S.' },
  },
  wolf: {
    pal: { H: '#6a4a2a', S: '#8a6a40', E: '#ffd75e', T: '#5a3a20', P: '#4a3018', B: '#3a2410', K: '#1a1010', W: '#e8d8b8' },
    rows: { 0: '...H..H.....', 1: '...HHHHHH...', 2: '...HHSSSSS..', 3: '...HSSSESE..', 4: '...HSSSSSSK.', 5: '....SWWWS...' },
  },
  kid: {
    pal: { H: '#0b0b12', S: '#d9dde3', E: '#ff3b3b', T: '#e9e4da', P: '#e9e4da', B: '#d9dde3' },
    rows: { 2: '..HHHSSSSS..', 3: '..HHSSSESE..', 4: '..HHSSSSSS..', 5: '..HH.SSSS...', 6: '..H.TTTTT...' },
    legRows: { 0: '...TTTTTT...', 1: '...TTTTTT...' },
  },
};

function makeCharacters(scene) {
  for (const [id, look] of Object.entries(CHAR_LOOKS)) {
    for (const frame of ['run0', 'run1', 'fly', 'run2', 'run3', 'jump', 'fall']) {
      let body = BODY.map((r, i) => look.rows[i] ?? r);
      if (frame === 'jump' || frame === 'fall') body = ARMS_UP(body);
      const legs = LEGS[frame].map((r, i) => (look.legRows && look.legRows[i]) ?? r);
      px(scene, `${id}_${frame}`, [...body, ...legs], look.pal);
    }
    // v6: a real slide pose (feet first, leaning back, head up) instead of a rotated run frame
    const body = BODY.map((r, i) => look.rows[i] ?? r);
    const head = [1, 2, 3, 4].map((i) => body[i].slice(2, 11) + '.........');
    const legP = (look.legRows && look.legRows[0] && look.legRows[0].includes('T')) ? 'T' : 'P';
    const slide = [
      ...head,
      '.' + body[7].slice(2, 11) + legP.repeat(6) + '..',
      '.' + body[8].slice(2, 11) + legP.repeat(6) + 'BB',
      '.....' + legP.repeat(10) + 'BBB',
      '......' + legP.repeat(9) + 'BBB',
    ];
    px(scene, `${id}_slide`, slide, look.pal);
  }
}

// ---------------- ghost ----------------
const GHOST0 = [
  '.....WWWWWW.....',
  '...WWWWWWWWWW...',
  '..LWWWWWWWWWWW..',
  '..LWKKWWWWKKWW..',
  '.LWWKKWWWWKKWWW.',
  '.LWPWWWWWWWWPWW.',
  '.LWWWWWKKWWWWWW.',
  '.LWWWWWKKWWWWWW.',
  'LWWWWWWWWWWWWWWW',
  'LWWWWWWWWWWWWWWW',
  'LWWWWWWWWWWWWWWW',
  'LWWWWWWWWWWWWWWW',
  'LW.WWW.WWWW.WWW.',
  'L...W...WW...W..',
];
const GHOST1 = [
  ...GHOST0.slice(0, 12),
  '.WWW.WWWW.WWW.WW',
  '..W...WW...W...W',
];
const GHOST_PAL = { W: '#e6f0ff', L: '#9fb8e8', K: '#1b1630', P: '#ff9fbf' };

// ---------------- candle ----------------
const CANDLE_BASE = [
  '...K...',
  '.CCCCC.',
  '.CCCCC.',
  '.CDCCC.',
  '.CDCCC.',
  '.CCCCC.',
  '.CCCCC.',
  'DDDDDDD',
];
const FLAME0 = ['...Y...', '..YYY..', '..YOY..', '..YOY..'];
const FLAME1 = ['..Y....', '..YY...', '..YOY..', '...OY..'];
const CANDLE_PAL = { Y: '#ffd75e', O: '#ff8a2a', K: '#2a1a10', C: '#f3e6c4', D: '#c9b48a' };

// ---------------- spirit node ----------------
const SPIRIT = [
  '....GGGGGG....',
  '..GGGGGGGGGG..',
  '.GGWWWWWWWWGG.',
  '.GWWWWWWWWWWG.',
  'GGWKKWWWWKKWGG',
  'GWWKKWWWWKKWWG',
  'GWWWWWKKWWWWWG',
  'GGWWWWWWWWWWGG',
  '.GWWKWKWKWKWG.',
  '.GGWWWWWWWWGG.',
  '..GGGGGGGGGG..',
  '...GG.GG.GG...',
  '....G..G..G...',
];
const SPIRIT_PAL = { G: '#4fe38a', W: '#d8ffe6', K: '#0d2a18' };

// ---------------- hand ----------------
const HAND_TOP = [
  '.K..K..K......',
  '.A..A..A..K...',
  '.A..A..A..A...',
  'AA.AA.AA.AA...',
  'AA.AA.AA.AA...',
  'AAAAAAAAAAA...',
  'AAAAAAAAAAAA..',
  'AAAAAAAAAAAAA.',
  '.AAAAAAAAAAAA.',
  '.SAAAAAAAAAS..',
  '..SAAAAAAAAS..',
  '..SAAAAAAAAS..',
];
const HAND_PAL = { A: '#86a07e', S: '#5a7356', K: '#1a1a1a', D: '#3e523b', R: '#7a2a2a' };

// ---------------- banshee ----------------
const BANSHEE = [
  '......WWWWWW............',
  '....WWWWWWWWWHHHH.......',
  '...WWWWWWWWWWHHHHHHH....',
  '..WWKKWWWKKWWHHHHHHHHH..',
  '..WWKRWWWKRWWWHHHHHHHHHH',
  '..WWWWWWWWWWWWHHHHHHH...',
  '..WWWWMMMWWWWWHHHHHHHHH.',
  '..WWWMMMMMWWWWHHHHHH....',
  '..WWWMMMMMWWWWWHHHHHHHH.',
  '...WWWMMMWWWWWWWHHHH....',
  '....WWWWWWWWWWWWWWHHHHH.',
  '.....WWWWWWWWWWWWWWW....',
  '......WWWWWWWWWWWWWWWW..',
  '.......WWWWWWWWWWWWWWWW.',
  '........WWWWWWWWWWWWW...',
  '..........WWWWWWWWW.....',
  '............WWWW........',
];
const BANSHEE_PAL = { W: '#cfe0ff', H: '#3b2a55', K: '#0a0612', R: '#ff3355', M: '#4a0010' };

// ---------------- swingers ----------------
const LAMP = [
  '........KK........',
  '......KKKKKK......',
  '....KKMMMMMMKK....',
  '...KMMMMMMMMMMK...',
  '..KMMMMMMMMMMMMK..',
  '.KMMMMMMMMMMMMMMK.',
  'KKKKKKKKKKKKKKKKKK',
  '.YYYYYYYYYYYYYYYY.',
  '..YYYYYYYYYYYYYY..',
];
const LAMP_PAL = { K: '#2a2f33', M: '#8fa3a8', Y: '#fff2b0' };

const AXE = [
  '.......BB.......',
  '.......BB.......',
  '.......BB.......',
  '.......BB.......',
  '.......BB.......',
  '...WWWWBBWWWW...',
  '..WWWWWBBWWWWW..',
  '.EWWWWWBBWWWWWE.',
  'EWWWWWWBBWWWWWWE',
  'EWWWWWWBBWWWWWWE',
  '.EWWWWWWWWWWWWE.',
  '..EWWWWWWWWWWE..',
  '....EEWWWWEE....',
];
const AXE_PAL = { B: '#5b3a1e', W: '#9aa3ae', E: '#dfe6ee' };

const HOOK = [
  '....KK....',
  '....KK....',
  '....RK....',
  '....KK....',
  '....KR....',
  '....KK....',
  '...KKK....',
  '..KKR.....',
  '.KK.......',
  'KKR....K..',
  'KK....KK..',
  'KK...KR...',
  '.KKRKK....',
  '..KKK.....',
];
const HOOK_PAL = { K: '#6b6f73', R: '#8a3b1e' };

// ---------------- backgrounds (320x180 logical, scaled 2x) ----------------
function hospitalFar(ctx, w, h) {
  const r = rng(11);
  R(ctx, 0, 0, w, h, '#22323a');
  for (let i = 0; i < 400; i++) R(ctx, r() * w, r() * h, 1, 1, '#1d2c33');
  R(ctx, 0, 120, w, 42, '#18252b');
  R(ctx, 0, 118, w, 2, '#2f444c');
  for (let base = 0; base < w; base += 160) {
    // window
    R(ctx, base + 18, 40, 44, 44, '#141f25');
    R(ctx, base + 20, 42, 40, 40, '#0b1430');
    for (let i = 0; i < 12; i++) R(ctx, base + 20 + r() * 40, 42 + r() * 36, 1, 4, '#1c2a55');
    R(ctx, base + 39, 42, 2, 40, '#141f25');
    R(ctx, base + 20, 61, 40, 2, '#141f25');
    if (base === 0) { R(ctx, base + 44, 48, 8, 8, '#e8e2c0'); R(ctx, base + 46, 50, 2, 2, '#c9c2a0'); }
    // door
    R(ctx, base + 96, 96, 34, 66, '#121b20');
    R(ctx, base + 99, 99, 28, 63, '#2b3d3f');
    R(ctx, base + 104, 106, 18, 12, '#0d1618');
    R(ctx, base + 122, 130, 3, 3, '#a0a070');
    R(ctx, base + 104, 88, 18, 6, '#1a3a22');
    R(ctx, base + 106, 89, 14, 4, '#3cff7a');
    // stain
    R(ctx, base + 72, 128, 6, 3, '#2a1c1c');
    R(ctx, base + 74, 131, 2, 6, '#2a1c1c');
  }
}
function hospitalMid(ctx, w, h) {
  const sil = '#0e171b';
  // gurney
  R(ctx, 30, 140, 56, 5, sil); R(ctx, 34, 145, 3, 17, sil); R(ctx, 79, 145, 3, 17, sil);
  R(ctx, 40, 134, 30, 6, sil);
  // IV pole
  R(ctx, 180, 100, 2, 62, sil); R(ctx, 172, 100, 18, 2, sil); R(ctx, 174, 102, 5, 9, sil);
  R(ctx, 176, 158, 10, 4, sil);
  // wheelchair
  R(ctx, 250, 136, 20, 3, sil); R(ctx, 266, 118, 3, 20, sil);
  for (let a = 0; a < 20; a++) {
    const t = (a / 20) * Math.PI * 2;
    R(ctx, 258 + Math.cos(t) * 9, 150 + Math.sin(t) * 9, 2, 2, sil);
  }
}
function hospitalEdge(ctx, w, h) {
  R(ctx, 0, 0, w, 18, '#34444a');
  for (let x = 0; x < w; x += 20) R(ctx, x, 0, 1, 18, '#2a383d');
  R(ctx, 0, 16, w, 2, '#253237');
  for (let x = 30; x < w; x += 80) {
    R(ctx, x, 12, 22, 4, '#dff6ff');
    R(ctx, x - 2, 11, 26, 1, '#7a8a90');
  }
  R(ctx, 0, 162, w, 18, '#2c3638');
  for (let x = 0; x < w; x += 8) {
    for (let y = 164; y < h; y += 8) {
      if (((x / 8) + ((y - 164) / 8)) % 2 === 0) R(ctx, x, y, 8, 8, '#3a4648');
    }
  }
  R(ctx, 0, 162, w, 2, '#56686b');
}

function forestFar(ctx, w, h) {
  const r = rng(22);
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const c = `rgb(${Math.round(18 + 24 * t)},${Math.round(11 + 14 * t)},${Math.round(36 + 28 * t)})`;
    R(ctx, 0, y, w, 1, c);
  }
  for (let i = 0; i < 70; i++) R(ctx, r() * w, r() * 100, 1, 1, r() > 0.8 ? '#ffffff' : '#8a80b0');
  // moon
  const mx = 470, my = 40;
  for (let y = -14; y <= 14; y++) for (let x = -14; x <= 14; x++) {
    if (x * x + y * y <= 196) R(ctx, mx + x, my + y, 1, 1, '#f1e9c6');
  }
  R(ctx, mx - 5, my - 4, 4, 3, '#d8cfa8'); R(ctx, mx + 4, my + 5, 3, 3, '#d8cfa8');
  // far tree line
  let y0 = 120;
  for (let x = 0; x < w; x++) {
    y0 += (r() - 0.5) * 3;
    y0 = Math.max(100, Math.min(130, y0));
    const spike = (x % 13 === 0) ? 12 * r() : 0;
    R(ctx, x, y0 - spike, 1, h - y0 + spike, '#1a1230');
  }
}
function forestMid(ctx, w, h) {
  const r = rng(33);
  const sil = '#0b0814';
  for (let base = 0; base < w; base += 106) {
    const x = base + 20 + Math.floor(r() * 40);
    R(ctx, x, 20, 9, 142, sil);
    R(ctx, x - 12, 60, 14, 3, sil); R(ctx, x - 14, 56, 3, 5, sil);
    R(ctx, x + 8, 80, 16, 3, sil); R(ctx, x + 22, 74, 3, 7, sil);
    R(ctx, x - 3, 158, 15, 4, sil);
    // gravestone
    const gx = base + 70;
    R(ctx, gx, 146, 12, 16, '#1d1a26'); R(ctx, gx + 1, 144, 10, 2, '#1d1a26');
    R(ctx, gx + 5, 148, 2, 6, '#2c2838'); R(ctx, gx + 3, 150, 6, 2, '#2c2838');
  }
  // fog
  for (let i = 0; i < 30; i++) R(ctx, r() * w, 140 + r() * 20, 20 + r() * 30, 2, 'rgba(160,150,200,0.12)');
}
function forestEdge(ctx, w, h) {
  const r = rng(44);
  for (let x = 0; x < w; x++) {
    const d = 10 + Math.floor(Math.sin(x * 0.15) * 3 + r() * 5);
    R(ctx, x, 0, 1, d, '#0f1f14');
    if (x % 23 === 0) R(ctx, x, d, 1, 6 + r() * 14, '#13281a');
  }
  R(ctx, 0, 162, w, 18, '#2a1d14');
  for (let i = 0; i < 120; i++) R(ctx, r() * w, 166 + r() * 14, 2, 1, '#1f150e');
  for (let x = 0; x < w; x++) R(ctx, x, 160 + (r() > 0.6 ? 0 : 1), 1, 3, '#1e3a1e');
  for (let x = 40; x < w; x += 97) {
    R(ctx, x, 157, 6, 3, '#b0303a'); R(ctx, x + 2, 160, 2, 2, '#e8dcc8');
    R(ctx, x + 1, 158, 1, 1, '#ffffff');
  }
}

function sewerFar(ctx, w, h) {
  const r = rng(55);
  R(ctx, 0, 0, w, h, '#221f1a');
  for (let y = 0; y < h; y += 8) {
    const off = (y / 8) % 2 === 0 ? 0 : 8;
    for (let x = -8; x < w; x += 16) {
      const shade = r() > 0.85 ? '#35302a' : '#2d2a24';
      R(ctx, x + off + 1, y + 1, 14, 6, shade);
    }
  }
  // pipes
  R(ctx, 0, 48, w, 8, '#3e4a3a'); R(ctx, 0, 48, w, 2, '#566650');
  for (let x = 20; x < w; x += 64) R(ctx, x, 46, 6, 12, '#2f3a2c');
  // tunnel arches
  for (let base = 0; base < w; base += 160) {
    const cx = base + 110;
    for (let y = 80; y < 162; y++) {
      const half = y < 100 ? Math.sqrt(Math.max(0, 400 - (100 - y) * (100 - y))) : 20;
      R(ctx, cx - half, y, half * 2, 1, '#0c0b09');
    }
    // slime
    R(ctx, base + 40, 56, 3, 10 + r() * 10, '#3f6b2a');
    R(ctx, base + 60, 56, 2, 6 + r() * 8, '#3f6b2a');
  }
}
function sewerMid(ctx, w, h) {
  const sil = '#14120f';
  for (let base = 0; base < w; base += 160) {
    R(ctx, base + 20, 18, 10, 144, sil);
    R(ctx, base + 18, 60, 14, 4, sil); R(ctx, base + 18, 120, 14, 4, sil);
    // grate
    R(ctx, base + 60, 130, 30, 24, sil);
    for (let x = 0; x < 30; x += 5) R(ctx, base + 61 + x, 131, 2, 22, '#221f1a');
  }
}
function sewerEdge(ctx, w, h) {
  const r = rng(66);
  R(ctx, 0, 0, w, 18, '#1a1814');
  for (let x = 0; x < w; x += 12) R(ctx, x, 0, 1, 18, '#0f0e0b');
  R(ctx, 0, 16, w, 2, '#2c2822');
  for (let x = 10; x < w; x += 37) R(ctx, x, 18, 1, 2 + r() * 4, '#3f6b2a');
  R(ctx, 0, 162, w, 18, '#3a352c');
  R(ctx, 0, 162, w, 2, '#544c3e');
  R(ctx, 0, 170, w, 10, '#1f3b2a');
  for (let i = 0; i < 40; i++) R(ctx, r() * w, 171 + r() * 8, 4, 1, '#3f6b4a');
}

// ---------------- misc ----------------
function glow(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
function darkness(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 25, w / 2, h / 2, 140);
  g.addColorStop(0, 'rgba(4,3,10,0)');
  g.addColorStop(1, 'rgba(4,3,10,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

const FLAME_ICON = ['..Y..', '.YYY.', '.YOY.', 'YOOOY', 'YOROY', '.YOY.', '..K..'];
const SHIELD_ICON = ['.BBBBB.', 'BLLLLLB', 'BLWLLLB', 'BLLLLLB', 'BLLLLLB', '.BLLLB.', '..BLB..', '...B...'];

export function makeArt(scene) {
  px(scene, 'flame_icon', FLAME_ICON, { Y: '#ffd75e', O: '#ff8a2a', R: '#ff5a2a', K: '#2a1a10' });
  px(scene, 'shield_icon', SHIELD_ICON, { B: '#1d3a7a', L: '#4fa8ff', W: '#dff0ff' });
  makeCharacters(scene);
  px(scene, 'ghost0', GHOST0, GHOST_PAL);
  px(scene, 'ghost1', GHOST1, GHOST_PAL);
  px(scene, 'candle0', [...FLAME0, ...CANDLE_BASE], CANDLE_PAL);
  px(scene, 'candle1', [...FLAME1, ...CANDLE_BASE], CANDLE_PAL);
  px(scene, 'spirit', SPIRIT, SPIRIT_PAL);
  px(scene, 'banshee', BANSHEE, BANSHEE_PAL);
  px(scene, 'lamp', LAMP, LAMP_PAL);
  px(scene, 'axe', AXE, AXE_PAL);
  px(scene, 'hook', HOOK, HOOK_PAL);

  // hand + long arm
  const arm = [];
  for (let i = 0; i < 60; i++) {
    let row = '..SAAAAAAAAS..';
    if (i % 17 === 5) row = '..SAADAAAAAS..';
    if (i % 23 === 11) row = '..SAAAAARAAS..';
    arm.push(row);
  }
  px(scene, 'hand', [...HAND_TOP, ...arm], HAND_PAL);

  canvas(scene, 'glow', 64, 64, glow);
  canvas(scene, 'dark', 700, 500, darkness);
  canvas(scene, 'pixel', 2, 2, (c) => R(c, 0, 0, 2, 2, '#ffffff'));

}

export function makeAnims(scene) {
  const mk = (key, frames, rate) => {
    if (scene.anims.exists(key)) return;
    scene.anims.create({ key, frames: frames.map((k) => ({ key: k })), frameRate: rate, repeat: -1 });
  };
  for (const id of Object.keys(CHAR_LOOKS)) {
    mk(`${id}_run`, [`${id}_run0`, `${id}_run1`, `${id}_run2`, `${id}_run3`], 13);
    mk(`${id}_flyA`, [`${id}_fly`], 1);
  }
  mk('ghost_float', ['ghost0', 'ghost1'], 5);
  mk('candle_flicker', ['candle0', 'candle1'], 6);
}

// ---------------- v3 content: NPCs, pickups, hazards, UI icons, background events ----------------
const GHOUL_PAL = { G: '#8fb08a', D: '#5e7a5a', K: '#1a1010', M: '#4a1a1a', W: '#d8d2c0', S: '#b0a890' };
const GHOUL_HEAD = ['...GGGG...', '..GGGGGG..', '..GKGGKG..', '..GGGGGG..', '...GMMG...'];
const GHOUL = {
  walk0: [...GHOUL_HEAD, '..WWWWWW..', '.GWWWWWWG.', '.G.WSWW.G.', '...WWWW...', '...DD.DD..', '...D...D..', '..DD...DD.'],
  walk1: [...GHOUL_HEAD, '..WWWWWW..', '.GWWWWWWG.', '.G.WWSW.G.', '...WWWW...', '....DDD...', '....DD....', '...DDDD...'],
  panic: ['G..GGGG..G', 'G.GGGGGG.G', 'GGKKGGKKGG', '..KKGGKK..', '...GMMG...', '..WMMMMW..', '..WWWWWW..', '...WSWW...', '...WWWW...', '..DD..DD..', '.DD....DD.', 'DD......DD'],
};
const SOUL_ROWS = [
  '....B....', '...BB....', '..BBLB...', '..BLLBB..', '.BLLWLB..', '.BLWWLBB.',
  'BBLWWWLB.', 'BLLWWWLLB', 'BLLKWKLLB', 'BLLWWWWLB', '.BLLWWLB.', '..BBBBB..',
];
const SOUL_ROWS2 = ['...B.....', '...BB....', ...SOUL_ROWS.slice(2)];
const SOUL_PAL = { B: '#2a6bff', L: '#6fb7ff', W: '#dff3ff', K: '#0b0918' };
const LETTERS = {
  B: ['TTTTTTTTTT', 'TYYYYYYTTT', 'TYYTTTYYTT', 'TYYTTTYYTT', 'TYYYYYYTTT', 'TYYTTTYYTT', 'TYYTTTYYTT', 'TYYYYYYTTT', 'TTTTTTTTTT'],
  O: ['TTTTTTTTTT', 'TTYYYYYYTT', 'TYYTTTTYYT', 'TYYTTTTYYT', 'TYYTTTTYYT', 'TYYTTTTYYT', 'TYYTTTTYYT', 'TTYYYYYYTT', 'TTTTTTTTTT'],
};
const LETTER_PAL = { T: '#3a2a5a', Y: '#ffd75e' };
const ORB = (icon) => {
  const base = [
    '....RRRRR....', '..RR.....RR..', '.R.........R.', '.R.........R.', 'R...........R', 'R...........R',
    'R...........R', 'R...........R', 'R...........R', '.R.........R.', '.R.........R.', '..RR.....RR..', '....RRRRR....',
  ];
  return base.map((row, y) => row.split('').map((c, x) => (icon[y - 2] && icon[y - 2][x - 2] && icon[y - 2][x - 2] !== '.' ? icon[y - 2][x - 2] : c)).join(''));
};
const ICON_MAGNET = ['.........', '.XX...XX.', '.XX...XX.', '.XX...XX.', '.XX...XX.', '.XXX.XXX.', '..XXXXX..', '...XXX...', '.........'];
const ICON_SLOW = ['.XXXXXXX.', '..X...X..', '...X.X...', '....X....', '...X.X...', '..X.X.X..', '.XXXXXXX.', '.........', '.........'];
const ICON_RUSH = ['....XX...', '...XX....', '..XX.....', '.XXXXXX..', '....XX...', '...XX....', '..XX.....', '.XX......', '.........'];
const ICON_SHIELD = ['..XXXXX..', '.XXXXXXX.', '.XXWXXXX.', '.XXXXXXX.', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....', '.........'];
const EMITTER = ['..KKKKKK..', '.KWWWWWWK.', 'KWWKWWKWWK', 'KWKKWWKKWK', 'KWWWWWWWWK', '.KWKWKWKK.', '..KKKKKK..', '...KKKK...'];
const MEDAL = ['..RR..RR..', '..RR..RR..', '...RRRR...', '..CCCCCC..', '.CCLCCCCC.', 'CCLCCCCCCC', 'CCCCCCCCCC', 'CCCCCCCCDC', '.CCCCCCDC.', '..CCCCCC..'];
const SYM = {
  candles: ['...Y....Y.', '..YOY..YOY', '...K....K.', '..CC...CC.', '..CC.Y.CC.', '..CC.K.CC.', '..CCCCCCC.', '..CCCCCCC.', '.DDDDDDDDD'],
  blast: ['......Y...', '.....YO...', '....K.....', '..KKKK....', '.KKKKKK...', 'KKWKKWKK..', 'KKKKKKKK..', '.KKWWKK...', '..KKKK....'],
  revive: ['.RR...RR.', 'RRRR.RRRR', 'RWRRRRRRR', 'RRRRRRRRR', '.RRRRRRR.', '..RRRRR..', '...RRR...', '....R....'],
  bone: ['WW......WW', 'WWW....WWW', '.WWWWWWWW.', '.WWWWWWWW.', 'WWW....WWW', 'WW......WW'],
  gift: ['...R.R....', '....R.....', 'PPPPRPPPPP', 'PPPPRPPPPP', 'QQQQRQQQQQ', 'QQQQRQQQQQ', 'QQQQRQQQQQ', 'QQQQRQQQQQ'],
};
const SYM_PAL = { Y: '#ffd75e', O: '#ff8a2a', K: '#1d1a26', C: '#f3e6c4', D: '#c9b48a', W: '#e8e2d0', R: '#e0303a', P: '#9b5de5', Q: '#6a3fb0' };

function darkWall(ctx, w, h) {
  // a wall of living darkness: solid on the left, ragged and toothy on the right, with eyes
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(3,2,8,1)'); g.addColorStop(0.75, 'rgba(3,2,8,0.95)'); g.addColorStop(1, 'rgba(3,2,8,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(3,2,8,1)';
  for (let y = 0; y < h; y += 6) { const d = 8 + Math.sin(y * 0.4) * 6 + (y % 18 === 0 ? 10 : 0); ctx.fillRect(w - 30, y, d, 6); }
  const eye = (x, y, r) => {
    ctx.fillStyle = '#ff2244'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe0a0'; ctx.fillRect(x - 1, y - 1, 2, 2);
  };
  eye(w - 50, 50, 6); eye(w - 34, 54, 6); eye(w - 60, 120, 4); eye(w - 48, 122, 4);
  ctx.fillStyle = '#e8e2d0';
  for (let k = 0; k < 6; k++) { ctx.fillRect(w - 56 + k * 5, 80, 3, 5); ctx.fillRect(w - 54 + k * 5, 92, 3, -5); }
}

function giantShadow(ctx, w, h) {
  ctx.fillStyle = 'rgba(3,2,8,0.92)';
  // head, neck, shoulders: a huge figure walking past outside
  ctx.beginPath(); ctx.ellipse(w / 2, 34, 22, 28, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(w / 2 - 10, 56, 20, 16);
  ctx.beginPath(); ctx.moveTo(4, h); ctx.quadraticCurveTo(10, 70, w / 2, 68); ctx.quadraticCurveTo(w - 10, 70, w - 4, h); ctx.fill();
}
function giantTentacle(ctx, w, h) {
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const r = 3 + t * 13;
    const x = w / 2 + Math.sin(t * 5) * 8 * (1 - t);
    ctx.fillStyle = 'rgba(10,18,12,0.95)';
    ctx.fillRect(x - r, y, r * 2, 1);
    if (y % 9 === 4 && t > 0.15) { ctx.fillStyle = 'rgba(60,90,60,0.9)'; ctx.fillRect(x + r - 4, y, 3, 3); }
  }
}
function rain(ctx, w, h) {
  const r = rng(77);
  ctx.fillStyle = 'rgba(160,190,230,0.55)';
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(r() * w), y = Math.floor(r() * h);
    for (let k = 0; k < 5; k++) ctx.fillRect((x - k + w) % w, (y + k * 2) % h, 1, 2);
  }
}
function fog(ctx, w, h) {
  const r = rng(88);
  for (let i = 0; i < 40; i++) {
    const x = r() * w, y = h * 0.3 + r() * h * 0.6, rad = 10 + r() * 22;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(200,190,230,0.22)'); g.addColorStop(1, 'rgba(200,190,230,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    // wrap so it tiles
    if (x + rad > w) ctx.fillRect(x - rad - w, y - rad, rad * 2, rad * 2);
  }
}

const ICONS = {
  icon_star: ['...Y...', '..YYY..', 'YYYYYYY', '.YYYYY.', '..YYY..', '.YY.YY.', 'YY...YY'],
  icon_gear: ['..W.W..', '.WWWWW.', 'WWW.WWW', 'WW...WW', 'WWW.WWW', '.WWWWW.', '..W.W..'],
  icon_full: ['WW...WW', 'W.....W', '.......', '.......', '.......', 'W.....W', 'WW...WW'],
  icon_charm: ['..YYY..', '.Y...Y.', '..Y.Y..', '...Y...', '..RRR..', '.RRRRR.', '..RRR..'],
};

const BAT0 = ['K.......K', 'KK.KKK.KK', '.KKKKKKK.', '..KRKRK..', '...KKK...'];
const BAT1 = ['...KKK...', '..KRKRK..', '.KKKKKKK.', 'KK.....KK', 'K.......K'];
function moon(ctx, w, h) {
  ctx.fillStyle = '#f4f6ff';
  ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - 1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c8d0e8';
  for (const [x, y, r] of [[9, 10, 3], [20, 18, 4], [12, 22, 2], [22, 8, 2], [6, 17, 2]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
}
function scanlines(ctx, w, h) {
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
  ctx.fillStyle = 'rgba(160,255,170,0.35)';
  for (let y = 2; y < h; y += 4) ctx.fillRect(0, y, w, 1);
}

export function makeArt2(scene) {
  for (const hat of HATS) if (hat.rows) px(scene, `hat_${hat.id}`, hat.rows, hat.pal);
  px(scene, 'bat0', BAT0, { K: '#2a1424', R: '#ff3355' });
  px(scene, 'bat1', BAT1, { K: '#2a1424', R: '#ff3355' });
  px(scene, 'fx_cross', ['.X.', 'XXX', '.X.'], { X: '#bfffe8' }, false);
  canvas(scene, 'fx_moon', 30, 30, moon);
  canvas(scene, 'fx_scan', 4, 4, scanlines);
  for (const [k, rows] of Object.entries(ICONS)) px(scene, k, rows, { Y: '#ffd75e', W: '#cfe0ff', R: '#ff6bb5' });
  px(scene, 'ghoul0', GHOUL.walk0, GHOUL_PAL);
  px(scene, 'ghoul1', GHOUL.walk1, GHOUL_PAL);
  px(scene, 'ghoul_panic', GHOUL.panic, GHOUL_PAL);
  px(scene, 'soul0', SOUL_ROWS, SOUL_PAL);
  px(scene, 'soul1', SOUL_ROWS2, SOUL_PAL);
  px(scene, 'letter_B', LETTERS.B, LETTER_PAL);
  px(scene, 'letter_O', LETTERS.O, LETTER_PAL);
  px(scene, 'orb_magnet', ORB(ICON_MAGNET), { R: '#ff6b9a', X: '#ff6b9a' });
  px(scene, 'orb_slow', ORB(ICON_SLOW), { R: '#9ff0ff', X: '#9ff0ff' });
  px(scene, 'orb_shield', ORB(ICON_SHIELD), { R: '#4fa8ff', X: '#4fa8ff', W: '#dff0ff' });
  px(scene, 'orb_rush', ORB(ICON_RUSH), { R: '#c08aff', X: '#ffe066' });
  canvas(scene, 'darkwall', 130, 180, darkWall);
  px(scene, 'emitter', EMITTER, { K: '#1d1a26', W: '#b8ffd2' });
  for (const [name, col] of [['BRONZE', '#c98a4a'], ['SILVER', '#c8d0dc'], ['GOLD', '#ffd75e'], ['PLATINUM', '#dff6ff']]) {
    px(scene, `medal_${name}`, MEDAL, { R: '#b0303a', C: col, L: '#ffffff', D: '#00000055' });
  }
  for (const [k, rows] of Object.entries(SYM)) px(scene, `sym_${k}`, rows, SYM_PAL);
  canvas(scene, 'giant_shadow', 120, 150, giantShadow);
  canvas(scene, 'giant_tentacle', 40, 150, giantTentacle);
  canvas(scene, 'rain', 64, 64, rain);
  canvas(scene, 'fog', 320, 90, fog);
}

export function makeAnims2(scene) {
  const mk = (key, frames, rate) => {
    if (scene.anims.exists(key)) return;
    scene.anims.create({ key, frames: frames.map((k) => ({ key: k })), frameRate: rate, repeat: -1 });
  };
  mk('ghoul_walk', ['ghoul0', 'ghoul1'], 6);
  mk('ghoul_run', ['ghoul_panic', 'ghoul1'], 12);
  mk('soul_flicker', ['soul0', 'soul1'], 6);
  mk('bat_flap', ['bat0', 'bat1'], 8);
}
