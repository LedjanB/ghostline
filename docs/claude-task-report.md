# Claude Code task report: Cinematic Opening V2 visual milestone (12 Nov 2026)

Task: `docs/claude-opening-v2-visual-pass.md`. Branch `v6-runner` only, `main` untouched.
Review route: **`?opening=1&prelude=1`**. Production `?opening=1` and first launch still run the old opening, unchanged.

## DONE
**One cut on one art style:** St. Mercy exterior -> Ward 4 corridor -> **Bed 7 on the approved Ward 4 room** -> 3:33 -> the separation -> Milo lands and surfaces. Then the review cut ends on a black card. It is not playable.

**C. The Bed 7 discontinuity (the main fix).** The new `src/scenes/opening-v2.js` builds the room from the owner-approved art, not the old code-drawn room:
- **Room art:**
  - `room-plate.png` as the room, unchanged, one static whole-pixel frame (lamp, Bed 7, monitor, window).
  - `bed-front.png` (the plate's own blanket and footboard) over the boy; `near-pipes.png` in front.
- **Milo:** the real `milo-sleep.png` "lie" frame at Ward Lab's 1.5x size.
  - Head on the approved pillow, the plate's blanket over him from the waist.
  - Placement checked by composite before coding: (216, 176).
- **Same beats and times as `OpeningScene.begin`:**
  - 3:32, then "ST. MERCY. WARD 4." 3:33 at 3.4 s, power stutter at 4.6, dark at 5.22.
  - Monitor on battery at 5.65; the lamp stutters and stays at 6.15.
  - At 7.2 the separation (same 2.0/1.0/0.9/1.3 s phases, the ghost rows of the sleep sheet), then the approved `op_wake` acting.
- **Lights-off:** the ward darkens, the ceiling tubes go dead. The bedside lamp, the window (St. Mercy's own tower is in it) and the monitor are added back as light.
- **Props:**
  - The monitor's ECG sweeps on each beep.
  - A new small wall clock (`room-clock.png`: 3:32 / 3:33 / dead) above the monitor.
  - Rain runs on the window.
- **Spirit:** lands beside the bed in front of the window: the approved composition.

**A. The shake.**
- All camera motion is gone from the prelude. Every shot is a fixed, whole-pixel camera at zoom 1 or exactly 2, joined by hard cuts. The mist moves in whole pixels.
- New capture (`scripts/prelude-shots.mjs`): Phaser's own frame loop is paused and the real game is stepped by exactly 1/30 s per frame (`game.step`). Every frame is screenshotted and encoded at a constant 30 fps.

**B. Establishing shots.**
- **Exterior:** three static framings with hard cuts. The tower clock close at 3:33 (1.7 s), the wide dark hospital in the rain (2.6 s), then the single warm Bed 7 window close (1.9 s).
- **Corridor:** static now.
  - Ward 4 leads the eye: stronger warm spill from its portholes, the right leaf left ajar, a long warm reflection.
  - EXIT dimmed; the tube overhead is dying (dim, a rare short struggle back to light, no strobe).
  - The near floor falls into shadow; one abandoned item: an empty wheelchair by the wall, back-lit.

## CHECKED
- **Video:** `shots/opening-v2/opening-v2.mp4` is 32.3 s, 970 frames at an exact 30 fps, from the real game, from the gate press to the end card.
- **Stills:** `shots/opening-v2/`, all at 640x360 from the same run, all inspected:
  - `1-clock`, `2-exterior`, `3-window`, `4-corridor`
  - `5-bed7-332` (approved room, clock 3:32)
  - `6-separation` (his spirit sitting up out of the body, lights out)
  - `7-landed` (beside the bed)
  - No page errors.
- **Shake evidence:**
  - I counted repeated frames with ffmpeg `mpdecimate`. The old screencast video (`shots/opening-prelude/prelude.mp4`) repeated frames 8 times **during the moving exterior pan** (0.1 to 4.1 s) and in clusters at the cuts. That is uneven capture cadence, seen exactly when the camera was moving.
  - The new video repeats frames only where nothing moves: the static corridor and the black end card.
  - The old live scene also panned by fractions of a pixel (20 by 40 px over 4.6 s). At 640x360 that steps the whole picture 1 px at uneven moments. That code is gone, so the live game has no camera motion that could judder.
  - I could not watch a physical screen here, so live smoothness is by construction, not eyeballed.
- **One focused Playwright test,** `npx playwright test -g "opening V2 review"`. First run: 1 failed on `-0` versus `0` in my whole-pixel camera check. After that one-line fix: **1 passed**. It checks:
  - the exterior framings and the corridor are whole-pixel at zoom 2/1/2 and 1;
  - the hand-off to `openingv2` with the plate, the bed-front layer, `milo2_sleep` at 1.5x at (216, 176), clock 3:32, camera at 80;
  - 3:33, the rise, the landing at (548, 335) at 1.5x;
  - save untouched; `?opening=1` still runs the old opening with no prelude or V2; no page errors.
- Not run, per the testing rules: full suite, bots, other tests.

## BLOCKED
- Nothing blocked. Honest limits:
  - The sleeping boy uses the sheet's "lie" frame. Its old blanket frames (breath, twitch) don't match the approved bed, so he doesn't breathe yet. The "still alive" beat is the monitor's loud beep.
  - The 2x close-ups are the same paintings at 2x (crisp, but bigger pixels).
  - The old production opening is untouched, as asked.

## NEXT
Owner / ChatGPT review of `opening-v2.mp4` and the stills. If approved: carry the rest of the opening on this room in the same V2 scene, fully non-playable until Boo says RUN, then hand off to the first chase. The rest is discovery, the Ghostline, THE STRETCH's shadow, and round ghost Boo. Also two sleep frames redrawn for the approved bed (breath, twitch).
