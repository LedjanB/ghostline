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
- `src/scenes/` menu, play, hud, pause, settings, over
- `src/art.js` all pixel art drawn in code; `docs/art-direction.md` is the visual contract
- `src/audio.js` Web Audio synth: buses, music layers, SFX
- `src/input.js` action map (float, pause, confirm, back, nav) for keyboard, pointer, gamepad
- `src/save.js` versioned save with migration + backup
- `src/pacing.js` difficulty curve, speed curve and spawn tables
- `src/missions.js` mission pool, levels, per-run tracker
- `src/run-features.js` mixed into PlayScene: pickups, lasers, ghouls, weather, giants, opening, daily ghost, spin/revive/finalize
- `src/scenes/spin.js` Grave Spin; `missions.js`, `charms.js` menu overlays

## Rules
- Run state is reset in `init()`, never the constructor.
- Simulation runs on a fixed 120 Hz step in `PlayScene.step()`; drawing happens in `render()`.
- Gameplay reads actions from `src/input.js`, never raw keys.
- Bump `SAVE_VERSION` and add a migration when the save shape changes (now v4: `mode` normal/daily/creative, `creative` checkpoint, `missions`, `charms`, `daily`, `giftAt`).
- Creative mode: `PlayScene.rebirth()` replaces death; `saveCheckpoint()` writes the creative slot.
- iPhone fullscreen = home screen web app (`manifest.webmanifest`, apple meta tags, `icons/`).

## Test
Serve the folder (`python -m http.server 8000`) and open http://localhost:8000.
Debug: `window.__game` exposes the Phaser game.
