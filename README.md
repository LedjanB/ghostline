# Ghostline

A spooky-fun pixel runner in the style of Jetpack Joyride. A ghost drags you through a haunted hospital, the woods and the sewers. Hold to float, grab candles to keep the light on, dodge spirits, hands, swinging blades and banshees.

**Play:** https://ledjanb.github.io/ghostline/

## Controls
- Hold **tap / mouse / Space / Up** to let the ghost pull you up
- **P** or **Esc** to pause

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
- Built with skills from [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) (phaser-core, phaser-arcade-physics, game-feel, procedural-gen)

## Run locally
```
cd ghostline
python -m http.server 8000
```
Then open http://localhost:8000
