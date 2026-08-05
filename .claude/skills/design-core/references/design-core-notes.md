# Design Core Selection Notes

Use this reference only to choose a foundational child or identify a category handoff. Do not perform the child's detailed analysis here.

## Purpose-Goal-Means Signals

Route to `purpose-goal-means` when:

- a proposed implementation is stated as the purpose
- acceptance conditions are absent or unverifiable
- several purposes share one proposed means
- a candidate means conflicts with a known constraint

Use the child directly when this is the only material concern. Keep combined purpose, quality, or context uncertainty in `design-core` for routing and dependency order. Attributable customer requirement/intent can establish Purpose when its content states an intended state or aim. Functional/system requirements, specifications, Constraints, contract conditions, architecture, and code may be classified by the child but do not establish Purpose alone.

Selection vocabulary:

- Purpose: intended state, action aim, or target; Actor and rationale are separate metadata.
- Goal: observable condition showing that the purpose is achieved.
- Means: implementation, process, module, architecture, or tool considered for a goal.

## Quality-Attribute Signals

Route to `quality-attributes` when designs are compared without quality scenarios or when words such as maintainable, secure, reliable, fast, or testable lack observable conditions.

## Context-Interpretation Signals

Route to `context-interpretation` when:

- one term has different meanings for different actors or workflows
- the domain/system boundary is uncertain
- actor intent is inferred rather than evidenced
- external interfaces, persistence, compatibility, or organizational setting can change the meaning of the request

## Known Contract Fields

The parent may carry preconditions, postconditions, invariants, and non-goals only when they already appear in supplied evidence. If deriving or validating them requires detailed domain or code reasoning, return a contracted handoff through `route-design-work` or the matching category Core.

## Category Handoff Signals

- Domain terms, bounded contexts, valid states, or data integrity -> `domain-design`.
- Class/module responsibilities, interfaces, branching, naming, or abstractions -> `code-design`.
- Behavior-preserving restructuring or debt sequencing -> `refactoring`.
- A claimed design practice or slogan needs a cross-team reuse-fit decision -> `design-knowledge-scaling` directly; workshop plus scaling coordination -> `organization`.
- More than one category -> return to `route-design-work`.

## Parent Self-Review

Confirm only that:

- the request contract contains Actor, Purpose, Context, Constraints, and Evidence, with unknowns preserved
- only the first eligible unfinished step may be `ready` or `blocked`; every other incomplete step is `not-started`
- a returned child advances the chain only after it provides an output reference and explicitly declares its own completion condition satisfied
- the smallest foundational child set was selected
- detailed analysis was not performed in the parent
- specialized concerns were returned as contracted handoffs
- routing report completion is separate from execution readiness
