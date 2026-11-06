// v6 runner: shared tuning, constants and helpers (used by runner.js, runner-stretch.js, runner-flight.js, runner-weapons.js)
import { CEIL, FLOOR } from './data.js';
import { Device } from './input.js';

export const TOP = CEIL + 16;
export const MILO_SCALE = 2.5;     // v6: 1.25x the v5 size, so he reads on a busy screen
export const MILO_HALF = 22;       // half his height at that scale
export const BOTTOM = FLOOR - MILO_HALF; // Milo's centre when standing
// movement (scaled from prototype A: 2/3 of its 960x540 numbers)
export const RUN_G = 1800;
export const JUMP_V = 575;          // about 90 px high, 0.64 s in the air
export const JUMP_CUT = 0.45;       // let go early = shorter jump
export const COYOTE = 0.09, BUFFER = 0.13;
export const SLIDE_T = 0.6;
export const FAST_FALL = 2400;      // slide in the air = drop fast
// the chaser
export const RUN = {
  START_GAP: 118, MAX_GAP: 132, CAUGHT: 22,
  STUMBLE_COST: 40,          // px the creature gains per stumble
  CLEAN: 5,                  // px/s it falls back while you run clean
  CANDLE: 1.2, KILL: 8,
  LAND_GAP: 100, AIR_HIT: 30, // flight: it waits where you land; each air hit = 30 px closer (3 hits = caught)
  LAND_MAX: 108, // candles in the air push it back, but never all the way: landing stays tense
  ORB_TIME: 8,               // Boo orb flight (s): rare, but long enough to be a real moment
  ORB_FIRST_M: 900, ORB_EVERY_M: [1800, 2600],
  CHASM_S: 6.5,              // fallback flight section width in seconds (a set piece sets its own)
  CHASM_AT_M: 220,           // phase 3: a flight section in every world, this far into it
  SAFE_RUNS: 3, SAFE_M: 300, // a player's first runs: Boo saves you until 300 m
};
// weapons (picked up during the run; each breaks after its time or ammo). They aim and fire on their own.
// Phase 3: each weapon is the answer to something (ANSWERS); it only aims at what it answers, and the
// pickup you get is the answer to the world you're in (WORLD_WEAPON).
export const WEAPONS = {
  salt: { name: 'SALT SHOTGUN', short: 'SALT!', icon: 'salt_gun', ammo: 24, time: 16, cd: 0.32, range: 230, answer: 'SALT BREAKS CRATES AND GHOULS' },       // short, wide spread
  flame: { name: 'CANDLE FLAMETHROWER', short: 'FIRE!', icon: 'flame_gun', ammo: Infinity, time: 9, cd: 0.045, range: 125, answer: 'FIRE BURNS HANDS AND ROOTS' }, // constant stream
  holy: { name: 'HOLY WATER SLINGSHOT', short: 'HOLY WATER!', icon: 'sling', ammo: 12, time: 18, cd: 0.7, range: 420, answer: 'HOLY WATER: EYES, STEAM, IT' },  // long range, pierces
  bone: { name: 'BONE BOOMERANG', short: 'BONE!', icon: 'bone', ammo: 8, time: 18, cd: 0.25, range: 270, answer: 'THE BONE HITS IT BEHIND YOU' },   // comes back, hits behind you
};
export const ANSWERS = {
  salt: ['crate', 'ghoul', 'gurney', 'cart'],
  flame: ['hand', 'roots', 'drawer', 'chandelier'],
  holy: ['eye', 'vent', 'ghoul', 'trick'],
  bone: ['trick', 'ghoul', 'crate'],
};
export const WORLD_WEAPON = {
  ward: 'salt', morgue: 'flame', woods: 'flame', graveyard: 'bone',
  sewer: 'holy', catacombs: 'bone', carnival: 'salt', otherside: 'holy',
};
export const ECTO = { cd: 0.28, range: 300 }; // Boo's ectoplasm while flying: pops banshees and hands
export const STRETCH_SCALE = 2.4; // about 2.5x Milo's height
export const BEAM_END = FLOOR - 32; // a ceiling beam's tip: just above Milo's head, so sliding clearly fits under
// one trap of its own per world
export const WORLD_TRAPS = {
  ward: 'gurney', morgue: 'drawer', woods: 'roots', graveyard: 'sinkhole',
  sewer: 'vent', catacombs: 'chandelier', carnival: 'cart', otherside: 'eye',
};
export const WALKERS = { ghoul: 45, gurney: 110, cart: 170 }; // these move at you on their own

export const kindsAt = (m, zoneId) => [
  [WORLD_TRAPS[zoneId], m > 40 ? 2.6 : 0],
  ['grave', 4],
  ['beam', m > 20 ? 3 : 0],
  ['hand', m > 50 ? 2.5 : 0],
  ['crate', m > 80 ? 2 : 0],
  ['ghoul', m > 110 ? 2.2 : 0],
  ['pit', m > 150 ? 2 : 0],
  ['swing', m > 260 ? 1.4 : 0],
];

// later in a run: it sits closer, each stumble costs more, it falls back slower (0 = start, 1 = hardest)
export const late = (d) => Math.max(0, (d - 0.2) / 0.8);
export const maxGap = (d) => RUN.MAX_GAP - 30 * late(d);
export const stumbleCost = (d) => RUN.STUMBLE_COST + 16 * late(d);
export const cleanRate = (d) => RUN.CLEAN * (1 - 0.6 * late(d));
// two stumbles inside this = caught: forgiving while you learn, stricter later
export const comboWindow = (d) => 2.2 + 1.0 * Math.min(1, d / 0.6);


// short prompts for the run (input.js keeps the menu prompts)
export function prompt2(action) {
  // before the first input the device is unknown: a touch screen means a phone, so say TAP, not SPACE
  let d = Device.get();
  if (d === 'keyboard' && typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) d = 'touch';
  if (action === 'jump') return d === 'touch' ? 'TAP' : d === 'gamepad' ? 'A' : d === 'mouse' ? 'CLICK' : 'SPACE';
  return d === 'touch' ? 'SWIPE DOWN' : d === 'gamepad' ? 'B' : 'DOWN';
}
