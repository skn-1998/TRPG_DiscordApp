---
name: route-design-work
description: Return and stop at a routing artifact for broad or category-unclear software-design work. Keep unsupplied Actor and Purpose unknown. Each Step has one mapped recipient, artifact type, and recipient completion declaration; never perform or predict child work. Use across design categories or when one result controls another; otherwise invoke one exact child or category Skill directly.
---

# Route Design Work

Route design work without becoming the designer. The route is this invocation's final result: name exactly one next Step or `none`, then stop without executing any Step. Purpose and context guide order; specialized methods remain independently callable.

## Input

Normalize once:

```text
Actor: stakeholder, beneficiary, owner, or responsible party whose intent matters
Purpose: outcome or value to achieve
Context: domain, system, boundary, code area, or organizational setting
Constraints: binding rules, compatibility needs, limits, and policies
Evidence: supplied or directly referenced requirements, code, tests, logs, decisions, and sources
```

Copy the five fields conservatively from supplied evidence and preserve absent or unresolved values as `unknown`. Do not infer Actor from the requester, executing agent, or nouns that merely identify an affected domain. Set Purpose only when evidence explicitly states an intended stakeholder state, action aim, or target. A problem statement or request to discover customer purpose, separate responsibilities, improve changeability, route, review, refactor, install, or implement is work to perform, not evidence of the design Purpose; keep Purpose `unknown`.

Each Step references this contract and records only justified deltas. Ask only when an unknown changes recipient selection, dependency order, a binding boundary, public behavior, or authority for the next Step; otherwise preserve it for the recipient to analyze.

Input normalization is preparation performed by this parent, not a routed Step. Never use `route-design-work` as the Recipient of a Step merely to normalize its own input.

## Parent Boundary

This parent may select recipients, order material dependencies, define Step contracts, expose blockers, and record a recipient's returned output reference and explicit completion declaration for sequencing. It must not reassess semantic quality, execute or summarize a recipient method, invent a child result, compare solutions, review an artifact, author a Skill, design or refactor code, or implement the route. Invocation happens separately after routing.

## Select Recipients

Read `references/skill-map.md` and confirm current Skill metadata before treating a capability as installed.

- exact child: one clearly owned method
- category parent: multiple methods in one category, unclear child ownership, or coordination of returned child results
- this parent: multiple categories or unclear category ownership
- `missing-capability`: declared but unavailable; do not simulate or substitute it
- `unsupported`: outside the declared hierarchy unless another installed Skill clearly owns it

A broad route may mix exact children and category parents. Send each clearly owned method directly to its exact child even when other Steps cross categories; do not insert a category parent merely because the overall request is broad.

Each Step has exactly one recipient. When an exact child is known, name that child alone; never write a composite parent/child recipient.

The installed `references/skill-map.md` is authoritative for recipients in this suite. Do not substitute a similarly named external rules, planning, or review Skill when an exact mapped child owns the requested result.

Capability discovery is part of the recipient Step. Do not create a second Step merely to report that recipient's missing child capability.

Category ownership:

- `design-core`: purpose-goal-means, quality attributes, context interpretation
- `domain-design`: model boundaries, language, hidden concepts, invariants, data integrity
- `code-design`: encapsulation, interfaces and branching, naming, abstraction
- `refactoring`: debt priority and behavior-preserving restructuring
- `organization`: design learning and validated knowledge scaling
- matching review Skill: review a supplied artifact for its declared concern

`skill-creator` owns the decision and workflow to create or revise a Skill. When it needs category placement evidence, this parent returns only the existing design-capability route and gaps. Skill creation, names, trigger thresholds, files, commands, examples, and authoring acceptance are not Steps in this route.

Route only concerns requested now. Match a review Skill by its declared concern, not by the generic verb "review". In particular, use `review-changeability` only for scenario-specific change propagation or modifiability review; do not add it to a class-responsibility or design review unless that concern is requested.

An installed routing parent does not imply that its planned children exist. Whenever the Recipient is a category parent, use this interface regardless of the user's eventual goal:

```text
Objective: route the category concern to the smallest declared child workflow
Expected output: child route with capability states, dependencies, completion conditions, and one next child; or an explicit missing/unsupported-capability report
Completion condition: the category parent returns an output reference and explicitly declares its own route completion; this parent does not reassess or restate child-route semantics
```

