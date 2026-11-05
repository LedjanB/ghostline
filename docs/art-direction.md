# Ghostline art direction

Made with the `create-game-assets` skill's brief. All art is drawn in code: actors in `src/art.js`, worlds in `src/zones.js`.

## Game frame
- Player fantasy: a nobody being dragged through haunted places by a friendly-ish ghost
- Core verbs: hold to float, release to fall, grab candles, dodge
- Engine and renderer: Phaser 4.2.1, WebGL, `pixelArt: true` (nearest filtering, rounded pixels)
- Target platforms: desktop browser, phone browser (landscape)
- Camera/view/facing: fixed side view, player faces right at x=150
- Native viewport: 640x360, scaled to fit. Sprites drawn at 1x and shown at 2x (backgrounds) or 2x (actors)
- Typical actor size on screen: 24x32 px (player), 28 to 48 px (hazards)

## Visual system
- Tone: spooky fun. Cute ghost, goofy-scary hazards, never gore
- Shape language: round and soft for friendly things (ghost, candles), spiky and angular for hazards (claws, blades, banshee hair)
- Silhouette priorities: 1 player, 2 hazards, 3 candles, 4 background
- Value structure: dark backgrounds (values 10-25%), mid-value actors, brightest values only on light sources (candles, spirit beams, lamp)
- Palette roles:
  - Night base `#07060d`, UI panel `#140f24`, UI edge `#8f7fbf`
  - Ghost `#e6f0ff` / shade `#9fb8e8`
  - Candle light `#ffd75e` / `#ff8a2a`
  - Spirit danger `#4fe38a`, banshee `#cfe0ff` with `#ff3355` eyes, warning `#ff2244`
  - Zones: each zone has its own sky gradient and exactly one accent color (see `ZONES[].accent` in `src/zones.js`)
- Edge treatment: every actor and icon has a 1px `#0b0918` outline; backgrounds have none
- Lighting: light comes from candles and the player; darkness grows as the LIGHT meter drains
- Motion character: bouncy and quick (Back ease on pops, squash on landing), hazards telegraph before they act
- Exclusions: no blood beyond tiny stains, no real people, no copyrighted characters

## Technical contract
- Actor sprites: text-row pixel maps, 1 char = 1 px, `.` = transparent, +1 px outline on each side
- Characters: 12x16 base (14x18 with outline), frames `run0`, `run1`, `fly`
- Backgrounds: painted per zone into a `Buf` pixel buffer, seamless horizontally, 5 layers: sky, far, mid, near, edge (ceiling + floor band, opaque). Scroll factors .03 / .1 / .3 / .6 / 1
- Zone gates: 80x180 opaque set pieces (`gate_<i>`) that hide the seam where one zone's layers end and the next begin
- Max 16 colors per sprite (checked with `asset_report.py`)
- Naming: `<thing>` or `<character>_<frame>`, zone layers `<zone>_<sky|far|mid|near|edge>`

## World painting rules (v4)
- Indie storybook look: Bayer-dithered gradients, no smooth blends, no anti-aliasing
- Atmospheric perspective: farther layers are lower contrast and pushed toward the sky color; nearest layers are darkest silhouettes
- One accent color per zone, used for lights only (windows, lanterns, eyes, bulbs). Never on hazards
- Backgrounds never use the hazard colors (`#4fe38a`, `#ff2244`) so dangers always read
- Each zone gets: a sky event (moon, aurora, lightning), a landmark silhouette, a weather particle set and one background giant
- The 8 worlds go from real to unreal: hospital, morgue, woods, cemetery, sewer, catacombs, carnival, the other side
