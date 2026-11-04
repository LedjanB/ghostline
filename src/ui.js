// UI helpers (game-ui-ux skill): pixel text, buttons with a visible focus state,
// and focus groups so every screen works with mouse, touch, keyboard and gamepad.
import { FONT } from './data.js';
import { Audio } from './audio.js';

export const FOCUS = 0xffd75e;

export function text(scene, x, y, str, size = 16, color = '#e6f0ff', origin = 0.5) {
  const t = scene.add.text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color, align: 'center' });
  t.setOrigin(origin, 0.5);
  return t;
}

const lighter = (c) => {
  const r = Math.min(255, ((c >> 16) & 255) + 28);
  const g = Math.min(255, ((c >> 8) & 255) + 28);
  const b = Math.min(255, (c & 255) + 28);
  return (r << 16) | (g << 8) | b;
};

export function button(scene, x, y, label, onClick, opts = {}) {
  const w = opts.w ?? 160;
  const h = opts.h ?? 40;
  let fill = opts.fill ?? 0x2a1f4a;
  let edge = opts.edge ?? 0x8f7fbf;
  const size = opts.size ?? 16;
  const bg = scene.add.rectangle(x, y, w, h, fill).setStrokeStyle(2, edge);
  const lbl = text(scene, x, y + 1, label, size, opts.color ?? '#e6f0ff');
  const ring = scene.add.rectangle(x, y, w + 10, h + 10).setStrokeStyle(3, FOCUS).setVisible(false);
  let focused = false;
  let enabled = true;
  bg.setInteractive({ useHandCursor: true });
  const api = {
    bg, lbl, ring, onClick, onLeft: opts.onLeft, onRight: opts.onRight,
    press() {
      if (!enabled) return;
      if (!opts.silent) Audio.sfx('click');
      scene.tweens.add({ targets: [bg, lbl], scaleX: 0.92, scaleY: 0.92, duration: 60, yoyo: true });
      api.onClick();
    },
    focus(on) {
      focused = on;
      ring.setVisible(on);
      bg.setFillStyle(on ? lighter(fill) : fill);
      return api;
    },
    setLabel(s) { lbl.setText(s); return api; },
    setVisible(v) { bg.setVisible(v); lbl.setVisible(v); if (!v) ring.setVisible(false); else ring.setVisible(focused); enabled = v; return api; },
    setDepth(d) { bg.setDepth(d); lbl.setDepth(d + 1); ring.setDepth(d + 1); return api; },
    setColors(f, e) { fill = f; edge = e; bg.setFillStyle(focused ? lighter(f) : f); bg.setStrokeStyle(2, e); return api; },
    destroy() { bg.destroy(); lbl.destroy(); ring.destroy(); },
  };
  bg.on('pointerdown', (p) => { p.__ui = true; api.press(); });
  bg.on('pointerover', () => { if (api.group) api.group.set(api.group.items.indexOf(api)); else api.focus(true); });
  bg.on('pointerout', () => { if (!api.group) api.focus(false); });
  return api;
}

// Vertical (or horizontal) list of buttons with one focused at a time.
export function focusGroup(scene, items, { horizontal = false, start = 0 } = {}) {
  const g = {
    items,
    index: start,
    set(i, silent = true) {
      if (i < 0 || i >= items.length) return;
      if (i !== g.index && !silent) Audio.sfx('move');
      g.index = i;
      items.forEach((b, j) => b.focus(j === i));
    },
    // drive from an input map (see input.js)
    handle(input) {
      const prev = horizontal ? 'left' : 'up';
      const next = horizontal ? 'right' : 'down';
      if (input.pressed(prev)) g.set((g.index - 1 + items.length) % items.length, false);
      if (input.pressed(next)) g.set((g.index + 1) % items.length, false);
      const cur = items[g.index];
      if (!horizontal) {
        if (input.pressed('left') && cur.onLeft) cur.onLeft();
        if (input.pressed('right') && cur.onRight) cur.onRight();
      }
      if (input.pressed('confirm')) cur.press();
    },
  };
  items.forEach((b) => { b.group = g; });
  g.set(start);
  return g;
}
