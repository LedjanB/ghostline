# Ghostline Claude Task Template

This file is a **template**. It does NOT trigger a GitHub Actions run.
To trigger a single bounded run, create `docs/claude-next-task.md` on `v6-runner` with the exact status line `STATUS: RUN` and one self-contained task. Do not do this until Claude credentials have been securely added and the workflow has passed one controlled authentication check.

STATUS: TEMPLATE

## One task only
Safely restore and validate the existing Ward 4 movement art lab work (already present as uncommitted files on the owner's PC, not guaranteed to be on GitHub).

## Preconditions
- Do not access, reset or overwrite the owner's PC working tree; this workflow executes on the GitHub runner.
- If the required exact Ward 4 screenshot and approved Milo reference are not in the repository, stop the visual adaptation and report the missing asset. Do not invent a substitute.
- Inspect `CLAUDE.md`, `docs/owner-notes.md`, `docs/ghostline-production-coordination.md` and GitHub issue #1.
- Never modify `main`, the original opening, saved-game structure, or boss/gameplay systems.

## Scope
- Use existing Ward 4 files when actually present.
- Confirm working Milo movement uses distinct sprite poses and frame-based animation.
- Assess missing art and unnecessary procedural rendering; recommend the smallest fix.
- Perform only isolated scene edits. No broad rewrites.

## Acceptance criteria
- Existing tests continue passing.
- New lab loads and can be controlled with PC keyboard.
- Touch and gamepad paths not removed; state if not empirically tested.
- Approved Milo design and environment art are preserved.
- Document DONE / CHECKED / BLOCKED / NEXT in `docs/claude-task-report.md`.
- One run only, maximum eight model turns, stop at usage limits.
