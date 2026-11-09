# Claude Code task report: Ward 4 movement lab V1 (9 Nov 2026)

Branch `v6-runner` only. `main` untouched.

## DONE
1. Fetched origin and fast-forwarded `v6-runner` to `1daa186` (coordination doc + workflow). No conflict: the incoming commits didn't touch the Ward 4 files.
2. Preserved the uncommitted Ward 4 work before anything else: a scratchpad copy + patch and a local git ref `refs/backup/ward4-wip-2026-11-09`. Then committed it **unchanged** as `4d834c7` so its origin is reviewable.
   - The approved reference **is** in the repo now: `assets/reference/ward4-approved-2026-11-09.png` (the coordination doc thought it might be missing).
3. Ward 4 movement lab V1 (`src/scenes/wardlab.js`, `?wardlab=1`), see `docs/ward4-art-target.md` "Movement V1":
   - Reused the milo lab's movement model (coyote, buffer, takeoff crouch, cut jump, 120 Hz), scaled to Milo's 1.5x size so the walk/run cycle tempo matches the actual speed (before: walk 84 px/s for a cycle drawn for 105 at this scale, so the feet slid).
   - Added walk_start / stop / pivot, rise/apex/fall, land with the approved frames.
   - Bed: solid sides, walkable top; no walking in place against it (found in a screenshot, fixed).
   - Touch thumb ring, device-aware control hint, debug line (anim, frame, m/s).
   - Fixed: the scene overwrote Phaser's `this.time` clock plugin (renamed `clockT`).
   - `sw.js`: cache 31; no longer caches `tests/`, `docs/` and the 1.4 MB reference PNG on players' phones.

## CHECKED
- `tests/wardlab.spec.js`, 4 tests: boot + ghost; walk/run cycle speed 0.95-1.05 at full walk, run reached, stops to idle; bed blocks without treading, jump lands on the top (air, jump_start and land seen); touch drag walk -> run -> idle, right-half tap jumps.
- Full suite `npx playwright test`: **48 passed** (2 workers, 5.9 min).
- Real browser screenshots (headless Chromium, 640x360): feet on the floor and on the mattress, walk frames in step.
- Stress test with 3 parallel workers: earlier versions failed because this PC renders 3 headless Chromes slowly (the game advanced about 6 px in 5 s). The tests now poll states and record short ones in the page. Not rerun at 3 workers after the last change.

## BLOCKED / NOT DONE
- Bots (`scripts/bot.mjs`) not run: the runner, bosses and opening were not changed.
- Gamepad is in the code but has no automated test and no real-pad check.
- The 64x128 CC0 motion template and newer Ward 4 ZIPs from ChatGPT are not in the repo; not used. Milo frames are the existing approved sheets only.
- The owner hasn't checked it on an iPhone yet.

## NEXT (one step)
Owner plays `?wardlab=1` on PC and iPhone and judges the movement feel and Milo's size. Then the art task from `docs/ward4-art-target.md`: a clean reusable Bed 7 bed/cabinet set + an empty room shell to replace the single plate.
