# GHOSTLINE — Opening V4: From slideshow to an actual directed scene
**Creative-director brief.** 12 Nov 2026. Ready for **manual** Claude Code dispatch only. `main` untouched. No hourly automation or `docs/claude-next-task.md` edits.

## Diagnosis
Owner approved the **visual art** of `shots/opening-v3/` but says the current opening **feels like a slideshow, not a real video-game introduction**. The problem is not that the PNGs are ugly. In `src/scenes/prelude.js`, the exterior holds ~5.4s, dips to black, the corridor holds ~3.8s, fades black, then the Bed 7 scene is mostly a fixed wide shot with its existing scripted separation. Light/rain are animated but **no purposeful blocking or character activity** happens until the room. The latest real Phaser screenshots are `shots/opening-v3/1-exterior.png`, `2-corridor.png`, `4-bed7-332.png`, `5-separation.png`, `6-landed.png`. Do **not** solve this with more stills, zoom crops, more black fades, more rain, generic jump scares or new generic procedural backgrounds.

## Reference principles (not a mandate to copy)
- **Ori and the Blind Forest:** the prologue earns emotion through character actions and sound before danger, not just scenery. Specific beats change how we feel.
- **INSIDE:** the setting acts; environmental clues, movement and cause-and-effect build tension without exposition.
- **Little Nightmares:** vulnerability is established in a character waking in a concrete place; mystery is visual. Unlike that game, *Ghostline's approved rule is non-playable until Boo says RUN*.
- **Shadow of the Colossus:** every opening composition tells us something, shots are economical and staged rather than serving as a location catalogue.
Ghostline should combine **Ori's emotional arc, INSIDE's environmental tension, and precise cinematic staging**. Achievable with 2D Phaser and real asset animation, without AAA budgets or a 3D engine.

## LOCKED — do not reinterpret
- Keep approved 640×360 St. Mercy and Ward 4 corridor images at `assets/reference/Ghostline_St_Mercy_Exterior_Concept_01.png` and `assets/reference/Ghostline_Ward4_Corridor_Concept_01.png`; keep approved Bed 7 room plate at `assets/ward4-bed7/room-plate.png` and the approved Milo sprite sheets. Don't replace their visual identity.
- Keep `docs/story-full.md` canon and newer handoff priority: Milo 16, St. Mercy Ward 4 Bed 7, the hospital's frozen 3:33 clock, THE STRETCH true final boss, Boo a **small round supernatural ghost** with janitor cap, keys and lantern, *not* an old human. Opening **NON-PLAYABLE until Boo says RUN**. Do not implement or redesign Boo/The Stretch in this visual milestone.
- Use the real Phaser app/real sprites, `v6-runner` only. Do not modify production first-launch `?opening=1`, `main`, savings, boss/runner logic, or story. Implement on the isolated `?opening=1&prelude=1` review route.
- No crosses/religious symbols anywhere. Existing approved images and Milo must remain intact. No new paid services, subagents, big dependencies, new game engine, or another standalone HTML review.

## The dramatic question
**What happens to Milo when the hospital clock reaches 3:33?** Everything in the opening must move us toward that moment. We want anticipation, then a moment of impossible stillness, then an emotional response from a boy. The hospital is ordinary and alive *before* it becomes wrong.

## One continuous ~40–55 second directed opening REVIEW CUT
Timings are editorial targets, not rigid. Treat this as one sequence, not a slideshow of completed locations. No silent static hold longer than about 2 seconds without a motivated action. Keep a consistent time, spatial direction and audio bed.

### Beat 1 — Exterior / the hospital is alive (about 0–6 s)
- Start in the existing approved exterior composition. No new wide painting.
- **One real foreground/midground action**, beyond falling rain or flickering glows. E.g. a tiny staff silhouette passes briefly through the illuminated entrance, door opens then settles; or a vehicle's light sweeps the wet pavement as it moves. Prefer one motivated detail, never an obvious paranormal apparition. Achieve by isolating a few art layers/animating modest Phaser sprites, **not** transforming the whole PNG. Keep atmospheric rain secondary.
- Hearing first: heavy rain outside, distant traffic/soft hospital sound. Focus our attention toward an inhabited warm window so the next interior cut feels motivated.
- **Transition:** sound bridge (rain continues but muffles indoors), hard action cut to corridor. Do not use dip-to-black between every shot.

### Beat 2 — Corridor / a real route toward Ward 4 (about 6–11 s)
- Use approved corridor image as the persistent place.
- Add one subtle **foreground physical event**, e.g. an unattended hospital cart wheel slowly turning to a stop, or a distant ward door completing its closing motion. One is enough; keep it believable. Reuse the art via layer isolation if possible. Avoid the generic floating wheelchair effect and unrelated horror props.
- Frame/place our attention toward the ward; let the hospital hum, shoes fading away (optional, no visible new character required) and a fluorescent buzz carry continuity. The corridor *changes* during our view, it's not merely a light overlay.
- Cut on a meaningful sound (soft door latch, monitor beep beginning before the cut) directly into Milo's room. No black fade unless a **single** artistically justified blackout occurs at 3:33.

