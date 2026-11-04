# Ghostline

A spooky-fun pixel runner in the style of Jetpack Joyride. A ghost drags you through a haunted hospital, the woods and the sewers. Hold to float, grab candles to keep the light on, dodge spirits, hands, swinging blades and banshees.

**Play:** https://ledjanb.github.io/ghostline/

## Controls
- Hold **touch / mouse / Space / Up / gamepad A** to let the ghost pull you up
- **P**, **Esc** or gamepad **Start** to pause
- Menus work with mouse, touch, arrows + Enter, or a gamepad d-pad + A

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
