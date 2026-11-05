// Score multiplier, combo tiers and the unlock track.
// Subway Surfers: finishing missions raises a permanent score multiplier.
// Downwell: every run fills a bar, and something new unlocks every run or two.

// ---------------- score multiplier ----------------
export const MAX_MULT = 30;
export const multiplierFor = (level) => Math.max(1, Math.min(MAX_MULT, level));

// ---------------- combo ----------------
// Every good thing you do feeds one combo. Keep doing good things within the window
// or it ends. Getting hit drops it. Bigger combos multiply the points of each event.
export const COMBO_WINDOW = 2.4; // seconds
export const COMBO_TIERS = [0, 12, 30, 55, 90]; // combo count needed for x1..x5
export const tierFor = (n) => { let t = 1; COMBO_TIERS.forEach((need, i) => { if (n >= need) t = i + 1; }); return t; };
// base points per event (before combo tier and score multiplier)
export const POINTS = { candle: 5, near: 25, soul: 50, letter: 30, boo: 200, ghoul: 15, splat: 20, power: 20, escape: 300, gate: 100 };

export const fmt = (n) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// ---------------- Boo's hats (drawn above the ghost) ----------------
export const HATS = [
  { id: 'none', name: 'NO HAT' },
  { id: 'top', name: 'TOP HAT', rows: ['..KKKKKK..', '..KKKKKK..', '..KLKKKK..', '..RRRRRR..', 'KKKKKKKKKK'], pal: { K: '#2e2a40', L: '#4a4566', R: '#c0303a' } },
  { id: 'party', name: 'PARTY HAT', rows: ['...W...', '...P...', '..PCP..', '..CPC..', '.PCPCP.', '.CPCPC.'], pal: { W: '#ffffff', P: '#ff6bb5', C: '#7ff0ff' } },
  { id: 'witch', name: 'WITCH HAT', rows: ['.....PP...', '....PPP...', '....PPPP..', '...PPPPP..', '...YYYYY..', 'PPPPPPPPPP'], pal: { P: '#6a3fb0', Y: '#ffd75e' } },
  { id: 'bow', name: 'BIG BOW', rows: ['RR...RR', 'RRR.RRR', 'RRRWRRR', 'RRR.RRR', 'RR...RR'], pal: { R: '#ff4d8a', W: '#ffd0e0' } },
  { id: 'propeller', name: 'PROPELLER CAP', rows: ['RRR.BBB', '...Y...', '.GGGGG.', 'GGRGGRG', 'GGGGGGG'], pal: { R: '#ff4d4d', B: '#4d9bff', Y: '#ffd75e', G: '#3fbf6a' } },
  { id: 'pumpkin', name: 'PUMPKIN', rows: ['...G...', '.OOOOO.', 'OOKOKOO', 'OOOOOOO', 'OKKKKKO', '.OOOOO.'], pal: { G: '#3f8f3a', O: '#ff8a2a', K: '#3a1a0a' } },
  { id: 'crown', name: 'CROWN', rows: ['Y..Y..Y', 'YY.Y.YY', 'YYYYYYY', 'YRYBYRY', 'YYYYYYY'], pal: { Y: '#ffd75e', R: '#e0303a', B: '#4d9bff' } },
  { id: 'halo', name: 'HALO', rows: ['.YYYYY.', 'Y.....Y', '.YYYYY.'], pal: { Y: '#fff2b0' }, float: 6 },
];

// ---------------- ectoplasm trail colors ----------------
export const TRAILS = [
  { id: 'ecto', name: 'ECTOPLASM', cols: [0xcfe0ff, 0x8fe8ff] },
  { id: 'ember', name: 'EMBERS', cols: [0xffb040, 0xff6020] },
  { id: 'lime', name: 'SLIME', cols: [0xc6ff7a, 0x8fd84a] },
  { id: 'candy', name: 'CANDY', cols: [0xff9fd0, 0xffd0f0] },
  { id: 'frost', name: 'FROST', cols: [0xffffff, 0xaee8ff] },
  { id: 'gold', name: 'GOLD', cols: [0xffd75e, 0xfff2b0] },
  { id: 'void', name: 'VOID', cols: [0xb48aff, 0x7a4fd0] },
  { id: 'rainbow', name: 'RAINBOW', cols: [0xff6060, 0x60ff90], rainbow: true },
];

