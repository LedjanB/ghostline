// Action map (input-systems skill): gameplay asks "is float held?", never "is Space down?".
// Bindings per device: keyboard, pointer (mouse/touch), gamepad.

const KEYS = {
  float: ['SPACE', 'UP', 'W'],
  pause: ['P', 'ESC'],
  confirm: ['ENTER', 'SPACE'],
  back: ['ESC', 'BACKSPACE'],
  left: ['LEFT', 'A'],
  right: ['RIGHT', 'D'],
  up: ['UP', 'W'],
  down: ['DOWN', 'S'],
  slide: ['DOWN', 'S'],
};
// Standard gamepad mapping: 0 A, 1 B, 7 RT, 9 Start, 12-15 d-pad up/down/left/right
const PAD = {
  float: [0, 7, 6, 5],
  pause: [9],
  confirm: [0],
  back: [1],
  up: [12],
  down: [13],
  slide: [1, 13],
  left: [14],
  right: [15],
};

// last device that sent input, shared by every scene so prompts stay consistent
let lastDevice = 'keyboard';
const listeners = new Set();
function setDevice(d) {
  if (d === lastDevice) return;
  lastDevice = d;
  listeners.forEach((fn) => fn(d));
}
window.addEventListener('keydown', () => setDevice('keyboard'), true);
window.addEventListener('pointerdown', (e) => setDevice(e.pointerType === 'touch' ? 'touch' : 'mouse'), true);

export const Device = {
  get: () => lastDevice,
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

export function prompt(action) {
  const d = lastDevice;
  if (action === 'float') {
    if (d === 'touch') return 'HOLD THE SCREEN';
    if (d === 'mouse') return 'HOLD THE MOUSE';
    if (d === 'gamepad') return 'HOLD A';
    return 'HOLD SPACE';
  }
  if (action === 'confirm') return d === 'gamepad' ? 'A' : d === 'keyboard' ? 'SPACE' : 'TAP';
  if (action === 'pause') return d === 'gamepad' ? 'START' : 'P';
  return '';
}

// One per scene. Call update() at the top of the scene's update().
export function createInput(scene) {
  const allCodes = [...new Set(Object.values(KEYS).flat())];
  const keys = scene.input.keyboard.addKeys(allCodes.join(','));
  const prev = {};
  const now = {};
  const actions = Object.keys(KEYS);

  const padDown = (action) => {
    const gp = scene.input.gamepad;
    if (!gp || !gp.total) return false;
    for (const pad of gp.getAll()) {
      for (const b of PAD[action] || []) {
        const btn = pad.buttons[b];
        if (btn && (btn.pressed || btn.value > 0.4)) { setDevice('gamepad'); return true; }
      }
      // left stick also navigates
      const s = pad.leftStick;
      if (s) {
        if (action === 'up' && s.y < -0.6) { setDevice('gamepad'); return true; }
        if ((action === 'down' || action === 'slide') && s.y > 0.6) { setDevice('gamepad'); return true; }
        if (action === 'left' && s.x < -0.6) { setDevice('gamepad'); return true; }
        if (action === 'right' && s.x > 0.6) { setDevice('gamepad'); return true; }
      }
    }
    return false;
  };

  // Pointers (v6 runner): tap = jump, hold = higher jump / rise, swipe down = slide.
  // A touch waits 70 ms (or until it lifts) before it counts as a jump, so a swipe never jumps first.
  const ptrs = new Map();
  let tapLatch = false, swipeLatch = false;
  const SWIPE_PX = 22, HOLD_MS = 70;
  scene.input.on('pointerdown', (p) => { if (!p.__ui) ptrs.set(p.id, { y0: p.y, t0: performance.now(), state: 'pending' }); });
  scene.input.on('pointermove', (p) => {
    const s = ptrs.get(p.id);
    if (s && p.isDown && s.state !== 'swipe' && p.y - s.y0 > SWIPE_PX) { s.state = 'swipe'; swipeLatch = true; }
  });
  const lift = (p) => { const s = ptrs.get(p.id); if (s && s.state === 'pending') tapLatch = true; ptrs.delete(p.id); };
  scene.input.on('pointerup', lift);
  scene.input.on('pointerupoutside', lift);
  const pointerDown = () => [...ptrs.values()].some((s) => s.state === 'jump');

  // Latch key presses as events so a tap shorter than one frame is never missed
  // (input-systems skill: capture discrete presses, poll held state).
  const codesFor = {};
  for (const a of actions) codesFor[a] = KEYS[a].map((k) => keys[k].keyCode);
  let latched = new Set();
  const onKey = (e) => { if (!e.repeat) latched.add(e.keyCode); };
  scene.input.keyboard.on('keydown', onKey);
  scene.events.once('shutdown', () => scene.input.keyboard.off('keydown', onKey));
  // a paused scene keeps receiving DOM events; drop anything latched while paused
  scene.events.on('resume', () => { latched = new Set(); });
  const edge = {};

  const api = {
    update() {
      let ptrEdge = false;
      for (const s of ptrs.values()) if (s.state === 'pending' && performance.now() - s.t0 >= HOLD_MS) { s.state = 'jump'; ptrEdge = true; }
      if (tapLatch) ptrEdge = true;
      for (const a of actions) {
        prev[a] = now[a];
        let down = KEYS[a].some((k) => keys[k] && keys[k].isDown) || padDown(a);
        if (a === 'float' && pointerDown()) down = true;
        if (a === 'slide' && [...ptrs.values()].some((s) => s.state === 'swipe')) down = true; // keep the finger down to keep sliding
        now[a] = down;
        edge[a] = (down && !prev[a]) || codesFor[a].some((c) => latched.has(c));
        if (a === 'float' && ptrEdge) edge[a] = true;
        if (a === 'slide' && swipeLatch) edge[a] = true;
      }
      latched = new Set();
      tapLatch = false; swipeLatch = false;
    },
    held: (a) => !!now[a] || codesFor[a].some((c) => latched.has(c)),
    pressed: (a) => !!edge[a],
    // mark pointers currently down as belonging to UI so a button press doesn't float
    claimPointers() { scene.input.manager.pointers.forEach((p) => { if (p.isDown) { p.__ui = true; ptrs.delete(p.id); } }); },
  };
  scene.input.on('pointerup', (p) => { p.__ui = false; });
  api.update();
  api.update();
  return api;
}
