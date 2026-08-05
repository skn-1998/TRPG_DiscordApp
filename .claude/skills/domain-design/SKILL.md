---
name: domain-design
description: Route and order domain-design work across bounded-context discovery, Ubiquitous Language, invisible concepts, invariants, and data-destruction analysis. Use for requests spanning more than one domain method, requests whose correct child is unclear, or requests to coordinate a returned child result with later domain work. Also use for subdomain classification or prioritization and Context Map relationship-pattern selection so unsupported capability is reported instead of substituting Bounded Context discovery. Prefer a focused child directly for a single owned method. This parent defines steps and dependencies only; it does not perform child modeling or invent missing capabilities.
---

# Domain Design

Route domain-design work into the smallest coherent child workflow. Preserve the principle that a model serves an actor's purpose within a context.

## Input Contract

Normalize the request once:

```text
Actor: who benefits from or uses the model
Purpose: the stakeholder outcome or job to achieve
Context: the business subject and scope
Constraints: binding business rules or limits
Evidence: supplied statements, examples, artifacts, observations, and decisions
```

Preserve missing fields as unknown. Analysis, sequencing, handoff, review, approval, persistence, and implementation are workflow actions rather than domain Purpose or Evidence. Do not infer an Actor from the requester, a domain constraint from a routing dependency, or a particular reviewer, approver, or owner from a generic need for review.

Each Step references this request contract and records only justified deltas. Do not copy the same five values into every Step merely for formatting consistency.

## Parent Boundary

This parent may classify concerns, choose children, order dependencies, define Step contracts, identify blockers, and record a child's returned output reference and explicit completion declaration for sequencing. It must not evaluate child semantics, perform a child's detailed analysis, synthesize a child result, or treat dispatch as completion.

Review, approval, persistence, and implementation are downstream effects rather than domain child methods. Do not invent generic review or approval Steps. Include one only when the request asks for that effect or a supplied governance policy makes it part of the requested route; otherwise mention a material governance unknown once, only if it affects readiness.

Prefer a child directly when one installed method fully owns the request. Use this parent when:

- the request spans two or more domain methods
- the correct domain child is unclear
- one child result must control a later Step
- a requested domain capability is declared but unavailable
- subdomain prioritization or Context Map relationship-pattern selection is requested and no declared child owns it

Route code structure to `code-design` and behavior-preserving restructuring to `refactoring` when category-level selection or ordering remains. When a handoff already selects one installed exact child, direct invocation remains valid. Route cross-category orchestration to `route-design-work`.

## Child Discovery

Read `references/child-map.md` to identify declared children. Read a selected parent-owned child contract only when needed to define that Step. Do not inspect a child body to reproduce its method in the parent report.

Use only exact capabilities declared in the child map and visible in current Skills metadata:

- an available declared child can receive a Step
- an unavailable declared child is `missing-capability` and is never simulated
- a domain method outside the declared set is `unsupported`; do not invent a capability name or provide an unofficial substitute

Runtime installation and release admission are platform or deployment facts rather than normal routing work. If the environment supplies a trusted admission state, use it only to distinguish diagnostic use from authoritative downstream use.

## Routing Workflow

1. Normalize the five-field request contract and preserve material unknowns.
2. Classify the request into boundary, language, hidden-concept, invariant, mutation-integrity, code, refactoring, or unsupported domain work.
3. Select the smallest declared child set that covers the request. A narrow request gets one child; a broad request gets an ordered chain.
4. Order semantic dependencies:
   - resolve material model-scope ambiguity before context-specific language or detailed modeling
   - establish purpose and context-specific language before purpose-specific hidden concepts or detailed invariants
   - provide known invariants to data-destruction analysis when available
   - return newly discovered integrity constraints to invariant work before a destructive recheck
5. Define each Step's recipient, inputs, dependencies, expected output, completion condition, exclusions, and return condition.
6. Consider only the first unfinished Step whose predecessors are complete: mark it `blocked` when a missing capability, dependency, evidence item, or authority prevents meaningful in-scope output; otherwise mark it `ready`. Mark every other incomplete Step `not-started` and report known gaps separately. An evidenced postponement may make only the first eligible Step `deferred`.
7. Return the route. Child execution occurs under the selected child Skill, not inside the parent method.
8. On re-entry, preserve Step identity and dependencies. Record the returned output reference, the child's explicit completion declaration, and declared blocking findings or handoffs without copying or reassessing the child's report.

