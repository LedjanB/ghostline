// ART LAB: Visual Art Benchmark V1 (?artlab=1). An isolated preview, not part of the game.
// Everything is drawn on a 320x180 art canvas (1 art px = 2 screen px) and shown at 640x360,
// so pixels stay crisp and there is no camera zoom. Views:
// 1 THE AWAKENING, 2 CHARACTER ACTING, 3 THE GHOSTLINE, 4 THREAT AND RESCUE, 5 CURRENT V2 vs NEW.
// Keys: 1-5 or left/right = view, space = next pose, H = hide the lab buttons. Touch: tap a tab, swipe left/right.
import { W, H, FONT } from '../data.js';
import * as A from '../artlab-assets.js';
import { makeOpeningArt } from '../opening-art.js';

const G = 2;
const VIEWS = ['1 AWAKENING', '2 ACTING', '3 GHOSTLINE', '4 THREAT', '5 V2 vs NEW'];
const NOTES = [
  'BED 7, 3:33. The living boy sleeps; his spirit stands up beside him.',
  'Six poses, real size. Top: living. Bottom: the spirit (same pixels, spirit light).',
  'The Ghostline: wrist to wrist, then into the floor seam. Poses change, it stays on.',
  'Its shadow climbs the wall. Boo\'s lantern is where it stops.',
  'Same height on screen: current opening Milo (28 px, x3) vs new (46 px, x2).',
];
const V3_POSES = ['reach', 'neutral', 'shocked', 'recoil', 'frightened', 'confused'];

// a dithered radial glow (alpha in 4 steps, Bayer dithered), drawn with 'lighter'
function glow(r, col, a = 1) {
  const c = document.createElement('canvas'); c.width = c.height = r * 2; const x = c.getContext('2d');
  const [R, Gc, B] = A.rgb(col);
  for (let j = 0; j < r * 2; j++) for (let i = 0; i < r * 2; i++) {
    const d = Math.hypot(i + 0.5 - r, j + 0.5 - r) / r; if (d >= 1) continue;
    const v = (1 - d) ** 2 * 4, lo = Math.floor(v), k = (v - lo > A.bayer(i, j) ? lo + 1 : lo) / 4;
    if (k <= 0) continue;
    x.fillStyle = `rgba(${R},${Gc},${B},${(k * a).toFixed(3)})`; x.fillRect(i, j, 1, 1);
  }
  return c;
}
// a soft spirit halo around a sprite: its silhouette grown by 2 px
function aura(buf, col) {
  const c = document.createElement('canvas'); c.width = buf.w + 4; c.height = buf.h + 4; const x = c.getContext('2d');
  x.fillStyle = col;
  for (let y = -2; y < buf.h + 2; y++) for (let i = -2; i < buf.w + 2; i++) {
    if (buf.get(i, y)) continue;
    let near = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 2 && buf.get(i + dx, y + dy)) near++;
    if (near && (near > 2 || A.bayer(i, y) < 0.5)) x.fillRect(i + 2, y + 2, 1, 1);
  }
  return c;
}
function stamp(dst, src, ox, oy) { for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = src.get(x, y); if (c) dst.set(ox + x, oy + y, c); } }
function copyBuf(b) { const n = new A.Buf(b.w, b.h); n.d = b.d.slice(); return n; }

export class ArtLabScene extends Phaser.Scene {
  constructor() { super('artlab'); }

