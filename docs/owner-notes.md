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
