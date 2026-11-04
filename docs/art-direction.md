# Ghostline art direction

Made with the `create-game-assets` skill's brief. All art is drawn in code in `src/art.js`.

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
  - Zones: hospital teal-grey `#22323a`, forest purple `#120b24` to `#2a1840`, sewer brick `#2d2a24` with slime `#3f6b2a`
- Edge treatment: every actor and icon has a 1px `#0b0918` outline; backgrounds have none
- Lighting: light comes from candles and the player; darkness grows as the LIGHT meter drains
- Motion character: bouncy and quick (Back ease on pops, squash on landing), hazards telegraph before they act
- Exclusions: no blood beyond tiny stains, no real people, no copyrighted characters

## Technical contract
- Actor sprites: text-row pixel maps, 1 char = 1 px, `.` = transparent, +1 px outline on each side
- Characters: 12x16 base (14x18 with outline), frames `run0`, `run1`, `fly`
- Backgrounds: 320x180 tiles (forest far layer 640x180), seamless horizontally, 3 layers per zone: far, mid, edge (ceiling + floor band, opaque)
- Max 16 colors per sprite (checked with `asset_report.py`)
- Naming: `<thing>` or `<character>_<frame>`, zone layers `<zone>_<far|mid|edge>`
