<!-- Full copy of the Claude Doc "Ghostline v6: Full Game Review & Roadmap" (https://claude.ai/artifact/EyjbWdkTeKKZWBW3bb65B4). Re-export with scripts/doc-to-md.py if the doc changes. -->

# Ghostline v6: Full Game Review & Roadmap

2026-11-05 · Ledjan Bajrami

## Where we are now (Nov 5, evening)

Updated Nov 6. Phases 1, 2 and most of 3 (alpha) are done on `v6-runner`, plus six polish rounds (AI testers now 7.5, 7.5, 8). Alpha is still missing THE STRETCH's twist per world. Next the game changes direction: bosses, heroes and a real world (see Plan from Nov 6 below). The list under this is from Nov 5.
The 10 findings in the summary, as they stand now:
1. **Wrong story:** fixed. New story cards, the DON'T LOOK BACK tagline, Boo's lines for running, THE STRETCH is introduced.
2. **Missions:** fixed. All 23 missions remapped to running, jumping, sliding, flights and weapons.
3. **No ending:** decided, not built. You need every journal page AND to reach the end of world 8; endless mode after. Built in phase 3.
4. **Flying:** fixed. Rarer but longer flights, and the ward's flight is hand-made (THREAD THE NEEDLE).
5. **THE STRETCH:** mostly fixed. Footsteps, breathing and roars, a lunge on stumbles, a 4-step walk and a crawl, and a grab death scene that ends on its grin. A twist per world is still to come in phase 3.
6. **Difficulty:** better. Bots reach about 460 m (kid), 620 to 720 m (casual) and 1,400 m (good). Tune again in beta.
7. **Every run is the same trip:** open. Phase 3 adds a set piece per world and hand-made trap patterns.
8. **Art:** partly fixed. New Milo frames (run, jump, fall, slide, stumble), new creature frames, and gates are now dark passages. The trap art pass is still open.
9. **Nothing brings players back tomorrow:** open. Phase 4: daily streak, daily run, weekly event.
10. **No real players:** still open. AI testers stand in for now: round 2 scored 5, 5 and 4; round 3 scored 6, 6 and 6, and all three would run again.

Also fixed after phase 2: traps froze on screen when Boo grabbed you, there are no more crosses on graves, and only one popup shows at a time.

## Plan from Nov 6

Ghostline grows from a runner into a run-and-fight game with a world of its own: boss fights, heroes with powers, people to meet and one signature twist. World building comes first, because today the worlds read as generic and machine-made.

### Where we are

| Phase | Status |
|---|---|
| 1. Fix v6 | Done |
| 2. Vertical slice | Done |
| 3. Alpha | Mostly done: 8 flight set pieces, the ending, weapons with a purpose, trap patterns, a scare per world. Missing: THE STRETCH's twist per world |
| 4. Beta | Not started |
| 5. Launch | Not started |

### Biggest weakness: the world

- The 8 worlds are stock horror places (ward, morgue, woods, graveyard, sewer, catacombs, carnival). Nothing in them belongs only to Ghostline.
- Everything is drawn in code in one look, with no hand-made landmark you would remember.
- The flavor lines are jokes (\"DO NOT LICK ANYTHING\") instead of a voice.
- Nobody lives there: no residents, no villains, no faces besides Milo, Boo and THE STRETCH.

The fix is a world bible before more features: one place with a history (the town around St. Mercy, and why the dark came), and each world as a chapter with who lived there, what happened, its own rule, a resident you meet, a boss who guards it and one landmark. A human pixel artist for the key art (logo, Milo, THE STRETCH, one landmark per world) is the fastest way off the \"AI made this\" look.

### ChatGPT's ideas and what we do with them

| Idea | What we have | Decision |
|---|---|---|
| Character collection | 8 characters with looks | Rework them as heroes with powers (decided) |
| Worlds that feel like different games | 8 worlds, one trap and one set piece each | Yes: every world adds a new rule and a boss |
| Upgrades | Perks, charms | Yes, in Beta: spend candles between runs |
| Achievements, challenges | Missions | Add achievements and a collection book, Beta |
| Secrets, rare finds | Daily ghost, journal pages | Add secret portals and a rare ghost, Beta |
| Reality Shift | No | Yes, the signature mechanic: the Other Side bleeds in mid-run and the world turns into its dark version |
| Monster Chase | THE STRETCH chases all run | Have it; bosses add the fights |
| Random portals, Ghost Hour | No | Later; Ghost Hour is a good rare event |
| Leaderboards, weekly challenge | No | Beta, needs a server |
| Money: rewarded ads, cosmetics, no pay-to-win | No | After launch on web and itch; cosmetics only |
| His world list (carnival start, drowned city, cursed kingdom) | A different 8 | Keep ours, rework them in the world bible |

### Decided Nov 6

- **Arena boss fights:** Milo stops in a boss room and fights: move, jump, dodge, an attack button. One boss per world.
- **Heroes with powers:** each playable character gets its own special move.
- **Story characters:** allies and villains you meet between worlds.
- **No 3D.**

### Next, in order

1. World bible: the story of the place, 8 chapters, residents, bosses, each world's new rule. A doc, no code.
2. Boss prototype: one arena fight in world 1, greybox. Keep if a new player has fun in 60 to 90 s on a phone without help.
3. If kept: bosses for worlds 1 and 2 at final quality plus 2 heroes with powers (a new vertical slice).
4. Reality Shift prototype.
5. The other 6 worlds, then Beta.

## Summary

The v6 runner plays well, but the game around it still belongs to the flying game. That mismatch is the biggest problem, ahead of any missing feature. Nothing in the game has been changed for this review.
The 10 findings that matter most, in order:
1. **The game tells the wrong story.** The intro, the menu tagline and Boo's lines still say \"hold on, don't let go\" and \"float\". THE STRETCH is never introduced. New players learn one game and then play another.
2. **About 1 in 3 missions can't be done or make no sense now.** Missions like \"use a Spirit Rush\", \"outrun the Dark\", \"hug the ceiling\" and \"splat ghouls with ecto\" point at systems v6 turned off. Missions are the main reason to keep playing, so this blocks progress.
3. **There is no ending.** After the 8th world the run just continues. There is no boss, no escape and no payoff for the story.
4. **Flying is too short and arrives at the wrong times.** A 3.5 second orb is a blink, not a big moment. Your ask (longer, rarer) is right; see Gameplay.
5. **THE STRETCH has no personality.** It has no sound, no reactions, no per-world twist and no name reveal. Temple Run's monkeys went viral because they were scary; ours is just a sprite at the edge.
6. **Difficulty has no middle.** A perfect player never dies; a decent player gets caught at 2.5 to 3 km; a sloppy one dies at about 110 m.
7. **Every run is the same trip.** Same 8 worlds, same order, always from the hospital. By run 20 the first 400 m is a chore.
8. **The new art is a level below the old art.** Traps drawn with code rectangles (roots, steam) and a rotated Milo for the slide sit next to hand-painted worlds.
9. **Nothing brings players back tomorrow** except a 4-hour gift. There are no events, streaks, notifications, leaderboards or friends.
10. **No real players have tested it.** All difficulty numbers come from scripted bots.

**Do first:** fix the story and missions for v6, make flying longer and rarer, and give THE STRETCH a voice. Then run a 5-person playtest before building anything new.

## What we tested

The review is based on four inputs. None of them is a real player, so treat difficulty numbers as a starting guess.

| Input | What it covered | Result |
|---|---|---|
| Scripted bot runs, 6 minutes each | Perfect player, decent player (timing off by up to 0.07 s, 3% missed traps), sloppy player (off by up to 0.15 s) | Perfect: all 8 worlds, never caught. Decent: caught at 2,557 to 3,157 m. Sloppy: caught at about 110 m. Flying took 11 to 17% of a run |
| Screenshots of every trap, weapon and moment | Beam slide, 8 world traps, 4 weapons, chasm flight, landing, caught, results screen | All render and work; the mismatch between old and new art is clear |
| Your playtests | Prototype B recording, the v6 beam screenshot | Too much flying (B), a beam that looked impossible (v6, now fixed) |
| Code review | Story, missions, unlocks, journal, menu, HUD, tips, Boo's lines | 65 missions, 12 journal pages, 36 unlock steps, 8 characters, 10 charms, 3 modes |
| Research | Jetpack Joyride, Temple Run, Subway Surfers, retention benchmarks, onboarding, roadmaps, comedy in games | Sources at the end |

The automated test suite (15 tests) passes. It checks that systems work, not that the game is fun.

## AI playtest after phase 1

With no human testers, two kinds of AI testers played the phase 1 build. All three AI testers agreed on the top problem: there is too much text on screen, so players can't see what is about to hit them.

### Human-like bots (70 runs)

These bots react late and make mistakes like people do. Kid: reacts in 0.38 s, timing off by up to 0.12 s, 8% wrong move. Casual: 0.30 s, 0.08 s, 4%. Good: 0.22 s, 0.05 s, 1.5%.

| Player | Runs | Median distance | Median run | Caught before 300 m | Reached 1,000 m | Flying share |
|---|---|---|---|---|---|---|
| Kid, first runs (Boo saves you) | 10 | 629 m | 51 s | 0 of 10 | 1 of 10 | 13% |
| Kid | 20 | 506 m | 43 s | 5 of 20 | 2 of 20 | 12% |
| Casual | 20 | 875 m | 66 s | 2 of 20 | 9 of 20 | 15% |
| Good | 20 | 1,259 m | 89 s | 2 of 20 | 11 of 20 | 14% |

- **Floor hands are the top trap** for every player type: 22 to 31 hits per 20 runs. They rise too late to read.
- **Low swings are the top killer for good players** (6 of 20 deaths). They sweep about 290 px wide, wider than one slide covers.
- **In the air, spirit beams hit most** (14 to 36 per 20 runs).
- **The first-run safety works:** no kid lost a first run before 300 m.

### Fresh-eyes AI testers (31 screenshots of a real first launch and run)

Three testers saw only the screenshots: a 12-year-old mobile player (5 out of 10), a daily runner fan (\"past day 1 for the charm, day 7 doubtful\") and a senior game designer.

| Problem | Kid | Fan | Designer |
|---|---|---|---|
| Text pileups: tip, world name, Boo's bubble and mission banner all at once, often in the flight lane | yes | yes | yes |
| Got caught while the danger bar was about 70% full: the \"two stumbles\" rule is invisible | yes | yes | yes |
| Tips that don't match the screen (\"ROLLING BEDS\" before any bed shows, \"slide\" while already caught) | yes | yes | yes |
| Hazards blend into the background; candles are brighter than threats |  | yes | yes |
| THE STRETCH looks parked at the left edge; nothing reacts to how close it is |  | yes | yes |
| Too many mystery counters: souls, B-O-O letters, the x1 box next to a combo x3 | yes | yes | yes |
| Results screen: numbers don't add up, \"NEW BEST\" twice, the death line \"THE DARK SAYS HI\" is from v5, no retry button | yes | yes | yes |
| Story card 2 runs off both screen edges; keyboard hints shown on phones | yes | yes | yes |
| The chasm reads as missing art, not a hole |  | yes | yes |
| Tombstones and rain in a hospital ward feel wrong |  |  | yes |
| Pixel styles don't match (smooth giants, kawaii Boo, realistic gun) |  |  | yes |

### Fix list before phase 2 (phase 1.5)

1. One message at a time: queue tips, Boo's lines and banners; keep them out of the flight lane; no tips after death.
2. Make danger honest: the bar drops on a stumble, and two stumble pips show \"one more and it gets you\".
3. Tips appear when the trap is on screen, not when it spawns.
4. Hazards get warm, outlined colors; candles lose some glow; lasers move off the exit-sign green.
5. THE STRETCH lunges forward on a stumble, with a dark left edge that grows as it gets closer.
6. Hide souls and B-O-O letters until they first matter; drop the x1 box during a run.
7. Results: v6 death lines, the trap that got you, numbers that add up, a big RUN AGAIN button.
8. Story card 2 fits on screen; touch hints on phones.
9. Floor hands give a longer tell; low swings sweep narrower.
10. The chasm gets a real edge and depth so it reads as a hole.

### Round 2 (after the phase 1.5 fixes)

The first round's fixes landed: one message at a time, an honest danger meter, results that name what got you. Round 2 found a blocker that round 1 missed: Grave Spin had only a SPIN button, so a new player never reached the results. That is now fixed with NO THANKS and an 8-second auto-skip. Scores: 5, 5 and 4 out of 10.
Fixed after round 2: Grave Spin exit, the cause of death shown on screen with a short freeze, THE STRETCH's front edge matching the meter, tips moved to the top band, popups capped at 2, souls no longer covering the candle count, at most 3 tips per run, a warning glow on morgue drawers, and jump-after-jump combos with room to land.

### Left for phase 2 (from the testers)

- Milo is small (about 30 px); scale him up 1.5x with real slide and stumble frames. Today he looks dead when he slides.
- World gates look like a split-screen glitch; they need a set piece that hides the seam.
- Introduce one system per run: missions on run 1, B-O-O on run 3, souls and Grave Spin later.
- The giant background silhouette is the best chase moment; use one at every world gate.
- Weapons are noise without a decision; give each a purpose (phase 3).
- Rain falls indoors in the ward; the woods moon looks sliced.

## What the game is missing

These are things the game does not have at all. Size is a rough guess at the work: S is an afternoon, M is a few days, L is a week or more.

| Area | Missing | Why it matters | Size |
|---|---|---|---|
| Story | A v6 intro that shows THE STRETCH waking up and chasing Milo | New players don't know why they run | S |
| Story | An ending: an escape, a final chase or a boss after world 8 | Without a finish line, 8 worlds feel like a loop | L |
| Story | THE STRETCH's real name, origin and a reason it wants Milo | A chaser with no reason is wallpaper | S |
| Story | Cutscenes or short beats at each world gate | Gates are the natural place for story and they say nothing | M |
| Creature | Per-world twists: climbs trees in the woods, crawls on the sewer ceiling, rides the carnival rails | Already in the design doc; it is the cheapest way to make each world feel new | M |
| Creature | Sound: footsteps, breathing, a scream when it closes in, silence when it is far | Sound is what made Temple Run scary; we have none | S |
| Creature | Reactions: it trips on traps too, hisses at candles, gets angry when you smash things | Makes it feel alive and makes the chase funny | M |
| Gameplay | Lane changes or a second axis of movement | Jump and slide only is thin over long sessions | L |
| Gameplay | A boss or set-piece chase per world | Peaks in the run; today every 400 m feels the same | L |
| Gameplay | Near-miss rewards on the ground (graze a trap, get a bonus) | Near misses only count while flying now | S |
| Gameplay | Combo moves: slide into a jump, jump off a crate, stomp a ghoul | Skill expression beyond timing | M |
| Gameplay | Daily runs that use v6 rules (a fixed seed with ground traps) | Daily mode still races a v5 ghost line | S |
| Weapons | Weapon upgrades or a choice between two pickups | Weapons are random and forgettable | M |
| Weapons | Screen feedback: hit-stop, knockback, numbers, a meter for ammo on Milo | Shooting feels like nothing happens | S |
| Progression | A v6 mission set (stumble-free 200 m, smash 10 crates, burn 5 hands, land with 0 air hits) | 1 in 3 current missions are broken | M |
| Progression | Character perks that make sense for running (double jump, longer slide, magnet for candles) | Current perks talk about light and floating | M |
| Progression | Charms reworked for running | Same problem as perks | M |
| Progression | A shop that sells something you want (new weapons, a skin for THE STRETCH, world skins) | Candles have little to buy | M |
| Retention | Daily streak with rising rewards | The cheapest proven return reason | S |
| Retention | Weekly event (a special world, a modifier like \"night mode\" or \"double creature speed\") | Gives old players a reason to come back | M |
| Retention | Leaderboard (global, daily, friends) | Score chasing is the core reason runners last | M |
| Retention | Share a run (a clip or a card with distance and cause of death) | Free marketing; Temple Run grew on word of mouth | M |
| Retention | Push notifications or a reminder for the home screen app | Without them, the game is forgotten after day 1 | M |
| Retention | Cloud save or a login | Players lose everything if they clear the browser | L |
| Onboarding | A first run that is safe and teaches jump, slide, the creature and flying in under 60 s | Benchmarks show day 1 is decided in the first few minutes | S |
| Onboarding | A skip for players who already know | Forced tutorials push experienced players away | S |
| Audio | Music that reacts to the chase (faster and louder as it closes in) | The music layers exist but don't follow the creature | S |
| Audio | Sounds for each world trap and each weapon | Several reuse the same three sounds | S |
| Visuals | Proper frames for Milo: slide, jump, stumble, caught | He is a rotated run frame | M |
| Visuals | A death scene where THE STRETCH grabs him | The v5 ragdoll bounce plays instead | S |
| Visuals | Particle effects for weapons (salt spray, fire, splash, bone spin trail) | Shots are 3 px squares | S |
| Accessibility | Bigger touch zones, a one-button mode (auto-slide), colorblind check for new traps | Settings exist but predate v6 | M |
| Business | A plan for money (free with ads, one-time price, or cosmetics) | Shapes what the shop and rewards can be | S |
| Business | Analytics: where players die, how long runs last, who comes back | You can't fix what you can't see | M |
| Business | A store page, trailer and screenshots for v6 | The current store kit shows v5 | M |

## What the game has but does not do well

These exist and work, but they are weak, unclear or built for the old game.

| Feature | What's weak | How to make it good |
|---|---|---|
| Flying | 3.5 s orb, one chasm per world: it ends before it feels like anything | Fewer, longer flights: 8 to 10 s, about once per world, each with its own air set piece |
| Landing | \"IT'S COMING\" text is the only tension | A slow-mo beat, a scream, the creature visibly sprinting in, a short safe window |
| THE STRETCH | Walks or crawls at the edge; that's all | Lunges when close, reaches for Milo, trips, climbs, reacts to candles |
| Danger meter | A bar at the top; players watch the road, not the HUD | Show danger on screen: the creature's hand reaching in, a red vignette, heartbeat sound |
| Stumble | A flash and a shake; it doesn't read as \"I tripped\" | A stumble animation, a short slow-down you can feel, a creature roar |
| Ground traps | 15 kinds, but most are \"jump\" with a different picture | Give more traps a second answer (shoot it, slide or jump, time it) |
| World traps | Each world has one, and it mixes into the same random pool | Introduce each with a short safe teach moment at the gate, then build patterns around it |
| Weapons | Random pickup, short life, the same auto-aim for all | Make each feel different: flame clears hands ahead, boomerang can catch candles, holy water stuns the creature |
| Candles | Pushing the creature back by 1.2 px each is invisible | Bigger, rarer candle moments: a candle line that visibly pushes it back with a hiss |
| Combo | Counts up from dodges, but there's no reason to care during a run | Tie combo tiers to visible changes: music, Milo's speed trail, a creature that hesitates |
| Missions | Built for v5; many are broken | Rewrite for v6 (see the forgotten-items section) |
| Unlocks (hats, trails, journal) | Cosmetic for Boo, who is now a side character | Add unlocks for Milo and for THE STRETCH (skins, voices) |
| Characters | 8 heroes with v5 perks (light, Spirit Rush, banshee speed) | New perks that change running |
| Charms | 10 charms, several now do nothing (night light, long rush) | Rework or remove |
| Grave Spin and second chance | Fine, but revive drops you in front of the creature with no drama | A short revive scene: Boo shoves the creature back |
| Daily mode | Races a v5 ghost recorded as height over distance | A v6 daily seed and a ghost that runs |
| Tips | Text banners that cover the middle of the screen | Show the action once (a ghost Milo slides under the first beam) |
| Results screen | Distance, candles, missions; nothing about how you died | Show the trap that got you, how close you came to a best, and one tip |
| HUD | Seven numbers at once (meters, candles, souls, score, multiplier, combo, meter) | Hide what doesn't matter mid-run; keep distance, candles and danger |
| Zone art | Beautiful, but you run past it at 400+ px/s | Slow moments (flights, gates) are where the art should get its close-up |
| Difficulty curve | Rises by distance only | Also rise by skill: tighten when a player is doing well, ease after two quick deaths |

## What is wrong with the game

These are bugs, contradictions and unfair moments, worst first.

| # | Problem | Where | Severity |
|---|---|---|---|
| 1 | Missions that can't be done: \"use a Spirit Rush\" (x2), \"outrun the Dark\" (x2), \"splat ghouls with ecto\" (x2). Spirit Rush and the Dark were turned off; ecto splats aren't counted | `missions.js` | High: blocks mission levels and the score multiplier |
| 2 | Missions that don't fit: \"hug the ceiling\", \"stay on the floor\" (now automatic), \"fly 250 m with no candles\", \"survive laser rows\" (only possible in short flights) | `missions.js` | High |
| 3 | Story says \"don't let go\"; the menu tagline says \"DON'T LET GO\"; the itch page says \"don't let go\". The game is now about running | story, menu, store page | High |
| 4 | Two sloppy mistakes inside 2.2 s ends the run at 110 m: harsh for a first run | runner tuning | Medium |
| 5 | A perfect player never dies: no late-game pressure beyond speed | runner tuning | Medium |
| 6 | Flights can start right before a gate; the gate swap and the flight overlap | spawner | Medium |
| 7 | Boo's quips still include v5 lines (\"HOLD TO FLOAT\" was disabled, but \"near\" and \"dark\" lines remain) | `run-features.js` | Low |
| 8 | Character perks that do nothing in v6: Nurse Ivy (light lasts longer), Count Vlad (Spirit Rush), Rattles (banshees slower, only in flight) | `data.js` | Medium: players pay candles for nothing |
| 9 | Charms that do nothing: Night Light, Long Rush, Bouncy Bones (barely) | `data.js` | Medium |
| 10 | Daily mode ghost records height over distance; in v6 it is a flat line | daily mode | Low |
| 11 | The bobbing eye and the steam vent need the right action at the right moment; a new player can read them as luck | world traps | Medium |
| 12 | The danger meter keeps the old flame bar's position in the HUD between candles and souls, where nobody looks during a chase | HUD | Low |
| 13 | Weapon icons and the power-up icon share one slot; a magnet hides the weapon | HUD | Low |
| 14 | A slide can't be cancelled into a jump on touch for 70 ms (the swipe delay) | input | Low |
| 15 | No test that a level of the game is beatable by a human; difficulty numbers come from bots | tests | Medium |
| 16 | The store kit (screenshots, cover, description) shows the v5 flying game | `docs/store` | Medium before any release |

## Comparison with other games

Each of these games is better than Ghostline at one specific thing. The right column is what we copy, in our own way.

| Game | What it does better | What Ghostline should take |
|---|---|---|
| Jetpack Joyride | Built to make you fail over and over, and rewards each failure: progress, missions done and a slot-machine bonus after every crash; retry is one tap (Berkun on the Failcon talk) | Our results screen shows the numbers but doesn't make dying feel like progress. Always show the next mission and one thing that got better |
| Jetpack Joyride | Vehicles: a whole new way to play for 20 seconds, then back | Our flights should be that: rare, long enough to enjoy, each one a different set piece |
| Temple Run | The chaser: the monkeys trigger real fear, and that fear is what people talked about; one-hand controls; runs of 30 s to a few minutes (TechCrunch) | THE STRETCH needs a sound, a look and a moment people screenshot and share |
| Subway Surfers | A new city every three weeks keeps the same game fresh (PocketGamer.biz); the run sits inside a constant content schedule (Adrian Crook) | We have 8 worlds already. Rotate which world a run starts in, run a \"world of the week\" |
| Subway Surfers | Lanes: three tracks plus jump and roll gives far more choices than our two buttons | Consider lanes later; first get more out of jump and slide (combos, double jump perk) |
| Alto's Adventure | Calm, beautiful, and the tricks (flips, grinds) give skill expression | Our worlds are as pretty; our moves have no tricks |
| Canabalt | One button, a dramatic start, no menus before you play | Our first run should start the second you tap |
| Downwell | One move does two jobs (the gun boots shoot and slow your fall) | Give our weapons a second job: holy water could also stun THE STRETCH |
| Vampire Survivors | Auto-fire plus choosing upgrades every minute makes every run different | Our auto-fire weapons are random; a choice between two at each pickup would add decisions |
| Crossy Road | Characters change the world (it's already in our game) and the humor is in the characters | Keep it; make THE STRETCH skins and Milo outfits just as funny |
| Super Mario Run | Racing a friend's ghost | Our daily ghost exists; make it a running ghost and let friends race it |

## Visuals: how to make it look better

The worlds are the strongest part of the game. The new v6 pieces are the weakest, so the fix is to bring them up to the worlds' level.
1. **Redraw the code-drawn traps as pixel art.** Roots, steam, sinkhole dirt and slide marks are flat rectangles today. They should follow `docs/art-direction.md` like every other actor: outlined, max 16 colors.
2. **Give Milo real frames.** Slide (2 frames), jump up, jump down, stumble, caught. A rotated run frame reads as a glitch.
3. **Animate THE STRETCH properly.** It needs 4 walk frames instead of 2, a lunge, a reach, a trip and a scream with its jaw open too wide. It is the face of the game.
4. **Use the screen to show danger, not a bar.** When it gets close, darken the left third, show its long fingers reaching into frame, pulse a red edge. Players never read the HUD mid-run.
5. **Make flights look different.** Pull the camera back a little, add speed lines and a color shift, and let the world's art show off (this is the close-up moment).
6. **Put weight on hits.** A 40 to 60 ms hit-stop when a weapon kills something, a puff, and numbers that pop. The game-feel skill in the repo covers this.
7. **Fix readability.** Every trap should have a 0.3 s tell before it acts (the hands twitch already; the drawer rattles; the eye needs one).
8. **One accent color per world for traps.** Right now new traps use random colors. Tie them to each world's accent so they belong.
9. **Cut HUD clutter.** Seven numbers on screen compete with the art. Show three during a run, the rest on the results screen.
10. **A real death moment.** THE STRETCH grabs Milo, the screen goes dark from the left, a beat of silence, then the results. Funny or scary, never the old ragdoll bounce.

## Gameplay, idea and concept

The concept is strong: a ghost and a kid running from something that is always right behind them. The gameplay doesn't use the \"right behind\" part enough yet.
**The idea in one line (proposed):** Milo runs from THE STRETCH through 8 haunted places; Boo can only carry him for a moment, so every flight is a breath before the chase gets worse.

### Flying: longer, but rarer (your ask)

|  | Now | Proposed |
|---|---|---|
| Boo orb flight | 3.5 s, every 800 to 1,100 m | 8 to 10 s, about once per 2 worlds |
| Flight section (chasm) | 2.6 s, every world | 6 to 8 s, every other world, alternating with the orb |
| Share of a run spent flying | 11 to 17% | Stays near 15%, but in 2 or 3 big moments instead of many small ones |
| What happens in the air | Random v5 hazards | A short scripted set piece per world (a banshee swarm, a laser gauntlet, a collapsing ceiling), then random |
| Landing | Creature 64 px back | Creature distance depends on how well you flew; a clean flight earns real distance |

### Gameplay changes

- **Make the creature the pacing.** Close = faster music, darker screen, Boo panics. Far = calm, candles, jokes. The run should breathe.
- **Give jump and slide more depth.** Double jump as a perk, slide-jump (a longer, lower jump out of a slide), stomp ghouls by landing on them.
- **Traps with two answers.** A crate you can jump or shoot; a gurney you can slide under if you're fast. Choice is more fun than a quiz.
- **Weapons with a purpose.** Holy water stuns THE STRETCH for 2 s; flame clears a hand row; boomerang brings candles back. Each has a reason to want it.
- **Patterns, not just random.** Hand-made 5 to 10 second chunks per world, mixed by the spawner, like Jetpack Joyride's set obstacle layouts.
- **Fair difficulty.** Ease up after two quick deaths; tighten when a player runs clean. Bots show the gap between \"decent\" and \"perfect\" is too wide.

### Concept risks

- It can feel like \"Temple Run in 2D\". The fix is what Temple Run doesn't have: Boo, the flights, the worlds and the humor.
- A chaser plus 8 worlds plus weapons plus flights is a lot of systems. Every new idea should make the chase better, or wait.

## Repetition and boredom

The game gets boring in three places: the first 400 m of every run, the middle of a long run, and the meta after about 20 runs.

| When it gets samey | Why | Fix |
|---|---|---|
| The first 1 to 2 minutes of every run | Always the hospital, always the same easy traps | Start runs in any world you've reached; a \"skip to\" with a cost; a different opening each day |
| Mid-run, 1,000 m and up | Same trap pool, only faster; no events between gates | One scripted moment per world (a chase set piece, a flight, a boss beat) |
| Every 400 m | Gates are the only change, and they're visual only | A gate should change the rules a little: new trap, new creature twist, a story line |
| After a death | Same results screen, same missions | Rotating daily missions, a \"you almost beat X\" line, a new tip |
| After 20 runs | Most hats are cosmetic for Boo; candles have little to buy | Things that change how a run plays: perks, weapon upgrades, new starting worlds |
| After a week | Nothing new appears | A weekly event: one world with a modifier (fog, double speed, no weapons, creature in the trees) |

Research backs this: players leave when sessions feel empty and have little variety, and when updates are too slow (GameAnalytics). A good fix mixes activities inside one session (Game Developer).

## Story and plot

The existing story is good and short: Milo wakes at 3:33 AM in St. Mercy, the lights are dying, something in the dark is hungry, and Boo grabs him. The 12 journal pages add lore (Boo was the night janitor; the carnival closed in 1931). What's missing is THE STRETCH and an ending.

### Proposed v6 story (a draft for you to change)

- **The hook:** At 3:33 AM every light in St. Mercy dies at once. Something tall unfolds from the dark at the end of the ward and smiles at Milo. Boo, the old night janitor's ghost, shouts \"RUN!\"
- **Why it chases:** THE STRETCH collects people who are awake at 3:33. Candles hurt it. Boo can carry Milo, but ghosts get tired fast, so they mostly run.
- **The middle:** Each world is a step toward the Other Side, where the door that \"forgot to close\" is. Each gate gives one line of story and one journal page.
- **The ending:** In the Other Side, Milo and Boo close the door with THE STRETCH on the far side. The lights in St. Mercy come back on. A last shot: the clock flips to 3:33 again. Endless mode unlocks.
- **The twist (optional):** Boo was the one who left the door open, the night he died. He's been trying to fix it ever since.

### Where story lives

| Moment | What it shows | Length |
|---|---|---|
| First launch | 5-card intro, rewritten for the chase | 15 s, skippable |
| Each world gate (first time) | One line from Boo, one shot of THE STRETCH doing something new | 3 s, no stop |
| Journal | One page per unlock, now about THE STRETCH as well | Read any time |
| Death | THE STRETCH line or Boo line that fits the cause of death | 2 s |
| Ending | The door closes, the lights come on | 30 s |

## Funniness

The game has a little humor (Boo's quips, journal lines like \"the music never got the memo\"), but none of it is in the moment-to-moment play. Spooky fun works when the scary thing is also a bit ridiculous.
What comedy research says works in games: every action gets a response, gags are short and timed (often to the music), and they start from something familiar and then break it (Game Developer on McPixel 3). Failure is the best place for a joke, because players see it most (Berkun on Jetpack Joyride).
Ideas that fit Ghostline:
- **THE STRETCH is scary but clumsy.** It trips on the same tombstone you jumped, bonks its head on low beams, gets stuck in the morgue drawer for a second.
- **It has habits.** It stops to straighten a crooked painting. It's afraid of the carnival clown. It waves when it catches you.
- **Funny deaths.** Each trap has its own short death gag: Milo stuck in a drawer with a toe tag, Milo riding the coaster cart away while the creature chases it.
- **Boo's commentary.** Boo panics, gives bad advice (\"JUMP! No, the other jump!\"), complains about his back, apologizes when you die.
- **Silly unlocks.** A party hat for THE STRETCH, a \"mom calling\" ringtone it answers mid-chase, a skin where it's just a very tall man in a bad costume.
- **Callbacks.** Journal lines that pay off in play (\"399 of them are quiet\": the 400th grave in Crowsrest is the one that grabs you).

## Retention: why players keep it instead of deleting it

Most players are gone within a week, so the first session and the first day decide almost everything. In GameAnalytics' 2025 benchmarks, the top quarter of mobile games keep about 26 to 28% of players on day 1, the median game keeps 3.4 to 3.9% on day 7, and 75% of games keep under 3% by day 28. A typical session is 5 to 6 minutes (GameAnalytics benchmarks).

### What each time window needs

| Window | The player is asking | What keeps them | Ghostline today |
|---|---|---|---|
| First 60 seconds | \"Is this fun?\" | Play right away, no barriers; a clear win in the first minutes (GameAnalytics FTUE tips) | Story cards first, then a run that can end in 110 m |
| First session | \"Do I want one more?\" | Retry in one tap, a mission almost done, something new unlocked | Good: one-tap retry, missions, unlock bar. Broken missions hurt it |
| Day 1 to 7 | \"Why open it today?\" | A daily reason: gift, streak, daily run, event | 4-hour gift and daily mode only |
| Week 2 and on | \"Is there anything left?\" | New content on a schedule; Subway Surfers adds a new city every 3 weeks (PocketGamer.biz) | Nothing new after the 8 worlds |
| Always | \"Is it fair?\" | Steady difficulty, no sudden spikes, short sessions (GameAnalytics) | Mostly fair; the 2-stumble rule is harsh early |

### The retention plan for Ghostline

1. **First 60 s:** skip the story on first tap, a safe first run that can't end before 300 m, one guaranteed flight in the first run.
2. **First session:** v6 missions that complete on runs 1, 2 and 3; an unlock on every run (already there).
3. **Daily:** a streak (day 1 to 7 rewards), a daily seed run with a leaderboard, the gift.
4. **Weekly:** a world-of-the-week event with a modifier and a cosmetic reward.
5. **Long term:** the ending, then endless mode, then new worlds on a schedule.
6. **Measure it:** log runs, distance, death cause and returns, so changes are judged on data.

## How a good game roadmap is built

A good roadmap is a list of phases, each with a clear deliverable and a gate you must pass before moving on. The standard phases are concept, prototype, vertical slice, alpha, beta, gold and post-launch (Wayline).

| Phase | Delivers | Gate to move on |
|---|---|---|
| Concept | What the game is and isn't, who it's for, why it's different | Specific, not vague |
| Prototype | The core loop with placeholder art | It's fun before you invest more |
| Vertical slice | One small part at final quality: art, sound, UI, gameplay | Proves the team can hit the quality bar |
| Alpha | Every feature in, playable start to finish, buggy | Feature complete; no new features after this |
| Beta | All content in, bugs fixed, balanced | Stable enough for wide testing; playtest feedback applied |
| Gold | Final build, store checks done | Ready to submit |
| Post-launch | Monitoring, fixes, updates, community | Updates on a steady schedule |

Rules that make roadmaps work:
- **Goals are measurable:** \"day 1 retention above 30% in a 20-person test\" beats \"make it fun\".
- **Feature freeze is real:** after alpha, new ideas go on a \"later\" list.
- **Playtest at every gate:** each gate is passed with real players, not bots.
- **Small batches:** plan in 2-week chunks so the plan can change.

Ghostline today: v5 reached beta (shipped kit, tests, store pages). v6 is between prototype and vertical slice.

## Ghostline roadmap

**Roadmap (diagram in the doc): fix v6 first, then prove quality on two worlds before building the rest.**

| Phase | Time | What | Gate |
|---|---|---|---|
| 1. Fix v6 | 2 weeks | Story and missions for v6, perks and charms, flights longer and rarer; THE STRETCH sounds, chase music, a safer first run | 5 new players get it without help |
| 2. Vertical slice | 2 to 3 weeks | Worlds 1 and 2 at final quality: Milo frames, creature animation; trap art, a real death scene, one flight set piece | Testers ask for one more run |
| 3. Alpha | 4 to 6 weeks | All 8 worlds: set pieces, creature twists, the ending; weapons with a purpose, hand-made trap patterns | Feature freeze, nothing new after this |
| 4. Beta | 3 to 4 weeks | Balance, onboarding, daily streak, daily run, weekly event; analytics, v6 store kit, save migration from v5 | 30% of 20 testers come back the next day |
| 5. Launch and live | ongoing | Web and itch first, then Android; one event a month, new worlds on a schedule | |

Fix what v6 broke first, then build two worlds at final quality, and only then the other six. Each gate is passed with real players, not bots. Times assume part-time work and are guesses until you answer the questions below.
Nothing new gets built until phase 1's gate is passed.

## What you forgot to mention

Your list covered the game itself well. These are the areas it skipped, each with a short answer so nothing is left open.

| You didn't mention | Why it matters | Filled in |
|---|---|---|
| Sound and music | Half of horror is sound; THE STRETCH is silent | Creature sounds, chase music that follows the danger, a sound per trap and weapon |
| Real playtesting | Every number so far comes from bots | 5 people who have never seen it, no explaining, watch where they die and when they quit |
| What success means to you | Portfolio piece, players or money each lead to a different plan | Decide first; the roadmap assumes \"lots of players, small income\" |
| Money | Decides the shop, rewards and ads | Free, no forced ads; optional rewarded ad for a second chance; cosmetics; or a one-time price on itch |
| Platforms and release | Web, itch, Android and iPhone each have their own steps | Web and itch first (already set up), then Android through a wrapper |
| Analytics | You can't fix what you can't see | Log runs, distance, death cause and day-1 return; privacy page already exists |
| Performance | Old phones drop frames and drain battery | Test on a low-end Android; keep 60 fps; pause when hidden (already there) |
| Accessibility | More players, better reviews | One-button mode, bigger touch areas, reduce flashing (setting exists), colorblind check |
| Age and privacy | Spooky fun attracts kids; stores ask for an age rating | Keep it cartoon; no chat; no personal data; rating \"mild fantasy violence\" |
| Languages | Kosovo, Albania and big markets don't all read English | Few words in the game makes it cheap; Albanian and Spanish first |
| Marketing | Nobody plays a game they never hear about | Short clips of THE STRETCH chases for TikTok and Shorts; an itch devlog; a trailer |
| Name and brand | THE STRETCH and Ghostline need to be yours | Check the names are free; make an icon with THE STRETCH's grin |
| Your time | You have a full-time job and other projects | Plan in 2-week chunks; each chunk ships something playable |
| v5 vs v6 | v5 is on main and shipped | Decide when v6 replaces it; migrate saves so players keep candles and unlocks |
| Content cadence | Live games need new things on a schedule | Pick something you can keep up: one event a month, not every 3 weeks |
| Saves across devices | Clearing the browser wipes progress | Backup code exists; cloud save later if players ask |

### Questions for you

1. What does success look like for Ghostline: a portfolio piece, 10,000 players, or income?
2. Should THE STRETCH stay scary-funny, or get scarier?
3. Do you want an ending, or stay endless only?
4. Where do you want to release first: web and itch, or Android?
5. How many hours a week can you give it?
6. Do you agree with the flight numbers in the Gameplay section (8 to 10 s, about once every 2 worlds)?

## Sources

- Lessons on failure from Jetpack Joyride (Scott Berkun, on Luke Muscat's Failcon 2012 talk)
- How evil monkeys chased Temple Run to App Store #1 (TechCrunch)
- Sybo on the evolution of Subway Surfers (PocketGamer.biz)
- Great mobile games are managed as habits, not hits (Adrian Crook)
- GameAnalytics mobile gaming benchmarks 2025 (Game Dev Reports)
- 16 reasons players are leaving your game (GameAnalytics)
- 16 reasons why players are leaving your game (Game Developer)
- Tips for a great first-time user experience (GameAnalytics)
- Setting game development milestones, concept to launch (Wayline)
- How McPixel 3 incentivized failure by being funny (Game Developer)
