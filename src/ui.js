// Small UI helpers: pixel text and buttons.
import { FONT } from './data.js';
import { Audio } from './audio.js';

export function text(scene, x, y, str, size = 16, color = '#e6f0ff', origin = 0.5) {
  const t = scene.add.text(x, y, str, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    align: 'center',
  });
  t.setOrigin(origin, 0.5);
  return t;
}

export function button(scene, x, y, label, onClick, opts = {}) {
  const w = opts.w ?? 160;
  const h = opts.h ?? 40;
  const fill = opts.fill ?? 0x2a1f4a;
  const edge = opts.edge ?? 0x8f7fbf;
  const size = opts.size ?? 16;
  const bg = scene.add.rectangle(x, y, w, h, fill).setStrokeStyle(2, edge);
  const lbl = text(scene, x, y + 1, label, size, opts.color ?? '#e6f0ff');
  bg.setInteractive({ useHandCursor: true });
  const lighter = (c) => {
    const r = Math.min(255, ((c >> 16) & 255) + 28);
    const g = Math.min(255, ((c >> 8) & 255) + 28);
    const b = Math.min(255, (c & 255) + 28);
    return (r << 16) | (g << 8) | b;
  };
  bg.on('pointerover', () => bg.setFillStyle(lighter(fill)));
  bg.on('pointerout', () => bg.setFillStyle(fill));
  bg.on('pointerdown', (p, lx, ly, ev) => {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    if (!opts.silent) Audio.sfx('click');
    scene.tweens.add({ targets: [bg, lbl], scaleX: 0.92, scaleY: 0.92, duration: 60, yoyo: true });
    onClick();
  });
  const api = {
    bg, lbl,
    setLabel(s) { lbl.setText(s); return api; },
    setVisible(v) { bg.setVisible(v); lbl.setVisible(v); if (v) bg.setInteractive(); else bg.disableInteractive(); return api; },
    setDepth(d) { bg.setDepth(d); lbl.setDepth(d + 1); return api; },
    setColors(f, e) { bg.setFillStyle(f); bg.setStrokeStyle(2, e); return api; },
    destroy() { bg.destroy(); lbl.destroy(); },
  };
  return api;
}
