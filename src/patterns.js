// v6 phase 3: hand-made ground trap patterns (level-design skill: authored beats on top of the
// random spawner). Each step is [kind, t, opts]: t is when it reaches Milo, in seconds after the
// first one, so a pattern plays the same at any speed. Walkers (gurneys, carts, ghouls) are placed
// so they ARRIVE at that time too.
// Metrics (runner.js): a full jump is ~0.64 s in the air, a slide 0.6 s (hold to stretch it).
// So jump -> jump needs >= 0.72 s, jump -> slide >= 0.6 s, slide -> jump >= 0.4 s.
// `tests/ghostline.spec.js` checks every pattern against these numbers, and the bots run them.

export const METRICS = { jumpJump: 0.72, jumpSlide: 0.6, slideJump: 0.4, slideSlide: 0.3 };
export const NEEDS = {
  grave: 'jump', crate: 'jump', pit: 'jump', hand: 'jump', ghoul: 'jump', gurney: 'jump', cart: 'jump',
  roots: 'jump', sinkhole: 'jump', chandelier: 'jump', beam: 'slide', drawer: 'slide',
  vent: 'jump', eye: 'read',
};

// shared patterns: anywhere once you've seen the pieces
const SHARED = [
  { id: 'stairs', min: 220, steps: [['grave', 0], ['grave', 0.8], ['grave', 1.6]] },
  { id: 'tunnel', min: 260, steps: [['beam', 0], ['beam', 0.32], ['beam', 0.64]], tip: 'hold' }, // hold the slide
  { id: 'duckhop', min: 320, steps: [['beam', 0], ['grave', 0.5], ['beam', 1.15]] },
  { id: 'hopscotch', min: 420, steps: [['hand', 0], ['hand', 0.78], ['hand', 1.56]] },
  { id: 'pitrun', min: 520, steps: [['pit', 0], ['beam', 0.68], ['pit', 1.25]] },
  { id: 'gauntlet', min: 700, steps: [['crate', 0], ['beam', 0.66], ['hand', 1.1], ['grave', 1.9]] },
  { id: 'ghoulpack', min: 600, steps: [['ghoul', 0], ['ghoul', 0.8], ['beam', 1.45]] },
];

// one or two per world, built around that world's own trap
const WORLD = {
  ward: [
    { id: 'rounds', min: 40, steps: [['gurney', 0], ['beam', 0.7], ['gurney', 1.45]] },
    { id: 'wetfloor', min: 120, steps: [['grave', 0], ['gurney', 0.8], ['grave', 1.6]] },
  ],
  morgue: [
    { id: 'drawers', min: 0, steps: [['drawer', 0], ['drawer', 0.45], ['grave', 0.95]] },
    { id: 'coldlane', min: 0, steps: [['drawer', 0], ['grave', 0.5], ['drawer', 1.15], ['grave', 1.6]] },
  ],
  woods: [
    { id: 'rootmaze', min: 0, steps: [['roots', 0], ['beam', 0.78], ['roots', 1.3]] },
    { id: 'thicket', min: 0, steps: [['roots', 0], ['roots', 0.85], ['hand', 1.7]] },
  ],
  graveyard: [
    { id: 'opengraves', min: 0, steps: [['sinkhole', 0], ['grave', 0.85], ['sinkhole', 1.7]] },
    { id: 'diggers', min: 0, steps: [['hand', 0], ['sinkhole', 0.8], ['beam', 1.45]] },
  ],
  sewer: [ // read the steam: on, off, on (you run through the quiet one)
    { id: 'steamline', min: 0, steps: [['vent', 0, { on: true }], ['vent', 0.75, { on: false }], ['vent', 1.2, { on: true }]] },
    { id: 'pipework', min: 0, steps: [['vent', 0, { on: true }], ['beam', 0.68], ['vent', 1.15, { on: true }]] },
  ],
  catacombs: [
    { id: 'fallinglights', min: 0, steps: [['chandelier', 0], ['beam', 0.9], ['chandelier', 1.7]] },
    { id: 'ossuary', min: 0, steps: [['crate', 0], ['chandelier', 0.85], ['ghoul', 1.7]] },
  ],
  carnival: [
    { id: 'runaway', min: 0, steps: [['cart', 0], ['cart', 0.85], ['beam', 1.5]] },
    { id: 'midway', min: 0, steps: [['cart', 0], ['beam', 0.7], ['grave', 1.2], ['cart', 2.0]] },
  ],
  otherside: [ // the eye's bob is set so each one is a clear read: high (slide), low (jump), high
    { id: 'stare', min: 0, steps: [['eye', 0, { at: 'high' }], ['eye', 0.75, { at: 'low' }], ['eye', 1.35, { at: 'high' }]] },
    { id: 'lastmile', min: 0, steps: [['eye', 0, { at: 'low' }], ['beam', 0.72], ['pit', 1.3], ['eye', 2.1, { at: 'high' }]] },
  ],
};

export function patternsFor(zoneId, meters) {
  return [...SHARED.filter((p) => meters >= p.min), ...(WORLD[zoneId] || []).filter((p) => meters >= p.min)];
}
export const ALL_PATTERNS = [...SHARED, ...Object.values(WORLD).flat()];
export const WORLD_PATTERNS = WORLD;

// what a step needs from you (an eye depends on where it is when it reaches you)
export function stepNeed(step) {
  const n = NEEDS[step[0]];
  if (n !== 'read') return n;
  return step[2]?.at === 'low' ? 'jump' : 'slide';
}

// true when every pair of steps leaves time for the action after it (used by the tests)
export function patternFair(p) {
  const s = p.steps;
  for (let i = 1; i < s.length; i++) {
    const a = stepNeed(s[i - 1]), b = stepNeed(s[i]);
    const dt = s[i][1] - s[i - 1][1];
    if (s[i - 1][0] === 'vent' && s[i - 1][2]?.on === false) continue; // you ran through it: no action
    const need = a === 'jump' ? (b === 'jump' ? METRICS.jumpJump : METRICS.jumpSlide) : (b === 'jump' ? METRICS.slideJump : METRICS.slideSlide);
    if (dt < need - 1e-6) return false;
  }
  return true;
}
