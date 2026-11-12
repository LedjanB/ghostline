# GHOSTLINE — Next REAL milestone: Boo says RUN -> player actually escapes
**Prepared 12 Nov 2026 by creative director, for manual Claude Code dispatch only. No automation.**
Status: READY; not yet implemented. Use `v6-runner` exclusively; `main` remains untouched. Do NOT edit `docs/claude-next-task.md` (Actions trigger).

## Why we are changing course
The owner has now seen four opening variants. V3's approved St. Mercy and corridor art is beautiful, but static; V4 tried artificially manufactured silhouettes/closeups and looked **worse**. V3 was restored by commit `d88c8baa`; leave it intact, available at `?opening=1&prelude=1`.
The deeper issue is structural, not an extra raindrop or cut:
- `src/scenes/prelude.js` and `src/scenes/opening-v2.js` have the approved art and Milo but end in a review card *before Boo's RUN*.
- `src/scenes/opening.js` (older production path) uses its own code-drawn room, lets the user move **before RUN**, and ends on a `CONTINUE TO THE RUN` card/button.
- `src/scenes/play.js` and `src/runner-art.js` create the legacy runner using code-drawn `${this.char.id}_run0` rather than the **approved detailed MiloActor** sprites. Simply connecting the scenes would make three incompatible-looking games.
**Do not spend another task reworking the exterior or corridor paintings, zooms, shadows, cabinets or lamps.** We need a **GAME**: memorable motion, control, threat and relief.

## This task: one isolated, playable handoff proof (not a complete intro or world)
Create a preview route `?escape=1` (or equivalently explicit, non-production parameter) starting **at the moment Boo commands RUN**. We will integrate the previous story/encounter *after* proving this gameplay bridge. Do not claim this is already the full scene.

### What the player should see and do
1. Start in the **actual approved Ward 4 side-view room** (`assets/ward4-bed7/room-plate.png` and approved extracted layers), with the approved **ghost MiloActor** using `src/milo-sprite.js` at the scale/collision aligned with `?wardlab=1`. Begin near the established right-of-bed landing position (~world x 548, floor 335). Keep his appearance/size identical to V3; no legacy code-drawn runner Milo.
2. Threat is visually legible: THE STRETCH is **only a shadow**, moving from behind toward Milo. Its physical body/face must not be revealed. As the lantern flares from offscreen, a quick spoken/text **Boo: 'RUN!'** cues the transition. Do **not** use the old human-looking Boo sprite or invent a new Boo body; an offscreen voice/lantern cue is enough for this small proof. In the final intro Boo will be the approved small round ghost.
3. **On that cue, control is handed over automatically without a menu, black fade, press-to-start, tutorial interruption or a fake end card.** The chase begins instantly, in the same camera/composition.
4. A short, deliberately designed playable escape through the Ward 4 room toward the **existing right-hand corridor door**. Use existing `wardlab` movement/geometry and Milo animations; don't build a duplicate physics/animation engine. Allow directional control and jump (and slide if the current artwork/controls support it cleanly); keyboard, touch and gamepad all matter. Define *one* readable, story-appropriate challenge/reaction with real failure/retry behavior. Keep it natural for a hospital; no generic floating geometry or ugly placeholder pretending to be final art.
5. Let the camera track **without jitter**, keeping world rain/foreground attached. THE STRETCH's shadow closes in if Milo stalls. When Milo reaches the doorway, trigger a concise exit/blackout **after** his body crosses the threshold, not before. That is the scope end of the proof. No long new corridor, world 8, or new boss arena yet.
6. Short honest feedback on failure (caught by shadow -> quick reset at RUN), with light audio cues. No saves, currencies, inventory, boss or legacy `PlayScene` changes. **Do not connect the old legacy runner** until visual/style continuity can be addressed; jumping into the code-drawn runner would undo our art progress.

## Hard implementation rules
- Source of truth: `CLAUDE.md`, `docs/owner-notes.md`, `docs/story-full.md`, `docs/ward4-art-target.md`, `docs/ghostline-production-coordination.md` and this file.
- V3 artwork and preview route are **frozen**; don't change them in this run. `src/scenes/opening.js` and the actual `play` runner are also untouched. Only add isolated new preview scene/routing, minimal optional helper extraction to reuse WardLab movement (do not rewrite physics), focused test/report, and cache updates as necessary.
- Keep approved Milo artwork, Bed 7 room plate and existing round Boo specification intact. No generated new backgrounds, AI slop, subagents, paid tools, or fancy camera effects.
- Preserve original story (Milo 16, 3:33 separation, Boo's round supernatural identity, THE STRETCH final boss), and **non-playable intro until RUN**. Do not accidentally give earlier control in the V3 route.
- Scope/time guard: prioritize **one playable 8–15-second escape that feels responsive** rather than 30 seconds of low-quality new art. If genuinely blocked by missing art or a conflicting engine architecture, **stop and report it**, don't create a disconnected slideshow or a new general-purpose framework.
- Evidence: one continuous *actual in-engine gameplay recording* of prompt -> control -> action -> escape, with a few key screenshots of gameplay, **one focused Playwright smoke test** (keyboard command, control handoff, exit/no page errors; touch/gamepad verification if feasible and real), no full suite/bots or repeated test loops. Honest QA, not claimed unperformed tests.
- `main` untouched, no new hourly automation, no edits to Claude triggers, manual Claude Code only. One coherent commit/push to `v6-runner`, report DONE / CHECKED / BLOCKED / NEXT, then stop.

## How we decide if this is good
User should see *the approved Milo* react to Boo's **RUN**, instantly control the same sprite in the same painted ward, feel danger approaching, make one meaningful gameplay decision, and escape through the door. No scene switch in player avatar, no press-to-play menu, no unapproved hand-drawn ghost. This is not approval of the remaining intro nor a promise of a complete corridor stage.

## After this gets approved
1. Create the **side-on playable corridor** using purpose-made modular art consistent with the approved corridor concept (which is a **perspective establishing painting**, not a reusable side-scrolling level).
2. Extend the playable chase for ~30 seconds, with clear hazards, sound, feedback, and appropriate difficulty, then reconcile with the existing runner mechanic architecture.
3. Only then finish the non-playable preceding encounter (Ghostline reveal, THE STRETCH, approved round Boo) and connect V3 -> full scene -> RUN -> escape **as one continuous experience**. Stop using the legacy production opening's end card. Eventually build the first integrated slice: chase -> meaningful exploration -> boss.

### Reason for art-first/gameplay-first balance
We've repeatedly asked Claude to animate the approved **flat 640x360 images** with procedural overlays. This yields either a slideshow (V3) or tacky fake motion (V4). A real engine moment with a reusable approved sprite and movement has more player value. This pass tests that we can bridge cinematic and game without redoing the entire art pipeline.
