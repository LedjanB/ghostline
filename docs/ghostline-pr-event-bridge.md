# Ghostline PR event review bridge (staged)

This integration is intentionally staged on `automation/ghostline-pr-handoff` and targets `v6-runner` only. Never modify or merge into `main`.

## Producer: GitHub Actions
After a bounded Claude task and `npm test` both pass, the modified `.github/workflows/ghostline-claude-task.yml` publishes the reviewed diff to a fresh `review/ghostline-<run-id>` branch and opens a PR **against v6-runner**. It never pushes a Claude-created diff directly to v6-runner. Test failures do not open PRs.

The job requires GitHub Actions `pull-requests: write` and a repository setting that allows GitHub Actions to create pull requests. If disabled, the PR creation step fails without changing v6-runner. It uses the existing ephemeral `GITHUB_TOKEN`, not a new personal access token.

## Reviewer: ChatGPT Work GitHub PR event task
A supported GitHub PR-event-triggered Work task must be connected by the repository owner in ChatGPT Work. Workflow-run-completion triggers are not currently offered by the documented Work GitHub event integration. The task should filter GitHub PR activity for repo `LedjanB/ghostline`, base `v6-runner`, and title prefix `Ghostline Claude review:`. It should never react to `main`.

Suggested task instructions:

> On each matching GitHub PR event, check GitHub issue #1, the coordination doc, source branch, actual diff, Claude task report and complete CI run. Require successful `npm test`, no changed GitHub workflow/secret files, no token or session output, no unauthorized art or save changes, no main branch changes. On a safe, scoped, passing PR, merge only to v6-runner if permitted. Record a concise DONE/CHECKED/BLOCKED/NEXT review in issue #1. Once merged, and only if no Claude task is running and no blocker exists, author ONE new bounded task in docs/claude-next-task.md on v6-runner, which starts the existing Claude workflow. Never self-approve the bootstrap workflow PR or bypass failing tests. On quota/rate/auth errors stop without retries or purchases. Never merge main. Do not generate uncontrolled subagent loops.

Review gating is mandatory. A GitHub PR by itself does NOT wake ChatGPT: the Work event task must be installed/authorized first. Retain the existing hourly coordinator as a fallback but ensure it does not dispatch the same task during PR review.

## Status / activation

- GitHub-side workflow change: **staged, not merged or activated**.
- Work PR event task: **not installed in the current chat**; must be created from ChatGPT Work with GitHub connection.
- Existing hourly fallback: **unchanged**.
- Current test baseline: latest run 42708447669 failed 2 of 48 tests; don't queue new work until diagnosed.