  create() {
    window.__artlab = this;
    this.t = 0; this.view = 0; this.uiOn = true; this.poseT = 0; this.poseIx = 0; this.pulseT = 0;
    // ---- characters ----
    this.F = {};
    for (const k of Object.keys(A.POSES)) {
      const f = A.miloFrame(k), g = A.spiritOf(f.buf);
      this.F[k] = { live: f.buf.toCanvas(), ghost: g.toCanvas(), aura: aura(g, '#4a7ad0'), wrist: f.wrist, buf: f.buf, gbuf: g };
    }
    this.sl = A.sleeperFrame();
    const booB = [0, 1, 2, 3].map((i) => A.booFrame(i / 4));
    this.boo = booB.map((b) => b.toCanvas());
    this.booAura = aura(booB[0], '#6aa08a');
    this.booBuf = booB[0];
    // ---- rooms, lit once per view ----
    const on = A.drawRoom({ lampOn: true }), off = A.drawRoom({ lampOn: false });
    stamp(on, this.sl.buf, A.SLEEPER_AT[0], A.SLEEPER_AT[1]);
    stamp(off, this.sl.buf, A.SLEEPER_AT[0], A.SLEEPER_AT[1]);
    this.roomBuf = on;
    const lamp = { x: A.LAMP_AT[0], y: A.LAMP_AT[1], r: 150, col: [1.0, 0.62, 0.3], k: 1.35, sy: 0.85 };
    const lampTop = { x: A.LAMP_AT[0], y: 100, r: 46, col: [1.0, 0.7, 0.4], k: 0.5, sx: 0.7 };
    const mon = { x: 116, y: 75, r: 40, col: [0.25, 0.8, 0.6], k: 0.45 };
    const under = { x: 278, y: 117, r: 44, col: [0.4, 0.55, 0.95], k: 0.55, sy: 0.35 };
    const ghostAt = (x, y, k = 0.7) => ({ x, y, r: 64, col: [0.42, 0.62, 1.0], k });
    this.pos = {
      1: { x: 186, y: 160, flip: true }, // ghost feet (art px), facing left toward the bed
      3: { x: 168, y: 155, flip: true },
      4: { x: 24, y: 168, flip: true },
      boo: [42, 98],
    };
    this.bg = {};
    this.bg[1] = A.light(on, [lamp, lampTop, mon, under, ghostAt(186, 132)]);
    this.bg[2] = A.light(on, [{ ...lamp, k: 0.7 }, mon, under], [0.09, 0.1, 0.17]);
    this.bg[3] = A.light(on, [{ ...lamp, k: 1.0 }, lampTop, mon, ghostAt(160, 128, 1.0)], [0.08, 0.09, 0.16]);
    const lantern = { x: this.pos.boo[0] + A.BOO_LANTERN[0], y: this.pos.boo[1] + A.BOO_LANTERN[1], r: 84, col: [1.0, 0.68, 0.33], k: 1.7 };
    const beam = { x: A.BEAM_FROM[0], y: A.BEAM_FROM[1], r: 430, col: [0.6, 0.74, 1.0], k: 1.05, lin: true, block: true };
    const monRed = { x: 116, y: 75, r: 36, col: [0.9, 0.2, 0.15], k: 0.35 };
    const lanternWide = { ...lantern, r: 92, k: 0.45, lin: true };
    this.bg4lit = A.light(off, [beam, lantern, lanternWide, monRed, ghostAt(24, 142, 0.4)], [0.06, 0.07, 0.13]);
    this.bg4dark = A.light(off, [lantern, lanternWide, monRed, ghostAt(24, 142, 0.4)], [0.06, 0.07, 0.13]);
    this.bg4darkData = this.bg4dark.getContext('2d').getImageData(0, 0, A.AW, A.AH);
    this.shadowCv = document.createElement('canvas'); this.shadowCv.width = A.AW; this.shadowCv.height = A.AH;
    this.shadowT = -1;
    this.glows = { lamp: glow(34, '#ffb24a', 0.22), mon: glow(14, '#4cffb0', 0.25), monRed: glow(14, '#ff4a30', 0.25), lantern: glow(40, '#ffc060', 0.35), seam: glow(8, '#9fd0ff', 0.8), pulse: glow(4, '#dff0ff', 0.9) };
    // dust in the lamp light
    this.dust = Array.from({ length: 12 }, (_, i) => ({ x: 60 + ((i * 37) % 50), y: 92 + ((i * 53) % 40), s: 0.4 + (i % 4) * 0.15, p: i }));

    // ---- the screen: one 320x180 canvas at 2x ----
    if (this.textures.exists('artlab_screen')) this.textures.remove('artlab_screen');
    this.scr = this.textures.createCanvas('artlab_screen', A.AW, A.AH);
    this.ctx = this.scr.context; this.ctx.imageSmoothingEnabled = false;
    this.add.image(0, 0, 'artlab_screen').setOrigin(0).setScale(G).setDepth(0);

    // ---- current opening art for the comparison (same textures the opening uses; read only) ----
    makeOpeningArt(this);
    this.old = ['op_milo_idle', 'op_milo_reach2', 'op_milo_recoil'].map((k, i) => this.add.image(46 + i * 92, 266, k).setOrigin(0.5, 1).setScale(3).setDepth(2).setVisible(false));

    // ---- lab UI (not a game HUD) ----
    const txt = (x, y, s, size = 8, col = '#e6f0ff', ox = 0) => this.add.text(x, y, s, { fontFamily: FONT, fontSize: size + 'px', color: col, resolution: 2 }).setOrigin(ox, 0).setDepth(10);
    this.tabs = VIEWS.map((s, i) => {
      const t = txt(8 + i * 126, 6, s, 8, '#9fb0d0');
      t.setPadding(4, 8, 4, 8).setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.tapped = true; this.setView(i); });
      return t;
    });
    this.note = txt(W / 2, H - 14, '', 8, '#c8d4ea', 0.5);
    this.hideBtn = txt(W - 8, H - 26, 'H: HIDE', 8, '#6a7898', 1).setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.tapped = true; this.toggleUI(); });
    this.labels = A.POSE_ORDER.map((k, i) => txt((8 + i * 51 + 20) * G, 0, A.POSE_NAMES[k], 8, '#c8d4ea', 0.5).setVisible(false));
    this.cmpLabels = [
      txt(160, 52, 'CURRENT V2', 8, '#c8d4ea', 0.5), txt(160, 66, '28 px tall, shown x3', 8, '#7a88a8', 0.5),
      txt(480, 52, 'NEW BENCHMARK', 8, '#ffe0a0', 0.5), txt(480, 66, '46 px tall, shown x2', 8, '#7a88a8', 0.5),
      txt(W / 2, 290, 'In the opening today the V2 boy is drawn x4 (120 px).', 8, '#7a88a8', 0.5),
    ];
    this.cmpLabels.forEach((l) => l.setVisible(false));
    // keys and swipes
    const kb = this.input.keyboard;
    if (kb) {
      kb.on('keydown', (e) => {
        const n = Number(e.key);
        if (n >= 1 && n <= 5) this.setView(n - 1);
        else if (e.key === 'ArrowRight') this.setView((this.view + 1) % 5);
        else if (e.key === 'ArrowLeft') this.setView((this.view + 4) % 5);
        else if (e.key === 'h' || e.key === 'H') this.toggleUI();
        else if (e.key === ' ') this.nextPose();
      });
    }
    this.input.on('pointerdown', (p) => { this.down = { x: p.x, y: p.y }; this.tapped = false; });
    this.input.on('pointerup', (p) => {
      if (!this.down || this.tapped) return;
      const dx = p.x - this.down.x;
      if (Math.abs(dx) > 40) this.setView((this.view + (dx < 0 ? 1 : 4)) % 5);
      else this.nextPose();
      this.down = null;
    });
    const q = new URLSearchParams(location.search);
    this.setView(Math.max(0, Math.min(4, (Number(q.get('view')) || 1) - 1)));
    if (q.get('clean') === '1') this.toggleUI();
  }

  setView(i) {
    this.view = i; this.poseT = 0; this.poseIx = 0; this.pulseT = 0;
    this.tabs.forEach((t, j) => t.setColor(j === i ? '#ffe0a0' : '#7a88a8').setBackgroundColor(j === i ? '#2a2438' : '#00000000'));
    this.note.setText(NOTES[i]);
    this.labels.forEach((l) => l.setVisible(i === 1));
    this.labels.forEach((l) => l.setY(92 * G));
    this.cmpLabels.forEach((l) => l.setVisible(i === 4));
    this.old.forEach((o) => o.setVisible(i === 4));
  }
  toggleUI() { this.uiOn = !this.uiOn; [...this.tabs, this.note, this.hideBtn].forEach((t) => t.setVisible(this.uiOn)); }
  nextPose() { this.poseIx++; this.poseT = 0; }

  // the pose shown in views 2 and 3
  poseNow() {
    if (this.view === 2) return V3_POSES[this.poseIx % V3_POSES.length];
    if (this.view === 0) return 'confused';
    if (this.view === 3) return 'frightened';
    return A.POSE_ORDER[this.poseIx % 6];
  }
  // wrist of the spirit in room art px (follows pose, facing and breathing)
  ghostWrist(pose = this.poseNow(), breath = this.breath) {
    const p = this.pos[this.view === 2 ? 3 : 1];
    const f = this.F[pose + (breath ? '_b' : '')];
    const ox = p.x - A.FW / 2, oy = p.y - A.FH;
    return [ox + (p.flip ? A.FW - f.wrist[0] : f.wrist[0]), oy + f.wrist[1]];
  }
  livingWrist() { return [A.SLEEPER_AT[0] + this.sl.wrist[0], A.SLEEPER_AT[1] + this.sl.wrist[1]]; }
  seamPoint() { const lw = this.livingWrist(); return [Math.round(lw[0] + 7), A.SEAM_Y]; }

  update(time, delta) {
    const dt = Math.min(0.05, delta / 1000);
    if (!this.freeze) this.t += dt;
    this.poseT += dt;
    this.breath = Math.floor(this.t / 1.1) % 2 === 1;
    if (this.view === 1 && this.poseT > 1.6) this.nextPose();
    if (this.view === 2 && this.poseT > (V3_POSES[this.poseIx % V3_POSES.length] === 'reach' ? 3.2 : 2.2)) this.nextPose();
    this.draw();
  }

  drawMilo(ctx, pose, x, y, { flip = false, ghost = true, alpha = 0.92 } = {}) {
    const f = this.F[pose];
    const ox = Math.round(x - A.FW / 2), oy = Math.round(y - A.FH);
    ctx.save();
    if (flip) { ctx.translate(ox + A.FW, 0); ctx.scale(-1, 1); ctx.translate(-ox, 0); }
    if (ghost) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35;
      ctx.drawImage(f.aura, ox - 2, oy - 2);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = alpha;
      ctx.drawImage(f.ghost, ox, oy);
    } else ctx.drawImage(f.live, ox, oy);
    ctx.restore();
  }

  draw() {
    const ctx = this.ctx, v = this.view, t = this.t;
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, A.AW, A.AH);
    if (v === 0 || v === 2) {
      ctx.drawImage(this.bg[v + 1], 0, 0);
      this.drawMonitor(ctx, false);
      this.drawLampGlow(ctx, v === 2 ? 0.8 : 1);
      this.drawDust(ctx);
      const p = this.pos[v === 2 ? 3 : 1];
      const pose = this.poseNow() + (this.breath ? '_b' : '');
      this.drawMilo(ctx, pose, p.x, p.y, { flip: p.flip });
      this.drawGhostline(ctx, v === 2 ? 1 : 0.75);
    } else if (v === 1) {
      ctx.drawImage(this.bg[2], 0, 0);
      ctx.fillStyle = 'rgba(4,5,10,0.55)'; ctx.fillRect(0, 0, A.AW, A.AH);
      const cur = this.poseIx % 6;
      A.POSE_ORDER.forEach((k, i) => {
        const cx = 8 + i * 51 + 20;
        if (i === cur) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.drawImage(this.glows.lamp, cx - 34, 70 - 34); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
        const b = i === cur && this.breath ? '_b' : '';
        this.drawMilo(ctx, k + b, cx, 88, { ghost: false });
        this.drawMilo(ctx, k + b, cx, 172, { ghost: true });
      });
      ctx.fillStyle = 'rgba(255,224,160,0.8)';
      ctx.fillRect(8 + cur * 51 + 4, 89, 32, 1);
    } else if (v === 3) {
      this.drawThreat(ctx);
    } else {
      ctx.drawImage(this.bg[2], 0, 0);
      ctx.fillStyle = 'rgba(4,5,10,0.7)'; ctx.fillRect(0, 0, A.AW, A.AH);
      ctx.fillStyle = '#3a3f52'; ctx.fillRect(10, 134, 300, 1);
      ['neutral', 'reach', 'recoil'].forEach((k, i) => this.drawMilo(ctx, k, 182 + i * 46, 133, { ghost: true }));
      ctx.fillStyle = '#2a2e3e'; ctx.fillRect(160, 20, 1, 120);
    }
    this.scr.refresh();
  }

  drawLampGlow(ctx, k) {
    const fl = 0.9 + Math.sin(this.t * 13) * 0.03 + Math.sin(this.t * 3.1) * 0.04;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fl * k;
    ctx.drawImage(this.glows.lamp, A.LAMP_AT[0] - 34, A.LAMP_AT[1] - 34);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  drawDust(ctx) {
    for (const d of this.dust) {
      const x = Math.round(d.x + Math.sin(this.t * 0.4 + d.p) * 6), y = Math.round(d.y - ((this.t * d.s * 3 + d.p * 7) % 40));
      ctx.fillStyle = `rgba(255,220,160,${(0.25 + 0.2 * Math.sin(this.t + d.p)).toFixed(2)})`; ctx.fillRect(x, y, 1, 1);
    }
  }
  // heart monitor: sweeping ECG, numbers, a soft glow on each beat (red and slow on battery in view 4)
  drawMonitor(ctx, battery) {
    const M = A.MONITOR, per = battery ? 1.05 : 0.86, t = this.t;
    const ecg = (ph) => (ph < 0.04 ? -1 : ph < 0.08 ? 5 : ph < 0.12 ? -2 : ph > 0.3 && ph < 0.42 ? 1 : 0);
    const cols = M.w - 2, cur = Math.floor((t / 0.045) % cols);
    const tr = battery ? [255, 90, 60] : [90, 255, 160];
    for (let c = 0; c < cols; c++) {
      const back = (cur - c + cols) % cols;
      if (back > cols - 3) continue;
      const tau = t - back * 0.045, ph = ((tau % per) + per) % per / per;
      const y = M.y + 5 - Math.max(-1, ecg(ph));
      ctx.fillStyle = `rgba(${tr[0]},${tr[1]},${tr[2]},${(1 - back / cols * 0.7).toFixed(2)})`;
      ctx.fillRect(M.x + 1 + c, y, 1, 1);
    }
    const g = (s, x, y, col) => { ctx.fillStyle = col; const D = { 7: ['111', '001', '010', '010', '010'], 2: ['111', '001', '111', '100', '111'], 9: ['111', '101', '111', '001', '111'], 8: ['111', '101', '111', '101', '111'], 5: ['111', '100', '111', '001', '111'], 6: ['111', '100', '111', '101', '111'] }; let cx = x; for (const ch of s) { D[ch].forEach((r, j) => [...r].forEach((b, i) => { if (b === '1') ctx.fillRect(cx + i, y + j, 1, 1); })); cx += 4; } };
    g(battery ? '56' : '72', M.x + 1, M.y + 6, battery ? '#ff6a4a' : '#5aff9a');
    g('98', M.x + 9, M.y + 6, '#6ad0ff');
    const beat = ((t % per) / per) < 0.12 ? 1 : 0;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 + beat * 0.5;
    ctx.drawImage(battery ? this.glows.monRed : this.glows.mon, M.x + M.w / 2 - 14, M.y + M.h / 2 - 14);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }

  // the Ghostline path: spirit wrist -> living wrist (almost taut) -> down the blanket -> under the bed -> the seam
  ghostPath() {
    const gw = this.ghostWrist(), lw = this.livingWrist(), sp = this.seamPoint();
    const pts = [];
    const n1 = Math.max(4, Math.ceil(Math.hypot(lw[0] - gw[0], lw[1] - gw[1]) * 1.5));
    const sag = Math.min(4, Math.hypot(lw[0] - gw[0], lw[1] - gw[1]) * 0.06);
    for (let i = 0; i <= n1; i++) { const k = i / n1; pts.push([gw[0] + (lw[0] - gw[0]) * k, gw[1] + (lw[1] - gw[1]) * k + Math.sin(k * Math.PI) * sag]); }
    const drop = [[lw[0] + 2, lw[1] + 2], [lw[0] + 4, A.BED.top + 2], [lw[0] + 5, 137], [lw[0] + 6, 141], [sp[0], sp[1]]];
    let prev = lw;
    for (const q of drop) { const n = Math.ceil(Math.hypot(q[0] - prev[0], q[1] - prev[1]) * 1.5); for (let i = 1; i <= n; i++) pts.push([prev[0] + (q[0] - prev[0]) * i / n, prev[1] + (q[1] - prev[1]) * i / n]); prev = q; }
    return { pts, wristIx: n1 };
  }
  drawGhostline(ctx, k) {
    const { pts, wristIx } = this.ghostPath(), t = this.t;
    const seen = new Set();
    // the pulse: wrist -> wrist -> floor every 2.4 s
    const cyc = 2.4, ph = (t % cyc) / 1.7, pi = ph <= 1 ? Math.floor(ph * (pts.length - 1)) : -99;
    pts.forEach(([x, y], i) => {
      const X = Math.round(x), Y = Math.round(y), key = X + ',' + Y;
      if (seen.has(key)) return; seen.add(key);
      const sh = 0.55 + 0.25 * Math.sin(t * 5 + i * 0.6) + (i > wristIx ? -0.1 : 0);
      ctx.fillStyle = `rgba(196,222,255,${(sh * k).toFixed(3)})`; ctx.fillRect(X, Y, 1, 1);
    });
    if (pi >= 0) {
      for (let d = -3; d <= 1; d++) {
        const q = pts[pi + d]; if (!q) continue;
        ctx.fillStyle = d === 0 ? '#ffffff' : `rgba(220,240,255,${(0.9 - Math.abs(d) * 0.22).toFixed(2)})`;
        ctx.fillRect(Math.round(q[0]), Math.round(q[1]), 1, 1);
      }
      const q = pts[pi];
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6 * k;
      ctx.drawImage(this.glows.pulse, Math.round(q[0]) - 4, Math.round(q[1]) - 4);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    // where it goes into the floor: a faint cold spark in the seam, brighter as a pulse arrives
    const sp = this.seamPoint(), arrive = ph > 1 ? Math.max(0, 1 - (ph - 1) * 2.2) : 0;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (0.35 + arrive * 0.65) * k;
    ctx.drawImage(this.glows.seam, sp[0] - 8, sp[1] - 8);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    for (let d = -12; d <= 12; d++) {
      const a = Math.max(0, 1 - Math.abs(d) / 12) * (0.25 + arrive * 0.6) * k;
      if (a < 0.04 || (Math.abs(d) > 3 && A.bayer(sp[0] + d, sp[1]) > a * 2)) continue;
      ctx.fillStyle = `rgba(160,210,255,${a.toFixed(3)})`; ctx.fillRect(sp[0] + d, sp[1], 1, 1);
    }
    // the band on each wrist catches the thread
    for (const w of [this.ghostWrist(), this.livingWrist()]) { ctx.fillStyle = 'rgba(230,245,255,0.9)'; ctx.fillRect(Math.round(w[0]), Math.round(w[1]), 1, 1); }
  }

  // view 4: the beam, its shadow (only the shadow), Boo's lantern holding it off, Milo behind him
  drawThreat(ctx) {
    const t = this.t;
    ctx.drawImage(this.bg4lit, 0, 0);
    const st = Math.floor(t * 12);
    if (st !== this.shadowT) { this.shadowT = st; this.buildShadow(t); }
    ctx.drawImage(this.shadowCv, 0, 0);
    this.drawMonitor(ctx, true);
    const L = [this.pos.boo[0] + A.BOO_LANTERN[0], this.pos.boo[1] + A.BOO_LANTERN[1]];
    const fl = 0.85 + Math.sin(t * 11) * 0.05 + Math.sin(t * 2.3) * 0.08;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fl;
    ctx.drawImage(this.glows.lantern, L[0] - 40, L[1] - 40);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    const p = this.pos[4];
    this.drawMilo(ctx, 'frightened' + (this.breath ? '_b' : ''), p.x, p.y, { flip: p.flip, alpha: 0.85 });
    const bob = Math.round(Math.sin(t * 2.2) * 1.5), fr = Math.floor(t * 5) % 4;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3;
    ctx.drawImage(this.booAura, this.pos.boo[0] - 2, this.pos.boo[1] - 2 + bob);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.95;
    ctx.drawImage(this.boo[fr], this.pos.boo[0], this.pos.boo[1] + bob);
    ctx.globalAlpha = 1;
  }
  buildShadow(t) {
    const M = A.polyMask(A.AW, A.AH, A.stretchShadow(t));
    const x = this.shadowCv.getContext('2d');
    const img = x.createImageData(A.AW, A.AH), src = this.bg4darkData.data;
    let n = 0;
    for (let i = 0; i < A.AW * A.AH; i++) {
      if (!M.m[i]) continue;
      img.data[i * 4] = src[i * 4]; img.data[i * 4 + 1] = src[i * 4 + 1]; img.data[i * 4 + 2] = src[i * 4 + 2]; img.data[i * 4 + 3] = 255; n++;
    }
    x.putImageData(img, 0, 0);
    this.shadowMask = M; this.shadowPx = n;
  }
}
