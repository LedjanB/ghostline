// Game constants, characters and zones.
export const W = 640;
export const H = 360;
export const CEIL = 36;   // bottom of the ceiling band (screen px)
export const FLOOR = 324; // top of the floor band (screen px)
export const PLAYER_X = 150;
export const PX_PER_METER = 24;
export const ZONE_LENGTH_M = 600;
export const FONT = '"Press Start 2P", monospace';

export const CHARACTERS = [
  {
    id: 'survivor', name: 'SURVIVOR', price: 0,
    perk: 'No perks. Pure vibes.',
    drainMul: 1, candleMul: 1, shield: false,
  },
  {
    id: 'nurse', name: 'NIGHT NURSE', price: 100,
    perk: 'Light lasts 40% longer',
    drainMul: 0.6, candleMul: 1, shield: false,
  },
  {
    id: 'hunter', name: 'GHOST HUNTER', price: 300,
    perk: 'Survives 1 hit per run',
    drainMul: 1, candleMul: 1, shield: true,
  },
  {
    id: 'kid', name: 'POSSESSED KID', price: 700,
    perk: 'Candles count double',
    drainMul: 1, candleMul: 2, shield: false,
  },
];

export const ZONES = [
  { id: 'hospital', name: 'ST. MERCY WARD', swing: 'lamp', song: 'hospital' },
  { id: 'forest', name: 'THE HOLLOW WOODS', swing: 'axe', song: 'forest' },
  { id: 'sewer', name: 'THE DRIPPING DARK', swing: 'hook', song: 'sewer' },
];

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
