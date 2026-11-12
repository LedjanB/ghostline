# Ghostline — St. Mercy opening prelude: creative review and correction brief
Date: 2026-11-12. Reviewed commit `2d7600ec7ab3f6578351d7303cec2f5dc21e41e1`, actual Phaser screenshots and relevant scene/capture code.

**Owner assessment:** good first pass, can be **much much better**; the preview video shakes/judders strangely. This is **not approved final art**.

## What is good
- Real Phaser exterior and corridor scenes, not disconnected HTML mockups; St. Mercy reads as a fictional night hospital with rain and one warm window.
- Corridor has sound basic one-point perspective and destination doors.
- Existing Milo and story not rewritten; implementation is isolated under `?opening=1&prelude=1` and `main` untouched.

## Problems, in order
1. **Video judder/shimmer.** The scene uses fractional camera scroll on the exterior (`x44/y0 -> x64/y40`) and fractional zoom on the corridor (`1.00 -> 1.04`, with `centerOn` each frame) at native 640x360. Those can cause pixel-edge shimmer. The capture script uses Chrome CDP `Page.screencastFrame`, variable frame timestamps and FFmpeg concat -> `fps=30`, which can introduce frame repeats, uneven cadence and apparent shaking. **The original MP4 wasn't available to ChatGPT for frame-by-frame inspection; these are technical suspects, not a definitive diagnosis.** Verify native-browser motion separately from recording artifacts.
2. **Visual continuity fails at Bed 7.** The current `opening.js` still uses older code-painted ward art; screenshot `shots/opening-prelude/3-bed7.png` looks flatter and greener than the much richer approved `assets/reference/ward4-approved-2026-11-09.png` and current plate `assets/ward4-bed7/room-plate.png`. The transition currently feels like three different games. This is the largest artistic issue, but solving it properly is a separate meaningful milestone.
3. **Exterior composition is too frontal/symmetrical.** It is a solid establishing illustration, but not yet a striking horror-film composition. The camera currently pans from the clock toward the street rather than building focus on the one warm occupied ward window. Improve shot purpose, foreground-to-background depth, and timing **without** broad re-generation or changing the approved Ward 4 look.
4. **Corridor is tidy and sterile.** Centered vanishing point, two warm portholes, a red EXIT sign drawing attention away from Ward 4, no characterful detail. Need one purposeful composition change (e.g., stronger light spill and foreground shadow, one abandoned hospital item) rather than clutter. Avoid camera push/continuous resampling if it visibly jitters.

## NEXT CLAUDE TASK: polish cinematic motion + scene composition, then stop
This is one bounded task, not an instruction to trigger paid automation. Owner will manually dispatch if desired.

1. Read `CLAUDE.md`, `docs/owner-notes.md`, this review, `docs/claude-opening-prelude-task-draft.md`, `src/scenes/prelude.js`, and `scripts/prelude-shots.mjs`. Work only on `v6-runner`.
2. **Diagnose the shake efficiently.** Compare live-browser rendering with the recorded MP4. Isolate camera fractional scroll/zoom vs variable screencast capture cadence. Don't assert the root cause without comparison. Prefer static/steady composition or gently **integer-aligned** panning at native resolution; no continuous fractional corridor zoom, fake shake, or blur over the problem.
3. Make the exterior shot guide the eye from St. Mercy's stopped 3:33 tower clock to the single warm ward window, with restrained rainy foreground depth. Make the corridor a distinct quiet moment with a clear lit Ward 4 destination. Keep art and implementation changes minimal and meaningful; don't redraw all assets or invent a new engine.
4. Deliver **one short smooth, accurately timed recording** of the running Phaser prelude. If browser screencast capture remains uneven, use a proper stable-framerate capture path or honestly report capture limitation; don't call an inconsistent recording proof of game jitter.
5. Capture two useful actual Phaser stills at 640x360. Run **one focused Playwright check** for loading/transitions/page errors. No full suite, bots, test stress loops, unrelated keyboard debugging, subagents or paid external services.
6. Stop. Report concise DONE / CHECKED / BLOCKED / NEXT. Preserve `main`, all approved Milo/Boo art, story/full lore, original Ward 4 plate, existing Bed 7 opening scene, saves and opening gating decisions. Update `sw.js` when changing the game/files.

## Later milestone (not bundled into the motion task)
Unify the **actual Bed 7 opening scene** with the approved Ward 4 image/layer art, not by pasting an unrelated room over Milo but by reusing the existing room and real sleeping/ghost Milo while preserving wrist/thread and cinematic beats. Then make the full opening non-playable until Boo says RUN and the transition to gameplay is seamless. Owner-approved plot: exterior rain -> corridor -> Bed 7 -> separation -> THE STRETCH shadow -> round ghost Boo -> RUN. **THE STRETCH is the final boss.**

Do not reopen the cabinet/lamp micro-polish unless a visible issue materially affects the cinematic. No standalone HTML review boards.
