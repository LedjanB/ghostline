# Ghostline economy

Measured by stepping the real game logic headlessly (`window.__game`, fixed 120 Hz steps) with two bots,
invulnerable so distance is fixed:

| Bot | Distance | Time | Candles | Souls |
|---|---|---|---|---|
| Seeker (chases candles) | 400M | 35s | 89 | 0 |
| Seeker | 800M | 62s | 155 | 1 |
| Seeker | 1500M | 101s | 310 | 1 |
| Lazy (random holds) | 400M | 34s | 55 | 0 |
| Lazy | 800M | 61s | 71 | 1 |
| Lazy | 1500M | 94s | 155 | 2 |

So a run earns roughly **15 to 22 candles per 100M**, plus mission rewards (15 per star, level-up bonus 25 x level),
B-O-O (+50), outrunning the Dark (+25), Grave Spin prizes and a free gift every 4 hours (20 to 60).

Assumed new player: 300 to 600M per run, about 1 minute, about 100 candles per run including missions.

## Prices and what they mean in runs (at ~100 candles a run)

| Item | Price | Runs |
|---|---|---|
| Nurse Ivy | 150 | 1 to 2 (first purchase comes fast on purpose) |
| Dex the Hunter | 400 | 4 |
| Little Lila | 800 | 8 |
| Wraps | 1500 | 15 |
| Count Vlad | 2500 | 25 |
| Rattles | 3500 | 35 |
| Fang | 5000 | 50 |
| Charms | 150 to 650 | 2 to 7 each |

All characters: 13,850 candles, about 140 runs or 2.5 hours. All charms: 4,150 more.
Lila doubles candles, so buying her early speeds everything after.

**Needs real players:** these numbers assume skill. Watch real runs (distance per run, where people quit)
and retune `price` in `src/data.js`.
