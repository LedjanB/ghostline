# Bed 7: Milo acting asset audit and first production pass

14 Nov 2026, `v6-runner`. **Implementation is not yet owner-approved or browser-tested in this ChatGPT session.**

## Sources verified in GitHub

- `assets/milo/milo-sleep.png` is a 640×168 PNG, with two rows of five 128×84 transparent frames. Living frames **0 bed, 1 bed_breath, 2 bed_twitch, 3 lie, 4 sit**; ghost equivalents **5–9**. Precise frame names and wrist/hand anchors are in `assets/milo/frames.json`.
- `assets/milo/milo-living.png` / `milo-ghost.png` contain approved 96×100 Milo acting and movement.
- `assets/ward4-bed7/room-plate.png` (1065×360), `bed-front.png` (182×108) and `assets/reference/ward4-approved-2026-11-09.png` remain unmodified.
- Existing review scene: `src/scenes/opening-v2.js`; living body placed at world (216,176), scale 1.5, with bed foreground at (265,226). Ghost bed poses `lie=8`, `sit=9` remain as before.
- Actual source-pixel compositing before this change compared the old static `lie=3` and the existing sleeping `bed=0` against the room/foreground. Only a small local body area changed (420 pixels in the 640×360 camera crop); the approved painting was not edited. **A source composite is not an actual Phaser screenshot.**

## What is implemented

The living body now uses **real sprite frames** 0/1 for restrained breathing (~3.8-second cycle), with short single twitches using frame 2 before 3:33 and after the ghost lands. The living boy still breathes while his spirit is apart. No procedural shadows, enlarged closeups, exterior edits, character redesign, or new framework.

Added one focused assertion in the existing opening-review Playwright test and bumped service-worker cache for the new code. No tests or browser playtest were run in this ChatGPT environment; first real Phaser verification remains due. The existing V3 review route stays `?opening=1&prelude=1`, production `?opening=1` stays unchanged, and the isolated `?escape=1` remains unchanged.

## Missing art to actually direct the moment well

1. **Transition between ghost sitting and standing**: only poses `lie`, `sit` and full-body `MiloActor` currently exist, so the shift still risks a noticeable pop. Commission/hand-paint **one or two in-between poses matching the locked Milo face/hair/pajamas and 1.5× scale**, with correct wrist anchor; do not synthesize an unrelated new character.
2. **Recognition of the breathing body**: stage Milo's already-drawn `awakening` and `realization` poses toward the bed without changing his eyeline by merely scaling the full frame.
3. **Layered source files**: existing room plate is flattened. A proper source/editable layered working file is desirable for all future art revisions; current cutouts are not a full professional art pipeline.

**Next QA:** one focused Phaser review capture of current V3 room at original 640×360 (sleep/breath/twitch and separation), one focused test, then owner judges motion and palette. If the bedding of frame 0 feels wrong, restore old frame 3 and ask for a bedding-matched hand-painted sprite, not random visual effects.

Protect all approved art, story, eight worlds, round Boo, THE STRETCH final boss, and non-playable opening before RUN. No new Claude runs triggered by this document.
