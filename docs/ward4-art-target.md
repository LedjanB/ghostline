# Ghostline / Ward 4: visual target locked (9 Nov 2026)

## Owner-approved reference
`assets/reference/ward4-approved-2026-11-09.png` is the owner's approved screenshot. **Its upper gameplay panel (including Milo) is the target.** The instructional panels below are NOT in-game UI.

Approved:
- Milo's original detailed teen appearance and his **relative size** against the room as shown in this image. Never change his design to match a different generated environment.
- Rich but readable, deliberately limited 2D pixel art; cool navy/blues, restrained amber lamps, wet reflected tiles.
- The owner liked the earlier **Lighting OFF** version: base painting must carry the atmosphere. Don't add blanket glow overlays.
- Hospital props, rain, curtain, corridor door and distant silhouettes. **No crosses or other religious symbols anywhere in the game art.**
- Everything should respond correctly when Milo moves: gameplay camera follows; near foreground can overlap him; weather and monitor effects stay in their world positions.
- Same artwork and Milo sprites serve gameplay and cinematics. No separate movie-quality art style.

## What this first vertical slice actually proves
- It runs as `?wardlab=1` in Phaser 4 with the **actual** existing `MiloActor` sprite sheets.
- The artwork is generated once from the approved source, with the baked-in Milo and HUD removed; a real sprite moves through the scene.
- Native game rendering 640x360, horizontal following camera in a room about 1065px wide.
- Collision on floor and Bed 7, keyboard/touch/gamepad movement, ghost toggle, bounded rain, optional extra light OFF by default.
- Existing opening, main gameplay and save files are untouched.

## Honest limitation / next milestone
This is a **matching exercise**, not the final modular art pipeline. The room PNG has a bed, window, curtain and door baked in. The removal under where the reference Milo stood is temporarily hand-retouched and some floor texture is imperfect. World scrolling and Milo are genuinely dynamic; bed/curtain sprites are **not yet** separately animated. The next task is to repaint one clean reusable Bed 7 bed/cabinet set and one empty room shell to replace the plate, then recheck visual fidelity. Do not call this production-ready or copy it across eight worlds.

Do not redesign the approved concept or alter the opening while this lab is being evaluated. No full-engine migration.
