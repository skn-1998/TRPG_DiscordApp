---
name: code-design
description: Route and order implementation-design work across purpose-centered encapsulation, purpose-driven abstraction, interface branch reduction, and purpose-driven naming. Use when a request spans multiple methods, the correct method is unclear, one result controls another, or capability coverage is explicitly being audited. For one clear installed method, prefer that child directly. This parent only selects, sequences, contracts, and reports gaps; it does not redesign code, review code, edit code, or run tests.
---

# Code Design

Return a routing artifact. Do not perform a child's design method or implementation.

## Input Contract

```text
Actor:
Purpose:
Context:
Constraints:
Evidence:
```

- Preserve supplied wording and provenance; mark absent information `unknown`.
- Do not infer Actor from the requester, owner from a module name, or Purpose from a class, pattern, metric, or smell.
- Treat "split," "abstract," "add an interface," "rename," and named patterns as requested work or candidate Means.
- Ask only when an unknown changes the recipient, semantic order, public contract, compatibility boundary, or next consequential decision.
- Pass this contract to every child so it can run without this or another routing parent.

## Parent Boundary

The parent may classify supplied concerns, select available recipients, order dependent results, define handoff contracts, report gaps, and record a recipient's returned output reference and explicit completion declaration for sequencing. It does not reassess the artifact's semantic quality.

Never invent purposes, responsibilities, abstractions, interfaces, names, owners, patterns, tests, commands, or review gates. Do not produce detailed redesign, edit code, or execute verification. Report any unavailable recipient as `missing-capability`; do not imitate it.

## Select Recipients

Read `references/child-map.md`, then confirm availability from current Skills metadata.

- `purpose-centered-encapsulation`: known purpose-specific state or rules lack one responsible unit, or external access can invalidate them.
- `purpose-driven-abstraction`: one or more concrete cases or an existing abstraction need a decision about common purpose, semantic contract, and included or excluded variants.
- `interface-branch-reduction`: an evidence-backed abstraction already exists, but callers branch on variants or construction details.
- `purpose-driven-naming`: sourced purpose, responsibility or effect, context, and terminology are sufficient to evaluate or select a code name.

Use one clear installed child directly. Use this parent for multiple methods, ambiguity, coordination of returned results, or an explicit audit of declared capabilities. A missing child discovered during such a route is reported honestly, but child absence alone does not make a narrow ordinary request trigger this parent.

Add a peer only when its output is requested or required to choose the next recipient. Unknown Purpose alone does not add `purpose-goal-means`; possible future implementation does not add `refactoring`. Keep peer internals opaque. Missing evidence, actors, decisions, and permissions are gaps, not steps, unless obtaining one is itself a requested outcome with a real recipient and output.

## Order Dependencies

When both steps are selected:

1. Establish purpose or context evidence before a design method only when it controls the boundary.
2. Establish purpose-specific ownership before an abstraction only when the abstraction depends on that ownership.
3. Establish the abstraction purpose and semantic contract before `interface-branch-reduction`.
4. Establish responsibility or abstraction boundaries before naming only when the selected name depends on them.
5. Finish the requested design artifact before a requested behavior-preserving implementation handoff.

Every step must produce the requested result or an artifact consumed by another selected step. Remove speculative downstream work. Do not add generic approval, review, implementation, rollback, or testing steps.

## Step Contract

```text
Step ID:
Objective:
Recipient or required capability:
Request contract: [Actor / Purpose / Context / Constraints / Evidence, each expanded; then recipient-specific deltas]
Required inputs and dependencies:
Expected output:
Completion condition:
State: [ready / blocked / not-started / complete]
```

- Consider only the first unfinished step in declared order whose predecessors are complete: mark it `blocked` when a missing capability, decision, permission, or evidence prevents its output; otherwise mark it `ready`.
- Mark every other incomplete step `not-started`; report its known gaps separately.
- Mark `complete` only when the recipient returns an output reference and explicitly declares its own completion condition satisfied.
- Expand the five common fields in every step; do not make a child recover them from this parent artifact.

Do not embed redesign, implementation, tests, review gates, global readiness, or phase acceptance in a step.

## Output And Completion

Return the routing decision, normalized input, ordered steps, one next step or `none`, consequential gaps, and the result or event that should trigger rerouting.

Routing is complete when the smallest recipients, semantic order, contracts, next step, and consequential unknowns are explicit. A complete route may expose an unavailable child; it does not claim that design, review, implementation, or verification occurred.

Before returning, remove any step that performs a child's work, duplicates a recipient's internal route, or exists only to restate missing input.

## References

- `references/child-map.md`: child contracts and peer handoff conditions.
- `references/source-ledger.md`: source provenance and adoption limits.
- `references/source-to-rule-map.md`: production-rule audit.
