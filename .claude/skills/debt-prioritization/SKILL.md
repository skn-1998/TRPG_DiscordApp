---
name: debt-prioritization
description: Compare technical-debt candidates for a bounded investment decision using explicit purpose, constraints, expected change, observed consequences, remediation effort, and uncertainty. Use directly when two or more debt items compete for attention, when a roadmap or hotspot must be weighed against code-quality signals, or when asked what to address first, defer, or leave alone among identified candidates. Do not use for open-ended debt discovery, one-candidate design diagnosis, legacy-purpose splitting, target redesign, or refactor execution.
---

# Debt Prioritization

Recommend where limited improvement capacity should go. A debt candidate has priority because of its expected consequence in the declared decision context, not merely because its code looks undesirable.

## Input Contract

```text
Actor:
Purpose:
Context:
Constraints:
Evidence:
Candidates:
Decision horizon:
Available capacity:
Decision requested:
```

- Preserve supplied wording, provenance, units, and time windows; mark missing information `unknown`.
- Do not infer Actor from the requester, Purpose from a smell, business criticality from a module name, or future change from past churn alone.
- Treat scores, warnings, complexity, size, low coverage, and change frequency as evidence signals rather than priority conclusions.
- Run directly without `refactoring` or another routing parent.

Read `references/decision-contract.md` for the comparison artifact and completion semantics.

## Boundary

This Skill owns comparison of a supplied or bounded candidate set. It may inspect target-local code, history, incidents, work items, roadmap evidence, and estimates when available. It does not perform an open-ended repository debt inventory, establish a new domain or code design, discover purposes inside a legacy unit, edit code, create tests, verify a refactor, or plan a rollout or release.

Keep an opaque handoff when a missing result controls the decision:

- `quality-attributes`: define a quality scenario or response measure needed to compare consequences;
- `legacy-purpose-split`: establish competing purposes or boundaries inside a legacy target;
- `code-design` or `domain-design`: establish the desired responsibility, contract, invariant, or domain boundary;
- `ai-assisted-refactoring`: plan, execute, or review a selected bounded preserving change after its behavior boundary is known.

Report an unavailable required capability; do not simulate it. Missing evidence that can be gathered from the bounded candidates remains this Skill's work when gathering it is requested and permitted.

## Workflow

1. Bound the decision: candidates, Actor, Purpose, horizon, capacity, constraints, and the alternative to investing now.
2. Normalize each item as a debt hypothesis: observed condition, desired modifiability outcome or obligation, structural cause if evidenced, expected consequence, and remediation estimate. Keep unsupported parts `unknown`.
3. Select only comparison lenses relevant to the declared Purpose and Constraints. Consider evidenced business or user consequence, expected change, current change cost or failure exposure, recurrence and coupling, and remediation cost or feasibility.
4. Inspect the smallest useful evidence set. Distinguish supplied facts, direct observations, inferences, and missing evidence; align measurements to comparable scope and time windows.
5. Compare candidates qualitatively or with a user-supplied model. Do not invent weights, multiply ordinal labels, or turn a tool score into business priority.
6. Test sensitivity: state which assumptions or missing evidence could reverse the order. Use ties, groups, or `decision-incomplete` instead of false precision.
7. Return the selected next target when supported, otherwise the smallest evidence request or upstream decision that would make selection possible.

## Output And Completion

Return:

- normalized decision context and consequential unknowns;
- criteria with rationale and provenance;
- an evidence-linked comparison for every candidate;
- recommendation, ties or groups, deferred alternatives, and sensitivity;
- one of `recommendation-supported` or `decision-incomplete`;
- exclusions and any opaque handoff.

Complete with `recommendation-supported` only when the candidate set and horizon are bounded, comparison criteria follow from supplied Purpose and Constraints, material evidence is comparable, the recommendation is traceable, and known uncertainty does not invalidate it. Otherwise return `decision-incomplete` without fabricating a winner.

Before returning, remove unsupported decimal scores, unproven core-domain labels, smell-only priority claims, and invented downstream workflow. Do not invent or perform owners, reviewers, approvals, tests, rollout or release work, rollback, branches, commits, cadence, or prevention programs. Preserve supplied prerequisites and constraints as comparison evidence, and report requested out-of-scope work under exclusions or handoffs without performing it.

## References

- `references/decision-contract.md`: evidence model, comparison artifact, and edge cases.
- `references/source-ledger.md`: source provenance and adoption limits.
- `references/source-to-rule-map.md`: production-rule audit.
