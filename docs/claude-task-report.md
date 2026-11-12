# Claude Code task report: Opening V4, a directed cinematic (12 Nov 2026)

Task: `docs/claude-opening-v4-directed-cinematic.md`. Branch `v6-runner` only, `main` untouched.
Review route: **`?opening=1&prelude=1`**. Production `?opening=1` and first launch are unchanged.

## DONE
One continuous 41 s cut. The art is the approved images and approved Milo only; nothing new was painted. The action comes from small strips cut from that art (`scripts/opening-v4-layers.py`, `assets/opening-v4/`). Cameras are fixed on whole pixels (zoom 1, or exactly 2 for inserts).

| time | shot | what happens | sound |
|---|---|---|---|
| 0.0 | St. Mercy, wide | fades up in the storm | heavy rain |
| 1.2 | | **someone crosses behind the lit entrance glass** (a soft shadow made from the concept's own lit pixels) | |
| 3.3 | | **a shadow passes in the warmest ward window** | |
| 5.4 | hard cut: corridor | | rain drops to muffled, the vent takes over |
| 5.9 | | **someone crosses behind the amber door glass** | |
| 8.0 | | **their light goes out**; its warm reflection leaves the wet floor; the overhead tube struggles once | a latch |
| 9.6 | | | **a heart monitor beep, before we see it** |
| 10.2 | hard cut: Bed 7, wide (approved plate) | 3:32; rain on the window; the ECG sweeps | the beat carries over the cut |
| 12.6 | close (2x) on Milo | **asleep, breathing** (chest and arm rise: the approved "lie" frame, pixels moved 1 px, no redraw); **his fingers twitch** | a whisper of sheet |
| 16.8 | close (2x) on the wall clock + monitor | 3:32 ... **3:33, and on that frame the power drops.** The clock stays lit at 3:33, frozen. | flip + power fail; **the vent dies, the beat stops: silence** |
| 19.1 | wide, dark | only lamp, window, rain; the monitor finds its battery | chirp, **then his heartbeat returns** |
| 21.6 | | **his spirit separates**: the approved poses and timing, out of the body, sits up, stands, drifts over the footboard. Feet on the floor at the foot of Bed 7, so he and his body share the frame. | |
| 26.8 | | he surfaces and looks around (approved `op_wake`) | |
| 30.7 | close (2x) insert | **he looks at his hands; they shake** (approved `op_realize`) | his breath |
| 33.6 | match cut wide, on his turn | **he turns to the bed: his own body, still breathing. Shock. Hold.** | the monitor beat |
| 37.4 to 39.6 | | slow fade (isolated demo end; no card, no invented dialogue) | |

Code: `src/scenes/prelude.js` (exterior + corridor) and `src/scenes/opening-v2.js` (Bed 7 V4, same scene key). The sound bed is handed across the room cut, and Bed 7's assets preload in the prelude so that cut is a straight cut. `sw.js` cache 38.

## CHECKED
- **Video:** `shots/opening-v4/opening-v4.mp4`, 41.1 s, 1,234 frames at an exact 30 fps. The real game is stepped 1/30 s per frame and screenshotted; no page errors.
- **Pace check:** I reviewed the whole run as a 1.5 s contact sheet and tightened one soft spot, about 5 s of small acting in a wide after the landing (the hand-look now starts 1.4 s sooner).
- **Action stills** in `shots/opening-v4/`:
  - `1-someone-at-the-entrance`, `2-corridor-door-shadow`, `3-asleep-breathing-twitch`, `4-333-power-drops`
  - `5-separation`, `6-his-hands`, `7-his-living-body`
- **One focused test, run once: 1 passed** (`npx playwright test -g "opening V4 review"`). It checks:
  - exterior concept 1:1 with a fixed camera, and the entrance figure plays;
  - the corridor door's light-out frame;
  - the cut to Bed 7 with the approved plate and the sleeping Milo at 1.5x, 3:32;
  - breathing; 3:33 stops the heartbeat, then the battery brings it back;
  - landing at (488, 335), the realization, the end;
  - save untouched; `?opening=1` is still the old opening; no errors.
- Not run, per the brief: full suite, bots.

## BLOCKED / honest limits
- The figures behind the glass are soft shadows, not characters. That is how back-lit frosted glass reads, and it avoided drawing new people.
- The shock frames are the approved realization acting, which faces more toward the camera than the bed. The relationship reads through staging (him at the foot of the bed, the body breathing in the same frame), not his eyeline.
- Sound uses only the existing `opening-audio.js` synth. There is no traffic bed; it reuses rain, vent, latch, beep, breath and rise.

## NEXT
Owner review with sound on. If it passes the gate ("a living boy, something impossible at 3:33, he is afraid"), extend the same scene: he touches his body, THE STRETCH's shadow, Boo's rescue, RUN.
