// Missions (Jetpack Joyride / Subway Surfers style): 3 active goals, each worth 1-3 stars.
// Stars fill your level; each level-up pays candles and gives a new title.
// "run" missions must happen inside one run, "total" ones add up across runs.
import { Save } from './save.js';
import { TITLES } from './data.js';

// Ordered roughly easy -> hard; new missions are handed out in this order.
export const MISSION_DEFS = [
  { id: 'm150', text: 'REACH 150M', stars: 1, stat: 'meters', target: 150, scope: 'run' },
  { id: 'c25', text: 'GRAB 25 CANDLES IN A RUN', stars: 1, stat: 'candles', target: 25, scope: 'run' },
  { id: 'near1', text: 'GET 1 CLOSE CALL', stars: 1, stat: 'near', target: 1, scope: 'run' },
  { id: 'ghoul2', text: 'SCARE 2 GHOULS', stars: 1, stat: 'ghouls', target: 2, scope: 'run' },
  { id: 'soul1', text: 'COLLECT A SOUL', stars: 1, stat: 'souls', target: 1, scope: 'run' },
  { id: 'runs3', text: 'PLAY 3 RUNS', stars: 1, stat: 'runs', target: 3, scope: 'total' },
  { id: 'm300', text: 'REACH 300M', stars: 1, stat: 'meters', target: 300, scope: 'run' },
  { id: 'pow1', text: 'USE A POWER-UP', stars: 1, stat: 'powerups', target: 1, scope: 'run' },
  { id: 'ground6', text: 'STAY ON THE FLOOR 6S', stars: 2, stat: 'groundTime', target: 6, scope: 'run' },
  { id: 'c300t', text: 'GRAB 300 CANDLES TOTAL', stars: 2, stat: 'candles', target: 300, scope: 'total' },
  { id: 'die200', text: 'DIE BETWEEN 200M-260M', stars: 2, stat: 'deathM', target: [200, 260], scope: 'death' },
  { id: 'boo1', text: 'SPELL B-O-O', stars: 2, stat: 'boo', target: 1, scope: 'run' },
  { id: 'near5', text: 'GET 5 CLOSE CALLS IN A RUN', stars: 2, stat: 'near', target: 5, scope: 'run' },
  { id: 'spin3', text: 'USE 3 SOULS ON GRAVE SPIN', stars: 2, stat: 'spins', target: 3, scope: 'total' },
  { id: 'zone1', text: 'REACH THE HOLLOW WOODS', stars: 2, stat: 'zone', target: 1, scope: 'run' },
  { id: 'ceil5', text: 'HUG THE CEILING 5S', stars: 2, stat: 'ceilTime', target: 5, scope: 'run' },
  { id: 'laser3', text: 'SURVIVE 3 LASER ROWS', stars: 2, stat: 'lasers', target: 3, scope: 'run' },
  { id: 'c80', text: 'GRAB 80 CANDLES IN A RUN', stars: 2, stat: 'candles', target: 80, scope: 'run' },
  { id: 'ghoul15t', text: 'SCARE 15 GHOULS TOTAL', stars: 2, stat: 'ghouls', target: 15, scope: 'total' },
  { id: 'm700', text: 'REACH 700M', stars: 2, stat: 'meters', target: 700, scope: 'run' },
  { id: 'nocandle', text: 'FLY 250M WITH NO CANDLES', stars: 3, stat: 'noCandleM', target: 250, scope: 'run' },
  { id: 'ban5', text: 'DODGE 5 BANSHEES IN A RUN', stars: 2, stat: 'banshees', target: 5, scope: 'run' },
  { id: 'pow10t', text: 'USE 10 POWER-UPS TOTAL', stars: 2, stat: 'powerups', target: 10, scope: 'total' },
  { id: 'soul3', text: 'COLLECT 3 SOULS IN A RUN', stars: 3, stat: 'souls', target: 3, scope: 'run' },
  { id: 'die600', text: 'DIE BETWEEN 600M-660M', stars: 3, stat: 'deathM', target: [600, 660], scope: 'death' },
  { id: 'revive1', text: 'WIN A SECOND CHANCE', stars: 3, stat: 'revives', target: 1, scope: 'total' },
  { id: 'zone2', text: 'REACH THE DRIPPING DARK', stars: 3, stat: 'zone', target: 2, scope: 'run' },
  { id: 'near25t', text: 'GET 25 CLOSE CALLS TOTAL', stars: 2, stat: 'near', target: 25, scope: 'total' },
  { id: 'c150', text: 'GRAB 150 CANDLES IN A RUN', stars: 3, stat: 'candles', target: 150, scope: 'run' },
  { id: 'm1500', text: 'REACH 1500M', stars: 3, stat: 'meters', target: 1500, scope: 'run' },
  { id: 'boo3t', text: 'SPELL B-O-O 3 TIMES', stars: 3, stat: 'boo', target: 3, scope: 'total' },
  { id: 'ban40t', text: 'DODGE 40 BANSHEES TOTAL', stars: 3, stat: 'banshees', target: 40, scope: 'total' },
  { id: 'c2000t', text: 'GRAB 2000 CANDLES TOTAL', stars: 3, stat: 'candles', target: 2000, scope: 'total' },
  { id: 'm2500', text: 'REACH 2500M', stars: 3, stat: 'meters', target: 2500, scope: 'run' },
];
const BY_ID = Object.fromEntries(MISSION_DEFS.map((d) => [d.id, d]));
export const missionDef = (id) => BY_ID[id];

