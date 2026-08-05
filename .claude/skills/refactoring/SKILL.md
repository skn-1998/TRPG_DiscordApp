---
name: refactoring
description: Route and order behavior-preserving restructuring across debt prioritization, legacy purpose splitting, and AI-assisted refactoring. Use when an AI agent is asked to plan, execute, or review a bounded refactor; when a request spans multiple methods; when the correct method is unclear; when a required declared child is unavailable; or when one result controls another. For one clear installed method, prefer that child directly. This parent only selects, sequences, contracts, and reports gaps; it does not perform the refactor.
---

# Refactoring

Return a routing artifact. Do not perform a child's analysis or implementation.

## Input Contract

```text
Actor:
Purpose:
Context:
Constraints:
Evidence:
```

- Preserve supplied wording and provenance; mark absent information `unknown`.
- Do not infer Actor from the requester, a service name, or a code owner.
- Treat "split," "clean up," "modernize," tools, and patterns as requested work or candidate Means, not stakeholder Purpose.
- Ask only when an unknown changes the recipient, semantic order, observable-behavior boundary, public contract, or next consequential decision.
- Pass this contract to every child so it can run without a Core parent.

## Parent Boundary

The parent may classify supplied scope, select available recipients, order dependent results, define handoff contracts, report gaps, and record a recipient's returned output reference and explicit completion declaration for sequencing. It does not reassess the artifact's semantic quality.

Never rank debt, infer purpose boundaries, propose target design or migration slices, invent owners/reviewers/tests/commands/rollback, review code, edit code, or execute verification. Report any unavailable recipient as `missing-capability`; do not imitate it.

## Scope

- `pure-refactoring`: supplied intent preserves observable behavior.
- `behavior-change`: supplied intent changes observable behavior; exit this category.
- `mixed-scope`: supplied evidence separates preserving and changing portions; route only the preserving portion here.
- `unresolved`: evidence cannot establish the boundary; retain the uncertainty.

A diagnostic route does not require a complete behavior baseline. A child that will plan or execute a change may require a behavior contract and verification evidence before completion.

## Select Recipients

Read `references/child-map.md`, then confirm availability from current Skills metadata.

- `debt-prioritization`: several debt items compete for the next investment decision.
- `legacy-purpose-split`: evidence suggests a legacy unit mixes purposes and purpose or boundary analysis is requested.
- `ai-assisted-refactoring`: the request directs AI or Claude to plan, execute, or review a bounded preserving change, including an ordinary imperative such as "refactor this class." Do not select it merely because Claude answers a debt-priority or purpose-analysis request.

Use one clear installed child directly. Use this parent for multiple methods, ambiguity, an unavailable declared child, or coordination of returned results.

Add a peer only when its output is requested or required to choose the next recipient. Unknown Purpose alone does not add `purpose-goal-means`: ask only if one answer selects the recipient, and hand off only when a purpose/goal artifact is itself requested or independently delegated. Possible future interface work does not add `code-design`. Keep a peer or exit recipient opaque and define only its handoff. Missing evidence, actors, decisions, and permissions are gaps, not steps, unless obtaining one is itself a requested outcome with a real recipient and output.

## Order Dependencies

When both steps are selected:

1. Resolve scope before a preserving transformation.
2. Prioritize a broad debt set before detailed work only when target selection depends on it.
3. Establish purpose, domain, or target-responsibility evidence before a split only when it controls the boundary.
4. Establish a behavior contract and usable verification evidence before AI executes a change, not before diagnostic analysis.

Every step must produce the requested result or an artifact consumed by another selected step. Remove speculative downstream work. Do not add generic approval, review, rollback, implementation, or testing steps.

## Step Contract

```text
Step ID:
Objective:
Recipient or required capability:
Request contract: [full common input or reference plus deltas]
Required inputs and dependencies:
Expected output:
Completion condition:
State: [ready / blocked / not-started / complete]
```

- Consider only the first unfinished step whose predecessors are complete: mark it `blocked` when a missing capability, decision, permission, or evidence prevents its output; otherwise mark it `ready`.
- A later step waiting on a predecessor is `not-started`; report other known gaps separately.
- Mark every other incomplete step `not-started`.
- Mark `complete` only when the recipient returns an output reference and explicitly declares its own completion condition satisfied.

Do not embed design, implementation, tests, review gates, global readiness, or phase acceptance in a step.

## Output And Completion

Return the routing decision and scope, normalized input, ordered steps, one next step or `none`, consequential gaps, and the result or event that should trigger rerouting.

Routing is complete when the smallest recipients, semantic order, contracts, next step, and consequential unknowns are explicit. A complete route may expose an unavailable child; it does not claim that analysis, implementation, review, or verification occurred.

Before returning, remove any step that performs a child's work, duplicates a recipient's internal route, or exists only to restate missing input.

## References

- `references/child-map.md`: child contracts and peer handoff conditions.
- `references/source-ledger.md`: source provenance and adoption limits.
- `references/source-to-rule-map.md`: production-rule audit.
