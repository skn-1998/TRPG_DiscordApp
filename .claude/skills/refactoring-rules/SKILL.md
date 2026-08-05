---
name: refactoring-rules
description: plan, review, or guide safe code refactoring with ai agents. use when asked to refactor code, create refactoring rules, define cursor .mdc refactoring instructions, evaluate code smells, produce a refactoring plan, split large changes, add safety tests, or review whether a refactor preserves externally observable behavior.
---

# Refactoring Rules

Use this skill to plan and review refactoring while preserving externally observable behavior.

## Core principle

Treat refactoring as a sequence of small behavior-preserving transformations. Do not combine refactoring with feature changes or bug fixes unless the user explicitly asks and the dependency is explained.

## Core workflow

1. Classify the request:
   - identify refactoring candidates
   - create or update refactoring rules
   - produce a refactoring plan
   - review a proposed refactor
   - execute or describe stepwise refactoring
2. Define the safety boundary before code changes:
   - current external behavior
   - invariants and edge cases
   - public APIs, serialized formats, database schema, auth/permission behavior, error semantics
   - affected files and module boundaries
   - existing tests and missing tests
3. If coverage is weak, recommend characterization or regression tests before structural edits.
4. For `TRPG-SERVER/` refactoring work, run the following from `TRPG-SERVER/` before finalizing a plan or review:
   - large-file analyzer: `pnpm run refactor:large-files:analyze -- --out .tmp/refactor/large-files.json`
   - during post-implementation coding review loops, run it as static analysis before launching review subagents or independent reviewers
   - use `--include` narrowed to touched or target files when possible
   - treat `large-file` and `large-function` findings as warnings and refactoring candidates, not automatic blockers
   - dependency gate: `pnpm run build`, then `pnpm run check:circular` (normal output: "No circular dependency found!") — circular dependencies are zero-tolerance; treat any new cycle as a blocker, not a warning
   - use `pnpm run analyze:deps` for a broader dependency report when module boundaries are affected
   - if a command cannot run, state why and continue with a manual size/dependency check
5. Use Plan-first / Run-second for large or cross-module changes:
   - present candidates, impact, target structure, validation, and rollback/split plan
   - wait for human approval if the task requires actual large-scale editing
6. Apply small reversible transformations:
   - extract function/method
   - decompose conditional
   - move function/class
   - pull up method
   - introduce parameter object
   - replace magic values with named domain concepts
7. Validate after each step with targeted tests and broader checks when relevant.
8. Summarize behavior preserved, changes made, tests run, and remaining risk.

## Refactoring safety gates

- Do not begin with code edits when the request is broad. Start with analysis and plan.
- Do not change public API, auth, permissions, migrations, persistence format, billing, notifications, or logging contracts unless approved.
- Do not chase a fixed complexity-reduction percentage at the cost of readability or safety.
- Do not introduce abstraction after only one occurrence. Prefer the Rule of Three for shared mechanisms.
- Do not fail or reject a refactor solely because the large-file analyzer reports warnings. Use those warnings to scope, split, or justify the refactoring plan.
- Do not introduce new circular dependencies. `pnpm run check:circular` must stay clean; treat a new cycle as a blocking finding.
- Stop and ask for review if the diff becomes too large, tests conflict with the plan, or a new architecture boundary is required.

## Refactoring plan output

Use this format:

```markdown
## Goal
[what will improve]

## Current behavior to preserve
- [observable behavior]
- [edge case]
- [API/error/permission invariant]

## Code smells observed
- [smell] [location] [evidence]

## Proposed steps
1. [small step] [files] [validation]
2. [small step] [files] [validation]

## Tests / safety net
- Existing tests: [list]
- Tests to add: [list]

## Risks and rollback
- [risk] [mitigation]

## Go / No-go decision needed
[yes/no and why]
```

## Review output

When reviewing a refactor, use:

```markdown
## Verdict
[approved / approve with nits / changes requested / needs more context]

## Behavior preservation
- Preserved: [evidence]
- Risk: [possible behavior change]

## Blocking issues
- [issue] [file/function] [why it matters] [fix]

## Refactoring quality
- [smell addressed]
- [abstraction/coupling/readability impact]

## Validation
- Checks observed: [commands/tests]
- Checks still needed: [commands/tests/manual checks]
- Large-file static analysis before subagents: [command/output path, warning count, largest relevant files/functions, or why skipped]
- Circular dependency check: [`pnpm run check:circular` result, or why skipped]
```

## Reference material

Load `references/refactoring-playbook.md` for code smell mapping, detailed safety checks, and examples.
