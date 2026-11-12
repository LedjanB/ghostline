# Claude Code task report: Ward 4 modular bedside cabinet (12 Nov 2026)

Task: `docs/claude-ward4-cabinet-task-draft.md`. Branch `v6-runner` only, `main` untouched.

## DONE
- **New `assets/ward4-bed7/room-shell-v1.png`** (1065x360): the plate with only Bed 7's cabinet (and the mug on it) painted out. Made by `scripts/ward4-room-shell.py` (deterministic, reads the plate, never writes it). 7,241 px repainted, all inside the cabinet's footprint plus 2 thin rects (below). Every other pixel is identical to the plate (the script asserts it).
  - Wall: lamp light/shade solved smoothly from the wall around the hole, plus the plate's own grout, rail, baseboard and floor-seam detail continued from the clean wall strip left of the IV pole. Vertical grout continued at the painting's tile pitch.
  - Bed 7's hidden head end: the headboard post continued down to the floor (its own painted profile, fading out of the lamp light), the shaded mattress end, frame rail and under-bed dark continued from the columns right of the cabinet, and a dim copy of the bed's own caster under the post.
- **`?wardlab=1`** now draws the shell as its background. `cabinet.png` unchanged at world 121,227, depth 2. Bed collision, Milo, the opening, saves and global controls are untouched.
- **Debug-only toggle**: K or the on-screen `[ CABINET ]` button (`setCabinetVisible()`). Ward Lab only, nothing added to `input.js`.
- Two things the old extractions got wrong, fixed without editing them:
  1. `cabinet.png` missed the mug's top-left corner (9x11) and the feet's last 2 rows (83x2). Those rects come from the untouched `room-plate.png` as texture frames (`CABINET_EXTRA`), shown and hidden with the cabinet.
  2. `bed-body.png`'s first 15 columns (world x 192-206) have the cabinet's right edge baked in. Without a fix, hiding the cabinet left a cabinet strip on screen. The bed body is now drawn cropped from column 15 (file, position, size, depth unchanged). The shell carries that strip.
- G (ghost) and K now act on the key's down event. Polling `JustDown` missed a quick tap (down and up in one frame): the existing `wardlab boots ...` test failed 3 of 4 runs with the extra key.
- `sw.js`: cache `ghostline-v6-runner-34`, shell added to the precache list.
- `scripts/ward4-cabinet-shots.mjs`: real Phaser screenshots at 640x360.

## CHECKED
- **Screenshots from the running game** (`node scripts/ward4-cabinet-shots.mjs`, Milo on Bed 7, scene paused so all are the same frame), in `shots/ward4-cabinet/`:
  - `cabinet-visible.png`: shell + cabinet.
  - `cabinet-hidden.png`: cabinet hidden.
  - `reference-plate.png`: the same frame drawn the old way (plate background, uncropped bed body).
  - `shell-zoom.png`: 4x plate vs shell (from the script, not the game).
- Pixel diff: **visible vs old rendering = 0 px different**. Visible vs hidden = 7,241 px, all inside x 124-206, y 229-328.
- `room-plate.png` byte-for-byte unchanged (`git diff` empty, md5 c96741cc...).
- New Playwright test `ward lab: Bed 7 cabinet is a separate prop over room-shell-v1 ...`:
  - checks background, positions and depths, the 2 extra rects and the bed-body crop;
  - shell + cabinet + extras = plate with **0 px difference**; the shell differs from the plate only inside the prop's footprint;
  - K hides and shows the whole prop; the bed still blocks a walk with the cabinet hidden; `WARD_GEOM` unchanged;
  - save untouched, no page errors.
- Ward lab tests (both spec files) x3 each: **18 passed**.
- Full `npm test` (Chrome 153, swiftshader): **49 passed, 1 failed**. The failure is `milo lab: ?milolab=1 opens alone ...` (line 1281, a keyboard race in the milo lab). It's pre-existing: on the original code without my changes it failed 2 of 4 runs (mine: 3 of 4). Milo lab is out of this task's scope, so it isn't touched.
- Bots not run: runner and bosses weren't touched.

## BLOCKED / honest limits
- **The lamp floats when the cabinet is hidden.** The task says don't erase the lamp, so its base, pole and shade stay in the shell. The cabinet in front of it is the normal state; this only shows in the debug view.
- The bed's head post, mattress end and caster behind the cabinet were never painted. They are reconstructed from the painting's own pixels: plausible at game size, not artist work.
- The plate's soft cabinet shade on the wall just left of it (x 116-123) is baked outside the sprite. It stays in the hidden view as a slightly darker band by the IV pole. Small.
- Nothing else blocked.

## NEXT
ChatGPT / Ledjan review of `shots/ward4-cabinet/cabinet-hidden.png` and the toggle in `?wardlab=1`. If approved, the same pipeline for the **lamp** as its own prop (it belongs on the cabinet). Then re-extract `cabinet.png` with an exact mask so `CABINET_EXTRA` can go.