### Beat 3 — Bed 7 / establish Milo (about 11–22 s)
- Real approved room plate and Milo sprites. Start at the original 640×360 composition, then cut to **one carefully made tighter staged detail** of Milo: slight pillow/blanket movement from breathing, visible wristband, sleepy expression. Don't invent a different face or scale a screenshot until pixel art smears.
- Animate **sleeping Milo's breathing and one meaningful small human movement** (e.g. his fingers twitch beneath the blanket), the monitor pulses with his heartbeat. Need to see he is *alive*. Use Milo's approved sleep frames; if a missing frame is essential, adapt the existing sprite without redesign.
- Preserve existing ambient rain and a natural monitor beep. Let sound feel warm and human, not constant musical tension.

### Beat 4 — 3:33 / the ordinary becomes impossible (about 22–29 s)
- Do not introduce the paranormal too early. Cut to the in-room clock 3:32, then 3:33. **The ceiling light/power drops at this exact beat** as in our established story, monitor switches to battery, while lamp/window/rain remain readable.
- A moment of *sound vacuum* (vent/hum suddenly gone) followed by the body/monitor's continued heartbeat. Sound is the hinge. Use existing `opening-audio.js` primitives/synth, no licensed audio.
- Subtle environmental reactions (a curtain edge moving, a sharp stillness in nearby objects) are acceptable if subtle and directly motivated. No cheap strobe, excessive glowing or shaking camera.

### Beat 5 — Separation / emotionally legible (about 29–43 s)
- Use the existing approved spirit separation *poses and timing*, not replace with a generic particle effect.
- Hold both living Milo and the spirit visibly in the same **readable** composition for the separation; show the spirit's hesitation, awkward movement, feet finding the floor. One close reaction insert can show the fear/wristband, but maintain continuity when returning wide.
- Milo must react in character: confused, fearful, trying to understand. A view of his living body still breathing matters more than magical brightness.
- Finish on a **complete dramatic beat:** he sees his own living body and pauses in shock. Do not abruptly cut to an artificial "review ends" card during an action. It may then freeze/fade as an *isolated* demo end. Story dialogue (e.g. "NO. THAT'S ME.") belongs to the full later opening and should not be invented or rewritten here.

## Implementation principles
1. **Staging, not camera tricks.** If exterior/corridor concepts are flattened 640×360 PNGs, don't fake a smooth dolly by zooming the entire flat image: separate selected foreground props/window/door into tiny transparent sprites and cover baked pixels properly, or use intentional cuts. Camera must remain pixel-stable.
2. **Timeline architecture:** a small legible shot/beat state machine with entry/exit events, keyed character/prop actions and sound bridges. Reuse existing prelude and V2 room scene where appropriate. One scene is not mandatory; the *experience* must feel continuous and cause/effect.
3. **Sound leads pictures:** ambient rain can continue across cuts; monitor beep can be heard just before the room cut; the power-loss sound must synchronize with 3:33; leave dramatic silence.
4. **Minimal asset spend:** make only 2–4 small reusable sprite/layer assets if genuinely required; no new giant procedural hospital. Keep all original approved source files intact.
5. **Visual QA:** deliver 1 real **continuous 40–55s** Phaser video with stable frame cadence, **3–5 snapshots of meaningful actions** (not just locations), and a short list of what action occurs at each beat. Validate by watching the whole video and checking pace. One focused Playwright test for sequence and no page errors, then stop; no full suite/bots/test loops.
6. **Budget guard:** don't spend hours trying to inpaint a one-pixel flaw or on test harnesses. If 2D source layering for a particular action isn't feasible, choose a simple but effective **different action/cut** and explain honestly. Prioritize strongest narrative motion, not amount of animation.
7. Commit/push `v6-runner` only when permitted; update `sw.js` cache and concise DONE/CHECKED/BLOCKED/NEXT report.

## Approval gate
The test is: **turn sound on, watch once, and understand Milo is a living boy in a real hospital, something impossible happens at 3:33, and he is afraid.** If a viewer can instead describe it as "exterior picture, hallway picture, room picture, blue ghost," we have not solved the problem. Beautiful still images are not the final deliverable.

## Later milestone — complete intro through Boo's RUN
Once this directed sequence is accepted, extend it through Milo touching his living body, THE STRETCH's shadow reveal, and Boo's rescue with approved *small round ghost* artwork. The player only gains control at Boo's "RUN," seamlessly entering the first chase. This pass does NOT authorize redesigning Boo or the whole chase.
