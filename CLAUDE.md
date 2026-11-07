# Ghostline

Horror (spooky fun) 2D runner with boss arenas. Phaser 4.2.1 (vendored `vendor/phaser.min.js`), plain ES modules, no build step.
Work happens on branch `v6-runner`; `main` (v5) stays untouched. Commit as Ledjan <ledibajrami15@gmail.com>.
Start every session by reading `docs/owner-notes.md` (how Ledjan works, his decisions, the current task).
Story, names, voice: `docs/story.md` (short). Full story: `docs/story-full.md` (open it for Vigil's history, Milo's backstory, ally looks, Reality Shift per world, exact journal text).
Plans: `docs/review-roadmap-v6.md` (full review + roadmap), `docs/design-v6.md` (design log). Claude Docs exports: `scripts/doc-to-md.py`.
Game dev skills in `.claude/skills/` (start with `router`); engine skills `phaser-core`, `phaser-arcade-physics`.

## Saving tokens
- Read only the files the task names; use Grep to find a method before reading a file.
- Screenshots and AI testers only when asked. No subagents unless asked.
- Run the tests for what changed (`npx playwright test -g "<name>"`); the full suite and bots once at the end.

## Files
- `src/main.js` boot. `src/data.js` sizes (W, H, FLOOR, CEIL, PLAYER_X). `src/input.js` action map. `src/save.js` versioned save. `src/audio.js` synth + SFX.
- `src/scenes/play.js` the run (fixed 120 Hz `step()`, `render()`); `hud.js`, `menu.js`, `over.js`, `pause.js`, `settings.js`, `stats.js`, `unlocks.js`, `spin.js`, `story.js` (intro cards).
- Mixins into PlayScene: `run-features.js` (pickups, Boo quips, opening, revive), `run-score.js` (score, combo), `runner.js` (v6 core: init, run/jump/slide, spawning, world traps, collisions, headlines, drawing) which spreads in `runner-stretch.js` (THE STRETCH: chase, shadow, sounds, stumble arm, grab scene, Boo's lantern), `runner-flight.js` (Boo's flights + set pieces), `runner-weapons.js` (salt, flame, holy, bone). Shared tuning/constants: `runner-const.js` (`RUN`, `WEAPONS`, difficulty helpers). `lateK()` (worlds 5 to 8 harder) is in runner-flight.js.
- `zones.js` 8 zones (painted parallax, gates; `ZONE_LENGTH_M` 400). `art.js`, `runner-art.js` pixel art in code (`docs/art-direction.md`). `looks.js` color grade.
- `tricks.js` THE STRETCH's trick per world. `patterns.js` hand-made trap patterns (`patternFair()`). `setpieces.js` flight set pieces. `scares.js` one scare per world. `ending.js` the door at 3,200 m, ending, endless.
- `story.js` (v8) `ALLIES` (met once, gives a power; `save.story.met`), `STORY_BOSS` (arena at a world's end until beaten; `save.story.beaten`), ally art. `scenes/boss.js` arenas (`BOSSES`, `POWERS`): world 2 THE CORONER. `scenes/matron.js` world 1 THE NIGHT MATRON (`MATRON_FIGHT` mixed into BossScene at init): 3 acts in a tall building (Ward 4, the ward below, the stairwell), world px y down, own camera; `phase` survives TRY AGAIN.
- `scenes/opening.js` THE WRONG SIDE OF THE BED, the playable opening (first launch, `?opening=1`, `window.__opening`); own art `opening-art.js` (5 px grid) and sound `opening-audio.js`.
- `scripts/bot.mjs` bots: `node scripts/bot.mjs 6 all` full runs, `--pieces` flights, `8 all --arena` boss fights. `scripts/v8-shots.mjs` (and phase3/4), `scripts/matron-shots.mjs` screenshots.

## Rules
- Run state resets in `init()`, never the constructor. Gameplay reads actions from `input.js`, never raw keys.
- Save shape change: bump `SAVE_VERSION` + migration (now v8: `story` {met, beaten}). Bots' saves mark bosses beaten.
- Any file change: bump `CACHE` in `sw.js`; add new files to its list.
- Creative mode: `rebirth()` replaces death; `saveCheckpoint()` writes the slot. iPhone fullscreen = home screen web app.
- Zones are one-way: a gate swaps layers at its seam (`renderGate`: door 150 px before the seam, black stretch, next world fades in). Never fade or loop zones.
- Depths: darkness covers backgrounds only (4.5); tint on zone layers, wash 4.4, effects 2, scanlines 4.6. Hazards stay readable; hazard colors from `this.hz`.
- HUD: top bar = distance, meter (centered, fills red as THE STRETCH nears; `play.light` 1 = far), score, pause. Other counters `peek()` and fade. HUD x 120-180 row 2 stays empty.
- ONE message at a time: headline, popup (`popup(str, color, y, prio)`) and Boo's bubble share a slot; second lines go to `note()`. No floating +points.
- Good moves call `addCombo(kind)`; getting hit calls `breakCombo()`. Scares never call `this.rand`.
- Runner: `hit()` = stumble (two in a row = caught; in the air it costs distance). Every ground trap is beatable by jump or slide alone (slide fits under bottoms above FLOOR-20; standing head FLOOR-44; Milo at 2.5x). Ground traps in world px (`t.wx`), v5 air hazards in screen px, only while flying.
- One new system per run (`runnerInit`): run 1 missions, 2 power-ups, 3 B-O-O letters, 5 souls + Grave Spin.
- Flights are hand-made (`SET_PIECES`); the chasm opens early enough to land before the gate (`chasmAtM`). A trick or pattern gets the screen to itself; patterns only use traps seen this run.
- Door at 3,200 m opens with every journal page; after the ending the run goes on (endless, `this.beyond`).
- Caught = grab scene (`stepGrab`/`renderGrab`, it comes in from the left edge); a pit death keeps the fall.
- v8 THE STRETCH is heard, not seen: only its shadow (`stretchShadow`, depth 4.55) and sounds (steps, `keys`, breath, `hum` near). Body only on failure (`renderLungeArm` on a stumble, all of it when caught). Tricks are shadow + sound tells (`shadeStretch`); a trick that hits you shows the real thing. The hidden `stretch` sprite still runs the stage anims.
- v8 Boo only when needed (`booNeeded()`: opening, flights, saves, ally scenes, gates, ending, `booUntil`). Otherwise Milo carries the lantern (`renderLantern`) and only a few lines show, by the lantern.
- v8 arenas: same 4 actions everywhere: move, jump (`float`), dodge (`slide`), light (`light`). Attacks automatic. Touch: left half move, right tap jump, swipe dodge, LIGHT button when charged (`createInput(scene, { pointers: false })`). A power upgrades an action, never adds a button. Milo keeps every power (penlight = LIGHT; THE SHEET = dodge unseen 0.6 s every 1.5 s). A light attack (`hurt(x, true)`) ignores a plain dodge. Each boss needs its world's new power.
- v8 arenas: a boss takes hits only while open (gold outline: check/stun); 3 hits in one window = it shoves Milo off. Boo saves once per fight at the last heart. Matron: each act ends with her cracked, only the LIGHT ends it; colors red = hurts, gold = hit now, pale blue = magic light; a dodge in place on a bed/landing drops through. First time an attack comes it's slower with one line (`teach()`); "!" before every attack; losing shows how close and TRY AGAIN / GIVE UP.

## Test
Serve (`python -m http.server 8000`), open http://localhost:8000. Debug: `window.__game`, `window.__boss`.
`npm test` (Playwright, `tests/ghostline.spec.js`; `CHROME_PATH` for a system Chrome).
Store: `npm run build:itch`; `scripts/screenshots.mjs`; `docs/SHIPPING.md`.
