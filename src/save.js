// Saves progress in the browser (localStorage). Survives closing the tab.
const KEY = 'ghostline-save-v1';

const DEFAULTS = {
  candles: 0,
  best: 0,
  owned: ['survivor'],
  selected: 'survivor',
  muted: false,
  runs: 0,
};

let data = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS, owned: [...DEFAULTS.owned] };
    const parsed = JSON.parse(raw);
    const merged = { ...DEFAULTS, ...parsed };
    if (!Array.isArray(merged.owned) || merged.owned.length === 0) merged.owned = ['survivor'];
    if (!merged.owned.includes('survivor')) merged.owned.unshift('survivor');
    if (!merged.owned.includes(merged.selected)) merged.selected = 'survivor';
    return merged;
  } catch (e) {
    return { ...DEFAULTS, owned: [...DEFAULTS.owned] };
  }
}

function write() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* private mode etc */ }
}

export const Save = {
  get: () => data,
  update(fn) { fn(data); write(); return data; },
};
