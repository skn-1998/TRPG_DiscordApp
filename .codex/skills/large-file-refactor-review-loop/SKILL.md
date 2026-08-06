---
name: large-file-refactor-review-loop
description: >-
  Phase-gated workflow aligned with refactoring-rules for behavior-preserving
  large-file refactoring with AI agents: classify the refactor request, define
  the safety boundary, create or update refactoring docs, review the docs until
  H/M findings are resolved, split work into small phases, implement one phase
  at a time, run static analysis and tests, repeat implementation review loops,
  update ledgers, and commit completed phases only when explicitly requested. Use when the user asks for
  大きすぎるファイルのリファクタリング, refactoring phase split, レビューループ,
  H/M 解消まで反復, static-analysis-guided refactoring, AI-friendly refactor
  docs, or "フェーズを切って止めて".
---

# Large File Refactor Review Loop

Use this skill to drive a large-file refactor as a documented, review-gated sequence of small behavior-preserving changes.

The loop is strict: do not advance a document or implementation phase while unresolved H or M findings remain, unless the user makes an explicit design decision accepting the risk.

This skill operationalizes `refactoring-rules`. If a local phase habit conflicts with `refactoring-rules`, follow the `refactoring-rules` safety gates first.

## Core Contract

- Preserve externally observable behavior unless the user explicitly requests a behavior change.
- Keep feature work, bug fixes, and refactoring in separate phases or commits.
- Do not change public APIs, serialized formats, database schema, authentication, authorization, secrets, migrations, or deployment contracts without explicit approval.
- Prefer existing repository patterns, helpers, test conventions, and package manager commands.
- Use structured parsers or analyzers for code facts when practical; avoid brittle text-only metrics for AST-shaped questions.
- Treat complexity, duplication, coupling, function length, and large-file warnings as planning signals, not automatic blockers.
- Do not introduce an abstraction after a single occurrence; prefer the Rule of Three unless the boundary already exists.
- If a dependency must be added, document purpose, alternatives, security/operations impact, rollback, and why existing dependencies are insufficient.
- Do not stage, commit, or push unless the user explicitly instructs it.
- In `C:\workspace\dokcer-trpg-remix-app`, edit backend implementation and tests under `TRPG-SERVER/`, frontend under `trpg-next-app/`, and skills under `.codex/skills/`. If a commit is explicitly requested, use exact pathspecs only; CRLF/formatter churn makes broad `git add` unsafe.

## Workflow

### 1. Classify and Establish Scope

Before editing, identify:

- request class: refactoring candidates, refactoring rules, plan, review, or stepwise execution
- target file(s) and why they are too large or risky
- current behavior and invariants to preserve
- callers, exports, artifact formats, CLI/API contracts, and error semantics
- existing tests and the closest verification commands
- missing tests and whether characterization or regression tests are needed before structural edits
- current git state and any unrelated user changes
- whether the user asked to stop after phase planning

For this repo, read `CLAUDE.md`, `TRPG-SERVER/AI.md`, and the matching `TRPG-SERVER/AI.*.md`; read `TRPG-SERVER/src/ARCHITECTURE.md` when module boundaries are involved, and inspect nearby docs/tests before choosing a structure.

Use the smell mapping from `refactoring-rules/references/refactoring-playbook.md` when naming candidates: Long Method, Duplicated Code, Large Class/Module, Feature Envy, Shotgun Surgery, Complex Conditional, and Primitive Obsession.

### 2. Create or Update the Refactoring Document

Create or update a durable markdown plan before implementation. Include:

- goal and non-goals
- target files and ownership boundaries
- current behavior to preserve
- static analysis baseline or file-size/dependency evidence
- proposed target structure
- phase list with small reversible steps
- allowed files and forbidden edits per phase
- validation commands per phase
- rollback or abort criteria
- review ledger format

Use this `refactoring-rules` plan shape inside the document:

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

If the user says "フェーズを切って止めて", stop after the phase split and do not begin implementation.

### 3. Review the Document

Run a document review loop before implementation:

1. Self-review with H/M/L findings.
2. Resolve all H and M findings in the document.
3. Use an independent reviewer when available (for example, a separate read-only review agent).
4. Re-run review after patches until H/M is zero or a user decision is required.

Do not treat same-agent persona review as independent. If no independent reviewer is available, record that limitation in the ledger.

Document review must answer:

- Is behavior preservation explicit enough?
- Are phase boundaries reviewable and reversible?
- Are dependencies and public interfaces protected?
- Are validation commands close enough to the changed behavior?
- Is there any required human decision before implementation?

### 4. Split Fine-Grained Phases

Use small phase IDs such as `R1`, `R2`, or `R7a` when a phase is still broad.

Each phase must specify:

