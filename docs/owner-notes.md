# Owner notes (Ledjan)

Decisions, preferences and the current task, so any session (Claude Code, CLI, chat) starts with the same context.
Update this file when Ledjan decides something new.

## How to work with Ledjan
- Replies very short, casual, direct. Never use em dashes.
- Make decisions yourself when he's unsure; ask only when a wrong guess is expensive.
- Instructions to him: one step at a time, exact folder, file and command. Windows Command Prompt (cmd), not PowerShell.
- When done: commit as Ledjan <ledibajrami15@gmail.com>, run `npm test` and the bots, push `v6-runner`, give him something playable.
- No AI testers and no subagents unless he asks (Nov 6).
- He plays on iPhone (home screen web app) and PC equally. Everything must work on phone, keyboard and gamepad.
- Keep comparing with the best games of the genre and take the best from them. Say which game an idea comes from.

## Decisions so far
- Horror, "spooky fun" tone. 2D only, no 3D. No vehicles.
- v6 = runner on the ground fleeing THE STRETCH, flying only at times (Boo power-up and set parts of each world), flights longer but rarer, weapons picked up mid-run. Built on `v6-runner`; `main` (v5) untouched.
- He wants a real game people would download. He asked for strict critique.
- Roadmap in phases (docs/review-roadmap-v6.md). Phases 1, 2 and 3 done; phase 4 (polish) done; v8 story work in progress.
- The ending must be really hard to reach: every journal page + the end of world 8, after a long story and a long time playing. Then endless mode.
- Nov 6: wants real fight scenes, not just running: a boss arena per world, different bosses.
- One playable character: Milo (16). The other characters are story characters (allies), not selectable.
- The town (Vigil) is no real place: dreamlike, no country. Don't call the story doc a "world bible".
- He thinks world building is the biggest weakness ("looks like an AI made it").
- Not 3 characters on screen all the time: THE STRETCH seen only when you fail; Boo only when he helps Milo.
- Story source of truth: docs/story-full.md (full copy of the Claude Doc), short version docs/story.md.

## Current task: rebuild the boss fights (Nov 6)
His feedback on the arenas: "so bad", confusing ("I don't even know how to fight it").
He wants: fun, exciting, intuitive; the arena bigger the way other games do it (not just a wider camera); cooler, horror-magical fight effects.

Plan he was shown, Matron first, preview, then the Coroner:
1. The arena changes between phases (Cuphead). Matron: phase 2 the floor gives way into the ward below, beds become platforms; phase 3 a climb up the stairwell, camera follows. Coroner: phase 2 the drawer wall becomes a climbing wall; phase 3 the well door opens, the floor ices over.
2. More than one floor (Hollow Knight): rooms taller than the screen, ledges, platforms, a camera that follows Milo.
3. One new threat per phase, every attack telegraphed; later phases combine threats instead of just going faster (Cuphead).
4. One color language: red = hurts, gold = hit it now, pale blue = magic light.
5. Horror-magic effects: ember trails on lantern swings, hits crack the boss like porcelain and ink leaks out, the Penlight burns a hole in the dark with floating dust, a silent grey moment between phases, a beaten boss turns into moths flying into the light.

Already in (commit "Arenas teach"): first time an attack comes it's slower with one line telling what to do; "!" before every attack; losing shows how close you were plus TRY AGAIN / GIVE UP.

## Nov 7: THE NIGHT MATRON rebuilt (done, waiting for his playtest)
- Own file `src/scenes/matron.js`. Three acts: Ward 4 (teaches: charge into the wall = gold, curtain), the floor gives way into the ward below (beds fall and become platforms on 3 heights; new: she drops from the rail where you stand), she bursts into the stairwell (12 landings, camera climbs; new: gurneys down the stairs; she flees up and kills the lamps when hit).
- Every act ends with her cracked and kneeling: only the Penlight finishes it (Zelda light-arrow idea). Penlight charges faster by dodging through attacks (Cuphead parry).
- TRY AGAIN starts at the act you reached (his choice can change this; Cuphead restarts the whole fight).
- Next: his playtest on phone, then the Coroner the same way.

