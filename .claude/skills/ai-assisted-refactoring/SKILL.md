---
name: ai-assisted-refactoring
description: Plan, execute, or review a bounded behavior-preserving refactor with AI assistance and explicit evidence. Use directly when Claude or another AI is asked to restructure existing code without changing observable behavior, prepare code for an already-defined change, apply a supplied refactor design, or review an AI-produced refactor. Do not use to add features, fix behavior, prioritize debt, discover legacy purpose boundaries, or invent an architecture that must be decided first.
---

# AI-Assisted Refactoring

Improve internal structure without changing the declared observable behavior. AI-generated purpose and design claims are hypotheses until evidence supports them.

## Input Contract

```text
Actor:
Purpose:
Context:
Constraints:
Evidence:
Mode: [plan / execute / review / unknown]
Target:
Behavior boundary:
Allowed changes:
Verification evidence:
```

- Preserve supplied wording and provenance; mark absent information `unknown`.
- Do not infer Actor from the requester or Purpose from names, smells, metrics, patterns, or AI explanations.
- Record code-derived purpose as a hypothesis with file or symbol evidence and material counterevidence.
- Treat "clean up," "extract," "rename," named patterns, and AI or IDE use as requested work or candidate Means.
- Run directly without `refactoring` or another routing parent.

Read `references/operating-contract.md` for mode-specific output and completion semantics.

## Boundary

Refactoring preserves observable behavior. If the request also changes behavior, separate the parts and execute only the behavior-preserving portion whose boundary is clear. Do not hide feature work, bug fixes, schema changes, API changes, or altered failure semantics inside a refactor.

This Skill owns bounded transformation, evidence collection, execution, and refactor-diff review. It does not choose which debt deserves investment, discover competing purposes in a legacy component, define domain truth, or invent responsibility and abstraction boundaries.

Use an opaque handoff when a missing decision controls the change:

- `debt-prioritization`: select among competing debt investments;
- `legacy-purpose-split`: discover evidence-backed purpose and boundary hypotheses for a multi-purpose legacy unit;
- `code-design` or `domain-design`: establish a responsibility, abstraction, invariant, language, or domain boundary;
- `review-changeability`: evaluate scenario-specific change propagation beyond this refactor's preservation claim.

Report an unavailable required capability; do not simulate it. Missing evidence that can be gathered from the bounded target is work for this Skill, not automatically a handoff.

## Workflow

1. Select the mode from the explicit request. Ask only when plan versus execute versus review changes a consequential effect.
2. Inspect the target, nearby contracts and callers, existing verification, repository instructions, current changes, and supplied evidence. Preserve unrelated user work.
3. State the bounded structural goal, observable behavior to preserve, allowed files or symbols, and material unknowns. Keep inferred purpose provisional.
4. In `plan`, return the smallest executable sequence and evidence needs without editing.
5. In `execute`, establish proportionate baseline evidence, apply the smallest coherent transformation that advances the goal, then run the smallest relevant verification at meaningful checkpoints.
6. In `review`, inspect the actual diff and available results; return findings first without editing.
7. Report actual changes, commands and results, unsupported claims, and the next unresolved decision. Never report an unrun check as passed.

## Tool And Evidence Rules

- Prefer a trusted symbol-aware rename, move, or extract operation when available. If using an AI or manual patch instead, say so and verify references with available language tools, search, build, or focused tests; do not claim IDE-grade completeness.
- MinoDriven explicitly describes test code as essential to safe refactoring. Use relevant existing tests when the claim includes runtime behavior. This Skill's local adaptation does not force a new test for every request: without relevant executable behavior evidence, limit the claim to what symbol-aware tools, compilation, static checks, or directly observed cases actually prove, and mark broader runtime preservation `incomplete`.
- Tests are preservation evidence, not a score or mandatory deliverable. Do not add tests merely to satisfy this workflow. Add a focused characterization test only when the behavior cannot otherwise be evidenced, the test observes a relevant contract rather than implementation shape, and test changes are authorized.
- Do not invent a universal full-suite run, reviewer, approval gate, rollback step, commit, branch, or fixed command list.
- If evidence cannot support the requested preservation claim, narrow the change or stop before the risky edit and report what remains unverified.
- When a selected check fails, distinguish pre-existing evidence from a change-introduced failure when possible; do not fix unrelated failures silently.

## Completion

Use the selected mode's completion condition in `references/operating-contract.md`. An `execute` result is complete only when the bounded change exists and actual evidence supports unchanged behavior within the declared boundary. State the unverified remainder rather than upgrading partial evidence into a global safety claim.

Before returning, inspect the final diff for scope drift, accidental behavior changes, duplicated responsibility, and overwritten user work. This is execution hygiene, not an independent review gate.

## References

- `references/operating-contract.md`: mode selection, outputs, and completion.
- `references/source-ledger.md`: source provenance and adoption limits.
- `references/source-to-rule-map.md`: production-rule audit.
