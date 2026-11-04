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
};
// Standard gamepad mapping: 0 A, 1 B, 7 RT, 9 Start, 12-15 d-pad up/down/left/right
const PAD = {
  float: [0, 7, 6, 5],
  pause: [9],
  confirm: [0],
  back: [1],
  up: [12],
  down: [13],
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
        if (action === 'down' && s.y > 0.6) { setDevice('gamepad'); return true; }
        if (action === 'left' && s.x < -0.6) { setDevice('gamepad'); return true; }
        if (action === 'right' && s.x > 0.6) { setDevice('gamepad'); return true; }
      }
    }
    return false;
  };

  const pointerDown = () => scene.input.manager.pointers.some((p) => p.isDown && !p.__ui);

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
      for (const a of actions) {
        prev[a] = now[a];
        let down = KEYS[a].some((k) => keys[k] && keys[k].isDown) || padDown(a);
        if (a === 'float' && pointerDown()) down = true;
        now[a] = down;
        edge[a] = (down && !prev[a]) || codesFor[a].some((c) => latched.has(c));
      }
      latched = new Set();
    },
    held: (a) => !!now[a] || codesFor[a].some((c) => latched.has(c)),
    pressed: (a) => !!edge[a],
    // mark pointers currently down as belonging to UI so a button press doesn't float
    claimPointers() { scene.input.manager.pointers.forEach((p) => { if (p.isDown) p.__ui = true; }); },
  };
  scene.input.on('pointerup', (p) => { p.__ui = false; });
  api.update();
  api.update();
  return api;
}
