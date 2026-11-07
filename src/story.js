// v8: The Story of Vigil in the run (mixed into PlayScene). Each world has an ally Milo meets once
// (they give him a power, saved in save.story.met) and a boss at the end of the world, fought in its
// own arena scene (src/scenes/boss.js) until it is beaten once (save.story.beaten).
// World 1: Nurse Ivy + THE NIGHT MATRON in the ward. World 2: Ansel on slab 9 + THE CORONER in the Cold Room.
import { PLAYER_X, FLOOR, PX_PER_METER, W } from './data.js';
import { px, grid } from './scenes/boss.js';
import { Save } from './save.js';
import { Audio } from './audio.js';
import { RUN } from './runner.js';
import { ZONE_LENGTH_M } from './zones.js';

// ally: who, which world, where (m into the world), the power, the lines (one at a time, the voice of the doc)
export const ALLIES = {
  ivy: {
    zone: 0, at: 150, power: 'penlight', sprite: 'nurse_run0',
    lines: [['NURSE IVY.', 'SHE WAS HIDING BEHIND THE NURSE STATION.'], ["DON'T RUN ON MY WARD.", ''], ['RUN. TAKE THIS.', 'IVY GAVE YOU HER PENLIGHT.']],
  },
  // the man on slab 9: dead 40 years, nobody claimed him. He sits up under his sheet, points the way, lies back down
  ansel: {
    zone: 1, at: 150, power: 'sheet', sprite: 'ansel_lie', sit: 'ansel_sit', scale: 2.5, noFlip: true, sayAt: 330, holds: [0.8, 1.0, 2.0],
    lines: [['SLAB 9.', 'NOBODY CAME FOR HIM. 40 YEARS.'], ['HE SITS UP. HE POINTS.', ''], ['HE LIES BACK DOWN.', 'ANSEL LEFT YOU HIS SHEET.']],
  },
};
// boss: which world, when it starts (m into the world), the arena's key
export const STORY_BOSS = {
  matron: { zone: 0, at: 368, end: 393, ally: 'ivy', after: ['THE WARD IS QUIET.', 'NOW. FOR A WHILE.'] },
  coroner: { zone: 1, at: 368, end: 393, ally: 'ansel', after: ['THE HUM STARTS AGAIN.', 'SOMEWHERE A DRAWER CLOSES.'] },
};

// Ansel on his slab, lying and sitting up (pointing the way). Art direction: text rows, 1px outline.
const ANSEL_PAL = { S: '#d8dfe3', F: '#a7b2ba', K: '#8e9c94', k: '#5c6a64', M: '#6a7a88', m: '#4a5864', T: '#d8c89a', s: '#b8a888', l: '#6a5a40' };
function slab(g) {
  g.r(0, 15, 34, 2, 'M').r(0, 17, 34, 1, 'm').r(2, 18, 2, 4, 'm').r(30, 18, 2, 4, 'm');
  // the bare feet out the end, and the toe tag on its string
  g.r(27, 11, 2, 4, 'K').r(27, 10, 1, 1, 'k').r(28, 10, 1, 1, 'k');
  g.r(29, 12, 1, 1, 's').r(30, 13, 1, 1, 's').r(30, 14, 3, 4, 'T').r(31, 15, 1, 1, 'l').r(31, 16, 1, 1, 'l');
  return g;
}
export function makeAllyArt(scene) {
  if (scene.textures.exists('ansel_lie')) return;
  const lie = slab(grid(34, 22));
  lie.r(3, 10, 3, 1, 'S').r(2, 11, 5, 4, 'S').r(2, 14, 5, 1, 'F');               // the head under the sheet
  lie.r(7, 12, 19, 3, 'S').r(9, 11, 7, 1, 'S').r(17, 11, 4, 1, 'S').r(24, 10, 3, 2, 'S').r(24, 12, 3, 3, 'S');
  lie.r(7, 14, 20, 1, 'F').r(12, 13, 1, 1, 'F').r(20, 13, 1, 1, 'F');
  px(scene, 'ansel_lie', lie.rows(), ANSEL_PAL);
  const sit = slab(grid(34, 22));
  sit.r(9, 12, 17, 3, 'S').r(17, 11, 4, 1, 'S').r(24, 10, 3, 2, 'S').r(24, 12, 3, 3, 'S').r(9, 14, 18, 1, 'F'); // legs under the sheet
  sit.r(3, 5, 7, 10, 'S').r(3, 5, 2, 10, 'F').r(2, 12, 2, 4, 'S');              // the back, the sheet's hem
  sit.r(4, 1, 5, 4, 'S').r(5, 0, 3, 1, 'S').r(7, 2, 1, 1, 'F').r(8, 3, 1, 1, 'F'); // the head, the hollows of a face
  sit.r(10, 6, 6, 2, 'S').r(10, 7, 6, 1, 'F').r(16, 6, 4, 2, 'K').r(20, 6, 2, 2, 'K').r(22, 6, 3, 1, 'K').r(20, 8, 1, 1, 'k'); // the arm, pointing on
  px(scene, 'ansel_sit', sit.rows(), ANSEL_PAL);
}
const HOLD_BEFORE = 24; // m of empty floor before an arena, so nothing is mid-air when it starts