## Nov 7: new direction, CHASE -> EXPLORE -> CHASE (greybox prototype, waiting for his playtest)
- Ghostline becomes a 2D horror action-adventure: fast auto-running, small bounded exploration areas, boss fights.
- New story (priority over older story docs where they clash): Milo, 16, hospital patient, wakes at 3:33 AM as a ghost while his body stays in bed; he must get back before THE STRETCH claims his spirit. Not written into the game yet.
- Prototype `src/station.js`: two lit nurse stations in Ward 4 (55 m and 170 m). Run in, the run slows to a stop, walk left/right, jump on desk/shelf/cabinet, find the chart ("BED 7: MILO, 16."), THE STRETCH can't enter the light. EXIT on the right: run ramps back up, "IT WAS WAITING.", it comes back closer.
- How: Milo stays at x 150 like the runner; walking moves the world under him. No new scene, no camera change. Touch: left half = move thumb (like the arenas), right half jumps; keyboard arrows/A-D. Slide on a desk drops through (like the Matron's beds).
- Greybox only. Next: his playtest, then decide room size, what to find, and whether stations get their own camera.

## Nov 7: THE WRONG SIDE OF THE BED (new playable opening, waiting for his playtest)
- He judged the CHASE -> EXPLORE -> CHASE greybox a creative failure (empty, disconnected). Not expanded; the station code stays as is.
- Approved premise: Milo (16) at St. Mercy, 3:33 AM, his spirit leaves his living body. The Ghostline (silver thread) runs from his wrist into the floor, toward the well. THE STRETCH wants his spirit. Boo (dead janitor) helps.
- Built `src/scenes/opening.js` (+ `opening-art.js`, `opening-audio.js`): self-contained scene, own camera following Milo's world x. First launch plays it instead of the old story cards; `?opening=1` replays it. Ends at Boo's "LATER. RUN." with REPLAY OPENING / CONTINUE TO THE RUN (temporary handoff).
- Beats fire on where the player walks (bed -> Ghostline once; past the window -> the shadow; shadow close or Milo at the door -> Boo), never on a timer. THE STRETCH is only shadow + sound. Nothing can hurt Milo here. Uses `storySeen` (no save change).
- Next: his playtest (PC + iPhone). Then the corridor chase and the nurse station, only after he approves.

## Nov 8: Opening V2, part 1 (awakening + Ghostline discovery), waiting for his review
- His playtest of the first opening: pixels too chunky, weak framing, the ghost reveal too fast and unclear, the Ghostline looked like a thick rope, weak guidance, no emotional weight.
- Decisions: the opening uses a 3 px art grid (room, Milo, body, bed all redrawn to Milo's scale: 28 art px tall) and ONE camera zoom (4/3, so an art pixel is always 4 screen px). No close-ups, no zoom changes.
- Milo wears hospital pajamas with a white wristband. Living boy and spirit are the same drawing in two palettes.
- Awakening = one held medium-wide shot (3:32 -> 3:33, power dies, monitor on battery, bedside lamp stays, spirit separates slowly, both Milos held ~2 s). Then control.
- Discovery: stop, look, hesitate, reach, hand through, living fingers twitch, "NO. THAT'S ME.", then the Ghostline: pulse wrist -> wrist, flash at the living wrist, down into the floor seam under the bed. It stays as a faint 1 px thread on his wrist.
- No invisible walls before the discovery: the door is shut (he can walk into it); it drifts open after the Ghostline. The monitor beeps louder and the body's fingers move to call him back.
- Shadow and Boo sequences unchanged (only moved onto the new grid). They are the next redesign, after his review.
- Screenshots: `node scripts/opening-shots.mjs` -> shots/opening/.

## Nov 8: Visual Art Benchmark V1 (art lab), waiting for his review
- Question: can finer pixel art fix readability and acting? Built an isolated lab at `?artlab=1` (not in the game; the opening is unchanged).
- Proposal (docs/visual-target-v1.md): one 2 px art grid at 640x360, Milo 46 art px (92 on screen), everything at 27 px per meter, baked dithered midnight light, no zoom.
- Views: awakening, six poses (living and spirit), the Ghostline (anchored on the wristband in every pose), THE STRETCH's shadow vs Boo's lantern, V2 vs new at the same height.
- Finding: clearly better than V2, but faces still only 2 to 3 px per feature and limbs are code-drawn. Pro pixel art would be the next step if he likes the direction.
- Next: he and ChatGPT review the screenshots (`node scripts/artlab-shots.mjs` -> shots/artlab/) before adopting anything.

## Nov 8: THE NEW MILO, animation prototype V1 (milo lab), waiting for his review
- He approved Milo's new look: `assets/reference/milo-approved-concept.png` (+ faces, turnaround, acting, game-size crops), brief `docs/milo-approved-art-brief.md`. Not in the game yet; opening, art lab, runner, bosses and saves unchanged.
- Isolated lab at `?milolab=1` (`src/scenes/milolab.js`, reusable `src/milo-sprite.js`: `loadMilo`, `MiloActor`, `MILO_ANIMS`). Idle, 1 AWAKENING, 2 REALIZATION, 3 TOUCH, 4 FEAR, PLAY ALL, living/ghost, slow 1/4, x2 inspect, compare with opening V2 and art lab V1. Keyboard, touch, gamepad.
- Frames are raster sprites made by `py scripts/milo-frames.py` (acting in `scripts/milo-frames-acting.py`): the six key poses cut out of the concept (mask, no rectangles), downscaled to game size (92 px body), one 40 colour palette, then 30 in-between frames made at game resolution by moving parts (head, hands, arm, shoulders) and hand-painted faces (eyes, brows, mouth). Ghost = same pixels, spectral palette. Sheets `assets/milo/milo-living.png`, `milo-ghost.png`, 36 frames of 96x100.
- Limits: the body never changes between two concept poses through a drawn in-between (no artist frames), so pose changes still pop a bit; the wristband was missing on 5 concept poses and is painted in; the head turn reuses the idle head (the concept has no turning frames). Real fix if he likes it: a pixel artist draws the in-betweens on top of these.
- Shots: `node scripts/milolab-shots.mjs` -> shots/milolab/ (PNGs + play-all.webm at game size).
- Next: his review. Do NOT put the new Milo in the opening until he approves the animation.

## Nov 8: THE NEW MILO, movement prototype V2 (milo lab MOVE), waiting for his review
- Milo lab has a MOVE mode (`?milolab=1&move=1`, M, or the M: MOVE button): a 1600 px ward corridor at 640x360 with a bed, cabinet, gurney and step to jump on. Keyboard (arrows/A-D, Shift run, Space/W jump, Esc back), touch (left half drag thumb, far = run; right half jump, hold = higher), gamepad (stick/d-pad, full tilt or X = run, A jump, Start back). Coyote time, jump buffer, cut jump (Celeste).
- 25 movement frames (`scripts/milo-frames-move.py`): idle -> walk (turn, start0), walk 8, run 6, stop (side, turn), jump crouch/push/rise/apex/fall x2, land x2. Built from the concept's side view, parts rotated at concept resolution then shrunk like the key poses. Acting frames unchanged. `src/scenes/milolab-move.js`; anims in `MILO_ANIMS` (`MILO_MOVES`), `MiloActor.setFacing()`/`want()`.
- Limits in docs/milo-approved-art-brief.md (rotated parts, reconstructed shirt behind raised arms, far limbs = shaded copies, mirrored wristband). An artist pass would fix them.
- Shots: `node scripts/milolab-move-shots.mjs` -> shots/milolab-move/ (PNGs, frames.png, move.webm).
- Next: his review. Opening, runner, bosses, saves unchanged. Do NOT integrate until he approves.

## Nov 8: THE NEW MILO in the opening (Bed 7 integration pass), waiting for his review
- He approved the Milo acting + movement prototypes as the visual foundation. Both Milos in `?opening=1` are now the approved raster sprites; no old blocky Milo is drawn there (the old textures stay only for the labs' compare views).
- Camera: no zoom any more (1 world px = 1 screen px), so Milo draws 1:1 at 92 px, the concept's in-game size. Not scaled. Wider shot, the whole room height shows.
- The spirit is a `MiloActor` on the opening's own physics (no new physics): walk 72 px/s (matches the walk cycle), Boo's "RUN." uses the run cycle, jump has the crouch/takeoff frames, landing frames, pivot. Same controls on PC, iPhone and gamepad.
- Awakening: his spirit shows inside the body, lifts, sits up, stands in the air still asleep, drifts down, lands, then plays the approved awakening acting (wakes, looks around, confused). Control after it (~17 s from the key press, was ~14).
- Discovery: walks to the bed, then the approved acting in order: looks at his hands, turns to the body (shock), hesitates, reaches, the hand goes into his own (ripple, the body's fingers move), recoils in fear, "NO. THAT'S ME.", then the Ghostline as before. About 19 s.
- Living Milo in bed: new `assets/milo/milo-sleep.png` made by `scripts/milo-frames-sleep.py` (run by `py scripts/milo-frames.py`): the same side-view drawing laid down at concept resolution, eyes closed, arm over a new 1 px blanket; breath and finger frames. Ghost row = his spirit lying and sitting up (same pixels, spectral colours).
- Ghostline: `frames.json` now has `wrist` per frame (measured on the wristband pixels, 4 frames where the band is hidden were set by eye) and the sleep frames' wrist. `MiloActor.wrist()` follows frame, offset and mirroring. Never the hand.
- Room: rendered at full resolution; Bed 7 (tube frame, mattress, sheet, pillow, casters, chart) and the wall tiles redrawn at 1 px, 1 px grain on plaster and floor.
- Shots: `node scripts/opening-shots.mjs` -> shots/opening/ (awakening, sitting up, hands, shock, reach, through, recoil, Ghostline, walk, jump, Boo). Full recording: `node scripts/opening-video.mjs` -> shots/opening/opening-full.webm.
- Limits (honest): facing the bed is a mirror, so the wristband switches wrist when he turns (same as the lab). The sleeping face is the side profile turned 90 degrees: the hair falls "sideways" instead of onto the pillow. The sit-up is a rig pose (rotated parts, no cloth change). The curtains, door, window, clock, monitor numbers, Boo and THE STRETCH's shadow are still on the old 3 px grid, so some chunkier pixels remain away from Milo. Boo is now small and chunky next to the new Milo: that is for the Boo/shadow cinematic revision.
- Next: his review. THE STRETCH and Boo are NOT redesigned yet (their own pass).

## Nov 8: THE FIRST ENCOUNTER, cinematic revision V1 (THE STRETCH + Boo), waiting for his review
- His review of the Bed 7 integration: new Milo approved; the threat failed (STRETCH barely visible, shadow missable, Boo too early, old Boo clashed, no pacing, abrupt end).
- Rebuilt as story states with visibility gates (`src/opening-encounter.js`, mixed into the opening): warning -> shadow (figure, climb, reach) -> rescue -> escape -> exit -> end card. No step may start before the previous one was on screen long enough (figure 2.2 s, climb 1.6 s, the reaching hand 2.5 s). Boo can never come before that.
- Warning: vent dies, rain goes far, keys behind bed 8's curtain, bed 8's lamp flickers on (backlights the fabric), a long hand presses the curtain from behind, the door swings shut, Milo glances over (short lock). Starts when he walks toward bed 8 or after 6 s anyway.
- THE STRETCH = only a shadow: a too-tall figure on the backlit curtain, head and neck stretch up the wall and bend on the ceiling, one arm crawls along the upper wall, down the wall, over the floor to his feet (frost and a cold halo so it reads on the dark wall). It catches him wherever he goes (faster than the walk); if he slips past it, it pulls back and turns. Milo keeps control, flinches once (approved fear frames), trembles when idle.
- Rescue: it holds his ankle, silence, a match in the corridor, the door opens, warm light comes along the floor, Boo arrives, the lantern flares, the shadow burns back (erased by the light, flakes, hiss), Boo steps between, "THERE YOU ARE." / "WHAT IS THAT?" / "NOT NOW, KID. MOVE." + points at the door.
- Escape: control back, Boo leads (nags, then walks Milo if he stands still 9 s). At the door one last reach along the floor burns on the lantern; they walk into the dark corridor; fade; then the old end card.
- Camera: one slow framing of Milo + the beat's key point (curtain, head, hand, Boo, door); Milo never leaves the frame. Zoom 1.
- New Boo (Tobias Boone): raster sprites `assets/boo/` made by `py scripts/boo-frames.py` (no concept art exists, so painted by code: shaded rig at 4x downscaled + hand-painted 1 px head and lantern). Stooped old janitor, long grey-green coat, navy cap, white moustache, key ring, brass lantern. Cold + lit sheets crossfade as the lantern catches. Frames: dark, ignite, guard (lantern out, shielding), idle/talk/blink, point, walk x6. `src/boo-sprite.js` (`BooActor`). No old Boo in the opening.
- Shots: `node scripts/encounter-shots.mjs` -> shots/encounter/ (also checks bed, mid, exit, retreat, idle, jumpy all reach the end). Recording: `node scripts/opening-video.mjs` -> shots/opening/opening-full.webm.
- Limits (honest): Boo is code-painted, not artist-drawn: the face is ~6 px of features, the coat has no real cloth folds between poses, the walk is a rig. Good enough to judge the scene; an artist pass would lift him to Milo's level. The shadow is vector silhouettes (deliberate, but clean-edged, not hand-pixelled). Boo's lines use the old blip voice.
- Next: his review. Corridor level NOT started.

## Nov 9: Ward 4 movement lab V1 (?wardlab=1), waiting for his review
- New workflow: ChatGPT = creative direction + review, Claude Code = code + tests, Ledjan = approval. Shared notes: docs/ghostline-production-coordination.md and GitHub issue #1. Reports: docs/claude-task-report.md.
- The Ward 4 art lab (approved screenshot as the target, room plate, real Milo sprites) is committed. Milo now moves with the milo lab's tuning scaled to his 1.5x size: walk/run cycles match the speed, start/stop/turn/jump/land frames, jump onto Bed 7. Keyboard, touch, gamepad.
- Next: his playtest on PC + iPhone, then a clean modular Bed 7 set + room shell to replace the plate.
