# Ghostline — next Claude task draft (NOT A TRIGGER)

Status: READY FOR AUTHORIZED MANUAL DISPATCH ONLY.
Preparing this document must **not** start the Claude Action. The actual workflow is triggered only when `docs/claude-next-task.md` is updated on `v6-runner`; leave that file untouched until the owner explicitly authorizes the run and any usage/cost concern is resolved.

## Outcome: one genuinely modular Ward 4 prop, with visual proof

Fix exactly the **Bed 7 bedside cabinet** in the existing playable Phaser scene at `?wardlab=1`. It must become an independently drawn PNG prop over a convincingly reconstructed empty wall/floor, not a duplicate pasted over the cabinet baked into `room-plate.png`.

This is a first narrow proof of the art pipeline. **Do not tackle the bed, curtain, window, corridor, opening cinematic or other worlds in this run.**

### Read / art constraints

- Read `CLAUDE.md`, `docs/owner-notes.md`, `docs/ghostline-production-coordination.md`, `docs/ward4-art-target.md`, and `docs/story-full.md` for context; do not rewrite story or implement story beats.
- The approved visual target is `assets/reference/ward4-approved-2026-11-09.png`, upper gameplay panel only. The latest approved handoff supersedes older story decisions: THE STRETCH final boss, Boo round supernatural ghost, Milo unchanged, opening non-playable until Boo says RUN.
- Preserve existing room colors, material detail, navy-blue rainy ambience, restrained amber lighting, floor tile reflections, wall tile lines and scene scale. Base lighting remains OFF. No crosses/religious symbols.
- Preserve the approved original `assets/ward4-bed7/room-plate.png` **byte-for-byte** as a safety/reference baseline and do not redraw Milo or change his sprite sheets. Existing cabinet PNG: `assets/ward4-bed7/cabinet.png` at world x=121, y=227, dimensions 89×105, depth 2.
- No generative replacement room, no flat blue patches, no rectangles masquerading as retouch, no remote or paid assets.

### One bounded implementation

1. Inspect the existing plate, cabinet PNG, `src/scenes/wardlab.js` and its current screenshots/Playwright setup. Confirm the cabinet's exact painted footprint and overlap with lamp, wall and floor. Don't erase connected lamp or IV art.
2. Create a **new** `assets/ward4-bed7/room-shell-v1.png` at the original plate's 1065×360 resolution with only the cabinet removed and the wall/floor behind it retouched. Keep the rest of the painting the same. A repeatable, small image-processing script is acceptable if needed. If the art can't be convincingly reconstructed with available tools, **stop and report BLOCKED** instead of committing a poor fill.
3. Change only the isolated Ward Lab scene to load the new shell as its background, keep the existing extracted `cabinet.png` sprite at its approved world position, and leave the bed's current artwork and collision untouched. For visual validation, add a simple **Ward Lab debug-only** hide/show cabinet toggle, with no changes to global gameplay controls.
4. Capture actual **Phaser 640×360 screenshots** with the cabinet visible and hidden; store the files in a clear repo path (e.g. `shots/ward4-cabinet/`). The visible version must look like the original room (no double paint or misalignment); the hidden version must show plausible continuous tile/reflection texture with no cabinet ghost. These are screenshots of the real Phaser scene, **not HTML review boards**.
5. Add or update focused Playwright checks for scene load, sprite placement/depth, visual toggle and page errors; ensure no save or opening changes. Update `sw.js` cache ID and its precache list for new assets, following CLAUDE.md. Run relevant tests and, if feasible, full `npm test`, and report actual results.

### Scope / hard stops

- Allowed edits: `assets/ward4-bed7/room-shell-v1.png` (new); `src/scenes/wardlab.js`; `tests/ghostline.spec.js`; `sw.js`; `docs/claude-task-report.md`; a **small** purpose-specific script and real Phaser screenshot output if essential.
- No changes to `main`, `docs/story-full.md`, `docs/claude-next-task.md`, `.github/**`, opening, Milo/ghost/Boo assets, runner, bosses, other worlds, save format or dependencies.
- No subagents, AI testers, paid services, purchases, blind retries, broad rewrites or speculative creative changes.
- Stop within the workflow's ordinary execution limits. The GitHub job (not Claude itself) handles commit/push after checks. Report concise **DONE / CHECKED / BLOCKED / NEXT** in `docs/claude-task-report.md`.
- If visual work requires actual painting capability not available in this Claude runner, say exactly what is blocked and the smallest missing asset/action. A truthful blocker is preferable to fake progress.

### Acceptance

- Real game at `?wardlab=1` with an independently hideable cabinet, painted wall/floor behind it, correct depth and collision unchanged.
- Two screenshots from the running Phaser scene, visible and hidden.
- Exact unmodified original room plate; preserved Milo and Ward 4 look.
- Focused Playwright test result and no false claims of QA.
- No unrelated code; one bounded result only.
