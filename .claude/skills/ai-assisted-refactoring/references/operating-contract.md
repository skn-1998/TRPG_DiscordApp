# Operating Contract

## Mode Selection

- `plan`: the user asks to analyze, propose, scope, or plan and does not request edits.
- `execute`: the user asks to refactor, apply a stated refactor, move, extract, or rename existing code without changing behavior.
- `review`: the user asks to inspect a supplied or current refactor diff or result.
- `unknown`: the requested effect is materially ambiguous; ask one focused question before editing.

An execute request includes inspection of its own final diff and actual verification reporting. Do not add a separate review phase or independent reviewer unless the user requests one.

## Evidence Model

The behavior boundary may be evidenced by supplied requirements, public APIs, contracts, executable examples, existing tests, logs, schemas, callers, or directly observed results. Code shape and current tests can reveal behavior but do not by themselves prove stakeholder purpose or domain correctness.

Classify material statements as:

- `supplied`: stated by the user or an identified source;
- `observed`: directly read or executed in the current target;
- `hypothesis`: inferred from code, history, naming, or patterns;
- `unknown`: not established.

Do not use confidence scores as a substitute for evidence.

## Plan Mode

Return:

- normalized input and bounded structural goal;
- current behavior boundary and evidence;
- purpose or responsibility hypotheses with evidence and counterevidence;
- ordered transformations, each with target, preserved behavior, expected structural effect, and proportionate verification;
- handoffs, blockers, and stop conditions.

Plan mode is complete when another agent can execute the bounded sequence without inventing purpose, behavior, scope, or commands. It does not claim that code changed or checks passed.

## Execute Mode

1. Inspect repository instructions, target files, callers, tests or other contract evidence, current diff, and available commands.
2. Confirm one bounded structural goal and the observable behavior boundary. Partition any intentional behavior change.
3. Run or inspect the smallest relevant baseline evidence when doing so is safe and useful. Do not create a test suite by default. A runtime-preservation claim needs relevant executable behavior evidence; compilation, static checks, and reference search support only the properties they actually inspect.
4. Apply one coherent transformation. Prefer language-aware mechanics for reference-sensitive operations.
5. Inspect the diff and run proportionate focused verification. Stop on an introduced failure or an unsupported preservation claim.
6. Continue only while the next transformation remains inside the same agreed goal and the evidence boundary remains valid.

Return:

- changed files and structural effect;
- preserved behavior boundary;
- actual commands or observations and their results;
- purpose hypotheses still unresolved;
- scope exclusions, failures, and residual risk.

Execute mode is complete when the requested bounded internal change is applied, unrelated work is intact, and actual evidence supports unchanged behavior within the declared boundary. If the code changed but evidence is insufficient or a relevant check fails, report `incomplete`; do not call the refactor verified.

## Review Mode

Review the supplied or current diff, not an imagined implementation. Return findings first, ordered by severity and linked to files or symbols when possible. Check:

- observable behavior or contract drift;
- unsupported purpose, ownership, or abstraction claims;
- out-of-scope edits and mixed feature work;
- incomplete reference updates or tool-sensitive mechanics;
- whether cited verification actually covers the declared boundary;
- changeability regressions directly caused by the diff.

Then state reviewed scope, verification evidence, unknowns, and one of `acceptable`, `changes-needed`, or `inconclusive`. Review is complete when material findings and evidence gaps are explicit. It does not edit files or require a second reviewer.

## Non-Goals

- maximizing test count, coverage percentage, or number of commands;
- imposing a particular test style, framework, IDE, branch strategy, or commit cadence;
- proving all repository behavior from a bounded refactor;
- approving a business or domain decision from code inference;
- replacing the specialized debt, legacy-split, code-design, or domain-design methods.
