# Ghostline: Approved Milo concept and animation-test handoff

## Status
This is the **approved artistic reference**, not an approved production sprite atlas.
The user chose the detailed, expressive teen design in `assets/reference/milo-approved-concept.png` on Nov 8, 2026.

## Canonical look
- Sixteen-year-old Milo, slightly gangly teenage proportions, not a child/chibi.
- Messy dark hair, tired expressive dark eyes, readable brows, subtle freckles.
- Loose muted-blue hospital pajamas, small repeated pattern, slippers.
- White hospital wristband, always on the same wrist.
- Warm flesh tones for the living Milo; pale-blue spectral treatment for his ghost.
- Atmospheric midnight palette, deep navy shadows, delicate cyan rim and warm amber practical light.
- Emotion through posture AND facial expressions: idle, looking at hands, reaching, touch passing through, recoiling, fear.

## Benchmark requirements
1. **First create a separate animation test**, not a new opening and not a whole-game redraw.
2. At native 640x360 viewport and on iPhone, distinguish a teenage face and the emotions.
3. Consistent sprite alignment, proportion, hair, pajama patterns and wristband in all poses; feet grounded in the same place.
4. Transparent RGBA image sprites and actual sprite swapping/animation, not procedural character renderers.
5. A small 4-beat sequence: look at hands -> look toward body -> reach -> recoil, with a player-controlled replay or stepping UI.
6. Include ghost and living color variants for comparison, but avoid drawing two different people.
7. Show a scale-comparison reference with the prior Art Lab Milo if useful.
8. Existing `?opening=1`, `?artlab=1`, gameplay, saves unchanged.

## Important limits of the source image
- The approved PNG is a **concept sheet**, with characters, text, gradients, and dark backgrounds combined in a single raster image.
- Its pictured poses are **not** a clean RGBA spritesheet. Direct cropping will capture background and may cut off wisps of hair, limbs, or feet.
- Do **not** ship a crop with a black rectangle, harsh segmentation, missing hair or a mangled face just to say it's complete.
- Clean, original, consistent, artist-quality RGBA frame artwork is a production deliverable to validate. An engineer may need an image editor or dedicated visual art pipeline; changing source pixel resolution alone doesn't solve this.
- If clean images cannot be produced with available tools, document the blocker and provide the best honest preview; do not silently replace this design with rectangles, capsules, line limbs or the former procedural sprites.

## Reference crops
`assets/reference/milo-turnaround-reference.png`: consistent appearance from multiple views.
`assets/reference/milo-faces-reference.png`: expression targets.
`assets/reference/milo-acting-reference.png`: acting/key-pose targets.
`assets/reference/milo-game-size-reference.png`: intended game-scale readability.
Each crop is a **reference only**, not a frame/texture ready to use in gameplay.
