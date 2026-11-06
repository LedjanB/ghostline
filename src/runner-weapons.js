// v6: weapons (salt, flame, holy, bone): what each answers, aiming, shots, hits, smashing traps. Mixed into PlayScene via RunnerFeatures.
import { W, CEIL, FLOOR, PLAYER_X, PX_PER_METER } from './data.js';
import { Audio } from './audio.js';

import { RUN, WEAPONS, ANSWERS, ECTO } from './runner-const.js';

export const WeaponFeatures = {
  armWeapon(kind) {
    const def = WEAPONS[kind];
    this.weapon = { kind, ammo: def.ammo === Infinity ? Infinity : Math.round(def.ammo * this.perk.power), t: def.time * this.perk.power, cd: 0 };
    this.tracker?.add('weapons', 1);
    this.lastWeapon = kind;
    this.gunImg.setTexture(def.icon);
    Audio.sfx('powerup');
    if (this.clock < (this.storyTalkUntil || 0)) this.note(`${def.short} ${def.answer}`); // v8: an ally is talking
    else this.headline(def.short, def.answer, 1.0, true); // what it's for, every time (in the corner)
    this.tip(kind === 'bone' ? 'bone' : 'weapon');
    this.addCombo('power', PLAYER_X + 40, this.py - 40);
    this.events.emit('power', { kind: 'weapon', icon: def.icon, left: 1 });
  },

  // every target a weapon can hit right now: { cx, cy, box, t (trap) | b (banshee) | h (v5 hand) }
  // a ground weapon only sees what it answers (ANSWERS); Boo's ecto sees what's in the air
  targets(kind) {
    const out = [];
    if (kind === 'ecto') {
      for (const b of this.banshees) out.push({ cx: b.x - 6, cy: b.y, box: { l: b.x - 22, r: b.x + 10, t: b.y - 16, b: b.y + 16 }, b });
      for (const h of this.hands) if (h.state !== 'wait') {
        const box = h.fromFloor ? { l: h.x - 12, r: h.x + 12, t: h.y + 6, b: FLOOR } : { l: h.x - 12, r: h.x + 12, t: CEIL, b: h.y - 6 };
        out.push({ cx: h.x, cy: (box.t + box.b) / 2, box, h });
      }
      return out;
    }
    const ans = ANSWERS[kind] || [];
    for (const t of this.traps) {
      if (t.gone || !ans.includes(t.kind)) continue;
      const x = this.sx(t.wx);
      let box;
      if (t.kind === 'trick') {
        const c = this.trickAim(t);
        if (!c) continue;
        box = { l: c.x - 14, r: c.x + 14, t: c.y - 16, b: c.y + 16 };
      } else if (t.kind === 'eye') box = { l: x, r: x + t.w, t: t.y - 11, b: t.y + 11 };
      else if (t.kind === 'hand') { if (t.state === 'wait') continue; box = { l: x - 10, r: x + 10, t: t.y, b: FLOOR }; }
      else if (t.kind === 'roots') { if (t.state !== 'rise') continue; box = { l: x, r: x + t.w, t: FLOOR - t.cur - 4, b: FLOOR }; }
      else if (t.kind === 'drawer') { if (t.out < 0.2) continue; box = { l: x, r: x + t.w * t.out, t: FLOOR - 50, b: FLOOR - 26 }; }
      else if (t.kind === 'chandelier') { if (t.state !== 'down') continue; box = { l: x, r: x + t.w, t: t.y - 2, b: FLOOR }; }
      else if (t.kind === 'vent') box = { l: x, r: x + t.w, t: FLOOR - 34, b: FLOOR };
      else box = { l: x, r: x + t.w, t: FLOOR - t.h - 4, b: FLOOR };
      out.push({ cx: (box.l + box.r) / 2, cy: (box.t + box.b) / 2, box, t, behind: t.kind === 'trick' });
    }
    return out;
  },

  // where a weapon aims at a trick: THE STRETCH itself, or the part of it that's coming at you
  trickAim(t) {
    const b = this.trickBox(t);
    if (b) return { x: (b.l + b.r) / 2, y: (b.t + b.b) / 2 };
    const back = PLAYER_X - 8 - this.gapVis * 0.72 - 14;
    switch (t.trick) {
      case 'drawer': return { x: this.sx(t.wx) + 20, y: FLOOR - 12 };
      case 'burrow': return t.erupt < 0 ? { x: t.mx, y: FLOOR - 10 } : null;
      case 'ceiling': return { x: t.cx, y: CEIL + 24 };
      case 'canopy': return t.phase === 'tell' ? null : { x: this.sx(t.wx) + 34, y: FLOOR - 18 };
      default: return back > 0 ? { x: back, y: FLOOR - 50 } : null;
    }
  },

  stepWeapon(dt) {
    this.stepShots(dt);
    if (this.dead) return;
    // Boo's ecto blaster: only while he carries you, aimed down at what's in the way
    this.ectoCd -= dt;
    if (this.flying && this.ectoCd <= 0) {
      const gx = this.ghostX + 8, gy = this.ghostY + 10;
      const tg = this.nearest(this.targets('ecto'), gx, gy, ECTO.range);
      if (tg) {
        const a = Math.atan2(tg.cy - gy, tg.cx - gx);
        this.pellets.push({ type: 'ecto', x: gx, y: gy, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, life: 0.6, dmg: 9, hits: new Set() });
        this.ectoCd = ECTO.cd;
        Audio.sfx('splat');
      }
    }
    const wp = this.weapon;
    if (!wp) return;
    const def = WEAPONS[wp.kind];
    wp.t -= dt; wp.cd -= dt;
    if (!this.power) this.events.emit('power', { kind: 'weapon', icon: def.icon, left: Math.max(0, Math.min(wp.t / (def.time * this.perk.power), wp.ammo / (def.ammo * this.perk.power))) });
    if (wp.t <= 0 || wp.ammo <= 0) {
      this.weapon = null;
      this.events.emit('power', null);
      Audio.sfx('powerdown');
      this.popup(wp.kind === 'salt' ? 'OUT OF SALT' : 'IT BROKE!', '#c8c8d8');
      this.nextWeaponX = this.worldX + this.rand.range(240, 380) * PX_PER_METER;
      return;
    }
    if (wp.cd > 0 || this.flying) return; // in the air, Boo's ecto does the shooting
    if (wp.kind === 'bone' && this.pellets.some((p) => p.type === 'bone')) return; // one boomerang at a time
    const mx = PLAYER_X + 12, my = this.py - 2;
    const tg = this.nearest(this.targets(wp.kind), mx, my, def.range, wp.kind === 'bone');
    const ref = tg && (tg.t || tg.b || tg.h);
    if (ref !== this.aimRef) { this.aimRef = ref || null; if (ref) Audio.sfx('tick'); } // phase 4: you hear it lock on
    if (!tg) return;
    const a = Math.atan2(tg.cy - my, tg.cx - mx);
    this.gunKick = 1; // recoil: the gun jumps back, a flash at the muzzle
    if (wp.kind !== 'flame') this.burst(mx + 10, my, wp.kind === 'holy' ? 0x9fd0ff : 0xfff2b0, 2, 8, 90, 2);
    const shot = (type, ang, speed, life, dmg, extra = {}) => this.pellets.push({ type, x: mx, y: my, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life, dmg, hits: new Set(), ...extra });
    if (wp.kind === 'salt') {
      for (const sp of [-0.12, 0, 0.12]) shot('salt', a + sp, 720, def.range / 720 + 0.05, 1, { once: true });
      Audio.sfx('salt');
      this.burst(mx + 6, my, 0xffffff, 3, 12, 150, 2);
    } else if (wp.kind === 'flame') {
      shot('flame', a + this.rand.range(-0.22, 0.22), 340, 0.34, 0.25);
      if (this.rand.chance(0.25)) Audio.sfx('flame');
    } else if (wp.kind === 'holy') {
      shot('holy', a, 950, def.range / 950, 2);
      Audio.sfx('holy');
    } else if (wp.kind === 'bone') {
      const img = this.add.image(mx, my, 'bone').setScale(1.6).setDepth(21.7);
      shot('bone', a, 520, 3, 1, { phase: 'out', dist: 0, img, back: new Set() });
      Audio.sfx('swoosh');
    }
    wp.cd = def.cd;
    if (wp.ammo !== Infinity) wp.ammo--;
  },

  // the closest target ahead; the boomerang also turns round for THE STRETCH behind you
  nearest(list, mx, my, range, back = false) {
    let best = null, bestD = range;
    for (const t of list) { const d = Math.hypot(t.cx - mx, t.cy - my); if ((t.cx > mx - 4 || (back && t.behind)) && d < bestD) { bestD = d; best = t; } }
    return best;
  },

  stepShots(dt) {
    for (const p of this.pellets) {
      if (p.type === 'bone') {
        if (p.phase === 'out') {
          p.x += p.vx * dt; p.y += p.vy * dt; p.dist += 520 * dt;
          if (p.dist > WEAPONS.bone.range) p.phase = 'back';
        } else { // comes back to Milo
          const dx = PLAYER_X - p.x, dy = this.py - p.y, d = Math.hypot(dx, dy) || 1;
          p.x += (dx / d) * 560 * dt; p.y += (dy / d) * 560 * dt;
          if (d < 14) p.dead = true;
        }
        p.life -= dt;
        p.img.setPosition(p.x, p.y).setRotation(p.img.rotation + 16 * dt);
      } else {
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.type === 'ecto') p.vy += 500 * dt; // ectoplasm arcs down
      }
      if (p.life <= 0 || p.x > W + 40 || p.x < -40 || p.y > FLOOR + 4) p.dead = true;
    }
    // hits: pierce unless the shot is a single pellet; each shot hits each target once (bone: once out, once back)
    // each shot only meets what its weapon answers (ANSWERS); the lists are built once per step
    const lists = {};
    const listFor = (type) => lists[type] || (lists[type] = this.targets(type));
    for (const p of this.pellets) {
      if (p.dead) continue;
      const seen = p.type === 'bone' && p.phase === 'back' ? p.back : p.hits;
      for (const tg of listFor(p.type)) {
        const ref = tg.t || tg.b || tg.h;
        if (seen.has(ref) || (tg.t && tg.t.gone)) continue;
        const bx = tg.box;
        if (p.x < bx.l || p.x > bx.r || p.y < bx.t || p.y > bx.b) continue;
        seen.add(ref);
        this.hitTarget(tg, p);
        if (p.once) { p.dead = true; break; }
      }
    }
    for (const p of this.pellets) if (p.dead && p.img) { p.img.destroy(); p.img = null; }
    this.pellets = this.pellets.filter((p) => !p.dead);
  },

  hitTarget(tg, p) {
    if (tg.b) { // banshees: ecto pops them; everything else only shoves them back
      const b = tg.b;
      if (p.type === 'ecto') {
        this.burst(b.x - 6, b.y, 0xcfe0ff, 14, 40, 420);
        for (let i = 0; i < 2; i++) this.addCandle(b.x - 10 + i * 16, b.y);
        b.x = -1e5;
        this.tracker?.add('popped', 1); this.kills++;
        Audio.sfx('ghoul');
        this.addCombo('ghoul', PLAYER_X + 60, this.py - 30);
      } else {
        b.x += p.type === 'holy' ? 60 : 26; b.vx *= 0.82;
        this.burst(b.x - 10, b.y, 0xcfe0ff, 4, 16, 200, 2);
        if (!b.salted) { b.salted = true; this.addCombo('near', b.x, b.y - 20); }
      }
      return;
    }
    if (tg.h) { // a v5 hand in the air
      this.burst(tg.h.x, tg.cy, 0xb8ffd2, 10, 30, 350);
      tg.h.x = -1e5;
      this.addCombo('splat', PLAYER_X + 60, this.py - 30);
      return;
    }
    const t = tg.t;
    const x = this.sx(t.wx);
    if (t.kind === 'trick') { this.smashTrick(t); return; }
    if (t.kind === 'vent') { // holy water puts the steam out for good
      this.burst(tg.cx, FLOOR - 20, 0xdfe8e0, 14, 40, 420);
      this.popup('DOUSED!', '#9fd0ff', FLOOR - 70);
      this.addCombo('splat', tg.cx, FLOOR - 60); this.kills++; this.tracker?.add('kills', 1);
      Audio.sfx('holy'); this.dropTrap(t);
      return;
    }
    if (p.type === 'flame' && !(t.hp > 0)) { // fire burns a hand, roots, a drawer or a wreck away
      this.burst(tg.cx, tg.cy, 0xff8a2a, 12, 30, 380);
      this.addCandle(tg.cx, FLOOR - 30);
      this.addCombo('splat', tg.cx, tg.cy - 30);
      this.popup(t.kind === 'drawer' ? 'BURNED SHUT!' : 'BURNED!', '#ffb060', Math.min(tg.cy - 30, FLOOR - 70));
      this.hitStop = Math.max(this.hitStop || 0, 0.03);
      this.tracker?.add('burns', 1); this.kills++; this.tracker?.add('kills', 1);
      this.dropTrap(t);
      return;
    }
    t.hp -= p.dmg;
    if (t.s) this.tweens.add({ targets: t.s, alpha: 0.4, duration: 40, yoyo: true });
    if (t.hp <= 0) this.smash(t, x);
  },

  smash(t, x) {
    const cx = x + t.w / 2, cy = t.kind === 'eye' ? t.y : FLOOR - t.h / 2;
    this.hitStop = Math.max(this.hitStop || 0, 0.035); // phase 4: a kill lands (game-feel: hit-stop for impact)
    this.shake(60, 0.003);
    this.burst(cx, cy, t.kind === 'ghoul' ? 0xc8ffc0 : t.kind === 'eye' ? 0xd8b0ff : 0xb07a3a, 12, 36, 420);
    this.kills++;
    this.tracker?.add('kills', 1);
    if (t.kind === 'crate') this.tracker?.add('crates', 1);
    this.gap = Math.min(RUN.MAX_GAP + this.perk.startGap, this.gap + RUN.KILL);
    // monsters go poof into candles
    const n = t.kind === 'ghoul' ? 3 : 2;
    for (let i = 0; i < n; i++) this.addCandle(cx - 14 + i * 14, cy - 10 - i * 8);
    if (t.kind === 'ghoul') { Audio.sfx('ghoul'); this.tracker?.add('ghouls', 1); this.popup('POOF!', '#c8ffc0', cy - 30); }
    else if (t.kind === 'eye') { Audio.sfx('ghoul'); this.popup('BLINK!', '#d8b0ff', t.y - 30); }
    else { Audio.sfx('bounce'); this.popup('SMASH!', '#ffd0a0', cy - 30); }
    this.addCombo(t.kind === 'ghoul' ? 'ghoul' : 'splat', cx, cy - 40);
    this.dropTrap(t);
  },

  renderAim() {
    const g = this.aimGfx;
    g.clear();
    const wp = this.weapon;
    if (!wp || this.dead || this.flying) return;
    const range = WEAPONS[wp.kind].range;
    const a = 0.5 + 0.3 * Math.sin(this.clock * 10);
    for (const tg of this.targets(wp.kind)) {
      if (Math.hypot(tg.cx - PLAYER_X, tg.cy - this.py) > range + 120 || tg.cx > W) continue;
      const locked = (tg.t || tg.b || tg.h) === this.aimRef; // phase 4: the one it's firing at reads solid
      g.lineStyle(locked ? 3 : 2, locked ? 0xfff2b0 : 0xffffff, locked ? 1 : a * 0.7);
      const { l, r, t, b } = tg.box, k = locked ? 7 : 5;
      g.lineBetween(l - 2, t - 2, l - 2 + k, t - 2); g.lineBetween(l - 2, t - 2, l - 2, t - 2 + k);
      g.lineBetween(r + 2, t - 2, r + 2 - k, t - 2); g.lineBetween(r + 2, t - 2, r + 2, t - 2 + k);
      g.lineBetween(l - 2, b + 2, l - 2 + k, b + 2); g.lineBetween(l - 2, b + 2, l - 2, b + 2 - k);
      g.lineBetween(r + 2, b + 2, r + 2 - k, b + 2); g.lineBetween(r + 2, b + 2, r + 2, b + 2 - k);
    }
  },

  // f (far) / m (middle) / n (near): the HUD face and the sounds follow it
};
