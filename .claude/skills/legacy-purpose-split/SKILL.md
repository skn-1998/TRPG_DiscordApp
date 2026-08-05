---
name: legacy-purpose-split
description: Discover evidence-backed purpose and boundary hypotheses inside one bounded legacy class, module, or subsystem without editing code. Use directly when supplied evidence indicates that responsibilities serve different actor purposes and the user asks to diagnose those purposes or boundaries, including whether similar-looking logic is genuinely shared. This is not an implementation or migration plan. For a request that mixes behavior-preserving work with intended behavior change, use `refactoring`; this Skill analyzes only an explicitly bounded preserving portion. Do not use for portfolio debt ranking, open-ended architecture design, implementation, test creation, or refactor execution.
---

# Legacy Purpose Split

Analyze one bounded legacy target. Produce purpose and split-boundary hypotheses; do not perform the split.

## Input Contract

```text
Actor:
Purpose:
Context:
Constraints:
Evidence:
Target:
Requested artifact:
Behavior authority:
Decision recipient:
Next decision:
```

- Preserve supplied wording, provenance, conflicts, and uncertainty. Mark absent information `unknown`.
- Treat a purpose inferred only from code shape or a physical object name as a hypothesis, never as domain fact.
- When only the common five fields are supplied, derive the added fields from Context and Evidence when possible.
- Use `Behavior authority` for evidence that can classify observable behavior. Runtime observations establish current behavior, but create a preservation obligation only when the supplied preserving scope or an authoritative contract requires it. Its absence does not block diagnostic analysis.
- Ask only when an unknown prevents identifying the bounded target or requested artifact, or when a missing recipient or next decision would materially change the output.

## Boundary

This Skill may inspect the target and relevant callers, contracts, documentation, tests, runtime observations, and change history. It may classify behavior and propose purpose-based boundaries and analysis-level sequencing considerations.

Do not edit code, create or run tests, rank a portfolio, redesign the surrounding architecture, assign owners or reviewers, prescribe release gates, or claim that a refactor is safe. Separate every behavior-changing idea from the preserving analysis.

## Workflow

Read `references/analysis-contract.md`, then:

1. Bound the target and record the requested recipient and decision.
2. Inventory externally observable behavior from supplied evidence as `must-preserve`, `intentional-change`, or `unknown`; do not decide correctness without authority.
3. Form purpose hypotheses from actor, desired outcome, domain statements, callers, rules, and change history. Record supporting and counterevidence.
4. Classify members as serving one purpose hypothesis, a shared candidate, infrastructure, or `unknown`. Do not force complete classification.
5. Propose boundary candidates with purpose, responsibilities, state, public obligations, dependencies, and exclusions.
6. Classify same-looking logic with the comparison in `references/analysis-contract.md`. Otherwise preserve the distinction or uncertainty.
7. Report direct-split or transitional sequencing considerations only when evidence supports them. A migration pattern is an option, not a default workflow.

## Output Contract

Return:

- normalized input and evidence limits;
- purpose hypotheses with actor, outcome, supporting evidence, counterevidence, and unknowns;
- behavior inventory;
- member-to-purpose classification;
- boundary candidates and cross-boundary dependencies;
- shared-logic decisions and rationale;
- preserving versus behavior-changing considerations;
- unresolved questions and the narrowest useful handoff;
- status: `analysis-supported` or `analysis-incomplete`.

Use the detailed schema in `references/analysis-contract.md`. Do not turn unknowns into mandatory project phases.
Omit non-consequential sections for a narrow requested artifact and group repetitive members; state material omissions rather than filling a template.

## Completion

Return `analysis-supported` when the bounded target, the analysis elements required by the requested artifact, and consequential uncertainty are usable for the named next decision or, when none is named, the supplied Purpose. A full purpose-boundary report requires evidence-linked purpose hypotheses, relevant behavior classes, and boundary candidates; a narrow shared-logic or purpose decision requires only the elements needed for that decision.

Return `analysis-incomplete` when a missing target, evidence conflict, or unresolved purpose distinction prevents the requested use; identify the exact missing evidence without fabricating it.

Completion does not mean that code was changed, tests passed, migration was approved, or behavior preservation was verified.

## Handoffs

- Hand off only the explicitly preserving portion to `ai-assisted-refactoring` when the purpose boundaries and observable-behavior contract are ready for a bounded plan, edit, or review.
- Return intentional-change items separately to the requester or `route-design-work`; do not send them through a preserving refactor handoff.
- Hand off a required domain-language, invariant, or context-boundary artifact through `domain-design`; use `bounded-context-discovery` directly when that single artifact is requested.
- Hand off a required target responsibility, abstraction, interface, or name artifact through `code-design`.
- Hand off to `debt-prioritization` only when several debt investments compete for selection.

Keep recipients opaque. State the artifact they need; do not reproduce their workflow.

## References

- `references/analysis-contract.md`: output schema and classification rules. Read for every run.
- `references/source-ledger.md`: sources, claims, and adoption limits. Read when checking provenance.
- `references/source-to-rule-map.md`: traceability from operational rules to sources.
