// Game constants, characters and zones.
export const W = 640;
export const H = 360;
export const CEIL = 36;   // bottom of the ceiling band (screen px)
export const FLOOR = 324; // top of the floor band (screen px)
export const PLAYER_X = 150;
export const PX_PER_METER = 24;
export { ZONE_LENGTH_M } from './zones.js';
export const FONT = '"Press Start 2P", monospace';

// The cast. MILO is the hero; BOO is the ghost who drags him out of St. Mercy.
export const CHARACTERS = [
  { id: 'survivor', name: 'MILO', price: 0, perk: 'Woke up at 3:33. No perks.', drainMul: 1, candleMul: 1, shield: false },
  { id: 'nurse', name: 'NURSE IVY', price: 150, perk: 'Light lasts 40% longer', drainMul: 0.6, candleMul: 1, shield: false },
  { id: 'hunter', name: 'DEX THE HUNTER', price: 400, perk: 'Survives 1 hit per run', drainMul: 1, candleMul: 1, shield: true },
  { id: 'kid', name: 'LITTLE LILA', price: 800, perk: 'Candles count double', drainMul: 1, candleMul: 2, shield: false },
  { id: 'mummy', name: 'WRAPS', price: 1500, perk: 'Wins the Grave Spin more', drainMul: 1, candleMul: 1, shield: false, spinLuck: true },
  { id: 'vampire', name: 'COUNT VLAD', price: 2500, perk: 'Spirit Rush lasts twice as long', drainMul: 1, candleMul: 1, shield: false, rushMul: 2 },
  { id: 'skeleton', name: 'RATTLES', price: 3500, perk: 'Banshees fly slower', drainMul: 1, candleMul: 1, shield: false, bansheeMul: 0.75 },
  { id: 'wolf', name: 'FANG', price: 5000, perk: 'Power-ups last 50% longer', drainMul: 1, candleMul: 1, shield: false, powerMul: 1.5 },
];
export const GHOST_NAME = 'BOO';

export { ZONES, zoneAt } from './zones.js';

export const DEATH_LINES = [
  'THE GHOST LET GO.',
  'YOU ARE ONE OF US NOW.',
  'SPOOKED.',
  'DRAGGED UNDER.',
  'SHOULD HAVE STAYED HOME.',
  'THE DARK SAYS HI.',
];

// Charms (Jetpack Joyride "gadgets"): permanent perks, equip up to 2 before a run.
export const CHARMS = [
  { id: 'magnet', name: 'CANDLE MAGNET', price: 300, desc: 'Pulls nearby candles to you' },
  { id: 'nightlight', name: 'NIGHT LIGHT', price: 200, desc: 'Light drains 25% slower' },
  { id: 'lucky', name: 'LUCKY TOOTH', price: 350, desc: 'Start every run with a soul' },
  { id: 'headstart', name: 'HEAD START', price: 500, desc: 'Begin at 250M' },
  { id: 'bouncy', name: 'BOUNCY BONES', price: 150, desc: 'Bounce further when you fall' },
  { id: 'graverobber', name: 'GRAVE ROBBER', price: 400, desc: 'Souls show up twice as often' },
  { id: 'ironlung', name: 'IRON LUNG', price: 600, desc: 'Start with a spirit shield' },
  { id: 'soulmagnet', name: 'SOUL MAGNET', price: 450, desc: 'Souls and letters fly to you' },
  { id: 'longrush', name: 'LONG RUSH', price: 550, desc: 'Spirit Rush lasts 3s longer' },
  { id: 'luckyspin', name: 'LUCKY SPIN', price: 650, desc: 'Grave Spin pays out more' },
];
export const MAX_CHARMS = 2;

// Flappy Bird-style medals on the results screen
export const MEDALS = [
  { m: 2000, name: 'PLATINUM', color: 0xdff6ff },
  { m: 1000, name: 'GOLD', color: 0xffd75e },
  { m: 500, name: 'SILVER', color: 0xc8d0dc },
  { m: 250, name: 'BRONZE', color: 0xc98a4a },
];
export const medalFor = (m) => MEDALS.find((x) => m >= x.m) || null;

export const TITLES = [
  'SCAREDY CAT', 'NIGHT OWL', 'CANDLE THIEF', 'GRAVE WALKER', 'GHOST WHISPERER',
  'SPOOK RUNNER', 'HAUNT HOPPER', 'CRYPT KEEPER', 'BANSHEE TAMER', 'LORD OF THE DARK',
];
export const GIFT_HOURS = 4;
