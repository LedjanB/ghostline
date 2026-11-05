# Ghostline v6: the runner (design doc)

Status: playable build on branch `v6-runner` (inside the real game, `src/runner.js`). v5 (the flying game) stays on `main`.
Prototype A was kept (physics felt good). Prototype B playtest: too much flying, too hard to die. The real build answers that: flying is ~10-15% of a run (one chasm per world + a rare 3.5 s Boo orb), 3 air hits = caught on landing, and difficulty escalates with distance.
Built since: one trap per world (gurney, morgue drawer, roots, sinkhole, steam vent, chandelier with a shadow, coaster cart, bobbing eye), all four weapons plus Boo's ecto blaster in flight, THE STRETCH's face on the danger meter. Not built: the creature's per-world twist (climbs trees, ceiling crawl, rides the rails).

## Why
v5 plays almost exactly like Jetpack Joyride. v6 makes it its own game:
**Milo runs from a creepy creature. Flying with Boo is the big moment, not the whole game.**

## Core loop
1. Milo runs on the ground, always moving right.
2. A creepy creature chases him from the left edge of the screen, all the time.
3. Ground traps come at him. He jumps and slides past them.
4. Weapons he picks up fire on their own and clear monsters and breakable traps.
5. Sometimes Boo grabs him and he flies. The traps change to air traps.
6. He lands, the creature has caught up a bit, and he runs again.

## The creature (the chaser)
- Working name: **THE STRETCH**. Tall, thin, too many joints, long arms, a white porcelain face with a wide grin. Moves on two legs, drops to all fours when it speeds up. Spooky fun, never gory.
- Always on screen at the left. How close it is = the danger meter (it replaces the LIGHT bar).
- Hitting a small trap = **stumble**: Milo slows down and the creature gets closer (Temple Run).
- Two stumbles close together, or one big trap (a pit, a laser) = **caught**. Run over.
- Candles push it back a little. A clean stretch with no stumbles pushes it back slowly.
- During flight it can't follow. It stays on the ground, jumps and reaches up with its long arms, then falls behind. When you land, it runs to catch up, so landing feels tense.
- Each world gives it a small twist (in the woods it climbs trees, in the sewer it crawls along the ceiling, at the carnival it rides the rails).

## Controls (the same game on every device)
| Action | Phone | Keyboard | Gamepad |
|---|---|---|---|
| Jump (hold = higher) | tap / hold | Space, Up, W | A |
| Slide | swipe down | Down, S | B or stick down |
| Rise while flying | hold | hold Space | hold A |
| Shoot | **automatic** | automatic | automatic |
| Pause | II button | P, Esc | Start |

Weapons aim and fire on their own at the nearest target ahead. You only steer, so it plays the same with a thumb, a keyboard or a controller.

