STATUS: RUN

# Ghostline microtask: make ONE Ward 4 keyboard ghost-toggle test deterministic

## Why this is deliberately smaller
Previous run https://github.com/LedjanB/ghostline/actions/runs/42730625158 hit Claude's configured eight-turn ceiling before editing either test. This is a NEW, single-assertion microtask, not a repeat of the two-test assignment. The existing workflow and its turn limit must remain unchanged.

## Do exactly this
- Read the mandatory project instructions and this task, then inspect only the specific Ward 4 ghost-toggle test in `tests/wardlab.spec.js` and the directly relevant keyboard handler if essential.
- Diagnose why pressing `g` after movement sometimes fails to switch ghost mode. Make the smallest test-only change that uses genuine keyboard input and verifies actual scene state. Do not directly set ghost state, delete the assertion, add arbitrary sleeps, or change gameplay.
- Edit only `tests/wardlab.spec.js` and `docs/claude-task-report.md`. Never write `output.txt`, logs, art, other tests, workflow, auth or task file.
- Keep investigation short. With the existing eight-turn limit, prioritize making the small edit and writing the report over exploring unrelated code. If cause cannot be established, write BLOCKED with precise evidence rather than guessing.
- Run the focused Ward 4 Playwright test using existing tools if feasible. GitHub Actions will run the full suite afterward. Report exact commands and results under DONE/CHECKED/BLOCKED/NEXT.
- No subagents, new dependencies, commits, pushes, quota retries or payments.

## Acceptance
One reviewable test-only fix and an accurate report, with all existing assertions preserved. The separate Milo Lab awakening failure remains for a later distinct task. No visual approval is needed. Stop after this microtask.
