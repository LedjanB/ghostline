# GHOSTLINE — CURRENT PRODUCTION PLAN (13 NOV 2026)
**Source of truth for what to do NEXT.** This replaces the old “immediate bounded task” section further below, which is retained only as historical context. No automatic Claude dispatch. Always work on `v6-runner`, never `main`.

## The game we are producing
A **cinematic 2D narrative action-adventure**, not a pure endless runner. Primary promise: beautiful authored environments, coherent art/characters, memorable story beats and atmosphere; secondary but essential: responsive movement, satisfying short chases, meaningful exploration and bosses. The eight-world Vigil story, all character backstories and journal entries remain in `docs/story-full.md`. Newer owner approvals override conflicting older story details: THE STRETCH final boss; Boo a small round supernatural ghost with janitor cap, keys and lantern; approved teen Milo; complete opening non-playable until Boo says RUN; no crosses/religious symbols. Do **not** rewrite story or replace approved art.

## State of play (verified on v6-runner, 13 Nov)
- **Approved visual baselines:** `assets/reference/ward4-approved-2026-11-09.png` (upper gameplay panel only, Milo + Ward 4); `assets/reference/Ghostline_St_Mercy_Exterior_Concept_01.png`; `assets/reference/Ghostline_Ward4_Corridor_Concept_01.png`; `assets/ward4-bed7/room-plate.png` and detailed Milo sheets. Lighting-OFF cool navy with restrained amber.
- **Opening V3 review** `?opening=1&prelude=1`: attractive real game frames on approved exterior, corridor and room, 3:33 and spirit separation. Owner liked the images, **not** the slideshow-like pacing. V4’s forced shadows/inserts were rejected and V3 restored (`d88c8baa`). Don't redo these paintings.
- **Escape proof** `?escape=1` was already implemented (`fc927627`), with actual video `shots/escape/escape.mp4`: same approved ghost Milo and room, Boo's off-screen RUN -> instant control -> Bed 8 shadow sweep -> doorway. One focused test passed; **owner has not yet reviewed this as a finished gameplay scene**, and touch/gamepad were not directly tested. It lasts ~4 seconds when successful. Preserve as a *prototype*, not the final chase.
- **Legacy production** `src/scenes/opening.js` is a separate earlier art/control flow that allows moving before RUN and uses a temporary end card. `src/scenes/play.js` uses older code-drawn runner sprites. These are **not** visually continuous with V3 and may not be spliced together as-is.
- `docs/next-milestone-run-handoff.md` described a task now **already completed**; do not assign it again. Latest code/report prevail over stale task descriptions.

## NON-NEGOTIABLE PIPELINE — every future scene
**Design -> assets -> integration -> experience review -> acceptance.** No separate Claude job for each microdetail. Do not ask Claude to invent hero paintings or hand-drawn acting with Python geometry; no pretending code-painted placeholders are final. Approved source art must be preserved byte-for-byte where locked. New assets should be *layered editable masters* (Krita .kra / layered working source if used) and exported transparent PNGs / frame strips + a small asset-placement spec. These source files must be stored in repo so Claude never needs chat-only attachments. If suitable art cannot be created with available tools, explicitly report that limitation and choose a simpler honest presentation rather than simulating artistry with extra effects. Do not add Krita, Tiled, Pixelorama or Godot just to look productive:
- **Now:** Phaser 4 stays. Use current approved images, carefully crafted PNG layers, sprite sheets, and simple engine timelines.
- **Krita / Pixelorama:** bring in only for actual visual editing or animation frames. They are not guaranteed to be interactively operable in ChatGPT or Claude's environment; do not assert they are.
- **Tiled:** add when building the first real multi-room/side-scrolling level, not for a static cinematic.
- **No engine migration** without an isolated comparison proving a real benefit. No paid tools, subagents or auto-running Claude workflows without authorization.

## Gates (sequential: do not launch an entire chapter at once)

### Gate 0 — NOW: protect the work and define ONE hero beat
**Creative director / ChatGPT:** inventory actual assets (approved reference vs usable PNG layers vs missing character motion), specify the **Bed 7, 3:33 -> first emotional separation** 10–15 second production shot with exact scale, story events, audio and 3–5 necessary character poses/layers. No invented Milo redesign. Prepare an asset/animation board plus clear DONE/MISSING inventory, not a generic concept slideshow.
**Claude Code:** no new implementation job yet. Do not touch production opening, V3 or escape proof.
**Owner:** no installs, Git or other technical work. Reviews the small visual/animation target once it is actually available.

### Gate 1 — PROVE ART / ANIMATION PRODUCTION
**Creative director:** source/produce/approve enough *real reusable sprite and depth layers* to animate that Bed 7 beat. Keep original art intact.
**Claude:** integrate only this 10–15s segment into an isolated Phaser review using the approved Milo and room, with natural pose transitions and synchronized rain/monitor/blackout audio; **no zoomed fake-closeups or generic shadow silhouettes**. Deliver 1 actual video and few frames, 1 focused test; stop.
**Owner:** approve/reject based on emotional impact, sprite fidelity and natural motion. No scope expansion while missing basics.

### Gate 2 — MAKE STORY -> CONTROL SEAMLESS
Extend the approved Bed 7 beat into the full non-playable intro through Boo's RUN (using **approved small round Boo art**), then connect *directly* to the existing `?escape=1` movement prototype. No old room, sprite jump, start menu, or user controls before RUN. One coherent 40–90s integrated scene, reviewed in-engine; avoid changing the still-approved exterior/corridor unnecessarily.

