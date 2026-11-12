# Claude Code task report: RUN -> control escape proof (12 Nov 2026)

Task: `docs/next-milestone-run-handoff.md`. Branch `v6-runner` only, `main` untouched.
Preview: **`?escape=1`** (isolated). Opening V3 (`?opening=1&prelude=1`), the production opening and the runner are untouched.

## DONE
**A playable escape in the approved Ward 4 room, with the approved ghost Milo at the same size (1.5x).**
- **Reused movement, nothing rebuilt.** `src/scenes/escape.js` extends `WardLabScene`: same room layers, same keyboard/gamepad/touch input, same fixed 120 Hz `tick()` (coyote, buffer, cut jump), same `animate()`.
- **The only Ward Lab change:** its constructor takes a scene key, and `tick()` checks a list of solid beds (`this.solids`, default `[BED]`), so Bed 8 can be solid too. Ward Lab's own behaviour is unchanged.
- **What happens:**
  1. **0 to 1.6 s, not playable:** Milo at the foot of Bed 7, facing his body. THE STRETCH's **shadow only** rises on the wall behind the bed and the lamp gutters. It is the runner's own `stretch_walk` silhouette filled black, softened with offset copies; no body, no face. Input is ignored.
  2. **RUN:** Boo's lantern flares beyond the exit door, the door swings open, "BOO / RUN!" from off screen, with lantern flare, keys and door sounds. No Boo sprite is invented. **Control is handed over on that frame:** no menu, no fade, no press-to-start. A one-line control hint fades out by itself.
  3. **Chase:**
     - Any direction held is a run. The shadow follows along the wall, slow off the mark, then faster than a walk but slower than his run.
     - **Stall and it has you** (about 2.3 s). The presence sound swells as it closes.
  4. **The challenge:** as he passes the curtain, the shadow's **arm sweeps the floor right into the doorway**.
     - The tell: the floor darkens and a low lunge sound plays. The arm is a dark shadow with a thin red edge (red = it hurts in this game).
     - Be off the floor until it passes: **up on Bed 8** is the safe place. A quick hop over Bed 8 lands him on its floor and loses.
  5. **Caught:** fear frame, grip sound, short text ("IT HAS YOU. AGAIN." / "THE FLOOR WAS ITS. GET OFF IT."), then **an instant reset at RUN** (0.7 s, no menu).
  6. **Exit:** once his whole body is inside the open doorway, he goes into Boo's light, fade to black, "OUT OF WARD 4. next: the corridor (escape proof ends here)".
- **Camera** follows on whole pixels only (no shimmer); rain is on the window; no saves.
- `src/main.js` adds the `?escape=1` route; `sw.js` cache 38.

## CHECKED
- **Recording:** `shots/escape/escape.mp4`, 9.7 s, the real game at an exact 30 fps (stepped 1/30 s per frame), played with **real key events**.
  - Attempt 1 hops Bed 8 and the arm takes him; instant reset at RUN.
  - Attempt 2 climbs Bed 8, waits for the arm, runs through the door.
- **Stills:** `1-threat`, `2-run`, `3-the-arm`, `4-caught`, `5-on-bed-8`, `6-through-the-door`.
- **Tuning found by playing it with a script:**
  - The first sweep was too late, so a straight dash ignored it.
  - A long held jump over Bed 8 landed beyond the arm, so the arm now reaches the doorway.
  - The wall shadow never moved, a real bug, fixed.
  - Phaser's blur filter made the shadow vanish, so it was replaced with offset copies.
- **One focused test, run once: 1 passed** (`npx playwright test -g "escape proof"`). Keyboard throughout:
  - no movement before RUN;
  - stalling gets caught, then reset at RUN with no menu;
  - Bed 8, the arm passes, through the door;
  - save untouched, no page errors.
- **Not verified:** touch and gamepad. They come from the reused Ward Lab code but weren't exercised here. Full suite and bots not run (the brief says not to); Ward Lab's own tests weren't re-run after the `tick()` change (same behaviour with `[BED]`).

## BLOCKED / honest limits
- **Short:** a clean escape is about 4 s of play after RUN; with one failure the loop is about 10 s. The room is 1,065 px and Milo runs at 262 px/s. Extending it honestly needs the side-on corridor art (the next milestone), not padding.
- **Boo is only a voice and a light,** as the brief says.
- **THE STRETCH's shadow** is the runner's pixel silhouette, softened. A painted shadow pass would match the plate better.

## NEXT
Owner plays `?escape=1`. If it feels right: the side-on playable corridor from modular art matching the approved corridor concept, then a ~30 s chase.
