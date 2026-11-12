# GHOSTLINE: Cinematic Opening V2 — ONE COHESIVE VISUAL MILESTONE
Status: READY FOR MANUAL CLAUDE CODE SESSION. Do **not** change `docs/claude-next-task.md`; that would trigger a separate paid GitHub Action. This document supersedes the narrower motion-only task in `docs/opening-prelude-creative-review-2026-11-12.md` as our next development assignment.

## Owner's actual feedback, not a task to pass tests
St. Mercy exterior and corridor are "not bad but can be much much better." The current video **shakes/judders strangely**. A technically green prelude that still looks like three different games is **not success**. The owner wants real visual and playable results, not new HTML workbenches, test loops, dozens of microfixes or a giant technical report.

## The deliverable
**One visually cohesive, smooth, cinematic review cut, from rainy St. Mercy -> Ward 4 corridor -> approved Bed 7 room -> the start of Milo's 3:33 separation, inside the real Phaser game.** This is the next *meaningful* milestone, not a collection of minor improvements. One short video that a player could watch without the art changing style halfway through, plus 3-4 actual game screenshots.

**Only one key creative commitment this pass:** make the first room reveal *actually look like the owner-approved Ward 4 artwork*, not the old greener/flat code-drawn room. Avoid an obvious switch back to old art after the reveal. If continuing the entire old opening on the approved plate requires too much risky rework, isolate a **genuine opening V2 review route** ending after the first separation beat, leaving the old production opening unchanged until this look is approved. Do not fake the reveal by flashing an approved image before returning to old art.

## Context to read first
- `CLAUDE.md`, `docs/owner-notes.md`, `docs/ghostline-production-coordination.md`
- `docs/story-full.md` (preserve story, lore, and 3:33 hospital history); `docs/ward4-art-target.md`; `docs/opening-prelude-creative-review-2026-11-12.md`
- Relevant portions only of `src/scenes/prelude.js`, `src/scenes/opening.js`, `src/opening-art.js`, `src/milo-sprite.js`, and their screenshots/scripts
- Approved upper gameplay panel: `assets/reference/ward4-approved-2026-11-09.png`; current room source: `assets/ward4-bed7/room-plate.png` and extracted layers in `assets/ward4-bed7/`

The newer approvals override the older full story where different: THE STRETCH is the final boss, Boo is a **small round supernatural ghost** (not the current elderly-human look), Milo appearance and Ward 4 source are fixed, and the eventual **whole opening is non-playable until Boo says RUN**. Do not alter the old intro story or mistakenly ship current playable gates as approved final. No crosses/religious symbols.

## Work, in priority order

### A. Eliminate the unsettling shake (non-negotiable)
- First determine whether the jitter exists **inside the live Phaser browser** or only in the CDP/FFmpeg video. Current `src/scenes/prelude.js` uses fractional camera scroll for exterior and continuously changing zoom 1.00 to 1.04 for corridor; `scripts/prelude-shots.mjs` writes Chrome screencast frames with irregular timestamps and converts to 30 fps. Both are candidates.
- Use steady shots or native-pixel-aligned movement; **remove the tiny fractional corridor zoom** if it shimmers. No random shake, no global soft blur, no fake smoothing.
- Capture at a consistent frame rate, or explicitly report if only the capture still judders. Do not claim one confirmed cause without evidence. Minimize capture code changes; do not build a testing infrastructure project.

### B. Make the establishing shots worthy of the approved room
- Keep and meaningfully improve the existing exterior and corridor, *not* redraw them generically. Give the exterior one clear visual focus: the 3:33 clock and then the **single warm occupied window** of the dark hospital. Make the rainy layers and foreground depth feel cinematic while respecting performance.
- Corridor should have visual direction toward Ward 4 and subtle lived-in atmosphere, not merely symmetrical tiled emptiness or a red EXIT sign stealing focus. A specific meaningful staging/detail improvement is better than dozens of props.
- Use the exact cool navy / wet blue / restrained amber color treatment shared with Ward 4. Static framing and one strong hard cut often beat slow simulated zooms. No 3D fly-through, no new engine, no paid art service.

### C. Fix the huge art-style discontinuity at Bed 7
- Current `shots/opening-prelude/3-bed7.png` is the **old code-drawn room**. The owner approved the rich `assets/ward4-bed7/room-plate.png` visual target and Milo's existing raster sprite appearance. This is the major quality gap.
- Compose the actual Bed 7 opening visual with that **approved room art and actual sleeping/ghost Milo sprites** at believable approved scale, clock/rain/light motivated by the scene. Show the room at 3:32 and the beginning of the established 3:33 separation using the real opening timeline where possible.
- **Preserve the approved image's composition, character design, ambiance and lighting OFF baseline.** Do not merely replace the background without checking Milo's correct positions, sleep/bed alignment, light, wrist/Ghostline anchors, or visual depth. The cinematic and eventual gameplay should share art.
- Keep this on the **isolated V2 review route** (`?opening=1&prelude=1` plus an explicit V2 flag if necessary), with the production first-launch opening unchanged. Limit this task to the through-separation opening beat. Do not overhaul the encounter/Boo/final chase in the same run; those are the next major milestone.

## Acceptance (be strict)
1. Real Phaser recording that includes **exterior, corridor, approved-looking Bed 7 and start of the separation** and does not visibly jump to a mismatched old room. One reliable video, not a report that a scene booted.
2. Three or four true Phaser 640×360 frames from this sequence (exterior, corridor, 3:32 room, 3:33 separation); inspect the *pictures*, not just text assertions. If the video/capture issue remains, report exactly whether live game is smooth.
3. Approved original room plate and Milo assets remain unchanged; story, Boo, THE STRETCH, world lore, runner and saves not rewritten. The first-launch route on `main` and existing production route on `v6-runner` remain unchanged. Only `v6-runner` can be edited.
4. **Lean QA:** one focused Playwright test for the V2 route transition + page errors; one end-to-end video capture and a small set of stills. Re-run only after a relevant fix. No full test suite, bots, subagents, repeated flaky test debugging, new dependencies or paid services for this visual task.
5. Update `sw.js` version and cache only for actual asset/code changes; concise `docs/claude-task-report.md` with DONE, CHECKED, BLOCKED, NEXT.

## Hard budget / stop
This should produce one **substantial visible improvement**, not ten tiny incremental commits or hours chasing unrelated tests. If the genuine approved-room transition cannot be done well within a bounded session, stop at a usable, well-evidenced visual milestone, explain the exact blocker and next step, **do not** fake a seamless result with mismatched art. Save source/screenshot progress to `v6-runner` only, after permitted checks. No automatic follow-on tasks.

## After the owner approves this VISUAL milestone
Next *separate* milestone: reuse the now-unified room in a complete **non-playable** awakening/discovery/shadow/Boo sequence until Boo says RUN, with a direct handoff to the first exciting chase. Then meaningful exploration and boss fights. No cabinet/lamp micro-polish unless it is highly visible and damaging the cinematic.