## Flying (both ways)
- **Boo orb power-up:** grab it anywhere, fly for about 10 seconds.
- **Flight sections in every world:** a set part of each world where the ground ends (a collapsed hospital floor, a flooded crypt, a chasm in the woods, the carnival's broken coaster). Boo always carries you across. These are the showpiece moments of each world.
- While flying, the ground traps stop and the air traps start: banshees, spirit beams, laser rows (the v5 hazards).

## Ground traps (new)
- Graves and tombstones (jump), low branches and pipes (slide), hands from the floor (jump), gaps and pits (jump, deadly), swinging blades (time it), falling chandeliers (watch the shadow), crates (shoot them or jump).
- Each world adds one trap of its own.

## Weapons (picked up during the run)
Each one lasts a set time or ammo, then breaks. Monsters go poof into candles.
- **Salt shotgun:** short range, wide spread, breaks crates
- **Candle flamethrower:** short range, constant stream, burns hands from the floor
- **Holy water slingshot:** long range, one shot at a time, pierces
- **Bone boomerang:** comes back, hits twice
- **Ecto blaster (only while flying):** Boo's ectoplasm, aimed down (the v5 spray, now a real weapon)

## Monsters
- Ground: ghouls (walk at you), skeletons (throw bones), crawlers (low, slide under or shoot)
- Air: bats, banshees
- Some monsters don't die, they only get knocked away, so it's not just about shooting.

## What carries over from v5
8 worlds, the zone art and gates, music per zone and combo layers, weather, missions, combo, score multiplier, unlocks (hats, trails, journal), charms, characters and world looks, save system, settings, PWA, tests, store kit.

## What's new
Milo's movement (run, jump, slide, stumble), the chaser, the ground traps, the weapon system, the monsters, and the flight sections. `src/scenes/play.js` is mostly rebuilt.

## Plan (prototype first)
Work on a branch called `v6-runner`. Prototype code lives in `prototypes/runner/` and is thrown away after (prototype-fast skill).

**Prototype A, about 1 hour.** Question: *is running and jumping away from the creature fun?*
Grey boxes only: Milo, the creature, 4 ground traps, stumble and caught. Debug text shows speed and creature distance.
- Keep if: a new player gets it in 30 seconds without being told, and wants "one more run".
- Kill if: it only feels good after it's explained, or it feels like a worse Temple Run.

**Prototype B, about 1 hour.** Question: *does switching to flight feel like a big moment?*
Add the Boo orb, a flight section, and air traps when flying. Add one auto-fire weapon.
- Keep if: players get excited when Boo grabs them, and landing feels tense.
- Kill if: flying feels like a break from the real game instead of the best part.

If both prototypes pass, the real build reuses the v5 systems and replaces the run itself.

## Decisions (Nov 5)
- **The ending is hard to reach.** It only opens after a long story across many runs: the door on the Other Side
  needs every journal page (the full unlock track) AND a run that reaches the end of world 8. Most players will
  need many hours. After it, endless mode. Built in phase 3 (alpha), see the review doc's roadmap.
- Flights: rare but long. A flight section every other world (6.5 s), a Boo orb about every 1,400 to 2,000 m (8 s).
- THE STRETCH stays scary-funny. Release on web and itch first. Phase 1 = fix v6 (story, missions, perks, charms,
  flights, creature sounds, safer first runs).
- Phase 2 (vertical slice, worlds 1 and 2): Milo run/jump/fall/stumble frames, THE STRETCH 4-step walk, the grab
  death scene, the ward's hand-made flight (THREAD THE NEEDLE), shaded gates with the world's giant behind them,
  dust instead of rain indoors, one new system per run, a red edge instead of a full-screen hit flash, the meter
  drops while one more stumble gets you, results readable before the level-up cards. AI testers: 6, 6, 6 out of 10
  (round 2 was 5, 5, 4), all three would run again.

## Phase 3 (alpha), Nov 5
- **Every world has a flight set piece** (`src/setpieces.js`): ward THREAD THE NEEDLE (beam gates), morgue THE COLD HANDS
  (hands close to a gap), woods THE SWAYING PINES (branches sway up and down), graveyard CROW STORM (banshee waves, two
  lanes open), sewer PIPE BURST (one laser row at a time), catacombs THE BONE WHEELS (spinning bones), carnival THE
  BROKEN COASTER (a tube of beams), the Other Side THE LAST CROSSING (a mix). A chasm in every world now; it opens early
  enough that you always land before the gate.
- **THE STRETCH has a trick per world** (`src/tricks.js`), every 10 to 15 s of running (more often in worlds 5 to 8), with
  a tell and one answer: ward reaches at head height (slide), morgue comes out of a low drawer (jump), woods drops from
  the trees and crawls at you (jump), graveyard burrows and bursts up under you (jump), sewer crawls the ceiling and
  drops ahead, legs wide (slide), catacombs throws its face, bouncing high and low (read it), carnival rides a coaster
  cart from behind (jump). The Other Side: any of them, faster. Beating one = "IT MISSED!" + combo.
- **Weapons with a purpose** (`ANSWERS`, `WORLD_WEAPON`): salt breaks crates, ghouls, beds and carts; flame burns hands,
  roots, drawers and wrecks; holy water blinds eyes, douses steam and hurts it; the bone boomerang turns round and hits
  it behind you (knocks it back, breaks a trick). A weapon only aims at what it answers (white brackets show it), and
  the pickup you get is the answer to the world you're in.
- **Hand-made trap patterns** (`src/patterns.js`): 7 shared + 2 per world, timed in seconds so they work at any speed,
  checked by a test against the jump/slide metrics. They only use traps you've already met this run.
- **The ending**: the door at 3,200 m. Without every journal page it stays shut (Boo pulls you back, results say how
  many pages you have). With all 12 (the last pages now cost 8 and 20 points, so the whole track is about 160 points,
  many hours of runs) AND a run that reaches it: the ending, once. Then the door stays open, the run goes on beyond it
  (a new depth every 400 m), and ENDLESS mode appears in the menu (starts at the door, score counts only what you run).
- Worlds 5 to 8 are the hard half (`lateK`): tighter gaps, more patterns, more tricks, a longer two-stumble window, a slower recovery.
- Bots (`scripts/bot.mjs`): casual, regular, expert. They read traps better than people, so they are a floor check, not a difficulty target.

## Open questions
- The creature's final name and look
- Does the LIGHT meter go away completely, or does the dark come back as part of the creature?
- How many weapons at launch (start with 3?)
- Charms and character perks need a rework for running (for example "double jump", "longer weapons")
