---
name: purpose-centered-encapsulation
description: Design evidence-backed responsibility, state ownership, and purpose-meaningful operations for one bounded code target. Use directly when, for a supplied purpose, known purpose-specific state or rules are scattered, lack one responsible unit, or can be invalidated through setters, mutable references, direct writes, or other exposed operations. Do not use merely for a large class, duplicated code, generic SRP or private-field advice, unknown domain rules, abstraction or interface discovery, code changes, migration, or test creation.
---

# Purpose Centered Encapsulation

Produce an encapsulation design record. Decide responsibility and public operations; do not edit code.

## Input Contract

```text
Actor:
Purpose:
Context:
Constraints:
Evidence:
Bounded code target and callers:
Known state, rules, invariants, and mutation paths:
Public behavior and compatibility constraints:
Relevant change or behavior scenarios:
Requested recipient and decision:
```

- Preserve supplied wording, provenance, conflicts, and unknowns. Mark absent information `unknown`.
- Require an evidenced purpose and known state or state-related rule. Do not infer purpose or domain truth from a class name, field count, access modifier, pattern, or smell.
- Treat supplied invariants and contracts as obligations; this Skill does not discover or approve them.
- Ask only when an unknown prevents bounding the target, purpose, or requested ownership/API decision.

## Boundary

Analyze responsibility leaks, state ownership, state-related decisions and mutations, purpose-meaningful commands, necessary observations, public-contract effects, compatibility, and alternatives.

Do not perform domain discovery, invariant modeling, common-purpose abstraction, interface or variant selection, legacy splitting, implementation, migration, test execution, or behavior-preservation verification. Do not create one unit per field, method, noun, rule, or vaguely stated purpose.

## Workflow

Read `references/encapsulation-contract.md`, then:

1. Bound the code target, actor purpose, public behavior, callers, recipient, and decision.
2. Inventory material state, state-related rules, decision logic, mutation paths, and observation paths with evidence. Proceed only when evidence shows a material ownership gap, scattered rule, arbitrary mutation, mutable representation, or obligation bypass. Otherwise return `not-applicable` without an encapsulation design or supported/incomplete status.
3. Identify responsibility leaks: scattered rules, arbitrary mutation, mutable-representation exposure, or operations that bypass supplied obligations.
4. Propose the smallest responsible units needed. Tie each unit to one evidenced purpose; leave unresolved ownership explicit.
5. Allocate owned state, decisions, calculations, and transitions. Keep unrelated technical concerns outside unless the supplied purpose requires them.
6. Propose purpose-meaningful commands and only necessary queries or immutable observations. Hiding fields alone is not sufficient.
7. Allocate supplied preconditions, postconditions, and invariants to operations without inventing domain rules.
8. Report public-contract and compatibility effects, rejected alternatives, and consequential unknowns.

## Output Contract

Return:

- normalized input and evidence limits;
- current responsibility, mutation, and representation leaks;
- proposed responsible units and their evidenced purposes;
- owned state, rules, decisions, calculations, and transitions;
- proposed commands, queries, and immutable observations;
- allocation of supplied obligations;
- public-contract and compatibility effects;
- rejected alternatives, unknowns, and narrow handoffs;
- status: `encapsulation-supported` or `encapsulation-incomplete`.

Use `references/encapsulation-contract.md` proportionately. Do not require fixed schemas, exhaustive caller scans, factories, patterns, tests, migration steps, or release gates.

For the early exit, return normalized input, the checked trigger evidence, and status `not-applicable`. Every applicable report includes status `encapsulation-supported` or `encapsulation-incomplete`; presentation is flexible.

## Completion

Return `encapsulation-supported` when every proposed unit has one evidenced purpose; each material state-changing rule has one proposed responsible unit or explicit unresolved ownership; public operations express supplied obligations without arbitrary mutation; necessary observation does not expose mutable representation; and compatibility effects and uncertainty are usable for the named decision or, when none is named, the supplied Purpose.

Return `encapsulation-incomplete` when missing purpose, state/rule authority, caller behavior, or compatibility evidence prevents that use. Completion does not claim implementation, migration, test execution, or preserved behavior.

The `not-applicable` early exit is complete when the evidence shows no material encapsulation concern. Retaining a cohesive current boundary does not become `encapsulation-supported` unless an applicable ownership or public-operation decision was actually analyzed.

## Handoffs

- Hand off missing domain rules or invariants through `domain-design`.
- Hand off a common-purpose and semantic-contract decision to `purpose-driven-abstraction` when available.
- Hand off established-variant branch mechanics to `interface-branch-reduction` when available.
- Hand off accepted behavior-preserving implementation to `ai-assisted-refactoring`.
- Hand off scenario-specific propagation review to `review-changeability`.

Keep handoff targets opaque and pass only the design record and evidence they require.

## References

- `references/encapsulation-contract.md`: leak, unit, and operation schemas. Read for every run.
- `references/source-ledger.md`: source claims and limits.
- `references/source-to-rule-map.md`: production-rule traceability.
