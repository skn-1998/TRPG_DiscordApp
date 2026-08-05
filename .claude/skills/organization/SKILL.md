---
name: organization
description: Route only software-design capability work that spans learning workshops and knowledge scaling, has unclear ownership, or makes one result control the other. Prefer one child directly. This parent selects recipients, orders dependencies, and records handoffs only; it never designs workshops, channels, Skills, policies, reviews, or rollout. Do not use for generic file, data, meeting, or company organization.
---

# Organization

Return a routing artifact for software-design learning or knowledge sharing. Do not perform a child's method.

## Input Contract

```text
Actor:
Purpose:
Context:
Constraints:
Evidence:
```

- Preserve supplied wording and provenance; mark absent information `unknown`.
- Do not infer Actor from the requester, a manager title, team name, or organization chart.
- Set Purpose only when evidence states an intended capability, outcome, or value for an actor. A request to learn, teach, run a workshop, roll out, scale, make a Skill, or use a named tool or format is work to perform or a candidate Means, not by itself the design-capability Purpose.
- Ask only when an unknown changes the recipient, participant or rollout boundary, authority, safety boundary, or next consequential decision.
- Expand all five fields for every recipient so it can run without this or another routing parent.

## Parent Boundary

The parent may classify supplied capability concerns, select available recipients, order dependent results, define handoff contracts, report gaps, and record a recipient's returned output reference and explicit completion declaration for sequencing.

Never invent a curriculum, exercise, rubric, practice, participant, facilitator, channel, owner, metric, tool, version policy, review gate, or rollout plan. Do not run a workshop, package knowledge, author a Skill, enact policy, or implement tooling. Report an unavailable selected recipient as `missing-capability`; do not imitate it.

## Select Recipients

Read `references/child-map.md`, then confirm availability from current Skills metadata.

- `design-learning-workshop`: identified practitioners need to develop a named software-design capability through practice on realistic or safely representative work and explanation or feedback.
- `design-knowledge-scaling`: a claimed software-design practice or slogan is being considered for reuse across teams, repositories, or tools; missing support may produce `no-dissemination-yet` rather than a parent-level gap.

Use one clear installed child directly. Use this parent for both methods, unclear ownership, coordination of returned results, or an explicit capability audit. Child absence alone does not make a narrow ordinary request trigger this parent.

Do not equate attendance, document count, installation, prompt length, or tool availability with improved design capability. They may be supplied observations, not conclusions.

Add a peer only when its output is requested or an actual returned result makes it control the next recipient. An explicit request for identified practitioners to learn a named capability, such as interface design, is enough to select workshop work; the name alone is not. Missing method sources or details remain child-input gaps unless defining or revising that practice is itself requested as a separate outcome. Missing evidence, participants, decisions, or permissions are gaps, not invented prerequisite steps. Keep peer internals opaque.

## Order Dependencies

When both children are selected:

1. Put workshop learning before scaling only when the requested scaling decision depends on evidence produced by that learning work.
2. Route directly to scaling whenever a reuse-fit decision is requested, including when the claimed practice may be not ready; do not require prior practice definition, usage evidence, or a universal pilot.
3. Return evidence from scaled use to learning or practice revision only when the request or observed result makes that feedback work necessary.
4. Put a requested knowledge-architecture result before `skill-creator` only when an actual Skill will consume that result.

Every step must produce the requested result or an artifact consumed by another selected step. Remove speculative downstream work. Do not add generic approval, review, implementation, rollback, adoption, or evaluation steps.

## Step Contract

```text
Step ID:
Objective:
Recipient and capability state:
Request contract: [Actor / Purpose / Context / Constraints / Evidence, each expanded; then recipient-specific deltas]
Required inputs and dependencies:
Expected output:
Completion condition:
State: [ready / blocked / not-started / complete]
```

- Consider only the first unfinished step in declared order whose predecessors are complete: mark it `blocked` when a missing capability, decision, permission, safety condition, or evidence item prevents its output; otherwise mark it `ready`.
- Mark every other incomplete step `not-started`; report its known gaps separately.
- Mark `complete` only when the recipient returns the expected output reference and explicitly declares that its completion condition is satisfied. Record that declaration; do not reassess the artifact's semantic quality in this parent.
- Do not make a recipient recover the common input from this parent artifact.

Do not embed workshop design, rollout design, authoring instructions, tests, review gates, or global readiness in a step.

## Output And Completion

Return the routing decision, normalized input, ordered steps, one next step or `none`, consequential gaps, and the result or event that should trigger rerouting.

Routing is complete when the smallest recipients, semantic order, contracts, next step, and consequential unknowns are explicit. A complete route may expose an unavailable child; it does not claim that learning, scaling, authoring, review, adoption, or implementation occurred.

Before returning, remove any step that performs a recipient's work, duplicates its internal route, or exists only to restate missing input.

## References

- `references/child-map.md`: child summaries and peer handoff conditions.
- `references/source-ledger.md`: source provenance and adoption limits.
- `references/source-to-rule-map.md`: production-rule audit.
