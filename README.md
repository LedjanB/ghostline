# Ghostline

A spooky-fun pixel runner in the style of Jetpack Joyride. A ghost drags you through a haunted hospital, the woods and the sewers. Hold to float, grab candles to keep the light on, dodge spirits, hands, swinging blades and banshees.

**Play:** https://ledjanb.github.io/ghostline/

## Controls
- Hold **touch / mouse / Space / Up / gamepad A** to let the ghost pull you up
- **P**, **Esc** or gamepad **Start** to pause
- Menus work with mouse, touch, arrows + Enter, or a gamepad d-pad + A

## v3: the best of every runner
Researched Jetpack Joyride 1 & 2, Canabalt, Alto's Adventure, Subway Surfers, Temple Run, Geometry Dash, Robot Unicorn Attack, Bit.Trip Runner, Tiny Wings, Crossy Road, Flappy Bird, Downwell, Smash Hit, Super Mario Run, Zombie Tsunami and horror runners, then took the best ideas:
- **Missions** (Jetpack Joyride, Subway Surfers): 3 active at a time, 1-3 stars each, stars level you up and pay candles
- **Souls + Grave Spin** (Jetpack Joyride final spin): collect souls, spin a slot machine after you die for candles, extra meters or a **second chance**
- **Charms** (Jetpack Joyride gadgets): buy and equip 2 perks (magnet, night light, lucky tooth, head start, bouncy bones, grave robber)
- **Power-ups**: candle magnet, slow-mo, spirit shield
- **B-O-O letters** (Subway Surfers word hunt): spell it in a run for a big reward
- **Daily Haunt** (Tiny Wings / Super Mario Run): same level all day, race your best ghost from today
- **New hazards**: spirit laser rows, banshee swarms, moving beams; banshees speed up deeper in
- **World**: ghouls on the floor that panic and get scared off, giant things in the background, rain + lightning, fog, fireflies, ambience per zone
- **Feel**: ectoplasm exhaust, running dust, a ghost-grabs-you opening, speed that rises like Canabalt, silence right before a scream
- **Medals** on the results screen and a **free gift** every 4 hours

## Creative mode
Switch the mode button (bottom left) to **CREATIVE**. In creative you can't lose: when something hits you, you're reborn on the spot and the hazards around you vanish. Your spot is saved every 10 seconds, on pause and when you leave, so **CONTINUE** picks up where you stopped. Candles you grab still count for the shop; best distance only counts in normal mode. Pause has **RESTART AT 0M**.

## Fullscreen on iPhone
Safari can't make a web page fullscreen, so Ghostline is a home screen web app:
1. Open https://ledjanb.github.io/ghostline/ in Safari
2. Tap Share, then **Add to Home Screen**, then **Add**
3. Open Ghostline from your home screen and turn the phone sideways

## What's in v2
- Fixed 120 Hz simulation so it plays the same on any phone or PC
- Pacing: candle-only breathers, a rising sawtooth difficulty, and each hazard introduced in an easy version first
- Near misses ("CLOSE!"), candle streaks with rising pitch
- Music that builds as you speed up and throbs when a banshee is coming
- Settings: music and sound volume, mute, screen shake and light flicker toggles
- Versioned save with backup; v1 saves carry over
- v1 is kept on the `v1` branch

## Characters (buy with candles)
| Character | Price | Perk |
|---|---|---|
| Survivor | free | none |
| Night Nurse | 100 | light lasts 40% longer |
| Ghost Hunter | 300 | survives 1 hit per run |
| Possessed Kid | 700 | candles count double |

Progress saves in your browser.

## Tech
- [Phaser 4](https://phaser.io) (vendored in `vendor/`), plain ES modules, no build step
- All pixel art and audio are generated in code (`src/art.js`, `src/audio.js`)
- Built with [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) (Apache-2.0), installed in `.claude/skills/`. Start any change with the `router` skill
- Art direction and asset list: `docs/art-direction.md`, `docs/asset-manifest.json`

## Run locally
```
cd ghostline
python -m http.server 8000
```
Then open http://localhost:8000
