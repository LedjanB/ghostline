STATUS: RUN

# Bounded task: stabilize Milo Lab movement-to-acting keyboard regression check

This is a NEW small test-only task, not the previously failed final awakening assertion. The workflow now preinstalls Chromium and permits npx Playwright. Do not touch the previous failing test near lines 1276-1282.

## Scope
- Read CLAUDE.md, docs/owner-notes.md, docs/ghostline-production-coordination.md.
- In tests/ghostline.spec.js locate the FIRST Milo Lab movement test's return-to-acting section (near lines 1237-1246), where pressing '3' is followed by an immediate synchronous assertion that milo.anim is 'touch'.
- Replace ONLY that immediate timing-sensitive check with Playwright's condition-based waiting/assertion, retaining genuine keyboard.press('3'), the exact 'touch' outcome, and save/page-error assertions. No sleeps, state injection, skipping, or weaker checks.
- Edit ONLY tests/ghostline.spec.js and docs/claude-task-report.md. Do not modify the later separate Milo Lab animation test, any game code, assets, workflows, task file, dependencies or output.txt.
- Run a focused test via npx playwright test with a test-title filter, if feasible. The workflow runs the full suite afterward.
- Record concise DONE/CHECKED/BLOCKED/NEXT and actual commands/outcomes in docs/claude-task-report.md. If blocked, explain and stop; do not pretend success. No subagents. Do not commit or push.

## Acceptance
One minimal test-only diff, real keyboard interaction preserved, focused test result accurately reported. No gameplay changes. Stop after this single task.
