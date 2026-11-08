// MILO LAB (?milolab=1): THE NEW MILO, animation prototype V1. Isolated preview, not part of the game.
// Milo is shown at game size (1:1 on the 640x360 screen, 92 px body). Four acting sequences,
// living/ghost toggle, slow motion, a x2 inspect window and a comparison with the previous Milos.
// Keys: left/right/up/down + Space/Enter (or gamepad d-pad + A) move through the buttons,
// 0 idle, 1-4 sequences, 5 play all, G ghost, S slow, Z zoom, C compare, H hide UI. Touch: tap a button.
import { W, H, FONT } from '../data.js';
import { createInput } from '../input.js';
import { loadMilo, MiloActor, MILO_ANIMS, MILO_SEQUENCES, MILO_KEYS } from '../milo-sprite.js';
import * as A from '../artlab-assets.js';
import { makeOpeningArt } from '../opening-art.js';

const FLOOR = 300;
const MILO_X = 236;
const SEQ_NAMES = { idle: 'IDLE', awakening: '1 AWAKENING', realization: '2 REALIZATION', touch: '3 THE IMPOSSIBLE TOUCH', fear: '4 FEAR' };
const AURA = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export class MiloLabScene extends Phaser.Scene {
  constructor() { super('milolab'); }

  preload() { loadMilo(this); }

  create() {
    window.__milolab = this;
    this.ghost = false; this.slow = false; this.zoom = false; this.compare = false; this.uiOn = true;
    this.chain = null; this.holdT = 0; this.freeze = false; this.fx = 0;
    this.drawRoom();

    // the hand target: where his living body lies under the blanket (indicated by a soft ring)
    this.milo = new MiloActor(this, MILO_X, FLOOR);
    this.milo.sprite.setDepth(5);
    const touchStep = MILO_ANIMS.touch.frames.findIndex((f) => f[3] === 'through');
    const keep = { anim: this.milo.anim, step: this.milo.step };
    this.milo.anim = 'touch'; this.milo.step = touchStep; this.target = this.milo.hand();
    this.milo.anim = keep.anim; this.milo.step = keep.step; this.milo.show();
    this.ring = this.add.graphics().setDepth(4);
    this.aura = AURA.map(([dx, dy]) => this.add.sprite(0, 0, MILO_KEYS.ghost, 0).setOrigin(this.milo.sprite.originX, this.milo.sprite.originY)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.22).setTint(0x6fb8ff).setDepth(4.9).setVisible(false).setData('d', [dx, dy]));

    // x2 inspect window (same frame, magnified for review; the game size is the Milo on the floor)
    this.zoomBg = this.add.graphics().setDepth(20).setVisible(false);
    this.zoomBg.fillStyle(0x0b0e18, 0.92).fillRect(W - 208, 24, 200, 214).lineStyle(1, 0x3a4668, 1).strokeRect(W - 207.5, 24.5, 199, 213);
    this.zoomSpr = this.add.sprite(W - 108 - 24, 228, MILO_KEYS.living, 0).setOrigin(this.milo.sprite.originX, this.milo.sprite.originY).setScale(2).setDepth(21).setVisible(false);
    // comparison: the previous Milos at their own game size, next to the new one (living + ghost)
    makeOpeningArt(this);
    if (!this.textures.exists('milolab_old')) this.textures.addCanvas('milolab_old', A.miloFrame('neutral').buf.toCanvas());
    this.cmp = [
      this.add.image(90, FLOOR, 'op_milo_idle').setOrigin(0.5, 1).setScale(4),
      this.add.image(230, FLOOR, 'milolab_old').setOrigin(0.5, 1).setScale(2),
    ];
    this.cmpNew = [new MiloActor(this, 380, FLOOR), new MiloActor(this, 520, FLOOR, { ghost: true })];
    this.cmpNew[1].sprite.setAlpha(0.9);
    [...this.cmp, ...this.cmpNew.map((m) => m.sprite)].forEach((s) => s.setDepth(6).setVisible(false));

    // ---- UI ----
    const txt = (x, y, s, size = 8, col = '#e6f0ff', ox = 0) => this.add.text(x, y, s, { fontFamily: FONT, fontSize: size + 'px', color: col, resolution: 2 }).setOrigin(ox, 0).setDepth(30);
    this.title = txt(8, 8, 'MILO LAB V1', 8, '#ffe0a0');
    this.info = txt(8, 22, '', 8, '#9fb0d0');
    this.zoomLbl = txt(W - 108, 30, 'x2 INSPECT', 8, '#7a88a8', 0.5).setVisible(false);
    this.cmpLbls = [
      [90, 'OPENING V2', 'x4'], [230, 'ART LAB V1', 'x2'], [380, 'NEW LIVING', '1:1'], [520, 'NEW GHOST', '1:1'],
    ].map(([x, a, b]) => [txt(x, 146, a, 8, x > 300 ? '#ffe0a0' : '#c8d4ea', 0.5), txt(x, 160, b, 8, '#7a88a8', 0.5)]).flat();
    this.cmpLbls.forEach((l) => l.setVisible(false));
    const rows = [
      [['IDLE', () => this.playSeq('idle')], ['1 AWAKENING', () => this.playSeq('awakening')], ['2 REALIZATION', () => this.playSeq('realization')],
        ['3 TOUCH', () => this.playSeq('touch')], ['4 FEAR', () => this.playSeq('fear')], ['PLAY ALL', () => this.playAll()]],
      [['LIVING', () => this.setGhost(!this.ghost)], ['SLOW: OFF', () => this.setSlow(!this.slow)], ['ZOOM: OFF', () => this.setZoom(!this.zoom)],
        ['COMPARE', () => this.setCompare(!this.compare)], ['H: HIDE', () => this.toggleUI()]],
    ];
    this.btns = [];
    rows.forEach((row, r) => {
      const widths = row.map(([s]) => s.length * 8 + 12), total = widths.reduce((a, b) => a + b, 0) + (row.length - 1) * 6;
      let x = (W - total) / 2;
      row.forEach(([s, fn], i) => {
        const t = txt(x, 312 + r * 22, s, 8, '#9fb0d0').setPadding(6, 5, 6, 5).setInteractive({ useHandCursor: true });
        const b = { t, fn, r, i };
        t.on('pointerdown', () => { this.focus = this.btns.indexOf(b); fn(); this.paintBtns(); });
        this.btns.push(b); x += widths[i] + 6;
      });
    });
    this.focus = 0;
    this.ctl = createInput(this, { pointers: false });
    this.input.keyboard?.on('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k >= '0' && k <= '4') this.playSeq(['idle', ...MILO_SEQUENCES][Number(k)]);
      else if (k === '5') this.playAll();
      else if (k === 'g') this.setGhost(!this.ghost);
      else if (k === 's') this.setSlow(!this.slow);
      else if (k === 'z') this.setZoom(!this.zoom);
      else if (k === 'c') this.setCompare(!this.compare);
      else if (k === 'h') this.toggleUI();
      this.paintBtns();
    });
    const q = new URLSearchParams(location.search);
    if (q.get('ghost') === '1') this.setGhost(true);
    if (q.get('clean') === '1') this.toggleUI();
    this.paintBtns();
  }

  // ---- room: dark ward at 3:33, moonlit window, warm bedside lamp, the bed with his body ----
  drawRoom() {
    const g = this.add.graphics().setDepth(0);
    const bands = [0x0c1020, 0x0e1324, 0x101629, 0x12182d, 0x141b31, 0x151d33];
    bands.forEach((c, i) => { g.fillStyle(c, 1); g.fillRect(0, i * 50, W, 50); });
    // window + moonlight
    g.fillStyle(0x0a0d18, 1); g.fillRect(54, 70, 96, 120);
    g.fillStyle(0x1d2b4a, 1); g.fillRect(60, 76, 84, 108);
    g.fillStyle(0x2a3d63, 1); g.fillRect(64, 80, 36, 48); g.fillRect(104, 80, 36, 48);
    g.fillStyle(0x24365a, 1); g.fillRect(64, 132, 36, 48); g.fillRect(104, 132, 36, 48);
    g.fillStyle(0x0a0d18, 1); g.fillRect(100, 76, 4, 108); g.fillRect(60, 128, 84, 4);
    g.fillStyle(0x8fb4e8, 0.9); g.fillRect(118, 90, 10, 10);
    // wall rail and floor
    g.fillStyle(0x1a2238, 1); g.fillRect(0, 236, W, 6);
    g.fillStyle(0x0b0e19, 1); g.fillRect(0, FLOOR, W, H - FLOOR);
    g.fillStyle(0x1c2540, 1); g.fillRect(0, FLOOR, W, 2);
    for (let x = 0; x < W; x += 64) { g.fillStyle(0x10152a, 1); g.fillRect(x, FLOOR + 2, 1, H - FLOOR); }
    const light = this.add.graphics().setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
    // moon beam on the floor
    light.fillStyle(0x4a6aa8, 0.07); light.fillTriangle(60, 184, 150, 184, 300, FLOOR + 40); light.fillTriangle(60, 184, 300, FLOOR + 40, 150, FLOOR + 40);
    // bedside lamp (right of the bed)
    const lx = 560, ly = 226;
    if (!this.textures.exists('milolab_glow')) {
      const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
      const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
      gr.addColorStop(0, 'rgba(232,160,80,0.32)'); gr.addColorStop(0.35, 'rgba(232,160,80,0.10)'); gr.addColorStop(1, 'rgba(232,160,80,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 256, 256); this.textures.addCanvas('milolab_glow', c);
    }
    this.add.image(lx, ly, 'milolab_glow').setScale(1.1).setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
    g.fillStyle(0x1a1420, 1); g.fillRect(538, 246, 48, 54); g.fillStyle(0x261d2c, 1); g.fillRect(538, 246, 48, 4);
    g.fillStyle(0x3a2a1a, 1); g.fillRect(556, 232, 8, 14); g.fillStyle(0xf0b060, 1); g.fillTriangle(546, 232, 574, 232, 566, 214); g.fillTriangle(546, 232, 554, 214, 566, 214);
    // the bed: frame, mattress, his body under the blanket (head on the pillow to the right)
    const bx0 = 258, bx1 = 520, top = 252;
    g.fillStyle(0x1b2235, 1); g.fillRect(bx0, top + 10, bx1 - bx0, 18); g.fillRect(bx0, top + 28, 4, FLOOR - top - 28); g.fillRect(bx1 - 4, top + 28, 4, FLOOR - top - 28);
    g.fillStyle(0x2a3550, 1); g.fillRect(bx0, top, bx1 - bx0, 12);
    g.fillStyle(0x3c4a6a, 1); g.fillRect(bx0 + 2, top - 8, bx1 - bx0 - 50, 12); // blanket over the body
    g.fillStyle(0x46557a, 1); g.fillEllipse(bx0 + 120, top - 9, 150, 14);
    g.fillStyle(0x5a6788, 1); g.fillRect(bx1 - 46, top - 10, 40, 12); // pillow
    g.fillStyle(0x2a1f22, 1); g.fillEllipse(bx1 - 30, top - 14, 22, 14); // his hair on the pillow
    g.fillStyle(0x8a6a5c, 1); g.fillEllipse(bx1 - 40, top - 10, 10, 8); // face
    g.fillStyle(0x1b2235, 1); g.fillRect(bx1 - 6, top - 40, 6, 52); // headboard
    // heart monitor
    g.fillStyle(0x0e1220, 1); g.fillRect(470, 150, 44, 30); g.fillStyle(0x0f2a24, 1); g.fillRect(474, 154, 36, 22);
    this.mon = this.add.graphics().setDepth(1);
    this.bedTop = top;
  }

  setGhost(on) {
    this.ghost = on;
    this.milo.setGhost(on); this.milo.sprite.setAlpha(on ? 0.9 : 1);
    this.zoomSpr.setTexture(on ? MILO_KEYS.ghost : MILO_KEYS.living, this.milo.index[this.milo.frame]);
    this.btns[6].t.setText(on ? 'GHOST' : 'LIVING');
  }
  setSlow(on) { this.slow = on; [this.milo, ...this.cmpNew].forEach((m) => { m.speed = on ? 0.25 : 1; }); this.btns[7].t.setText(on ? 'SLOW: 1/4' : 'SLOW: OFF'); }
  setZoom(on) { this.zoom = on; this.btns[8].t.setText(on ? 'ZOOM: x2' : 'ZOOM: OFF'); this.syncViews(); }
  setCompare(on) { this.compare = on; this.syncViews(); }
  syncViews() {
    const c = this.compare;
    this.milo.setVisible(!c); this.ring.setVisible(!c);
    this.cmp.forEach((s) => s.setVisible(c)); this.cmpNew.forEach((m) => m.setVisible(c)); this.cmpLbls.forEach((l) => l.setVisible(c));
    [this.zoomBg, this.zoomSpr, this.zoomLbl].forEach((o) => o.setVisible(this.zoom && !c));
  }
  toggleUI() { this.uiOn = !this.uiOn; [this.title, this.info, ...this.btns.map((b) => b.t)].forEach((t) => t.setVisible(this.uiOn)); }
  paintBtns() {
    const playing = this.chain ? 'all' : this.milo.anim;
    const on = (b) => (b.r === 0 && (['idle', ...MILO_SEQUENCES][b.i] === playing || (b.i === 5 && this.chain))) ||
      (b.r === 1 && ((b.i === 0 && this.ghost) || (b.i === 1 && this.slow) || (b.i === 2 && this.zoom) || (b.i === 3 && this.compare)));
    this.btns.forEach((b, j) => b.t.setColor(on(b) ? '#ffe0a0' : '#8a98b8').setBackgroundColor(j === this.focus ? '#3a3050' : on(b) ? '#221c30' : '#00000000'));
  }

  playSeq(name, fromChain = false) {
    if (!fromChain) this.chain = null;
    if (this.compare) this.setCompare(false);
    this.holdT = 0;
    this.milo.play(name, () => {
      if (this.chain && this.chain.length) { this.playSeq(this.chain.shift(), true); return; }
      this.chain = null; this.holdT = 1600; // hold the last pose, then idle
    });
    this.paintBtns();
  }
  playAll() { this.chain = MILO_SEQUENCES.slice(1); this.playSeq(MILO_SEQUENCES[0], true); }
  // for screenshots and tests: show one frame of a sequence and hold it
  pose(name, step) { this.chain = null; this.milo.play(name); this.milo.step = step; this.milo.show(); this.freeze = true; }

  update(time, delta) {
    const c = this.ctl; c.update();
    const n = this.btns.length, row = this.btns[this.focus].r;
    if (c.pressed('right')) this.focus = (this.focus + 1) % n;
    if (c.pressed('left')) this.focus = (this.focus + n - 1) % n;
    if (c.pressed('down') || c.pressed('up')) {
      const target = this.btns.filter((b) => b.r !== row);
      const me = this.btns[this.focus].t;
      const best = target.reduce((a, b) => Math.abs(b.t.x - me.x) < Math.abs(a.t.x - me.x) ? b : a);
      this.focus = this.btns.indexOf(best);
    }
    if (c.pressed('confirm')) this.btns[this.focus].fn();
    if (['left', 'right', 'up', 'down', 'confirm'].some((a) => c.pressed(a))) this.paintBtns();

    const dt = Math.min(delta, 50);
    if (!this.freeze) {
      this.milo.update(dt);
      this.cmpNew.forEach((m) => m.update(dt));
      if (this.holdT > 0 && (this.holdT -= dt * (this.slow ? 0.25 : 1)) <= 0) { this.milo.play('idle'); this.paintBtns(); }
    }
    this.fx += dt / 1000;
    // ghost rim light (same frame, 1 px around, additive)
    const s = this.milo.sprite;
    this.aura.forEach((a) => {
      const [dx, dy] = a.getData('d');
      a.setVisible(this.ghost && !this.compare).setFrame(s.frame.name).setPosition(s.x + dx, s.y + dy);
    });
    this.zoomSpr.setFrame(s.frame.name);
    // the target ring on the blanket; flashes when the hand goes through
    const through = this.milo.tag === 'through' || (this.milo.anim === 'touch' && this.milo.step === MILO_ANIMS.touch.frames.length - 1);
    const showRing = this.milo.anim === 'touch' || this.milo.anim === 'fear';
    this.ring.clear();
    if (showRing) {
      const p = 0.5 + 0.5 * Math.sin(this.fx * 4), { x, y } = this.target;
      this.ring.lineStyle(1, through ? 0xbfe6ff : 0x6f8fc8, through ? 0.95 : 0.35 + 0.25 * p);
      this.ring.strokeEllipse(x, y + 1, 12 + (through ? 6 * p : 2 * p), 5 + (through ? 2 * p : 0));
      if (through) { this.ring.fillStyle(0x9fd8ff, 0.18); this.ring.fillEllipse(x, y + 1, 18, 7); }
    }
    // monitor trace
    this.mon.clear(); this.mon.lineStyle(1, 0x5fe0b0, 0.8); this.mon.beginPath();
    for (let i = 0; i <= 34; i++) { const ph = (i / 34 + this.fx * 0.6) % 1, yy = ph > 0.45 && ph < 0.5 ? -7 : ph > 0.5 && ph < 0.53 ? 4 : 0; i ? this.mon.lineTo(475 + i, 165 + yy) : this.mon.moveTo(475, 165 + yy); }
    this.mon.strokePath();

    const total = MILO_ANIMS[this.milo.anim].frames.length;
    this.info.setText(`${SEQ_NAMES[this.milo.anim]}   ${this.milo.frame}  ${this.milo.step + 1}/${total}${this.ghost ? '   GHOST' : ''}${this.slow ? '   1/4 SPEED' : ''}`);
  }
}
