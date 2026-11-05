# Ghostline

It's 3:33 AM at St. Mercy Ward and every light just went out. A ghost named Boo grabs Milo and flies. A spooky-fun pixel runner in the style of Jetpack Joyride: hold to float, grab candles to keep the light on, and get as deep as you can through 8 worlds before the dark catches up.

**Play:** https://ledjanb.github.io/ghostline/

## Controls
- Hold **touch / mouse / Space / Up / W / gamepad A** to let Boo pull you up
- **P**, **Esc** or gamepad **Start** to pause
- Menus work with mouse, touch, arrows + Enter, or a gamepad d-pad + A

## v4: the journey
- **8 worlds, one way down**: St. Mercy Ward, The Cold Room, The Hollow Woods, Crowsrest Cemetery, The Dripping Dark, The Bone Halls, The Dead Carnival, The Other Side. 400M each. You fly through a gate into the next one, no fades, no loops. Each has 5 hand-painted parallax layers, its own weather, its own song and its own giant
- **Story**: a short intro the first time you play, and Boo talks during runs
- **Pace breakers**: Spirit Rush (grab the orb, blast forward, can't be hurt) and Dark Chases (outrun a wall of nothing, candles push it back)
- **Fair darkness**: the dark only covers the background, hazards always stay visible
- **Tutorial tips** the first time you meet each thing
- **8 characters, 10 charms, 56 missions**
- **Settings**: vibration, high contrast hazards, backup / restore save code, lifetime stats
- **Share** your distance from the results screen
- **Offline**: installs as a home screen app and works with no internet
- **Tests**: `npm test` runs 8 Playwright tests (story, saves, journey through all 8 worlds, death, creative, missions)
- **Store kit**: itch.io build, store page text, privacy policy, screenshots. See `docs/SHIPPING.md`

## Characters (buy with candles)
| Character | Price | Perk |
|---|---|---|
| Milo | free | none |
| Nurse Ivy | 150 | light lasts 40% longer |
| Dex the Hunter | 400 | survives 1 hit per run |
| Little Lila | 800 | candles count double |
| Wraps | 1500 | wins the Grave Spin more |
| Count Vlad | 2500 | Spirit Rush lasts twice as long |
| Rattles | 3500 | banshees fly slower |
| Fang | 5000 | power-ups last 50% longer |

## Modes
- **Normal**: one life, best distance counts
- **Daily Haunt**: same run for everyone today, race your own ghost
- **Creative**: you can't lose. You're reborn on the spot and **CONTINUE** picks up where you stopped

## Fullscreen on iPhone
1. Open https://ledjanb.github.io/ghostline/ in Safari
2. Tap Share, then **Add to Home Screen**, then **Add**
3. Open Ghostline from your home screen and turn the phone sideways

## Older versions
- v3 added missions, souls + Grave Spin, charms, power-ups, B-O-O letters, Daily Haunt, lasers, medals and free gifts (researched from Jetpack Joyride, Subway Surfers, Canabalt, Alto's Adventure and more)
- v2 added a fixed 120 Hz simulation, pacing, near misses and the settings screen
- v1 is kept on the `v1` branch

## Tech
- [Phaser 4](https://phaser.io) (vendored in `vendor/`), plain ES modules, no build step
- All pixel art and audio are generated in code (`src/zones.js`, `src/art.js`, `src/audio.js`)
- Built with [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) (Apache-2.0), installed in `.claude/skills/`. Start any change with the `router` skill
- Art direction: `docs/art-direction.md`. Economy numbers: `docs/economy.md`
- Font: Press Start 2P (SIL OFL, `fonts/OFL.txt`)
- Privacy: no data leaves your device (`privacy.html`)

## Run locally
```
cd ghostline
python -m http.server 8000
```
Then open http://localhost:8000

## Test
```
npm install
npx playwright install chromium
npm test
```
