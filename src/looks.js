// Character world looks (Crossy Road: some characters change how the whole world looks).
// A look = a color grade on every background layer + one signature effect.
// Effects sit behind hazards (depth < 4.5 except the night-vision scanlines, which are faint)
// so the world changes but dangers always read the same.
import { W, H, CEIL, FLOOR } from './data.js';
import { LOOKS } from './unlocks.js';

export const mulColor = (a, b) => {
  const r = (((a >> 16) & 255) * ((b >> 16) & 255)) / 255;
  const g = (((a >> 8) & 255) * ((b >> 8) & 255)) / 255;
  const bl = ((a & 255) * (b & 255)) / 255;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
};

export class WorldLook {
  constructor(scene, charId, depthOffset = 0) {
    this.scene = scene;
    this.look = LOOKS[charId] || LOOKS.survivor;
    this.tint = this.look.tint;
    this.objs = [];
    this.parts = [];
    this.t = 0;
    const d = depthOffset;
    const add = (o) => { this.objs.push(o); return o; };
    const r = Math.random;
    // a color wash over the backgrounds (below the darkness and every hazard)
    if (this.look.wash) {
      add(scene.add.rectangle(0, 0, W, H, this.look.wash[0]).setOrigin(0).setDepth(4.4 + d)
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(this.look.wash[1]));
    }
    switch (this.look.fx) {
      case 'moon':
      case 'bats': {
        const red = this.look.fx === 'bats';
        add(scene.add.image(W - 150, 78, 'glow').setScale(4).setDepth(0.1 + d).setTint(red ? 0xff4050 : 0xcfe0ff)
          .setBlendMode(Phaser.BlendModes.ADD).setAlpha(red ? 0.45 : 0.5));
        this.moon = add(scene.add.image(W - 150, 78, 'fx_moon').setScale(2).setDepth(0.11 + d).setTint(red ? 0xff8088 : 0xeef4ff));
        if (red) {
          for (let i = 0; i < 9; i++) {
            const s = add(scene.add.sprite(r() * W, 60 + r() * 150, 'bat0').setScale(1 + r()).setDepth(2 + d));
            s.play({ key: 'bat_flap', startFrame: i % 2 });
            this.parts.push({ o: s, vx: -40 - r() * 50, vy: 0, ph: r() * 6, kind: 'bat' });
          }
        } else {
          for (let i = 0; i < 14; i++) {
            const o = add(scene.add.rectangle(r() * W, CEIL + r() * (FLOOR - CEIL), 2, 2, 0xdfe8ff).setDepth(2 + d).setAlpha(0.6));
            this.parts.push({ o, vx: -12 - r() * 10, vy: 10 + r() * 8, ph: r() * 6, kind: 'drift' });
          }
        }
        break;
      }
      case 'crosses':
        for (let i = 0; i < 14; i++) {
          const o = add(scene.add.image(r() * W, CEIL + r() * (FLOOR - CEIL), 'fx_cross').setScale(1 + Math.floor(r() * 2)).setDepth(2 + d).setAlpha(0.45));
          this.parts.push({ o, vx: -8, vy: -10 - r() * 10, ph: r() * 6, kind: 'drift' });
        }
        break;
      case 'scan':
        this.scan = add(scene.add.tileSprite(0, 0, W, H, 'fx_scan').setOrigin(0).setDepth(4.6 + d).setAlpha(0.22));
        add(scene.add.image(W / 2, H / 2, 'dark').setScale(2.4).setDepth(4.55 + d).setTint(0x103018).setAlpha(0.35));
        break;
      case 'bubbles':
        for (let i = 0; i < 16; i++) {
          const o = add(scene.add.image(r() * W, CEIL + r() * (FLOOR - CEIL), 'glow').setScale(0.12 + r() * 0.12).setDepth(2 + d)
            .setTint(i % 2 ? 0xff9fd0 : 0xffd0f0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.8));
          this.parts.push({ o, vx: -10, vy: -14 - r() * 16, ph: r() * 6, kind: 'bubble' });
        }
        break;
      case 'sand':
        for (let i = 0; i < 26; i++) {
          const o = add(scene.add.rectangle(r() * W, CEIL + r() * (FLOOR - CEIL), 3, 1, i % 3 ? 0xe8c890 : 0xc8a060).setDepth(2 + d).setAlpha(0.7));
          this.parts.push({ o, vx: -160 - r() * 140, vy: 6 + r() * 6, ph: r() * 6, kind: 'drift' });
        }
        break;
      case 'ash':
        for (let i = 0; i < 22; i++) {
          const o = add(scene.add.rectangle(r() * W, CEIL + r() * (FLOOR - CEIL), 2, 2, 0xf4ecdc).setDepth(2 + d).setAlpha(0.7));
          this.parts.push({ o, vx: -6, vy: 16 + r() * 14, ph: r() * 6, kind: 'drift' });
        }
        break;
      default: break;
    }
  }

  // speed: how fast the world scrolls (px/s), so particles feel like they live in it
  step(dt, speed = 0) {
    this.t += dt;
    if (this.scan) this.scan.tilePositionY -= 20 * dt;
    if (this.moon) this.moon.setAngle(Math.sin(this.t * 0.2) * 2);
    for (const p of this.parts) {
      p.ph += dt;
      const o = p.o;
      o.x += (p.vx - speed * 0.2) * dt + (p.kind === 'drift' ? Math.sin(p.ph * 1.3) * 8 * dt : 0);
      o.y += p.vy * dt + (p.kind === 'bat' ? Math.sin(p.ph * 3) * 30 * dt : 0) + (p.kind === 'bubble' ? Math.sin(p.ph * 2) * 6 * dt : 0);
      if (o.x < -20) { o.x = W + 20; o.y = p.kind === 'bat' ? 60 + Math.random() * 150 : o.y; }
      if (o.y > FLOOR) o.y = CEIL + 2;
      if (o.y < CEIL) o.y = FLOOR - 2;
    }
  }

  destroy() { this.objs.forEach((o) => o.destroy()); this.objs = []; this.parts = []; }
}
