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
  { id: 'nurse', name: 'NURSE IVY', price: 150, perk: 'THE STRETCH starts further back', drainMul: 0.6, candleMul: 1, shield: false },
  { id: 'hunter', name: 'DEX THE HUNTER', price: 400, perk: 'Survives 1 hit per run', drainMul: 1, candleMul: 1, shield: true },
  { id: 'kid', name: 'LITTLE LILA', price: 800, perk: 'Candles count double', drainMul: 1, candleMul: 2, shield: false },
  { id: 'mummy', name: 'WRAPS', price: 1500, perk: 'Wins the Grave Spin more', drainMul: 1, candleMul: 1, shield: false, spinLuck: true },
  { id: 'vampire', name: 'COUNT VLAD', price: 2500, perk: 'Boo carries you 50% longer', drainMul: 1, candleMul: 1, shield: false, rushMul: 2 },
  { id: 'skeleton', name: 'RATTLES', price: 3500, perk: 'Stumbles cost less', drainMul: 1, candleMul: 1, shield: false, bansheeMul: 0.75 },
  { id: 'wolf', name: 'FANG', price: 5000, perk: 'Power-ups and weapons last 50% longer', drainMul: 1, candleMul: 1, shield: false, powerMul: 1.5 },
];
export const GHOST_NAME = 'BOO';

export { ZONES, zoneAt } from './zones.js';

export const DEATH_LINES = [
  'IT CAUGHT YOU.',
  'YOU ARE ONE OF US NOW.',
  'SPOOKED.',
  'IT SAYS THANK YOU.',
  'SHOULD HAVE STAYED HOME.',
  'YOU LOOKED BACK.',
];
// v6: the results screen names what got you (the last thing you stumbled on, or the pit)
export const CAUSE_LINES = {
  grave: 'TRIPPED OVER IT.', beam: 'A SPIRIT BEAM GOT YOU.', hand: 'A HAND GRABBED YOUR FOOT.',
  crate: 'TRIPPED ON A CRATE.', ghoul: 'A GHOUL GOT IN THE WAY.', swing: 'THE SWING GOT YOU.', pit: 'YOU FELL IN A PIT.',
  gurney: 'RUN OVER BY A BED.', drawer: 'A DRAWER GOT YOU.', roots: 'TRIPPED ON THE ROOTS.', sinkhole: 'THE GROUND GAVE WAY.',
  vent: 'STEAMED.', chandelier: 'THE CHANDELIER GOT YOU.', cart: 'RUN OVER BY A CART.', eye: 'THE EYE SAW YOU.',
  door: "THE DOOR NEEDS EVERY JOURNAL PAGE.",
  matron: 'LIGHTS OUT. SHE PUT YOU TO BED.', coroner: 'FILED.', ending: 'YOU MADE IT THROUGH.',
  'trick:reach': 'IT REACHED YOU.', 'trick:drawer': 'IT CAME OUT OF THE DRAWER.', 'trick:canopy': 'IT DROPPED FROM THE TREES.',
  'trick:burrow': 'IT CAME UP UNDER YOU.', 'trick:ceiling': 'IT WAS ON THE CEILING.', 'trick:skull': 'ITS FACE HIT YOU.', 'trick:ride': 'IT RODE YOU DOWN.',
};

// Charms (Jetpack Joyride "gadgets"): permanent perks, equip up to 2 before a run.
export const CHARMS = [
  { id: 'magnet', name: 'CANDLE MAGNET', price: 300, desc: 'Pulls nearby candles to you' },
  { id: 'nightlight', name: 'NIGHT LIGHT', price: 200, desc: 'Candles push it back 2x' },
  { id: 'lucky', name: 'LUCKY TOOTH', price: 350, desc: 'Start every run with a soul' },
  { id: 'headstart', name: 'HEAD START', price: 500, desc: 'Begin at 250M' },
  { id: 'bouncy', name: 'BOUNCY BONES', price: 150, desc: 'Jump a little higher' },
  { id: 'graverobber', name: 'GRAVE ROBBER', price: 400, desc: 'Souls show up twice as often' },
  { id: 'ironlung', name: 'IRON LUNG', price: 600, desc: 'Start with a spirit shield' },
  { id: 'soulmagnet', name: 'SOUL MAGNET', price: 450, desc: 'Souls and letters fly to you' },
  { id: 'longrush', name: 'LONG RIDE', price: 550, desc: 'Boo carries you 3s longer' },
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
