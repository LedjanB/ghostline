// Versioned save (save-systems skill): plain data only, version stamp,
// migrate old saves, validate on load, keep a backup of the last good save.
export const SAVE_VERSION = 4;
const KEY = 'ghostline-save';
const BACKUP_KEY = 'ghostline-save.bak';
const LEGACY_KEY = 'ghostline-save-v1'; // v1 of the game stored here, without a version field

const CHARACTER_IDS = ['survivor', 'nurse', 'hunter', 'kid'];

function defaults() {
  return {
    version: SAVE_VERSION,
    candles: 0,
    best: 0,
    owned: ['survivor'],
    selected: 'survivor',
    runs: 0,
    mode: 'normal', // 'normal' | 'creative'
    // creative-mode checkpoint, its own slot so it never touches normal-mode records
    creative: { x: 0, rebirths: 0 },
    // v4: missions + levels, charms, daily run, gift timer
    missions: { active: [], done: [], stars: 0, level: 1, totals: {} },
    charms: { owned: [], equipped: [] },
    daily: { date: '', best: 0, ghost: [] },
    giftAt: 0,
    settings: { music: 0.8, sfx: 0.9, muted: false, shake: true, flicker: true },
  };
}

// Each migration takes a save of version N and returns version N+1.
const MIGRATIONS = {
  1: (old) => {
    const d = defaults();
    return {
      version: 2,
      candles: old.candles,
      best: old.best,
      owned: old.owned,
      selected: old.selected,
      runs: old.runs,
      settings: { ...d.settings, muted: !!old.muted },
    };
  },
  2: (old) => ({ ...old, version: 3, mode: 'normal', creative: { x: 0, rebirths: 0 } }),
  3: (old) => {
    const d = defaults();
    return { ...old, version: 4, missions: d.missions, charms: d.charms, daily: d.daily, giftAt: 0 };
  },
};

const CHARM_IDS = ['magnet', 'nightlight', 'lucky', 'headstart', 'bouncy', 'graverobber'];
const strArr = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []);
const numMap = (o) => {
  const out = {};
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (Number.isFinite(v)) out[k] = v;
  return out;
};
const isInt = (n) => Number.isFinite(n) && Math.floor(n) === n && n >= 0;
const clamp01 = (n, fb) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fb);

// Returns a clean save or null if the data is unusable.
function validate(raw) {
  if (!raw || typeof raw !== 'object') return null;
  let s = { ...raw };
  if (!isInt(s.version)) s.version = 1;
  if (s.version > SAVE_VERSION) return null; // from a newer build; don't guess
  while (s.version < SAVE_VERSION) {
    const m = MIGRATIONS[s.version];
    if (!m) return null;
    s = m(s);
  }
  const d = defaults();
  const out = {
    version: SAVE_VERSION,
    candles: isInt(s.candles) ? s.candles : 0,
    best: isInt(s.best) ? s.best : 0,
    runs: isInt(s.runs) ? s.runs : 0,
    owned: Array.isArray(s.owned) ? s.owned.filter((id) => CHARACTER_IDS.includes(id)) : [],
    selected: CHARACTER_IDS.includes(s.selected) ? s.selected : 'survivor',
    mode: ['normal', 'daily', 'creative'].includes(s.mode) ? s.mode : 'normal',
    missions: {
      active: strArr(s.missions?.active).slice(0, 3),
      done: strArr(s.missions?.done),
      stars: isInt(s.missions?.stars) ? s.missions.stars : 0,
      level: isInt(s.missions?.level) && s.missions.level >= 1 ? s.missions.level : 1,
      totals: numMap(s.missions?.totals),
    },
    charms: {
      owned: strArr(s.charms?.owned).filter((id) => CHARM_IDS.includes(id)),
      equipped: strArr(s.charms?.equipped).filter((id) => CHARM_IDS.includes(id)).slice(0, 2),
    },
    daily: {
      date: typeof s.daily?.date === 'string' ? s.daily.date : '',
      best: isInt(s.daily?.best) ? s.daily.best : 0,
      ghost: Array.isArray(s.daily?.ghost) ? s.daily.ghost.filter(Number.isFinite).slice(0, 4000) : [],
    },
    giftAt: Number.isFinite(s.giftAt) ? s.giftAt : 0,
    creative: {
      x: Number.isFinite(s.creative?.x) && s.creative.x >= 0 ? s.creative.x : 0,
      rebirths: isInt(s.creative?.rebirths) ? s.creative.rebirths : 0,
    },
    settings: {
      music: clamp01(s.settings?.music, d.settings.music),
      sfx: clamp01(s.settings?.sfx, d.settings.sfx),
      muted: typeof s.settings?.muted === 'boolean' ? s.settings.muted : false,
      shake: typeof s.settings?.shake === 'boolean' ? s.settings.shake : true,
      flicker: typeof s.settings?.flicker === 'boolean' ? s.settings.flicker : true,
    },
  };
  if (!out.owned.includes('survivor')) out.owned.unshift('survivor');
  out.owned = [...new Set(out.owned)];
  if (!out.owned.includes(out.selected)) out.selected = 'survivor';
  out.charms.equipped = out.charms.equipped.filter((id) => out.charms.owned.includes(id));
  return out;
}

function read(key) {
  try {
    const txt = localStorage.getItem(key);
    if (!txt) return undefined;
    return JSON.parse(txt);
  } catch (e) {
    return null; // corrupt
  }
}

function load() {
  const main = read(KEY);
  if (main !== undefined) {
    const v = validate(main);
    if (v) return v;
    const bak = validate(read(BACKUP_KEY)); // main is corrupt: fall back to the backup
    if (bak) return bak;
    return defaults();
  }
  const legacy = read(LEGACY_KEY);
  if (legacy) {
    const v = validate(legacy); // v1 save -> migrate
    if (v) return v;
  }
  return defaults();
}

let data = load();
write();

function write() {
  try {
    // keep the previous good save as a backup, then write the new one
    const prev = localStorage.getItem(KEY);
    if (prev) localStorage.setItem(BACKUP_KEY, prev);
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) { /* storage blocked (private mode): play without saving */ }
}

export const Save = {
  get: () => data,
  update(fn) {
    const draft = JSON.parse(JSON.stringify(data));
    fn(draft);
    const v = validate(draft);
    if (v) { data = v; write(); }
    return data;
  },
};
