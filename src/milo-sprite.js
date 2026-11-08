// THE NEW MILO, animation prototype V1 (approved concept, docs/milo-approved-art-brief.md).
// Raster sprite frames built by scripts/milo-frames.py from assets/reference/milo-approved-concept.png:
// assets/milo/milo-living.png and milo-ghost.png (same drawing, two palettes), 96x100 per frame,
// feet on row 97, hips on column 40. frames.json lists the frame names in sheet order.
// Reusable later: loadMilo(scene) in preload, then new MiloActor(scene, x, footY).play('touch').
// Not used by the game yet (only ?milolab=1).

export const MILO_KEYS = { living: 'milo2_living', ghost: 'milo2_ghost', meta: 'milo2_meta' };
export const MILO_FRAME = { w: 96, h: 100, foot: 97, anchorX: 40 };

// [frame, ms, dx]: dx = offset in px from the actor's spot (+ = toward what he faces). Absolute, not cumulative.
export const MILO_ANIMS = {
  idle: { loop: true, frames: [['idle0', 1400], ['idle1', 900], ['idle0', 1500], ['blink', 110], ['idle0', 1100], ['idle1', 900]] },
  // 1. eyes closed, slumped; he surfaces, almost slips back, opens his eyes, looks around, doesn't understand
  awakening: { frames: [
    ['wake0', 1000], ['wake1', 700], ['wake0', 500], ['wake1', 700], ['wake2', 450], ['wake1', 260], ['wake2', 500],
    ['wake3', 650], ['idle0', 450], ['blink', 110], ['idle0', 500], ['look_l', 650], ['look_l2', 800], ['look_l', 260],
    ['idle0', 450], ['confused', 1500]] },
  // 2. looks at his hands, they shake, then he turns to the body on the bed: confusion -> shock
  realization: { frames: [
    ['confused', 500], ['idle0', 260], ['raise', 300], ['hands0', 800], ['hands1', 160], ['hands0', 160], ['hands1', 160],
    ['hands0', 300], ['hands2', 700], ['hands0', 450], ['raise', 280], ['turn1', 800], ['blink', 90], ['turn1', 350],
    ['shock0', 600], ['shock1', 1500]] },
  // 3. hesitates, reaches, the hand goes through
  touch: { frames: [
    ['hes0', 700], ['hes1', 500], ['hes0', 450], ['hes1', 300], ['reach0', 240], ['reach1', 200], ['reach2', 260],
    ['reach3', 900], ['reach2', 160], ['reach3', 500], ['touch0', 320, 2], ['touch1', 900, 2, 'through'], ['touch2', 1300, 2]] },
  // 4. pulls back, stumbles backward, shoulders up, fear
  fear: { frames: [
    ['touch2', 250, 2], ['pull0', 110, 1], ['pull1', 110, 0], ['recoil0', 160, -3], ['recoil1', 220, -6], ['recoil0', 160, -8],
    ['fear0', 260, -11], ['fear1', 200, -13], ['fear2', 110, -13], ['fear4', 110, -13], ['fear2', 110, -13], ['fear4', 110, -13],
    ['fear3', 700, -14], ['fear2', 120, -14], ['fear4', 120, -14], ['fear3', 1600, -14]] },
};
export const MILO_SEQUENCES = ['awakening', 'realization', 'touch', 'fear'];

export function loadMilo(scene, base = 'assets/milo/') {
  const fw = { frameWidth: MILO_FRAME.w, frameHeight: MILO_FRAME.h };
  if (!scene.textures.exists(MILO_KEYS.living)) scene.load.spritesheet(MILO_KEYS.living, base + 'milo-living.png', fw);
  if (!scene.textures.exists(MILO_KEYS.ghost)) scene.load.spritesheet(MILO_KEYS.ghost, base + 'milo-ghost.png', fw);
  if (!scene.cache.json.exists(MILO_KEYS.meta)) scene.load.json(MILO_KEYS.meta, base + 'frames.json');
}

// One Milo on screen. Plays MILO_ANIMS by name with per-frame timing; living/ghost swaps the texture only.
export class MiloActor {
  constructor(scene, x, footY, { ghost = false, scale = 1 } = {}) {
    this.scene = scene; this.x = x; this.footY = footY; this.scale = scale; this.facing = 1;
    this.meta = scene.cache.json.get(MILO_KEYS.meta);
    this.index = Object.fromEntries(this.meta.frames.map((n, i) => [n, i]));
    this.ghost = ghost;
    this.sprite = scene.add.sprite(x, footY, ghost ? MILO_KEYS.ghost : MILO_KEYS.living, 0)
      .setOrigin(MILO_FRAME.anchorX / MILO_FRAME.w, (MILO_FRAME.foot + 1) / MILO_FRAME.h).setScale(scale);
    this.speed = 1;
    this.play('idle');
  }
  setGhost(on) { this.ghost = on; this.sprite.setTexture(on ? MILO_KEYS.ghost : MILO_KEYS.living, this.index[this.frame]); return this; }
  play(name, onDone) {
    this.anim = name; this.step = 0; this.t = 0; this.done = false; this.onDone = onDone || null;
    this.show();
    return this;
  }
  get cur() { return MILO_ANIMS[this.anim].frames[this.step]; }
  get frame() { return this.cur[0]; }
  get tag() { return this.cur[3] || null; } // e.g. 'through': the hand is inside the target
  show() {
    const [name, , dx = 0] = this.cur;
    this.sprite.setFrame(this.index[name]);
    this.sprite.x = Math.round(this.x + dx * this.facing * this.scale);
    this.sprite.y = this.footY;
  }
  // reach point of the current frame (from frames.json), in scene px
  hand() {
    const [hx, hy] = this.meta.hand[this.frame], dx = this.cur[2] || 0;
    return { x: this.x + (hx - MILO_FRAME.anchorX + dx) * this.scale * this.facing, y: this.footY + (hy - MILO_FRAME.foot) * this.scale };
  }
  update(dtMs) {
    if (this.done) return;
    const a = MILO_ANIMS[this.anim];
    this.t += dtMs * this.speed;
    let changed = false;
    while (this.t >= this.cur[1]) {
      this.t -= this.cur[1];
      if (this.step + 1 < a.frames.length) { this.step++; changed = true; continue; }
      if (a.loop) { this.step = 0; changed = true; continue; }
      this.done = true; this.t = 0;
      if (this.onDone) this.onDone(this.anim);
      break;
    }
    if (changed) this.show();
  }
  setVisible(v) { this.sprite.setVisible(v); return this; }
  destroy() { this.sprite.destroy(); }
}
