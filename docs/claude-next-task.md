STATUS: RUN

# Bounded Ward 4 QA fix: Playwright evaluation context

## Why this is a new, diagnosed correction
The prior task (GitHub Actions run 42705234833) FAILED: 44 passed, 4 Ward 4 tests failed. The specific error was `page.evaluate: ReferenceError: getScene is not defined`, reported at lines 24/39/58/81 of `tests/wardlab.spec.js`. The unsuccessful run was not committed. Avoid repeating the same flawed refactor. This task uses the diagnosed failure to fix browser-side evaluation scope correctly.

## Required work
1. Work ONLY on `v6-runner`. Read `CLAUDE.md`, `docs/ghostline-production-coordination.md`, the existing `tests/wardlab.spec.js`, and this task.
2. Refactor `tests/wardlab.spec.js` to remove dynamic `new Function` while keeping all four original tests intact. IMPORTANT: Playwright serializes `page.evaluate` callbacks into the browser, so functions or helpers defined in Node/test scope, such as `getScene`, are NOT automatically available to callbacks. Within EVERY evaluate callback, read `window.__game.scene.getScene('wardlab')` directly, or use a named browser global explicitly installed with `page.addInitScript` before navigation. Do not refer to outer Node helpers or closures inside browser evaluation. The regression from run 42705234833 must not recur.
3. Preserve boot/ghost, walk/run timing, bed collision/jump/land, touch input checks, and frame observer behavior. No `eval`, `new Function`, or source-to-code conversion. Only modify `tests/wardlab.spec.js` and `docs/claude-task-report.md`.
4. If possible, run `npx playwright test tests/wardlab.spec.js` with available browser setup and fix failures within this scope. GitHub Actions will separately run `npm test` and only commit on all passing checks.
5. Report DONE/CHECKED/BLOCKED/NEXT accurately in the report. Do not touch game code, art, main, opening, saves, workflow files, secrets, or unrelated `output.txt`. Do not commit/push (CI owns this), spawn subagents, pay, or retry on rate/quota limits.

## Next
Review the results and commit only after the GitHub CI check passes; handle root output.txt hygiene in a separate scoped task later.
