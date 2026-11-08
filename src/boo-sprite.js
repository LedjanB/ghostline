// BOO (Tobias Boone): raster sprites made by scripts/boo-frames.py (assets/boo/). Same frame size and anchors as the
// Milo sheets (96x100, feet on row 97, hips on column 40), drawn facing right. Two sheets with the same frames:
// boo-cold.png (moonlight, lantern dark) and boo-lit.png (lit by his own lantern); the actor crossfades them with
// `lit` (0..1) so the lantern lights his face and coat as it catches. frames.json: `lantern` = the flame per frame.
export const BOO_KEYS = { cold: 'boo2_cold', lit: 'boo2_lit', meta: 'boo2_meta' };
export const BOO_FRAME = { w: 96, h: 100, foot: 97, anchorX: 40 };

export const BOO_ANIMS = {
  dark: { loop: true, frames: [['dark0', 900], ['dark1', 900]] },
  ignite: { frames: [['ignite0', 420], ['ignite1', 300]], next: 'idle' },
  guard: { loop: true, frames: [['guard0', 520], ['guard1', 380]] },
  push: { frames: [['guard1', 500]], next: 'guard' },
  idle: { loop: true, frames: [['idle0', 1200], ['idle1', 900], ['idle0', 800], ['blink', 110], ['idle0', 900], ['idle1', 900]] },
  talk: { loop: true, frames: [['talk0', 140], ['idle0', 120], ['talk0', 180], ['idle1', 110]] },
  point: { loop: true, frames: [['point', 1000]] },
  walk: { loop: true, frames: [['walk0', 110], ['walk1', 110], ['walk2', 110], ['walk3', 110], ['walk4', 110], ['walk5', 110]] },
};

export function loadBoo(scene, base = 'assets/boo/') {
  const fw = { frameWidth: BOO_FRAME.w, frameHeight: BOO_FRAME.h };
  if (!scene.textures.exists(BOO_KEYS.cold)) scene.load.spritesheet(BOO_KEYS.cold, base + 'boo-cold.png', fw);
  if (!scene.textures.exists(BOO_KEYS.lit)) scene.load.spritesheet(BOO_KEYS.lit, base + 'boo-lit.png', fw);
  if (!scene.cache.json.exists(BOO_KEYS.meta)) scene.load.json(BOO_KEYS.meta, base + 'frames.json');
}

export class BooActor {
  constructor(scene, x, footY, add = (o) => o) {
    this.scene = scene; this.x = x; this.footY = footY; this.facing = 1; this.lit = 0; this.alpha = 1;
    this.meta = scene.cache.json.get(BOO_KEYS.meta);
    this.index = Object.fromEntries(this.meta.frames.map((n, i) => [n, i]));
    const oy = (BOO_FRAME.foot + 1) / BOO_FRAME.h;
    this.cold = add(scene.add.sprite(x, footY, BOO_KEYS.cold, 0).setOrigin(BOO_FRAME.anchorX / BOO_FRAME.w, oy));
    this.warm = add(scene.add.sprite(x, footY, BOO_KEYS.lit, 0).setOrigin(BOO_FRAME.anchorX / BOO_FRAME.w, oy));
    this.play('dark');
  }
  setDepth(d) { this.cold.setDepth(d); this.warm.setDepth(d + 0.01); return this; }
  setFacing(f) {
    this.facing = f < 0 ? -1 : 1;
    const ox = (this.facing < 0 ? BOO_FRAME.w - BOO_FRAME.anchorX : BOO_FRAME.anchorX) / BOO_FRAME.w;
    for (const s of [this.cold, this.warm]) s.setFlipX(this.facing < 0).setOrigin(ox, s.originY);
    return this;
  }
  want(name) { if (this.anim !== name) this.play(name); return this; }
  play(name, onDone) { this.anim = name; this.step = 0; this.t = 0; this.onDone = onDone || null; this.show(); return this; }
  get frame() { return BOO_ANIMS[this.anim].frames[this.step][0]; }
  // the flame of the lantern in scene px (mirrors with facing)
  flame() {
    const [lx, ly] = this.meta.lantern[this.frame];
    return { x: this.x + (lx - BOO_FRAME.anchorX) * this.facing, y: this.footY + (ly - BOO_FRAME.foot) };
  }
  update(dtMs) {
    const a = BOO_ANIMS[this.anim];
    this.t += dtMs;
    while (this.t >= a.frames[this.step][1]) {
      this.t -= a.frames[this.step][1];
      if (this.step + 1 < a.frames.length) this.step++;
      else if (a.loop) this.step = 0;
      else { const cb = this.onDone; if (a.next) this.play(a.next); if (cb) cb(); break; }
    }
    this.show();
  }
  show() {
    const f = this.index[this.frame];
    const x = Math.round(this.x), y = Math.round(this.footY);
    this.cold.setFrame(f).setPosition(x, y).setAlpha(this.alpha);
    this.warm.setFrame(f).setPosition(x, y).setAlpha(this.alpha * Math.min(1, this.lit));
  }
  setVisible(v) { this.cold.setVisible(v); this.warm.setVisible(v); return this; }
}
