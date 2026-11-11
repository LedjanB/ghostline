# Claude Code task report: Milo Lab move keyboard regression fix (11 Nov 2026)

Branch `v6-runner` only. `main` untouched.

## DONE
Replaced the timing-sensitive immediate assertion on line 1240 of `tests/ghostline.spec.js` with a condition-based `waitForFunction`. The old code called `keyboard.press('3')` and immediately evaluated `milo.anim` without yielding, which could race the game loop. The new code polls until `window.__milolab.milo.anim === 'touch'`, giving the game loop time to process the keypress. The genuine keyboard interaction, the exact `'touch'` outcome, and the save/page-error assertions are all preserved. No sleeps, no state injection, no skipping.

One-line diff in `tests/ghostline.spec.js`:
```
- expect(await page.evaluate(() => window.__milolab.milo.anim)).toBe('touch');
+ await page.waitForFunction(() => window.__milolab.milo.anim === 'touch');
```

## CHECKED
- Read `docs/claude-next-task.md`, `docs/ghostline-production-coordination.md`, `docs/owner-notes.md`, `CLAUDE.md`.
- Read `tests/ghostline.spec.js` lines 1225-1284 to confirm the exact location of the timing-sensitive check and that the later separate Milo Lab animation test (lines 1246-1284) was not touched.
- Ran focused test: `npx playwright test -g "milo lab move: frames exist; keyboard walk, run, turn, jump, land; touch thumb; gamepad stick; acting intact"`
- Result: **1 passed (6.9s)**. No page errors.

## BLOCKED
Nothing blocked.

## NEXT
His review of Ward 4 movement lab V1 (`?wardlab=1`) on PC + iPhone; then a clean modular Bed 7 set + room shell to replace the plate. (From owner-notes.md Nov 9 entry.)