// ---------------- journal pages (the story, a bit at a time) ----------------
export const PAGES = [
  ['BOO WAS THE NIGHT JANITOR', 'AT ST. MERCY.', 'HE NEVER CLOCKED OUT.'],
  ['THE COLD ROOM HUMS', 'AT 3:33 EVERY NIGHT.', 'NOBODY SET THAT TIMER.'],
  ['THE HOLLOW WOODS WERE', 'A PARK ONCE. THE TREES', 'STILL WAIT FOR VISITORS.'],
  ['CROWSREST HAS 400 GRAVES.', '399 OF THEM', 'ARE QUIET.'],
  ["THE DARK ISN'T EVIL.", "IT'S JUST HUNGRY.", 'CANDLES TASTE BAD TO IT.'],
  ['THE SEWERS UNDER THE CITY', 'ARE OLDER', 'THAN THE CITY.'],
  ['THE BONE HALLS KEEP', 'A LIST OF NAMES.', "MILO'S ISN'T ON IT. YET."],
  ['THE CARNIVAL CLOSED', 'IN 1931. THE MUSIC', 'NEVER GOT THE MEMO.'],
  ["BANSHEES AREN'T ANGRY.", "THEY'RE LATE FOR", 'SOMETHING. ALWAYS.'],
  ["BOO CAN'T HOLD ON FOREVER.", "THAT'S WHY HE NEEDS", 'YOU TO HOLD ON TOO.'],
  ["THE OTHER SIDE ISN'T", "A PLACE. IT'S A DOOR", 'THAT FORGOT TO CLOSE.'],
  ['MAKE IT ALL THE WAY', 'THROUGH AND THE LIGHTS', 'COME BACK ON. PROBABLY.'],
];

// ---------------- the unlock track ----------------
const h = (id) => ({ kind: 'hat', id });
const t = (id) => ({ kind: 'trail', id });
const p = (i) => ({ kind: 'page', i });
const c = (n) => ({ kind: 'candles', n });
export const TRACK = [
  t('ember'), p(0), h('top'), c(50), p(1), h('party'), t('lime'), p(2), c(100), h('witch'), p(3),
  t('candy'), h('bow'), p(4), c(150), t('frost'), h('propeller'), p(5), h('pumpkin'), c(200), p(6),
  t('gold'), h('crown'), p(7), c(250), t('void'), p(8), h('halo'), c(300), p(9), p(10), t('rainbow'), p(11),
];
// early unlocks cost 1 point, so the first runs each unlock something
// the last pages are expensive: the whole journal (the key to the door) takes many hours of runs
export const costFor = (i) => (i < 6 ? 1 : i < 14 ? 2 : i < 24 ? 3 : i < 30 ? 8 : 20);
// every run earns at least 1 point; going far and finishing missions earn more
export const runPoints = (meters, missionsDone) => 1 + Math.floor(meters / 400) + missionsDone;
export const BONUS_PER_POINT = 25; // after the track is finished, points turn into candles

export function owned(got) {
  const items = TRACK.slice(0, got);
  return {
    hats: ['none', ...items.filter((x) => x.kind === 'hat').map((x) => x.id)],
    trails: ['ecto', ...items.filter((x) => x.kind === 'trail').map((x) => x.id)],
    pages: items.filter((x) => x.kind === 'page').map((x) => x.i),
  };
}

export function itemName(item) {
  if (item.kind === 'hat') return HATS.find((x) => x.id === item.id).name;
  if (item.kind === 'trail') return `${TRAILS.find((x) => x.id === item.id).name} TRAIL`;
  if (item.kind === 'page') return `JOURNAL PAGE ${item.i + 1}`;
  return `${item.n} CANDLES`;
}

export const HAT_IDS = HATS.map((x) => x.id);
export const TRAIL_IDS = TRAILS.map((x) => x.id);

// world looks per character (Crossy Road: some characters change the whole world)
export const LOOKS = {
  survivor: { tint: 0xffffff, wash: null, fx: null, name: '' },
  nurse: { tint: 0xb8fff0, wash: [0x00ffb0, 0.12], fx: 'crosses', name: 'CLEAN WARD' },
  hunter: { tint: 0x90ff90, wash: [0x00ff40, 0.14], fx: 'scan', name: 'NIGHT VISION' },
  kid: { tint: 0xffb0e8, wash: [0xff50c0, 0.17], fx: 'bubbles', name: 'BUBBLEGUM' },
  mummy: { tint: 0xffc888, wash: [0xffa030, 0.17], fx: 'sand', name: 'SANDSTORM' },
  vampire: { tint: 0xff6060, wash: [0xff0020, 0.18], fx: 'bats', name: 'BLOOD MOON' },
  skeleton: { tint: 0xf4ecdc, wash: [0xfff0d8, 0.13], fx: 'ash', name: 'BONE DUST' },
  wolf: { tint: 0x90acff, wash: [0x3050ff, 0.16], fx: 'moon', name: 'FULL MOON' },
};
