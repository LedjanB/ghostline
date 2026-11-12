# Claude Code task report: Opening prelude on the approved concepts (12 Nov 2026)

Branch `v6-runner` only, `main` untouched. Review route: **`?opening=1&prelude=1`**. Production `?opening=1` and first launch are unchanged.

## DONE
- **Saved the two approved concepts** to `assets/reference/`: `Ghostline_St_Mercy_Exterior_Concept_01.png` and `Ghostline_Ward4_Corridor_Concept_01.png`. Byte-identical to the owner's files, own commit `b588f31`.
- **The prelude is now built on them.** Both are 640x360, the game's size, so they are shown 1:1 with a fixed camera: compositions untouched. Copies serve as `assets/opening-prelude/st-mercy-exterior.png` and `ward4-corridor.png`.
- **The Python-painted exterior/corridor/mist/tube layers are gone.** `scripts/prelude-art.py` now only makes the small V2 room props (wall clock, soft glow).
- **Animation, restrained, all in light and weather (never the camera):**
  - **Exterior, 5.4 s:**
    - fades up from black;
    - live rain in two depths over the painted rain;
    - the warm reflections of the porch and the ambulance in the wet ground ripple (the concept's own pixels, nudged whole pixels);
    - the lantern by the sign breathes, the porch light hums, two ward windows glow faintly.
  - **A dip to black,** then the **corridor, 3.8 s:**
    - the overhead tube is dying; when it drops out, its stripe on the wet floor fades with it, with soft edges;
    - the far exit light pulses; dust drifts in the tube's light.
  - **Fade to black** into the **Bed 7 V2 room**, unchanged: approved room plate, approved Milo at 1.5x, 3:32 to 3:33, the power cut, the separation, the landing by the window.
- Same sound as before: storm outside, muffled rain and vent inside. Not playable: gate, then a tap/key skips after 1 s. No save writes.

## CHECKED
- **Video:** `shots/opening-v3/opening-v3.mp4` is 32.9 s at an exact 30 fps. The real game is stepped frame by frame (`game.step`, 1/30 s) and screenshotted, so there are no capture hitches. It runs from the gate press to the end of the review cut. No page errors.
- **Stills** from the same run, inspected: `1-exterior`, `2-corridor`, `3-corridor-tube-out`, `4-bed7-332`, `5-separation`, `6-landed`.
- **One focused test, run once: 1 passed** (`npx playwright test -g "opening V2 review"`). It checks:
  - exterior and corridor are the concept textures at 640x360, camera zoom 1 at scroll 0,0;
  - the hand-off to Bed 7 on the approved plate with the approved sleeping Milo at 1.5x, clock 3:32;
  - 3:33, the separation, the landing at (548, 335);
  - save untouched; `?opening=1` still the old opening; no page errors.
- Not run, per the rules: full suite, bots.

## BLOCKED
Nothing.

## NEXT
Owner / ChatGPT review of `opening-v3.mp4`. Then approved keyframes for the closer Bed 7 beats (Milo's wristband / breath, his fear at the separation), to integrate the same way.
