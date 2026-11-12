# Claude Code task report: St. Mercy opening prelude (12 Nov 2026)

Task: `docs/claude-opening-prelude-task-draft.md`. Branch `v6-runner` only, `main` untouched.
Preview: **`?opening=1&prelude=1`**. Production `?opening=1` and first launch are unchanged.

## DONE
- **Shot 1, St. Mercy exterior** (`assets/opening-prelude/st-mercy-exterior.png`, 720x400). Painted art, not a greybox. It is made by `scripts/prelude-art.py`: painted at 3x and reduced, then grained, in the Ward 4 sheet's palette.
  - An old brick hospital in the rain: mansard wings with dormers, a pediment, and a clock tower **stopped at 3:33** (it always has been, per the story).
  - Carved "ST. MERCY HOSPITAL" over the portico. Iron railings, a bare tree framing the left, Vigil's dark hill with two house lights.
  - Wet street with smeared reflections, a cold street lamp, and ground mist (`st-mercy-mist.png`, a drifting layer).
  - A few cool lit windows. **One warm window: Bed 7.** No religious symbols.
  - In Phaser: a 4.6 s slow tilt from the tower down to the street, live rain in world space (two depths, slanted, splashes on the street) and drifting mist.
- **Shot 2, the corridor to Ward 4** (`ward4-corridor.png`, 680x380). A real one-point perspective: every pixel is a ray into the corridor, textured and lit, and the wet floor reflects it.
  - Ward 4's blue-green wall tiles, a bumper rail, rainy windows on the left and patient doors on the right. A red EXIT sign and a hanging "WARD 4" sign.
  - At the end, the double doors with **warm light through the portholes and under the door** (Bed 7's lamp).
  - In Phaser: a hard cut, 2.8 s, a tiny push in (zoom 1.0 to 1.04). One tube flickers now and then with a short dip, no strobe. That flicker is a separate light-only layer (`ward4-corridor-tube.png`).
- **Shot 3**: a 0.65 s fade to black, then the **existing OpeningScene starts unchanged** at its first beat: Bed 7, 3:32, then 3:33 and the separation.
- **Sound**: the opening's own rain and vent loops, loud outside, muffled inside. No new sounds.
- **Input**: not playable. There's a gate first (same "PRESS ANY KEY OR TAP / HEADPHONES ON" as the opening, needed for audio). After 1 s, a tap or key skips to the room. No save writes.
- New `src/scenes/prelude.js`, a small route in `src/main.js`, `sw.js` cache 35 with the new files, and `scripts/prelude-shots.mjs`.

## CHECKED
- Real Phaser captures at 640x360 (`node scripts/prelude-shots.mjs`), in `shots/opening-prelude/`:
  - `1-exterior.png`
  - `2-corridor.png`
  - `3-bed7.png`: the opening after the hand-off, phase `intro`, clock 3:32.
  - **`prelude.mp4`** (12.9 s, gate press to Bed 7): Chrome's screencast of the real game, encoded with the system ffmpeg. Playwright's own recorder needs a download, so I didn't install it.
  - No page errors.
- **One focused test, run once:** `npx playwright test -g "opening prelude"`, **1 passed**. It checks:
  - gate, exterior (art, rain, mist), corridor (art, tube layer);
  - the hand-off to the opening at phase `intro`, clock `32`, no control;
  - prelude gone after the hand-off, save untouched;
  - `?opening=1` alone has no prelude; no page errors.
- Not run, per the testing rules: full suite, bots, other tests.

## BLOCKED
- Nothing blocked. One honest note: the **existing Bed 7 room** in `opening.js` is still the older code-drawn room (greener, flatter). It is not the approved Ward 4 plate, so the cut from the corridor into it is a visible style step. The task said not to touch the opening.

## NEXT
Owner / ChatGPT review of the three shots and `prelude.mp4`. If approved: put the opening's room on the approved Ward 4 art (plate/shell + Bed 7 layers), so all three shots match. Then make the whole opening non-playable until Boo says RUN, and make the prelude the default first launch.
