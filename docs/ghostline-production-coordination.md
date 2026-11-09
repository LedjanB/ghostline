# Ghostline — shared production coordination

Updated November 9, 2026. The detailed task and cross-agent conversation checkpoint is in [GitHub issue #1](https://github.com/LedjanB/ghostline/issues/1).

**Branch rule:** do not change `main`. All work is on `v6-runner` or feature branches based on it. Claude Code must not make speculative/large rewrites or move outside task scope.

## Latest approved direction

- **Use the exact Ward 4 screenshot described by owner as "This Version in this pic, IS PERFECT, including Milo" as the visual reference.** The image exists in the ChatGPT conversation but is not verified as present in this GitHub repo. Do not invent/approximate a replacement. Obtain the reference if needed.
- Milo: 16, only playable character, exact approved haircut/face/pajama details/proportions. Existing sprites are technical starting points, not automatically final.
- Atmosphere: blue rainy hospital, subtle amber practical lighting, good unmodified base lighting. No crosses or religious symbolism.
- Boo: small round supernatural ghost with janitor cap, keys, lantern. Reject older elderly human-like prototype.
- Opening: fully non-playable until Boo tells Milo to RUN, then seamless control transition; don't rewrite before we prove a reusable art pipeline.
- Story: Milo's spirit separates from his living body in St. Mercy's Bed 7 at 3:33 AM; the Ghostline links them; haunted Vigil; THE STRETCH is the final boss.
- 2D spooky action-adventure: fast chase, meaningful exploration, distinct boss fights, eight planned worlds.

## Production workflow

ChatGPT = creative direction and technical review; Claude Code = implementation and testing; owner = approval on important visual/gameplay decisions. Create real reusable PNG/environment assets; avoid giant code-drawn scenes or warping a still image into a walk cycle. Phaser 4 at native 640x360 game coordinates, PC/iPhone home-screen/gamepad. Keep runner/bosses/saves/opening untouched until explicitly in scope.

The owner supplied a separately downloaded 64x128-grid CC0 movement reference sheet. It and newer Ward 4 ZIP prototypes may exist only in ChatGPT attachments, **not** GitHub. Verify source/license/files before implementation. Do not substitute the template character for Milo.

## Immediate bounded task

Develop an isolated Ward 4 movement lab: grounded idle/walk/run/jump/land with distinct sprite poses and conventional sprite animation, grounded feet, tempo matched to actual speed, keyboard/touch/gamepad. Reuse approved Milo design, but if exact reference or sprites are missing report the blocker rather than falsely asserting a match. Preserve all existing scenes and saves. Small reviewable changes, relevant tests/real browser check when available, no merge. Report DONE, CHECKED, BLOCKED, NEXT, then stop.

## Hard stop rules

If usage, token, tool, budget, or rate limits hit, stop work, preserve a minimal checkpoint (changed files, verified test results, blocker and single next step), and **do not retry in a loop or purchase credits**. Do not spawn subagents/AI testers without request. A GitHub handoff does not automatically run or communicate with Claude; an explicitly authorized trigger is required. Never commit secrets or auth tokens.

## Roadmap

1. Ward 4 reusable assets and movement lab.
2. Approved round-ghost Boo.
3. Non-playable opening cinematic using shared gameplay assets.
4. One polished vertical slice (cinematic → chase → exploration → boss).
5. Eight-world production and THE STRETCH finale.
6. Performance, control QA, saves, launch.

See [issue #1](https://github.com/LedjanB/ghostline/issues/1) for collaboration and acceptance details.
