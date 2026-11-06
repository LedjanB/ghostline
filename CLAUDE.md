# Ghostline

Horror-themed (spooky fun) Jetpack Joyride-style runner. Phaser 4.2.1, plain ES modules, no build step.
Phaser is vendored at `vendor/phaser.min.js` and loaded by `<script>` in `index.html` (the `package.json`
dependency is there so tools can detect the engine and version).

## Game dev skills
This repo ships game dev skills in `.claude/skills/` (from
https://github.com/gamedev-skills/awesome-gamedev-agent-skills, Apache-2.0).
For ANY game change, start with the `router` skill, then read the skills it picks before writing code.
Engine skills: `phaser-core`, `phaser-arcade-physics`.

## Layout
- `src/main.js` boot + game config
- `src/scenes/` story, menu, play, hud, pause, settings, stats, over, unlocks
- `src/zones.js` the 8 zones (data + painted 5-layer parallax art via `Buf`, gates, `ZoneLayers` seam swap); `ZONE_LENGTH_M` = 400
- `src/art.js` all pixel art drawn in code; `docs/art-direction.md` is the visual contract
- `src/audio.js` Web Audio synth: buses, music layers, SFX
- `src/input.js` action map (float, pause, confirm, back, nav) for keyboard, pointer, gamepad
- `src/save.js` versioned save with migration + backup
- `src/pacing.js` difficulty curve, speed curve and spawn tables
- `src/missions.js` mission pool, levels, per-run tracker
- `src/unlocks.js` score multiplier, combo tiers + points, unlock track (hats, trails, journal pages), character LOOKS
- `src/run-score.js` mixed into PlayScene: score, combo, ecto spray, thrust, speed lines, hat, world tint
- `src/looks.js` `WorldLook`: per-character color grade + signature effect (used by play and menu)
- `src/run-features.js` mixed into PlayScene: pickups, lasers, ghouls, weather, giants, opening, daily ghost, Spirit Rush, Dark Chase, Boo quips, tips, spin/revive/finalize
- `src/scenes/spin.js` Grave Spin; `missions.js`, `charms.js` menu overlays
- `src/runner.js` (v6, branch `v6-runner`) mixed into PlayScene last: run/jump/slide, THE STRETCH chaser, ground traps, Boo flights (a chasm in every world + a rare 8 s orb; the v5 hazards are the air traps), one trap per world (`WORLD_TRAPS`), weapons (`WEAPONS`: salt, flame, holy, bone; each only aims at what it answers, `ANSWERS`; the pickup is the answer to the world, `WORLD_WEAPON`; Boo's ecto blaster in flight). Tuning in `RUN`; `lateK()` makes worlds 5 to 8 harder
- `src/tricks.js` (phase 3) THE STRETCH's trick per world (`TRICKS`): tell, then one answer (jump or slide); lives in `this.traps` as kind `trick`
- `src/patterns.js` (phase 3) hand-made ground trap patterns, shared + per world; `patternFair()` checks them against the jump/slide metrics
- `src/setpieces.js` (phase 3) a hand-made flight set piece per world (`SET_PIECES`: gate, pinch, sway, wave, laser, wheel, track segments)
- `src/ending.js` (phase 3) the door at the end of world 8 (needs every journal page), the ending scene, endless mode (`save.ending.seen`, mode `endless`)
- `src/scares.js` (phase 4) one scare per world (`SCARES`): hush, sting, release; waits for a clear screen (`scareHold` stops the spawner), never hurts you
- `scripts/bot.mjs` bot players (casual, regular, expert): `node scripts/bot.mjs 6 all` for full runs, `--pieces` for each world's flight
- `src/runner-art.js` THE STRETCH (3 stages by distance: `_m`, `_n` frames via `hungry()`), its big ending face `stretch_face`, ground and world traps, weapons, HUD face icon (pixel art)
- `scripts/phase3-shots.mjs`, `scripts/phase4-shots.mjs` screenshots for the AI testers

## Rules
- Run state is reset in `init()`, never the constructor.
- Simulation runs on a fixed 120 Hz step in `PlayScene.step()`; drawing happens in `render()`.
- Gameplay reads actions from `src/input.js`, never raw keys.
- Bump `SAVE_VERSION` and add a migration when the save shape changes (now v7: v5 fields plus `bestScore`, `bestCombo`, `unlocks` {got, points, fresh}, `boo` {hat, trail}; v7 adds `ending` {seen, runs} and mode `endless`).
- Creative mode: `PlayScene.rebirth()` replaces death; `saveCheckpoint()` writes the creative slot.
- iPhone fullscreen = home screen web app (`manifest.webmanifest`, apple meta tags, `icons/`).
- Offline via `sw.js`: bump `CACHE` and add new files to its list whenever files change.
- Zones are one-way: a gate set piece swaps layers at its seam. Never fade or loop zones.
- Darkness covers backgrounds only (depth 4.5); hazards must stay readable. Hazard colors come from `this.hz` (high contrast setting).
- Character looks stay below hazards: tint goes on zone layers, the color wash sits at depth 4.4, effects at depth 2 (scanlines 4.6, faint).
- HUD x 120-180 on row 2 stays empty: the player hugs the ceiling there.
- Anything good the player does should call `addCombo(kind)`; getting hit calls `breakCombo()`.
- Phase 4: the runner's meter shows closeness (fills toward red as THE STRETCH gets nearer); `play.light` itself still means distance (1 = far).
- v6: `hit()` is a stumble on the ground (two in a row = caught) and costs landing distance in the air. The LIGHT bar shows how close THE STRETCH is.
- v6: every ground trap must be beatable by jump or slide alone (Milo can't change speed). Slide fits under anything whose bottom is above FLOOR-20; standing Milo's head is FLOOR-44 (Milo is drawn at 2.5x, `MILO_SCALE`).
- v6: ground traps live in world px (`t.wx`, drawn at `sx(wx)`); v5 hazards stay in screen px and only spawn while flying.
- v6: one new system per run (`runnerInit`): run 1 missions only, run 2 power-ups, run 3 B-O-O letters, run 5 souls and Grave Spin.
- v6: every flight section is hand-made (`SET_PIECES` in setpieces.js, per zone id); it replaces the random air spawner. The chasm opens early enough that you land before the gate (`chasmAtM`).
- v6: a trick or pattern needs the screen to itself: no traps spawn while `this.trick` runs, patterns only use traps already seen this run (teach, then test).
- v6: the door at 3,200 m only opens with every journal page; after the ending it stays open and the run goes on beyond it (endless, `this.beyond`, a new depth every 400 m).
- v6: a gate is a passage (`renderGate`): the door art stands 150 px before the seam, the seam sits inside a black stretch, the next world fades in after it.
- v6: one popup at a time (`popup(str, color, y, prio)`): a newer one replaces the old unless the old is more important and under 0.6 s old.
- Phase 4: ONE message on screen at a time. The headline (one short line), the popup and Boo's bubble share a slot: a headline clears the others, a popup waits out a headline unless prio >= 2 (danger). Second lines and tips go to the small corner note (`note(str)`, HUD bottom-left). No floating +points in the runner.
- Phase 4: scares and the RNG: never call `this.rand` from scares (it would change the run's layout).
- v6: getting caught plays the grab scene (`stepGrab`/`renderGrab`); a pit death keeps the fall.

## Test
Serve the folder (`python -m http.server 8000`) and open http://localhost:8000.
Debug: `window.__game` exposes the Phaser game.
Automated: `npm test` (Playwright, `tests/ghostline.spec.js`; set `CHROME_PATH` to use a system Chrome).
Store: `npm run build:itch` makes `dist/ghostline-itch.zip`; `scripts/screenshots.mjs` refreshes `docs/store/`; shipping steps in `docs/SHIPPING.md`.
