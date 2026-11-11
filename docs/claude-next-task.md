STATUS: RUN

# Ghostline bounded task: stabilize Milo Lab keyboard focus/animation assertion

## Context
This is the first bounded Claude task after the independently reviewed completion guard was activated on v6-runner. Previous attempts ended at the old eight-turn ceiling without a substantive change. Do not repeat the previous Ward 4 ghost-toggle task. This task is a DIFFERENT, single-test focus.

## Exact scope
- Read CLAUDE.md, docs/owner-notes.md, docs/ghostline-production-coordination.md and this task.
- Inspect ONLY the Milo Lab keyboard test at the end of tests/ghostline.spec.js (near lines 1276-1282) and the directly relevant Milo Lab keyboard/focus handler if needed.
- The flaky assertion presses 3 (touch), ArrowRight, Enter and immediately expects the selected animation to be awakening. Determine whether it races animation/input handling or has a mistaken focus assumption. Make the smallest reliable TEST-ONLY correction that still sends genuine keyboard input and asserts the actual awakening animation, not merely that a handler was called.
- Preserve every meaningful assertion. No direct state mutation, no arbitrary sleeps, no skipping, no changing gameplay, artwork, scene implementation, opening, runner, boss or saves.
- Edit ONLY tests/ghostline.spec.js and docs/claude-task-report.md. Never edit workflows, docs/claude-next-task.md, output.txt, or unrelated files. No dependencies or subagents.
- Run the focused Playwright test if feasible; the workflow runs the complete suite. Report DONE/CHECKED/BLOCKED/NEXT with exact commands and outcomes. If unable to substantiate a safe fix, report BLOCKED and stop rather than guessing.
- Do not commit or push; the GitHub workflow handles that after validation.

## Acceptance
A small reviewable keyboard-input test stabilization with intact behavioral checks and an accurate updated report. Real keyboard behavior tested via Playwright only; do not claim real-device verification. Stop after this one task.