export const StoryFeatures = {
  storyInit(save) {
    // story beats run in the normal and creative runs, not in the daily run or endless mode
    this.storyOn = save.mode === 'normal' || save.mode === 'creative';
    this.storyMet = [...save.story.met];
    this.storyBeaten = [...save.story.beaten];
    this.storyHold = false; // no new ground traps while a story beat has the screen
    this.ally = null;
    this.bossOn = false;
  },

  storyPowers() {
    return Object.entries(ALLIES).filter(([id]) => this.storyMet.includes(id)).map(([, a]) => a.power);
  },

  stepStory() {
    if (!this.storyOn || this.dead || !this.started || this.bossOn) return;
    const m = this.worldX / PX_PER_METER;
    const inWorld = m - this.zoneIndex * ZONE_LENGTH_M;
    this.storyHold = false;
    // an ally waits at their spot the first time
    for (const [id, a] of Object.entries(ALLIES)) {
      if (a.zone !== this.zoneIndex || this.storyMet.includes(id)) continue;
      if (!this.ally && inWorld >= a.at - 14 && inWorld < a.at + 40) this.meetAlly(id, a);
    }
    if (this.ally) this.stepAlly();
    // the boss: the floor clears, then the arena
    for (const [id, b] of Object.entries(STORY_BOSS)) {
      if (b.zone !== this.zoneIndex || this.storyBeaten.includes(id)) continue;
      if (inWorld >= b.at - HOLD_BEFORE && inWorld < b.end) this.storyHold = true;
      const chasmAhead = this.chasm && this.sx(this.chasm.wx) > PLAYER_X - 10;
      if (inWorld >= b.at && inWorld < b.end && !this.flying && this.grounded && !chasmAhead && !this.trick && !this.scare) this.startBoss(id);
    }
  },

  meetAlly(id, a) {
    makeAllyArt(this);
    const wx = this.worldX + (W - PLAYER_X) + 50; // just off the right edge
    const img = this.add.image(PLAYER_X + (wx - this.worldX), FLOOR + 1, a.sprite).setOrigin(0.5, 1).setScale(a.scale || 2.5).setDepth(8.9).setFlipX(!a.noFlip);
    this.ally = { id, a, wx, img, said: false, sat: false, lay: false };
  },

  stepAlly() {
    const al = this.ally;
    const x = this.sx(al.wx);
    al.img.setX(x);
    this.storyHold = true;
    // Ansel: he sits up as you come, and lies back down once he has said it
    if (al.a.sit && !al.sat && x < PLAYER_X + 400) { al.sat = true; al.img.setTexture(al.a.sit); Audio.sfx('creak'); }
    if (al.a.sit && al.said && !al.lay && x < PLAYER_X - 30) { al.lay = true; al.img.setTexture(al.a.sprite); } // once you're past him
    if (!al.said && x < PLAYER_X + (al.a.sayAt || 150)) {
      al.said = true;
      al.a.lines.forEach(([main, sub], i) => this.headline(main, sub, al.a.holds ? al.a.holds[i] : i === al.a.lines.length - 1 ? 2.0 : 1.4, i === 0));
      this.storyTalkUntil = this.clock + al.a.lines.length * 1.8 + 0.6; // pickup calls go to the corner note meanwhile
      this.storyMet.push(al.id);
      Save.update((s) => { if (!s.story.met.includes(al.id)) s.story.met.push(al.id); });
      Audio.sfx('unlock');
      this.addCombo('gate', PLAYER_X + 40, this.py - 30);
    }
    if (x < -40) { al.img.destroy(); this.ally = null; }
  },

  // the run pauses; the arena scene runs the fight and hands back the result
  startBoss(id) {
    this.bossOn = true;
    this.clearAround(W);
    this.clearMessages?.(); this.clearHeadline?.(); this.heads = [];
    this.events.emit('strike', null);
    const save = Save.get();
    const play = this;
    this.scene.sleep('hud');
    this.scene.pause();
    this.scene.setVisible(false); // the arena covers the screen: don't draw the run under it
    this.scene.launch('boss', {
      boss: id, powers: this.storyPowers(), char: this.char.id,
      shake: save.settings.shake, reduceFlicker: !save.settings.flicker,
      onEnd: (res) => play.endBoss(id, res),
    });
  },

  endBoss(id, res) {
    this.scene.resume();
    this.scene.setVisible(true);
    this.scene.wake('hud');
    this.cameras.main.fadeIn(300, 7, 6, 13);
    this.bossOn = false;
    if (res.won) {
      this.storyBeaten.push(id);
      Save.update((s) => { if (!s.story.beaten.includes(id)) s.story.beaten.push(id); });
      this.gap = RUN.START_GAP; this.crEnter = 0; // it lost you while you fought
      this.addCombo('gate', PLAYER_X + 40, this.py - 30);
      const [a, b] = STORY_BOSS[id].after || ['IT IS QUIET.', ''];
      this.headline(a, b, 1.8);
      return;
    }
    if (this.creative) { // creative: Boo pulls you out and the arena starts again a moment later
      this.rebirth();
      this.time.delayedCall(900, () => { if (!this.dead) this.startBoss(id); });
      return;
    }
    this.lastHitKind = id;
    this.deathCause = id;
    this.die();
  },
};
