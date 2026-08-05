---
name: design-core
description: Do not use for sharing or scaling a claimed practice or slogan; design-knowledge-scaling owns that even when unsourced. Route only multi-method or unclear foundational framing across purpose-goal-means, quality attributes, and context interpretation. Prefer one exact child directly and route-design-work across categories. This parent selects, orders, and contracts Steps only and performs no child analysis.
---

# Design Core

Route foundational framing into focused children. Purpose, achievement conditions, context, and quality concerns precede decisions that depend on them.

## Input

Normalize once:

```text
Actor: stakeholder, beneficiary, owner, or responsible party whose intent matters
Purpose: outcome or value to achieve
Context: domain, system, boundary, code area, or organizational setting
Constraints: binding rules, compatibility needs, limits, and policies
Evidence: supplied or directly referenced statements, requirements, artifacts, observations, decisions, and sources
```

Copy the five fields conservatively from supplied evidence and preserve absent or unresolved values as `unknown`. Do not infer Actor from the requester, executing agent, or nouns that merely identify an affected domain. Set Purpose only when evidence explicitly states an intended stakeholder state, action aim, or target. A problem statement or request to discover purpose, analyze, review, install, or implement is work to perform, not evidence of the design Purpose; keep Purpose `unknown`.

Each Step references this contract and records only justified deltas. Ask only when an unknown changes child selection, dependency order, meaning, quality priority, public behavior, or authority for the next Step; otherwise preserve it for the child to analyze.

## Parent Boundary

This parent may classify foundational concerns, select children, order dependencies, define Step contracts, expose blockers, and record a child's returned output reference and explicit completion declaration for sequencing. It must not reassess semantic quality, derive Purpose-Goal-Means records, quality scenarios, context interpretations, domain rules, architecture, review findings, or implementation. Invocation happens separately after routing.

Use `route-design-work` for cross-category coordination. Hand one clearly owned non-foundational concern to its category parent rather than coordinating peer categories here.

## Select Children

Read `references/child-map.md` and confirm current Skill metadata.

- `purpose-goal-means`: distinguish stakeholder Purpose, observable Goal conditions, binding Constraints, and proposed or decided Means
- `quality-attributes`: frame quality concerns, observable scenarios and measures, priority provenance, and pre-design interactions
- `context-interpretation`: resolve or expose material ambiguity in terms, roles, purpose cues, assumptions, scope, and system or environment boundaries

Use an exact child directly for one requested method. Use this parent for multiple requested foundational methods, unclear ownership, unavailable declared capability, or returned-result coordination. A gap that one child can report as a handoff does not by itself make the request multi-method. Mark a declared unavailable child `missing-capability`; never simulate it.

Do not select this parent merely because a practice proposed for organization-wide reuse lacks sources, Purpose evidence, or authority. Route the reuse-fit decision directly to `design-knowledge-scaling`; use a foundational child only when its own result is separately requested.

## Order Work

1. Resolve material meaning or boundary ambiguity before statements that depend on that interpretation.
2. Establish stakeholder Purpose and observable Goal conditions before selecting or approving Means.
3. Establish quality scenarios, measures, and priorities before comparing designs on those qualities.

Missing evidence may be an output of diagnostic analysis. Block only when it prevents child selection, makes the method meaningless, or is required to authorize the next effect. Do not add generic review, approval, persistence, installation, or implementation Steps, and never invent an owner or authority.

## Step Contract

Every Step contains:

```text
Step ID:
Objective:
Recipient and capability state:
Request contract reference and justified deltas:
Required inputs and dependencies:
Expected output:
Completion condition:
State: ready | blocked | deferred | not-started | complete
```

Derive fields from the request and selected child's production contract. Expected output names the child's declared artifact type. Completion records only an actual output reference and the child's explicit completion declaration; semantic assessment stays with the child. Do not add unsupplied examples, proposed meanings, quality thresholds, interpretation candidates, technologies, tactics, reviewers, or conclusions; missing evidence remains an input or question.

Consider only the first unfinished Step whose predecessors are complete: mark it `blocked` when a missing capability, dependency, evidence item, or authority prevents its output; otherwise mark it `ready`. Mark every other incomplete Step `not-started` and report known gaps separately. Use `deferred` only when an evidenced owner postpones an otherwise valid first eligible Step to a named event. A Step becomes `complete` only when the child returns an output reference and explicitly declares its own completion condition satisfied. On re-entry, keep unresolved evidence or authority visible and authorize at most one next Step.

## Output And Completion

Return a concise report with:

1. routing decision and scope
2. normalized input contract
3. ordered Steps
4. exactly one next Step or `none`
5. blockers, capability gaps, and material unknowns
6. re-entry condition

The route is complete when the smallest child set and acyclic order are explicit; every Step has input, output, completion, and state; one next Step or none is identified; and no child analysis was performed. A complete route may remain blocked or advisory.

Before returning, check that one-method work bypassed this parent, ambiguity and purpose precede dependent decisions, Purpose and Actor are traceable or `unknown`, Step contracts do not contain invented child conclusions, and no child result was fabricated. Do not emit this check as a gate matrix or review record.

## References

- `references/child-map.md`: child ownership and production contracts
- `references/design-core-notes.md`: ambiguous-routing signals
- `references/source-ledger.md`: source provenance and limits for maintenance
- `references/source-to-rule-map.md`: production-rule traceability for maintenance
