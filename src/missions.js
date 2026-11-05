// Missions (Jetpack Joyride / Subway Surfers style): 3 active goals, each worth 1-3 stars.
// Stars fill your level; each level-up pays candles and gives a new title.
// "run" missions must happen inside one run, "total" ones add up across runs.
import { Save } from './save.js';
import { TITLES } from './data.js';

// Ordered roughly easy -> hard; new missions are handed out in this order.
// v6: the missions that pointed at v5-only systems (Spirit Rush, the Dark, ceiling, ecto splats) now count
// runner things (traps cleared, crates, burns, flights, clean landings); their ids stay so saves keep working.
export const MISSION_DEFS = [
  { id: 'm150', text: 'REACH 150M', stars: 1, stat: 'meters', target: 150, scope: 'run' },
  { id: 'c25', text: 'GRAB 25 CANDLES IN A RUN', stars: 1, stat: 'candles', target: 25, scope: 'run' },
  { id: 'near1', text: 'JUMP 10 TRAPS', stars: 1, stat: 'dodges', target: 10, scope: 'run' },
  { id: 'ghoul2', text: 'SMASH 2 GHOULS', stars: 1, stat: 'ghouls', target: 2, scope: 'run' },
  { id: 'soul1', text: 'COLLECT A SOUL', stars: 1, stat: 'souls', target: 1, scope: 'run' },
  { id: 'runs3', text: 'PLAY 3 RUNS', stars: 1, stat: 'runs', target: 3, scope: 'total' },
  { id: 'm300', text: 'REACH 300M', stars: 1, stat: 'meters', target: 300, scope: 'run' },
  { id: 'pow1', text: 'USE A POWER-UP', stars: 1, stat: 'powerups', target: 1, scope: 'run' },
  { id: 'zone1', text: 'REACH THE COLD ROOM', stars: 1, stat: 'zone', target: 1, scope: 'run' },
  { id: 'rush1', text: 'RIDE WITH BOO', stars: 1, stat: 'flights', target: 1, scope: 'run' },
  { id: 'combo15', text: 'HIT A 15 COMBO', stars: 1, stat: 'combo', target: 15, scope: 'run' },
  { id: 'splat3', text: 'SMASH 3 CRATES', stars: 1, stat: 'crates', target: 3, scope: 'run' },
  { id: 'ground6', text: 'RUN 200M WITHOUT A STUMBLE', stars: 2, stat: 'clean', target: 200, scope: 'run' },
  { id: 'c300t', text: 'GRAB 300 CANDLES TOTAL', stars: 2, stat: 'candles', target: 300, scope: 'total' },
  { id: 'die200', text: 'DIE BETWEEN 200M-260M', stars: 2, stat: 'deathM', target: [200, 260], scope: 'death' },
  { id: 'boo1', text: 'SPELL B-O-O', stars: 2, stat: 'boo', target: 1, scope: 'run' },
  { id: 'near5', text: 'CLEAR 40 TRAPS IN A RUN', stars: 2, stat: 'dodges', target: 40, scope: 'run' },
  { id: 'spin3', text: 'USE 3 SOULS ON GRAVE SPIN', stars: 2, stat: 'spins', target: 3, scope: 'total' },
  { id: 'zone2', text: 'REACH THE HOLLOW WOODS', stars: 2, stat: 'zone', target: 2, scope: 'run' },
  { id: 'chase1', text: 'LAND WITH NO AIR HITS', stars: 2, stat: 'cleanLands', target: 1, scope: 'run' },
  { id: 'ceil5', text: 'BURN 3 HANDS OR ROOTS', stars: 2, stat: 'burns', target: 3, scope: 'run' },
  { id: 'laser3', text: 'PICK UP 2 WEAPONS IN A RUN', stars: 2, stat: 'weapons', target: 2, scope: 'run' },
  { id: 'c80', text: 'GRAB 80 CANDLES IN A RUN', stars: 2, stat: 'candles', target: 80, scope: 'run' },
  { id: 'ghoul5', text: 'SMASH 5 GHOULS IN A RUN', stars: 2, stat: 'ghouls', target: 5, scope: 'run' },
  { id: 'score3k', text: 'SCORE 3,000 IN A RUN', stars: 2, stat: 'score', target: 3000, scope: 'run' },
  { id: 'tier3', text: 'REACH COMBO X3', stars: 2, stat: 'comboTier', target: 3, scope: 'run' },
  { id: 'm700', text: 'REACH 700M', stars: 2, stat: 'meters', target: 700, scope: 'run' },
  { id: 'runs20t', text: 'PLAY 20 RUNS', stars: 2, stat: 'runs', target: 20, scope: 'total' },
  { id: 'zone3', text: 'REACH CROWSREST', stars: 2, stat: 'zone', target: 3, scope: 'run' },
  { id: 'pow3', text: 'USE 3 POWER-UPS IN A RUN', stars: 2, stat: 'powerups', target: 3, scope: 'run' },
  { id: 'ghoul15t', text: 'SMASH 15 GHOULS TOTAL', stars: 2, stat: 'ghouls', target: 15, scope: 'total' },
  { id: 'nocandle', text: 'RUN 250M WITH NO CANDLES', stars: 3, stat: 'noCandleM', target: 250, scope: 'run' },
  { id: 'ban5', text: 'POP 3 BANSHEES WITH ECTO', stars: 2, stat: 'popped', target: 3, scope: 'run' },
  { id: 'm1000', text: 'REACH 1000M', stars: 2, stat: 'meters', target: 1000, scope: 'run' },
  { id: 'combo60', text: 'HIT A 60 COMBO', stars: 3, stat: 'combo', target: 60, scope: 'run' },
  { id: 'splat40t', text: 'SMASH 40 THINGS TOTAL', stars: 2, stat: 'kills', target: 40, scope: 'total' },
  { id: 'soul3', text: 'COLLECT 3 SOULS IN A RUN', stars: 3, stat: 'souls', target: 3, scope: 'run' },
  { id: 'rush5t', text: 'RIDE WITH BOO 10 TIMES', stars: 2, stat: 'flights', target: 10, scope: 'total' },
  { id: 'die600', text: 'DIE BETWEEN 600M-660M', stars: 3, stat: 'deathM', target: [600, 660], scope: 'death' },
  { id: 'revive1', text: 'WIN A SECOND CHANCE', stars: 3, stat: 'revives', target: 1, scope: 'total' },
  { id: 'zone4', text: 'REACH THE DRIPPING DARK', stars: 3, stat: 'zone', target: 4, scope: 'run' },
  { id: 'near25t', text: 'CLEAR 500 TRAPS TOTAL', stars: 2, stat: 'dodges', target: 500, scope: 'total' },
  { id: 'c1000t', text: 'GRAB 1000 CANDLES TOTAL', stars: 2, stat: 'candles', target: 1000, scope: 'total' },
  { id: 'laser20t', text: 'LAND CLEAN 5 TIMES', stars: 2, stat: 'cleanLands', target: 5, scope: 'total' },
  { id: 'c150', text: 'GRAB 150 CANDLES IN A RUN', stars: 3, stat: 'candles', target: 150, scope: 'run' },
  { id: 'soul20t', text: 'COLLECT 20 SOULS TOTAL', stars: 2, stat: 'souls', target: 20, scope: 'total' },
  { id: 'score15k', text: 'SCORE 15,000 IN A RUN', stars: 3, stat: 'score', target: 15000, scope: 'run' },
  { id: 'near10', text: 'RUN 600M WITHOUT A STUMBLE', stars: 3, stat: 'clean', target: 600, scope: 'run' },
  { id: 'm1500', text: 'REACH 1500M', stars: 3, stat: 'meters', target: 1500, scope: 'run' },
  { id: 'chase3t', text: 'SURVIVE 3 STUMBLES IN A RUN', stars: 3, stat: 'stumbles', target: 3, scope: 'run' },
  { id: 'zone5', text: 'REACH THE BONE HALLS', stars: 3, stat: 'zone', target: 5, scope: 'run' },
  { id: 'boo3t', text: 'SPELL B-O-O 3 TIMES', stars: 3, stat: 'boo', target: 3, scope: 'total' },
  { id: 'ground12', text: 'RUN 1000M WITHOUT A STUMBLE', stars: 3, stat: 'clean', target: 1000, scope: 'run' },
  { id: 'spin15t', text: 'USE 15 SOULS ON GRAVE SPIN', stars: 3, stat: 'spins', target: 15, scope: 'total' },
  { id: 'ban40t', text: 'POP 25 BANSHEES TOTAL', stars: 3, stat: 'popped', target: 25, scope: 'total' },
  { id: 'zone6', text: 'REACH THE DEAD CARNIVAL', stars: 3, stat: 'zone', target: 6, scope: 'run' },
  { id: 'tier5', text: 'REACH COMBO X5', stars: 3, stat: 'comboTier', target: 5, scope: 'run' },
  { id: 'ceil10', text: 'BURN 30 HANDS OR ROOTS TOTAL', stars: 3, stat: 'burns', target: 30, scope: 'total' },
  { id: 'die1000', text: 'DIE BETWEEN 1000M-1060M', stars: 3, stat: 'deathM', target: [1000, 1060], scope: 'death' },
  { id: 'c2000t', text: 'GRAB 2000 CANDLES TOTAL', stars: 3, stat: 'candles', target: 2000, scope: 'total' },
  { id: 'm2500', text: 'REACH 2500M', stars: 3, stat: 'meters', target: 2500, scope: 'run' },
  { id: 'nocandle500', text: 'RUN 500M WITH NO CANDLES', stars: 3, stat: 'noCandleM', target: 500, scope: 'run' },
  { id: 'zone7', text: 'REACH THE OTHER SIDE', stars: 3, stat: 'zone', target: 7, scope: 'run' },
  { id: 'score60k', text: 'SCORE 60,000 IN A RUN', stars: 3, stat: 'score', target: 60000, scope: 'run' },
  { id: 'trick3', text: 'MAKE IT MISS 3 TIMES IN A RUN', stars: 2, stat: 'tricks', target: 3, scope: 'run' },
  { id: 'trick25t', text: 'MAKE IT MISS 25 TIMES TOTAL', stars: 3, stat: 'tricks', target: 25, scope: 'total' },
  { id: 'door1', text: 'FIND THE DOOR', stars: 3, stat: 'doors', target: 1, scope: 'run' },
  { id: 'm3500', text: 'REACH 3500M', stars: 3, stat: 'meters', target: 3500, scope: 'run' },
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
        for (const [k, v] of Object.entries(run)) if (typeof v === 'number' && !['meters', 'zone', 'score', 'combo', 'comboTier', 'noCandleM', 'groundTime', 'ceilTime', 'clean'].includes(k)) m.totals[k] = (m.totals[k] || 0) + v;
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
