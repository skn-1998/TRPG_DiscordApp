---
name: interface-branch-reduction
description: Design where established same-purpose variant selection should live so callers depend on a semantic contract rather than scattered implementation branches. Use directly only when an accepted evidence-backed abstraction purpose and contract already exist and a supplied variant or construction change spreads across callers. Do not use for an arbitrary conditional, speculative future variant, initial abstraction discovery, general State modeling, code edits, refactoring, or universal conversion to polymorphism.
---

# Interface Branch Reduction

Produce one branch-reduction design or a justified keep-branch decision. Do not edit code.

## Input Contract

```text
Actor:
Purpose:
Context:
Constraints:
Evidence:
Accepted abstraction purpose and semantic contract:
Callers, implementations, and branch locations:
Supplied variant or construction change scenario:
Creation, selection, public-behavior, and compatibility constraints:
Requested recipient and decision:
```

- Preserve supplied wording, provenance, conflicts, and unknowns. Mark absent fields `unknown`.
- Require provenance that the abstraction purpose and semantic contract are accepted inputs. Do not infer acceptance from existing code structure or an existing interface. Do not establish or broaden them in this Skill.
- Require a concrete supplied change scenario. Branch count or an imagined future implementation is not enough.
- Ask only when an unknown prevents identifying the accepted abstraction, branch surface, or requested decision.

## Boundary

Classify material branches, locate duplicated selection knowledge, design use and creation/selection boundaries, and report expected change localization, public-behavior effects, compatibility, and uncertainty.

Do not replace every `if` or `switch`, invent variants, redefine the semantic contract, choose a general domain state model, mandate Strategy, State, factory, registry, or dependency injection, edit code, create tests, or claim verified changeability.

## Workflow

Read `references/branch-contract.md`, then:

1. Confirm the accepted consumer purpose, semantic contract, variants, recipient, and supplied change scenario. If acceptance is absent, hand off abstraction discovery.
2. Inventory only branches material to that scenario. Classify variant-use selection, construction/selection, domain decision, state transition, validation, compatibility, or unresolved branching.
3. Identify callers that know concrete variants, repeated selection rules, and the expected propagation of the supplied change.
4. Propose a use boundary where callers invoke the accepted semantic contract without concrete knowledge.
5. Propose a separate creation/selection boundary only when it localizes the evidenced decision. Do not merely move a growing switch into a new file.
6. Decide `apply-interface`, `retain-interface`, `keep-branch`, or `insufficient-evidence`. Preserve local branches when an interface would not improve the supplied scenario.
7. Trace how the specified new or changed variant would affect callers under the proposal. Report this as an expectation, not verified behavior.
8. Record public-contract, compatibility, state-ownership, and cognitive-load concerns for the relevant handoff.

## Output Contract

Return:

- normalized input and accepted abstraction provenance;
- material branch inventory and duplicated selection knowledge;
- current propagation for the supplied change scenario;
- proposed use boundary and, when justified, creation/selection boundary;
- decision and rationale;
- expected change-localization trace;
- public-behavior and compatibility effects;
- state-ownership or indirection concerns, unknowns, and narrow handoffs;
- status: `branch-design-supported` or `branch-design-incomplete`.

Use `references/branch-contract.md` proportionately. Do not treat its classification vocabulary as exhaustive or require recipients to reproduce it. Do not require YAML or patterns. Do not produce implementations, tests, migration plans, or release gates.

## Completion

Return `branch-design-supported` when the accepted abstraction remains unchanged, the branch decision is justified by the supplied scenario, and either the specified variant is expected to avoid unrelated caller edits or the branch is explicitly retained with rationale. Make compatibility and uncertainty usable for the named decision or, when none is named, the supplied Purpose.

Return `branch-design-incomplete` when abstraction acceptance, semantic contract, branch evidence, or the change scenario is missing or contradictory. Completion does not claim implementation, passing tests, preserved behavior, or measured changeability.

## Handoffs

- Hand off common-purpose or semantic-contract discovery to `purpose-driven-abstraction` when available.
- Hand off purpose-specific state and mutation ownership to `purpose-centered-encapsulation` when available.
- Hand off accepted behavior-preserving implementation to `ai-assisted-refactoring`.
- Hand off scenario-specific propagation measurement to `review-changeability` and added-indirection assessment to `cognitive-load-review` when available.
- Re-enter `code-design` when several code-design methods require ordering.

Keep recipients opaque and pass only the accepted contract, branch design, and evidence they require.

## References

- `references/branch-contract.md`: branch classification and boundary schemas. Read for every run.
- `references/source-ledger.md`: source claims and limits.
- `references/source-to-rule-map.md`: production-rule traceability.