export const starsForLevel = (level) => level + 2;
export const titleFor = (level) => TITLES[Math.min(TITLES.length - 1, level - 1)];

// make sure 3 missions are active (hand out the next unfinished ones in order)
export function refillMissions() {
  Save.update((s) => {
    const m = s.missions;
    m.active = m.active.filter((id) => BY_ID[id] && !m.done.includes(id));
    for (const d of MISSION_DEFS) {
      if (m.active.length >= 3) break;
      if (!m.done.includes(d.id) && !m.active.includes(d.id)) m.active.push(d.id);
    }
    // all done: recycle the hardest ones so there is always something to do
    if (m.active.length < 3) {
      m.done = m.done.filter((id) => !MISSION_DEFS.slice(-6).some((d) => d.id === id));
      for (const d of MISSION_DEFS.slice(-6)) if (m.active.length < 3 && !m.active.includes(d.id)) m.active.push(d.id);
    }
  });
}

// progress of a mission, 0..1, given this run's stats
export function progress(def, run = {}, totals = Save.get().missions.totals) {
  if (def.scope === 'death') return run.deathDone ? 1 : 0;
  const have = def.scope === 'total' ? (totals[def.stat] || 0) + (run[def.stat] || 0) : (run[def.stat] || 0);
  return Math.min(1, have / def.target);
}

// One per run. The run reports stats; completed missions pop as they happen.
export function createTracker(onComplete) {
  refillMissions();
  const run = {};
  const doneNow = new Set();
  const active = () => Save.get().missions.active.map(missionDef).filter(Boolean);
  const check = () => {
    for (const d of active()) {
      if (doneNow.has(d.id) || d.scope === 'death') continue;
      if (progress(d, run) >= 1) { doneNow.add(d.id); onComplete(d); }
    }
  };
  return {
    run,
    add(stat, n = 1) { run[stat] = (run[stat] || 0) + n; check(); },
    max(stat, v) { if (v > (run[stat] || 0)) { run[stat] = v; check(); } },
    // death-range missions are judged when you die
    death(m) {
      for (const d of active()) {
        if (d.scope === 'death' && !doneNow.has(d.id) && m >= d.target[0] && m <= d.target[1]) {
          run.deathDone = true; doneNow.add(d.id); onComplete(d);
        }
      }
    },
    // apply results to the save; returns what happened for the results screen
    finish() {
      const completed = [...doneNow].map(missionDef);
      let reward = 0;
      let levelUps = [];
      Save.update((s) => {
        const m = s.missions;
        for (const [k, v] of Object.entries(run)) if (typeof v === 'number' && k !== 'meters' && k !== 'zone') m.totals[k] = (m.totals[k] || 0) + v;
        for (const d of completed) {
          if (!m.done.includes(d.id)) m.done.push(d.id);
          m.active = m.active.filter((id) => id !== d.id);
          m.stars += d.stars;
          reward += d.stars * 15;
        }
        while (m.stars >= starsForLevel(m.level)) {
          m.stars -= starsForLevel(m.level);
          m.level += 1;
          const bonus = 25 * m.level;
          reward += bonus;
          levelUps.push({ level: m.level, title: titleFor(m.level), bonus });
        }
        s.candles += reward;
      });
      refillMissions();
      return { completed, reward, levelUps };
    },
  };
}
