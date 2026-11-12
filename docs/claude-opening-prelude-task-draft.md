# Ghostline: rainy St. Mercy opening prelude
STATUS: READY FOR MANUAL CLAUDE DISPATCH. THIS FILE DOES NOT TRIGGER ACTIONS.

## Intent
Deliver a *real, visual* Phaser 4 cinematic prelude for review, using the same artistic standard as approved Ward 4. This is the owner's new idea: **St. Mercy exterior in rain -> brief empty Ward 4 corridor -> Milo in Bed 7, 3:32 to 3:33**. First show atmosphere and place, then the separation. No story rewrite. Full opening eventually stays non-playable until Boo says RUN; that larger input redesign is **not** part of this one task.

Read: `CLAUDE.md`, `docs/owner-notes.md`, `docs/ghostline-production-coordination.md`, `docs/ward4-art-target.md`, `docs/story-full.md`. Inspect existing `src/scenes/opening.js`, `src/main.js` and `assets/ward4-bed7/room-plate.png` before coding. Newer owner approvals supersede older script/story where conflicting: THE STRETCH is final boss; Boo is a small, round ghost, not an elderly human figure; Milo unchanged. Only work on `v6-runner`. Never touch `main`.

## Art direction (the main deliverable)
- Create a distinct original *painted* exterior view of **St. Mercy Hospital**, rain at night. This is fictional Vigil, not a modern generic skyscraper. Institutional, subdued, slightly old, architectural detail and a few dim windows. A single warm ward light contrasts the navy rain; no church crosses or other religious symbols. It should look like it belongs in the approved Ward 4 plate, not a low-detail greybox, cartoon block art, AI collage or stock photo.
- Next: a short, quiet hospital corridor shot with the same materials and lighting language, looking toward Ward 4. It can be a static composition with a tiny camera drift. Prefer a clean hard cut from exterior to corridor rather than an expensive simulated fly-through. If a convincing corridor cannot be finished inside this task, **ship only the exterior and record the corridor as BLOCKED/NEXT**; do not replace it with bad placeholder art.
- End on a cut to the *existing* Bed 7 room composition (do not repaint, scale or change Milo). The current spirit-separation chronology and details stay intact.
- Use actual reusable PNG image files (for example `assets/opening-prelude/st-mercy-exterior.png` and `ward4-corridor.png`). Subtle rain may be a transparent Phaser layer. No giant code-drawn background or separate HTML viewer. Optimize for native 640×360 and iPhone.
- Suggested pacing: exterior ~4–5 seconds, corridor ~2–3 seconds, then existing room. The exact timing follows the shot's quality; no lengthy title cards, exposition, camera zoom gimmicks or flashing lights. The town's hospital clock was already stopped at 3:33 according to the original story; don't accidentally imply it only stopped tonight.

## Engineering: keep this reviewable
1. Implement the two shot sequence in the **actual Phaser app**, gated behind a preview query such as `?opening=1&prelude=1`, so production's existing `?opening=1` and saved games remain untouched until artistic approval. A small PreludeScene that transitions into the unchanged OpeningScene is acceptable. This is NOT a standalone HTML workbench.
2. Ambient rain motion must be anchored correctly to the scene, not float with HUD. Keep light baseline dark, no global glow. If available, use existing audio; do not add dependencies or paid sounds.
3. After the prelude, hand off to the real existing opening at its normal first beat. Do not alter Milo sprites, the existing script's discovery/shadow/Boo sequences, global input, main gameplay, saves or the boss scenes. We know current opening still permits early interaction; fix that in a separately reviewed milestone once the visual sequence is approved.
4. Save **three real Phaser screenshots**: exterior, corridor (if completed), and first frame of Bed 7 after transition. If feasible, also a single short *real-game* video. Screen output only; no standalone HTML.
5. Run **one focused Playwright check** for scene load, transition, no page errors, unaffected saved state. Do not rerun passing tests, debug unrelated Milo Lab failures, run full suite or bots for this isolated art task. Follow the lean testing rules in `CLAUDE.md`.
6. Cache-bump `sw.js` and add any new files to the cache list. Update `docs/claude-task-report.md` with **DONE / CHECKED / BLOCKED / NEXT**, including screenshots and exact tests actually executed.

## Scope & stop condition
- Allowed: new prelude-specific Phaser scene/module and PNGs, small conditional route in `src/main.js`, scene-specific screenshot script, focused test, `sw.js`, task report.
- Forbidden: workflow files, `docs/claude-next-task.md`, `docs/story-full.md`, `main`, Milo/Boo assets, existing opening implementation, runner, bosses, save format, dependencies, unrelated refactors.
- No subagents, AI testers, external paid tools, token-intensive test loops or random retry cycles. Stop after one compelling visual result with evidence, or report a blocker instead of pretending to have finished it.
- If this is run manually in Claude Code, commit and push only `v6-runner` when the environment and user permission allow. GitHub Actions, if explicitly activated separately, handles its own commit after checks.

## Acceptance
The reviewer can watch the rainy exterior and quiet corridor as real Phaser shots, then naturally reach the existing Bed 7 opening, with an art style consistent with the approved Ward 4. Milo, Boo, the story and existing gameplay aren't redesigned. Single focused test outcome plus actual screenshots are reported.
