# Visual Target V1 (PROPOSAL, not approved)

Art benchmark for Ghostline's story scenes. Status: proposal until Ledjan approves it. Nothing in the game uses it yet.
Play it: `?artlab=1` (keys 1-5 or arrows = view, space = next pose, H = hide buttons; touch: tap a tab, swipe left/right).
Code: `src/artlab-assets.js` (all art, drawn in code), `src/scenes/artlab.js` (the lab). Shots: `node scripts/artlab-shots.mjs` -> `shots/artlab/`.

## The problem it tests
The opening draws Milo 28 art px tall at 4 screen px per art px (about 120 px). Faces are 3 to 4 pixels wide, so emotion only reads through big arm moves.

## Direction
- Native viewport 640x360. One art grid: **1 art px = 2 screen px** (a 320x180 canvas) for the room AND the actors. No camera zoom.
- One scale for everything: Milo 46 art px = 1.7 m, so 1 m = 27 art px. Bed 2.1 m long (57 px), mattress 0.6 m up, door 2.1 m (57 px), ceiling 3.4 m. Wide shot, like Eastward's rooms: the boy is small in a big dark room, the lamp makes the stage.
- Characters: three-quarter view facing right (both eyes visible), about 3 heads tall (head 16, body 30). Slightly gangly: thin long arms, loose pajamas.
- Light is baked per view: base colors x a light map (ambient navy + point lights), quantized to 7 bands with 4x4 Bayer dithering, so falloff stays pixel art. Glows are small dithered sprites added on top (no bloom, no blur). Spirits are drawn after the light pass (they give light, they don't take it).
- Outlines: sel-out (a darker shade of the neighbour on the lit side, near-black on the shadow side), plus inner lines where a limb crosses the body.

## Assets and sizes (art px; on screen x2)
| Asset | Size | Notes |
|---|---|---|
| Milo frame | 40x52 (boy 46 tall, 92 on screen) | skeleton per pose (shoulders, elbows, wrists, hips, knees) + a hand-made 16x16 head + an 8x9 face grid per expression |
| Milo poses | neutral, confused, shocked, frightened, reach, recoil | + a breath frame each (chest and head 1 px down) |
| Milo asleep | 50x26 | same head (eyes shut) on the raised pillow, arm on the blanket, wristband |
| Spirit Milo | same pixels | every color remapped by brightness to a 9-step spirit ramp, light rim, 2 px dithered halo |
| Boo | 50x60 | stout old man, cap with brass badge, white mustache, big nose, work jacket with name patch, belt with key ring (5 keys), lantern held out, far arm spread back (shelters), wisp tail (4 frames) |
| Bed 7 room | 320x180 | ceiling + cornice, aged grey wall with stains and a crack, wainscot, linoleum with a seam under the bed, curtains, bed (steel tubes, pillow, blanket, chart), table, lamp, cup, wall monitor (17x11 live ECG), oxygen panel, call cord, door with wired glass, plate 7, clock 3:33 |
| THE STRETCH | polygon, about 150x170 | shadow only: legs from the floor, back folded onto the ceiling, head hanging (a ridge like a cap brim), one long arm, 5 long fingers |

## Palette
- Night: `#07080d` `#12141b` (ceiling), wall `#33373e` to `#5a5e5c`, wainscot `#3c4842` `#2a332f`, floor `#2e302b` `#46473e`.
- Warm light: lamp `#ffb24a`, shade `#ecb464` / `#c88a42`, lantern glass `#ffe4a0` `#fff3cf`, flame `#ffb648` `#ff9a3a`.
- Spirit ramp: `#0c1430` `#16275a` `#24408a` `#3a64b6` `#5f8fd8` `#8dbcf0` `#bfe0ff` `#e9f7ff` `#ffffff`, Ghostline `#c4deff` + white pulse.
- Milo: skin `#f7d6b4` `#e8b38c` `#c3846a` `#8a5446`, hair `#4e3a31` `#2c201d` `#1b1416` `#0c0809`, pajamas `#d3dee4` `#a8bac8` `#7c91a6` `#4f6179` (stripe `#93a8ba`), wristband `#ffffff` / `#b9c2cf`.
- Boo: ghost `#eef6f2` `#cfe0d8` `#8eaaa2`, jacket `#7fa0a8` `#58797f` `#3d5a63`, cap `#4d6380` `#33455f` `#222f44`, brass `#d6a84a`.
- Threat light: cold beam `rgb(.6,.74,1)`; monitor on battery red `#ff6a4a`.

## Animation requirements (for a real adoption)
- Every pose needs at least a breath frame; real acting needs in-betweens (2 to 3 frames between key poses), blinks (1 frame, every 3 to 5 s) and a mouth frame for each line.
- Walk/run cycles must be redrawn at this size (8 frames), the old 4-frame run won't scale.
- The Ghostline is anchored to the wristband joint of the current frame (the skeleton gives it), so it follows any pose for free.
- The shadow animates by moving polygon points (breathing, fingers testing the light), 12 fps.

## What the screenshots showed (limitations found)
- Faces at 16 px heads still carry only 2 to 3 pixels per feature. Shocked, recoil and confused read; neutral vs reach is subtle. Body pose does most of the acting. A bigger head (18 to 20 px, closer to Eastward's chibi proportions) or a portrait for dialogue would make faces read on a phone.
- The skeleton renderer makes poses fast and the Ghostline exact, but limbs are capsules: hands are 3 to 5 px blobs with line fingers, knees and elbows don't fold cleanly. A pixel artist would hand-clean every key pose.
- Rotating heads (lying down, looking up) can't be done in code without breaking pixels; the sleeper uses a stepped tilt.
- The room at the true 27 px/m scale leaves a lot of empty wall. Good for the shadow, but each room needs set dressing (or a smaller ceiling) to avoid feeling empty.
- Lighting is baked once per view; moving lights would need a cheaper light pass (or a few pre-baked states).
- Boo's face is the weakest part: the cap brim and mustache hide most of it at this size; eyes are 2x2 pixels.
- Verdict: clearly more readable and more coherent than V2, but this is programmer art at a good level, not professional pixel art. For a commercial look, use these files as the spec and have a pixel artist redraw Milo's keys, Boo and the room.

## Rules if adopted
- Never mix grids: an art pixel is 2 screen px everywhere in the scene, characters and room alike.
- Never scale or rotate sprites at runtime. Facing is a flip.
- Spirits: same drawing, remapped colors. No separate ghost drawings.
- THE STRETCH: shadow only, inside a light. It needs a lit surface to exist.