### Gate 3 — SMALL BUT REAL FIRST LEVEL
Create purpose-made **side-view corridor** tiles/layers inspired by the approved *perspective* corridor image (that existing 640x360 painting is an establishing shot, not tileable playable level art). Build ~30–60 seconds of meaningful traversal, one simple narrative clue, one readable chase hazard, and sound. Tiled becomes useful here. Use the approved Milo animation system, not the legacy code-drawn runner.

### Gate 4 — FIRST HONEST VERTICAL SLICE
Connect intro -> chase -> exploration -> a representative tense encounter/boss mechanic (the larger Ward 4 chapter remains future work). This is the quality bar for further worlds. After owner approval, reuse the asset/scene pipeline to build out Vigil's eight chapters and THE STRETCH finale.

## Responsibilities
- **ChatGPT:** owns art direction/shot list, chooses asset pipeline, creates/reviews available assets, keeps documents consistent, checks real screenshots/game code, judges outcomes critically, scopes **one** Claude job at a time. Does *not* promise background work.
- **Claude Code:** implements scoped features in Phaser, organizes source PNGs/sprite sheets/levels, records real gameplay, runs only task-relevant tests, reports honest blockers. Never substitutes an unapproved redesign to “unblock” itself.
- **Owner:** one creative review at each gate, optional playtest from phone/home PC. No work laptop, no Git, no software installs needed just to approve.

## Stop/go criteria
The scene is not DONE because tests pass, PNGs exist, or the code compiles. DONE means: (1) it looks like **the same approved Ghostline** in both cinematic and gameplay, (2) Milo's performance is readable at 640×360, (3) motion/sound serve story without jitter, (4) player understands RUN/control and experiences one meaningful interaction, (5) owner says the experience meets the visual bar. One short true gameplay video, a few key frames, focused QA; no token-heavy loops. Failed acceptance means adjust the *underlying missing asset/pose/interaction*, not add random effects.

---
## Historic coordination (9 Nov 2026; old immediate task/roadmap below is superseded)

# Ghostline — shared production coordination

Updated November 9, 2026. The detailed task and cross-agent conversation checkpoint is in [GitHub issue #1](https://github.com/LedjanB/ghostline/issues/1).

**Branch rule:** do not change `main`. All work is on `v6-runner` or feature branches based on it. Claude Code must not make speculative/large rewrites or move outside task scope.

## Latest approved direction

- **Use the exact Ward 4 screenshot described by owner as "This Version in this pic, IS PERFECT, including Milo" as the visual reference.** The image exists in the ChatGPT conversation but is not verified as present in this GitHub repo. Do not invent/approximate a replacement. Obtain the reference if needed.
- Milo: 16, only playable character, exact approved haircut/face/pajama details/proportions. Existing sprites are technical starting points, not automatically final.
- Atmosphere: blue rainy hospital, subtle amber practical lighting, good unmodified base lighting. No crosses or religious symbolism.
- Boo: small round supernatural ghost with janitor cap, keys, lantern. Reject older elderly human-like prototype.
- Opening: fully non-playable until Boo tells Milo to RUN, then seamless control transition; don't rewrite before we prove a reusable art pipeline.
- Story: Milo's spirit separates from his living body in St. Mercy's Bed 7 at 3:33 AM; the Ghostline links them; haunted Vigil; THE STRETCH is the final boss.
- 2D spooky action-adventure: fast chase, meaningful exploration, distinct boss fights, eight planned worlds.

## Production workflow

ChatGPT = creative direction and technical review; Claude Code = implementation and testing; owner = approval on important visual/gameplay decisions. Create real reusable PNG/environment assets; avoid giant code-drawn scenes or warping a still image into a walk cycle. Phaser 4 at native 640x360 game coordinates, PC/iPhone home-screen/gamepad. Keep runner/bosses/saves/opening untouched until explicitly in scope.

The owner supplied a separately downloaded 64x128-grid CC0 movement reference sheet. It and newer Ward 4 ZIP prototypes may exist only in ChatGPT attachments, **not** GitHub. Verify source/license/files before implementation. Do not substitute the template character for Milo.

## Immediate bounded task

Develop an isolated Ward 4 movement lab: grounded idle/walk/run/jump/land with distinct sprite poses and conventional sprite animation, grounded feet, tempo matched to actual speed, keyboard/touch/gamepad. Reuse approved Milo design, but if exact reference or sprites are missing report the blocker rather than falsely asserting a match. Preserve all existing scenes and saves. Small reviewable changes, relevant tests/real browser check when available, no merge. Report DONE, CHECKED, BLOCKED, NEXT, then stop.

## Hard stop rules

If usage, token, tool, budget, or rate limits hit, stop work, preserve a minimal checkpoint (changed files, verified test results, blocker and single next step), and **do not retry in a loop or purchase credits**. Do not spawn subagents/AI testers without request. A GitHub handoff does not automatically run or communicate with Claude; an explicitly authorized trigger is required. Never commit secrets or auth tokens.

## Roadmap

1. Ward 4 reusable assets and movement lab.
2. Approved round-ghost Boo.
3. Non-playable opening cinematic using shared gameplay assets.
4. One polished vertical slice (cinematic → chase → exploration → boss).
5. Eight-world production and THE STRETCH finale.
6. Performance, control QA, saves, launch.

See [issue #1](https://github.com/LedjanB/ghostline/issues/1) for collaboration and acceptance details.
