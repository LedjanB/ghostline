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
- `src/runner.js` (v6, branch `v6-runner`) mixed into PlayScene last: run/jump/slide, THE STRETCH chaser, ground traps, Boo flights (one chasm per world + rare orb; the v5 hazards are the air traps), salt shotgun. Tuning in `RUN`
- `src/runner-art.js` THE STRETCH, tombstone, crate, salt shotgun pixel art

## Rules
- Run state is reset in `init()`, never the constructor.
- Simulation runs on a fixed 120 Hz step in `PlayScene.step()`; drawing happens in `render()`.
- Gameplay reads actions from `src/input.js`, never raw keys.
- Bump `SAVE_VERSION` and add a migration when the save shape changes (now v6: v5 fields plus `bestScore`, `bestCombo`, `unlocks` {got, points, fresh}, `boo` {hat, trail}).
- Creative mode: `PlayScene.rebirth()` replaces death; `saveCheckpoint()` writes the creative slot.
- iPhone fullscreen = home screen web app (`manifest.webmanifest`, apple meta tags, `icons/`).
- Offline via `sw.js`: bump `CACHE` and add new files to its list whenever files change.
- Zones are one-way: a gate set piece swaps layers at its seam. Never fade or loop zones.
- Darkness covers backgrounds only (depth 4.5); hazards must stay readable. Hazard colors come from `this.hz` (high contrast setting).
- Character looks stay below hazards: tint goes on zone layers, the color wash sits at depth 4.4, effects at depth 2 (scanlines 4.6, faint).
- HUD x 120-180 on row 2 stays empty: the player hugs the ceiling there.
- Anything good the player does should call `addCombo(kind)`; getting hit calls `breakCombo()`.
- v6: `hit()` is a stumble on the ground (two in a row = caught) and costs landing distance in the air. The LIGHT bar shows how close THE STRETCH is.
- v6: ground traps live in world px (`t.wx`, drawn at `sx(wx)`); v5 hazards stay in screen px and only spawn while flying.

## Test
Serve the folder (`python -m http.server 8000`) and open http://localhost:8000.
Debug: `window.__game` exposes the Phaser game.
Automated: `npm test` (Playwright, `tests/ghostline.spec.js`; set `CHROME_PATH` to use a system Chrome).
Store: `npm run build:itch` makes `dist/ghostline-itch.zip`; `scripts/screenshots.mjs` refreshes `docs/store/`; shipping steps in `docs/SHIPPING.md`.