## Step Contract

Every Step records the semantic core below. Presentation may be a table or concise block:

```text
Step ID:
Objective:
Recipient and capability state:
Request contract reference and justified deltas:
Input artifacts:
Expected output:
Completion condition:
State: ready | blocked | deferred | not-started | complete
```

Add dependencies, blockers, exclusions, or a return condition only when they affect execution or ownership. Add a result reference and the child's explicit completion declaration only on re-entry. Omit empty fields instead of expanding the report for template completeness.

Use stable Step IDs within a route. A Step becomes `complete` only when the child returns an output reference and explicitly declares its own completion condition satisfied. The parent records that declaration without independently upgrading or downgrading it.

An authoritative successor requires the review and decision authority demanded by supplied policy and the intended effect. Do not invent who holds either role. If the governing policy or authority is unknown, keep it unknown; the returned result may inform diagnosis but cannot authorize a baseline, persistence, implementation, or rollout.

## Child Routing

- `bounded-context-discovery`: model applicability is unclear, or one model may mix materially different purposes, process cycles, concept clusters, meanings, or invariants
- `ubiquitous-language`: context-specific terms are inconsistent, overloaded, implementation-led, or missing
- `invisible-driven-modeling`: visible physical nouns hide purpose, problems, ownership, rights, responsibilities, or other non-physical concepts
- `invariant-modeling`: valid states, transitions, consistency rules, or behavioral contracts must become explicit
- `data-destruction-analysis`: controlled invalid-data or mutation challenges are needed to reveal integrity constraints

Do not equate subdomain classification with Bounded Context discovery. Do not treat `Context Map` document authoring as relationship-pattern selection unless the request actually asks to choose or compare a relationship pattern.

## Direct Child And Re-entry Behavior

When a broad request directly invokes a child, accept the child's in-scope analysis plus its handoff for remaining work. Do not require the child to return an empty routing-only response. Re-enter this parent with that result when ordering or successor eligibility must be decided.

Accept a returned result only when its provenance is clear enough to distinguish it from parent-authored prose. A persisted result should have an immutable locator or artifact identity; an ephemeral same-task result may use the platform's native result identity.

## Output Contract

Produce a concise routing report containing:

1. routing decision and scope
2. normalized request contract
3. ordered, proportionate Steps with the semantic core above
4. exactly one authorized next Step or `none`
5. blockers, unsupported or missing capabilities, and material unknowns
6. return or re-entry condition

Do not append a child analysis to the parent report. Presentation is flexible and should remain proportional to the route.

## Review

Before returning, verify that:

- the route uses the smallest coherent child set
- the parent performed no child method
- dependencies reflect semantic prerequisites rather than a preferred implementation
- only one eligible next Step is ready
- unavailable or unsupported capabilities are not simulated
- every Step has explicit input, output, and an inspectable completion condition
- downstream authority is not inferred from report completion

The checks above are the parent's internal self-review and do not become routing Steps. When the request includes approval, Skill change, authoritative persistence, implementation, or broad rollout, expose any required independent review and decision authority as a handoff or blocker according to supplied governance. Do not add a generic review phase to an advisory design route, and do not infer a stakeholder role. Review records belong to the review artifact rather than every runtime routing response.

## Completion

The routing report is complete when the request contract is explicit; the smallest declared child set is selected; Step dependencies are acyclic; each Step has input, output, completion, and state; material exclusions and return behavior are present when needed; unavailable work is visible; one eligible next Step or none is identified; and no detailed child modeling occurred.

A complete route may remain blocked, deferred, or diagnostic-only.

## References

- `references/child-map.md`: declared child index
- `references/bounded-context-discovery-contract.md`: current parent-child contract
- `references/source-ledger.md`: source provenance and limits
- `references/source-to-rule-map.md`: production rule traceability