- purpose
- files allowed to change
- files that must not change
- exact refactoring move
- invariants to preserve
- static analysis or test checks
- review lanes
- completion criteria and, only when authorized, commit criteria
- stop conditions

Prefer phases shaped like:

- add characterization tests or static analyzer support
- introduce pure helper without wiring behavior
- move one responsibility behind an existing facade
- migrate one call path
- remove dead compatibility only after callers are proven migrated
- update docs and ledger

Allowed transformations should stay in the `refactoring-rules` family: Extract Function/Method, Decompose Conditional, Move Function/Class, Pull Up Method, Introduce Parameter Object, and replacing magic values with named domain concepts.

### 5. Implement One Phase

For each phase:

1. Announce the phase and allowed edit set.
2. Re-check `git status`.
3. Edit only files named by the phase.
4. Preserve exports, CLI names, artifact paths, JSON schemas, log semantics, and error behavior unless approved.
5. Avoid unrelated formatting, renames, and abstraction.
6. Keep compatibility facades when migration risk exists.

If implementation reveals a new boundary or dependency decision, stop and update the phase status instead of expanding the phase silently.

### 6. Verify With Static Analysis and Tests

Prefer existing repo commands first. Run these from `TRPG-SERVER/`:

```text
pnpm run refactor:large-files:analyze -- --out .tmp/refactor/large-files.json
pnpm run build
pnpm run check:circular
pnpm run test
pnpm run lint:check
git diff --check
```

Run `pnpm run refactor:large-files:analyze -- --out .tmp/refactor/large-files.json` before producing a plan or review. Summarize warning count, largest relevant files/functions, and threshold assumptions. Run `pnpm run check:circular` after `pnpm run build` before closing a plan or review phase (normal output: "No circular dependency found!"). Circular dependencies are zero-tolerance in this repo. If a command cannot run, record why and continue with a manual dependency/structure check.

Select the narrowest meaningful checks for the phase, then add broader checks when the touched code is shared.

Static analysis should confirm the intended structural movement, such as:

- oversized file size or exported symbol count decreased
- new module has expected imports and no forbidden dependency direction
- facade exports remain stable during migration
- circular dependencies were not introduced
- target responsibility no longer lives in the source file

If adding an npm analyzer, prefer AI-friendly AST/dependency tools that emit structured output, such as `ts-morph`, `dependency-cruiser`, `madge`, or an ESLint custom rule. Record why the selected tool fits the repo better than alternatives.

### 7. Review the Implementation

Run implementation review after verification:

1. Self-review the diff using H/M/L.
2. Patch every H and M finding.
3. Re-run impacted checks.
4. Use an independent final reviewer when available.
5. Repeat until H/M is zero or a user decision is needed.

Review output format:

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
```

H means unsafe to advance. M means should be fixed before phase completion. L may be recorded as follow-up if it does not threaten behavior preservation.

When a phase also needs H/M/L gating, include a short H/M/L appendix after the `refactoring-rules` review shape:

```text
H:
- ...

M:
- ...

L:
- ...

Open decisions:
- ...

Advance decision: yes/no
```

### 8. Update the Ledger and, When Authorized, Commit

Do not rely on chat history as the source of truth. Update the refactoring document or status section at every phase boundary with:

- timestamp
- phase id and status
- changed files
- static analysis summary
- tests and commands run
- self-review H/M/L
- independent review H/M/L, if run
- unresolved decisions
- next phase or stop reason

If the user explicitly requested a commit, commit locally only when:

- H/M findings are resolved
- required verification passed or limitations are recorded
- docs/status reflect the phase result
- unrelated user changes are not included

Use concise commit messages such as:

```text
docs: split <target> refactor phases
refactor: move <responsibility> from <source>
test: characterize <target> artifacts
```

## Stop Conditions

Stop and ask the user when:

- the user explicitly asked to stop after phase planning
- a phase requires changing files outside the allowed scope
- H/M findings require a product, security, infrastructure, or compatibility decision
- adding or upgrading a dependency is necessary and not already approved
- an independent reviewer is unavailable but was required by the user
- verification cannot run and no trustworthy substitute exists

Before stopping, update the document or ledger with the current state and the concrete decision needed.

## Minimal Phase Template

```markdown
### <Phase ID> - <Title>

- Status: `not-started`
- Purpose:
- Allowed files:
- Forbidden edits:
- Behavior invariants:
- Refactoring steps:
- Static analysis:
- Verification:
- Review lanes:
- Completion criteria / authorized commit criteria:
- Stop conditions:
```

## Minimal Ledger Template

```markdown
### <timestamp> - <phase> - <status>

- Changed files:
- Static analysis:
- Verification:
- Self-review:
- Independent review:
- Decisions:
- Next action:
```
