---
name: purpose-driven-abstraction
description: Decide whether one or more concrete cases or an existing abstraction share one evidenced consumer purpose and semantic contract. Use directly when the principal question is which cases belong together and whether to introduce, retain, narrow, remove, or avoid an abstraction. Do not treat duplication alone or speculative future reuse as sufficient evidence. Do not use for branch relocation, generic pattern selection, naming, architecture, implementation, migration, or test creation.
---

# Purpose Driven Abstraction

Produce one evidence-linked abstraction decision. Do not implement the abstraction.

## Input Contract

```text
Actor:
Purpose:
Context:
Constraints:
Evidence:
Consumer and concrete cases:
Inputs, results, failures, side effects, and invariants:
Realistic variation and change scenarios:
Existing abstraction and compatibility constraints:
Requested recipient and decision:
```

- Preserve supplied wording, provenance, conflicts, alternatives, and unknowns. Mark absent fields `unknown`.
- Require concrete cases or an existing abstraction plus a consumer purpose. Similar names, signatures, code shape, or duplication are not purpose evidence.
- Treat future variants as evidence only when a supplied committed or recurring change scenario makes them realistic.
- Ask only when an unknown prevents identifying the consumer, cases, or requested abstraction decision.

## Boundary

Analyze common purpose, semantic contract, included and excluded cases, hidden implementation decisions, alternatives, compatibility, and tradeoffs.

Do not assign state ownership, move caller branches, choose Strategy or another pattern, invent variants, design system architecture, rename symbols, edit code, create tests, or claim measured changeability. An abstraction may be an interface, type, function, module, or no new construct; this Skill decides the semantic boundary, not the implementation form.

## Workflow

Read `references/abstraction-contract.md`, then:

1. Bound the consumer, purpose, concrete cases, existing abstraction, recipient, and decision.
2. Describe each case's purpose-relevant behavior and evidence without normalizing differences away.
3. Test a common-purpose hypothesis from the consumer's perspective. Exclude cases serving different outcomes even when their implementation looks alike.
4. Compare semantic obligations: accepted inputs, observable results, failure meaning, side effects, invariants, and relevant timing or ordering.
5. Identify implementation decisions that can vary without changing those obligations and that are evidenced by supplied change scenarios or existing variation among the supplied cases.
6. Select included and excluded cases. State the evidenced consumer or change benefit, if any, and make the keep-concrete alternative explicit.
7. Decide `introduce`, `retain`, `narrow`, `remove`, `avoid`, or `insufficient-evidence` and record benefit, indirection or constraint cost, tradeoffs, compatibility, and consequential unknowns.
8. Hand off branch mechanics or implementation only when separately requested.

## Output Contract

Return:

- normalized input and evidence limits;
- consumer and common-purpose hypothesis;
- case comparison and semantic obligations;
- included and excluded cases with evidence;
- implementation decisions the abstraction may hide;
- selected decision and keep-concrete alternative;
- compatibility, tradeoffs, unknowns, and narrow handoffs;
- status: `abstraction-supported` or `abstraction-incomplete`.

Use `references/abstraction-contract.md` proportionately. Do not require a fixed matrix, minimum case count, YAML, pattern, interface creation, tests, migration, rollback, or release gate.

## Completion

Return `abstraction-supported` when the selected action is evidence-backed; every included case, if any, serves the same evidenced consumer purpose and satisfies the same semantic contract; exclusions and the keep-concrete alternative are explicit; speculative reuse is not evidence; and the action is usable for the named decision or, when none is named, the supplied Purpose.

Return `abstraction-incomplete` when missing consumer purpose, case semantics, or benefit evidence prevents distinguishing a supported action from its indirection or constraint costs. Completion does not claim implementation, passing contract tests, migration, or verified localization.

## Handoffs

- Hand off purpose-specific state and mutation ownership to `purpose-centered-encapsulation` when available.
- Hand off branch placement for an accepted abstraction to `interface-branch-reduction` when available.
- Hand off naming after the boundary is established to `purpose-driven-naming` when available.
- Hand off accepted behavior-preserving implementation to `ai-assisted-refactoring`.
- Hand off scenario-specific propagation review to `review-changeability`, and indirection review to `cognitive-load-review` when available.

Keep recipients opaque and pass only the abstraction decision and evidence they require.

## References

- `references/abstraction-contract.md`: case comparison and decision schemas. Read for every run.
- `references/source-ledger.md`: source claims and limits.
- `references/source-to-rule-map.md`: production-rule traceability.
