STATUS: RUN

# Autonomous bounded task 1: remove dynamic test evaluation

## Purpose
Issue #1 review identified unnecessary `new Function('s', 'a', src)` in `tests/wardlab.spec.js`. Replace dynamic source-string evaluation with direct, typed/readable `page.evaluate` callbacks or a fixed named test API. This is a test-only code hygiene improvement, NOT a gameplay or art change.

## Scope and acceptance
1. Read `CLAUDE.md`, `docs/owner-notes.md`, `docs/ghostline-production-coordination.md`, and `tests/wardlab.spec.js`. Use the approved `v6-runner` branch only.
2. Edit ONLY `tests/wardlab.spec.js` and `docs/claude-task-report.md`. Preserve all four Ward 4 tests and their assertions and intent (boot/ghost, walk/run/idle tempo, bed/jump/land, pointer/touch).
3. Eliminate `new Function`, `eval`, and string-to-code evaluation. Prefer explicit closures in `page.evaluate`; define small fixed helpers if needed. Preserve the frame state observer semantics without event-listener leaks.
4. Do NOT alter visual assets, source/gameplay, opening, bosses, runner, saves, workflows, task trigger, credentials, `main`, or any other files. If the change cannot be completed safely within this scope, report BLOCKED, do not expand scope.
5. Run focused Ward 4 Playwright tests if the environment permits. GitHub Actions will run the existing complete `npm test` suite and commit only if it passes. Do not commit or push manually.
6. Record concise DONE/CHECKED/BLOCKED/NEXT, and say explicitly which commands actually ran, in `docs/claude-task-report.md`. Report no art/playtest approval as achieved.
7. Do not create `output.txt` or other log files yourself; if present from the runner, do not alter existing unrelated files. Stop after one task. No subagents, repeated retries, quota bypasses or payments.

## Next after this task (not authorized in this run)
Review the diff and Actions tests, then independently address unexpected root `output.txt` and restore archived Ward 4 movement report through a separate small approved hygiene task. Continue only when coordination safeguards permit.
