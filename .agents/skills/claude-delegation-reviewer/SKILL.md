---
name: claude-delegation-reviewer
description: Coordinate work delegated to Claude and review Claude's returned changes. Use when Codex acts as the user's direct lead, prepares a Claude handoff, selects or names appropriate skills for Claude, creates reviewable evidence, verifies results against source documents and tests, or judges whether Claude's output is acceptable before reporting back to the user.
---

# Claude Delegation Reviewer

## Role

Act as the user's lead coordinator. Prepare Claude to do bounded work, then review Claude's result before treating it as done.

Do not claim Claude has performed work unless there is an artifact, diff, log, or user-provided result to review. If Codex cannot directly execute Claude, create or update the handoff material Claude should receive.

## Workflow

1. Clarify the objective in one sentence.
2. Read the controlling instructions and design documents before delegating.
3. Pick the skill or skills Claude should use, naming why each one applies.
4. Define allowed scope, forbidden scope, expected artifacts, validation commands, and completion criteria.
5. Produce a handoff that Claude can execute without hidden context.
6. When Claude returns work, review the raw artifacts first: diffs, files, logs, screenshots, or summaries.
7. Verify claims against source documents, tests, and code references.
8. Report findings first, then approval status, residual risks, and next action.

For reusable handoff and review formats, read `references/review-packet.md`.

## Repository Rules

For this repository, respect the project AGENTS instructions.

When the work touches `TRPG-SERVER`, read these before drafting a handoff or review:

- `TRPG-SERVER/AI.md`
- `TRPG-SERVER/src/ARCHITECTURE.md`
- The relevant domain design document, such as Discord, interactions, events, or config docs.

Preserve these architectural constraints:

- Keep dependency direction `features -> domains -> core -> shared`.
- Do not add new `forwardRef`, `@Global()` modules, extra `EventEmitterModule.forRoot()`, direct `process.env` access, service-locator `ModuleRef.get(...)`, or feature providers in core/shared/events/interactions.
- Keep domain services independent from Discord, interactions, UI, and feature-local orchestration.
- Prefer registries and factories over string-literal event names or custom IDs.

## Delegation Standard

Write Claude instructions as executable work, not broad advice.

Include:

- Objective: one sentence.
- Required context: exact files Claude must read.
- Skills to use: skill names and intended responsibility.
- Change scope: files or areas Claude may change.
- Out-of-scope: files or areas Claude must not change.
- Existing dirty files: summarize known modified or untracked files when relevant.
- Validation: exact commands to run.
- Evidence to return: diff summary, test output, important file references, and unresolved issues.
- Completion criteria: concrete pass/fail conditions.

If the delegation is for this repository and should persist, update `TRPG-SERVER/CLAUDE_HANDOFF.md`. For a short one-off, return the handoff text directly.

## Review Standard

Review Claude's output like a code review. Lead with problems, ordered by severity, with file and line references when possible.

Check:

- The work matches the delegated objective and did not expand scope.
- Required project instructions and design docs were followed.
- The selected skills were appropriate and their outputs are visible in the artifacts.
- Tests or validation commands support the claim.
- Failures are classified as related or unrelated to the delegated change.
- Documentation was updated when design or migration policy changed.
- No forbidden patterns were introduced.

End with one of these statuses:

- `Approved`: no blocking issues found.
- `Approved with follow-up`: acceptable now, with tracked residual risk.
- `Changes requested`: Claude must revise before the work is accepted.
- `Blocked`: review cannot proceed because required artifacts or evidence are missing.

## Evidence Discipline

Prefer primary artifacts over summaries. If Claude reports "tests passed", require the command and key output. If Claude reports "refactored X", inspect the diff or files. If evidence is absent, mark it as a review gap instead of guessing.

Do not reverse unrelated user changes. If unrelated dirty files exist, identify them and keep the review scoped to delegated work.
