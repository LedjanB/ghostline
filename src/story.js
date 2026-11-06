// v8: The Story of Vigil in the run (mixed into PlayScene). Each world has an ally Milo meets once
// (they give him a power, saved in save.story.met) and a boss at the end of the world, fought in its
// own arena scene (src/scenes/boss.js) until it is beaten once (save.story.beaten).
// Worlds 1 and 2 for now: Nurse Ivy + THE NIGHT MATRON in the ward.
import { PLAYER_X, FLOOR, PX_PER_METER, W } from './data.js';
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
};
// boss: which world, when it starts (m into the world), the arena's key
export const STORY_BOSS = {
  matron: { zone: 0, at: 368, end: 393, ally: 'ivy' },
};
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
    const wx = this.worldX + (W - PLAYER_X) + 30; // just off the right edge
    const img = this.add.image(PLAYER_X + (wx - this.worldX), FLOOR + 1, a.sprite).setOrigin(0.5, 1).setScale(2.5).setDepth(8.9).setFlipX(true);
    this.ally = { id, a, wx, img, said: false };
  },

  stepAlly() {
    const al = this.ally;
    const x = this.sx(al.wx);
    al.img.setX(x);
    this.storyHold = true;
    if (!al.said && x < PLAYER_X + 150) {
      al.said = true;
      al.a.lines.forEach(([main, sub], i) => this.headline(main, sub, i === al.a.lines.length - 1 ? 2.0 : 1.4, i === 0));
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
    this.scene.launch('boss', {
      boss: id, powers: this.storyPowers(), char: this.char.id,
      shake: save.settings.shake, reduceFlicker: !save.settings.flicker,
      onEnd: (res) => play.endBoss(id, res),
    });
  },

  endBoss(id, res) {
    this.scene.resume();
    this.scene.wake('hud');
    this.cameras.main.fadeIn(300, 7, 6, 13);
    this.bossOn = false;
    if (res.won) {
      this.storyBeaten.push(id);
      Save.update((s) => { if (!s.story.beaten.includes(id)) s.story.beaten.push(id); });
      this.gap = RUN.START_GAP; this.crEnter = 0; // it lost you while you fought
      this.addCombo('gate', PLAYER_X + 40, this.py - 30);
      this.headline('THE WARD IS QUIET.', 'NOW. FOR A WHILE.', 1.8);
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