Never replace this interface with the detailed design, refactoring plan, workshop, or other result an absent or unexecuted child would produce. Re-enter this parent with the returned route before advancing across categories. Apply this interface equally to every category parent.

Gotcha:

- Wrong: Recipient is `code-design`; Objective, Expected output, or Completion says class responsibilities and interfaces are decided.
- Right: Recipient is `code-design`; Objective is to route that category concern, Expected output is its child route or capability-gap report, and Completion records its output reference and explicit route-completion declaration.

Apply the same distinction to `design-core`, `domain-design`, `refactoring`, and `organization`, even when the user's eventual goal is the detailed child artifact.

## Order Work

Order only dependencies that affect later meaning or acceptance:

- resolve purpose or context uncertainty before dependent ownership or criteria
- resolve domain purpose, model applicability, language, or invariants before code structure when they determine responsibilities
- establish target responsibilities and observable behavior before behavior-preserving restructuring when they are unclear
- put another requested practice-definition or evidence-producing Step before organization scaling only when the scaling decision consumes that result; otherwise let `design-knowledge-scaling` qualify supplied evidence

Do not add generic research, review, approval, persistence, or implementation Steps. Include one only when requested or required by supplied governance; never invent its owner or authority.

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

Write Objective and Expected output from the request and recipient's production contract, using only the recipient's declared artifact type. Completion requires an actual output reference and the recipient's explicit declaration that its own completion condition is satisfied. Do not copy the child's semantic criteria into the route or predict its conclusions. Do not add unsupplied domain examples, entities, model splits, responsibilities, technologies, tactics, solution components, reviewers, or candidate conclusions. Missing evidence remains an input or question.

Use artifact language, never predicted child conclusions: write `evidence-backed boundary report`, not `relevant boundaries discovered`; write `invariant report with evidence and status`, not `complete invariant set`; write `responsibility design record`, not `responsibility split`. Keep the exact lowercase state vocabulary from the Step Contract. `Next Step` is one report-level field, never a label repeated for each row.

For a routing parent, Expected output is its child route or capability-gap report. For any recipient, Completion records only the returned output reference and that recipient's explicit completion declaration; semantic assessment stays with the recipient.

Consider only the first unfinished Step whose predecessors are complete: mark it `blocked` when a missing capability, dependency, evidence item, or authority prevents its output; otherwise mark it `ready`. Mark every other incomplete Step `not-started` and report its known gaps separately. Use `deferred` only when an evidenced owner postpones an otherwise valid first eligible Step to a named event. A Step is `complete` only after the recipient returns an output reference and explicitly declares its own completion condition satisfied.

## Output And Completion

Return a concise report with:

1. routing decision and scope
2. normalized input contract
3. ordered Steps, each with objective, recipient and capability, contract input and dependencies, expected output, completion condition, and state
4. exactly one next Step or `none`
5. blockers, capability gaps, and material unknowns
6. re-entry condition

Show the normalized five-field input. Present Steps as a table or structured prose appropriate to the request, but keep objective, recipient and capability, input and dependencies, expected output, completion condition, and state distinguishable. Do not return an ordered item as a Step when any of those meanings is absent.

The route is complete when the smallest recipient set and acyclic order are explicit; every Step has input, output, completion, and state; one next Step or none is identified; and no recipient method was performed. A complete route may remain blocked or advisory.

Return the routing artifact and stop. Do not continue into the ready Step, append an implementation plan, or turn route completion into permission to perform child work.

Before returning, self-correct any Step that lacks a contract input or dependency, expected output, completion condition, capability state, or lifecycle state. Then check that a narrow request bypassed unnecessary parents, category parents were treated as routers, Purpose and Actor are traceable or `unknown`, Objective/Expected output/Completion do not contain invented child conclusions, no unavailable method was simulated, and no solution or Skill-authoring detail came from the parent. Do not emit this check as a gate matrix or review record.

## References

- `references/skill-map.md`: hierarchy, ownership, and declared availability
- `references/source-ledger.md`: source provenance and limits for maintenance
- `references/source-to-rule-map.md`: production-rule traceability for maintenance
