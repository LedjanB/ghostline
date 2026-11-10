STATUS: RUN

# Ghostline QA: stabilize the two precisely diagnosed input-state failures

## Evidence and objective
The most recent run, https://github.com/LedjanB/ghostline/actions/runs/42708447669, completed with 46 passing / 2 failing. Changes from that run were NOT committed. The current checked-in test files are still the earlier originals. Fix specifically:
1. `tests/ghostline.spec.js` at the "milo lab: ?milolab=1 opens alone" test around line 1281: after ArrowRight then Enter, expected `window.__milolab.milo.anim === 'awakening'` but it was `touch`. Determine whether keyboard focus, a state transition, or a timing/race made this assertion brittle. Stabilize the test while still genuinely verifying the awakening sequence; do NOT just remove or weaken the assertion.
2. `tests/wardlab.spec.js` around line 30: after moving with 'd', `keyboard.press('g')` did not switch scene ghost to true within 5s. Diagnose keyboard focus/press handling and repair the test to reliably assert actual ghost form, without mutating the scene's ghost state to force a pass.

## Scope
- Read `CLAUDE.md`, `docs/owner-notes.md`, `docs/ghostline-production-coordination.md`, and both tests.
- Edit only `tests/ghostline.spec.js`, `tests/wardlab.spec.js` and `docs/claude-task-report.md`. No gameplay, source, sprites, approved art, workflows, saves, main or task-file edits.
- This is NOT another general test-evaluator refactor. Leave the existing `new Function` helper in wardlab untouched in this task unless a proven direct cause of these two failures.
- Preserve the intended full test coverage and all other assertions. Prefer explicit Playwright focus/keyboard-state synchronization or a real event wait over sleeps, without bypassing the app's actual controls. Don't hide genuine gameplay regressions.
- If you can, run the two focused tests first with existing npm/playwright tools; then report exact commands and results. Existing GitHub Actions runs the whole `npm test` suite and commits only on complete success. If not reproducible safely, explain BLOCKED rather than guess.
- Do not commit or push (workflow owns this); do not create raw session logs or touch unrelated output.txt. No subagents, retried quota errors or payments.
- Report DONE/CHECKED/BLOCKED/NEXT accurately in `docs/claude-task-report.md`.

## After
Independent review CI outcome before dispatching any further task. If all 48 tests pass, separately revisit the dynamic evaluator cleanup and raw output.txt hygiene.
