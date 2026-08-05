---
name: quality-attributes
description: Turn stakeholder goals, vague non-functional concerns, SLOs, thresholds, and quality requirements into evidence-backed quality concerns, six-part scenarios, response measures, priority provenance, and interaction questions before design selection. Use directly for performance, reliability, security, usability, compatibility, modifiability, portability, safety, or other quality framing; when "good", "fast", or "reliable" lacks observable meaning; or when quality priorities or interactions may be assumed. This Skill frames quality evidence only; it does not invent thresholds, silently map taxonomy versions, run QAW or ATAM, select architectures, tactics, or technologies, authorize implementation, or write code.
---

# Quality Attributes

State which quality matters, for whom, under what conditions, and how its response would be judged. Preserve incomplete concerns instead of filling them with industry defaults.

## Input Contract

Reconstruct the smallest useful frame:

```text
Actor: stakeholder, beneficiary, domain owner, or responsible party whose quality intent matters
Purpose: intended stakeholder state, action aim, or target
Context: system, environment, event, and boundary in which the concern applies
Constraints: supplied binding rules, limits, and their provenance
Evidence: supplied or directly referenced concerns, scenarios, measures, priorities, observations, and decisions
```

Unknown fields do not prevent diagnosis. Keep them unknown when they affect interpretation or downstream use. Do not infer Actor from the requester, stimulus source, reviewer, tool operator, or decision authority. Do not infer Purpose from a quality label, threshold, architecture, technology, or analysis activity.

Use current-request evidence and explicitly designated artifacts. Preserve original wording, source, authority, scope, and version when material. A bare artifact ID or unavailable pointer does not supply its omitted contents.

## Source Authority

MinoDriven supplies the primary design intent: an unspecified request for "good" work is ambiguous, so the quality to improve must be explicit and tied to Purpose. ISO/IEC 25010:2023 is a current product-quality reference model, not a license to assign an unstated taxonomy or unavailable definition. SEI Quality Attribute Workshop material supplies business-goal trace and the six-part quality scenario structure. SEI ATAM defines later architecture evaluation and therefore the boundary this Skill must not cross.

Read `references/method.md` for scenario, response-measure, priority, or interaction mechanics. Read `references/source-ledger.md` and `references/source-to-rule-map.md` only when checking or revising a normative rule.

## Responsibility Boundary

This Skill may:

- preserve and clarify supplied quality wording
- trace a concern to evidenced Actor, Purpose, business goal, or Goal
- form or refine a six-part quality scenario
- expose missing response-measure dimensions without inventing them
- preserve evidenced priorities and decision provenance
- distinguish observed requirement conflict, interaction hypothesis, and no evidenced interaction
- produce quality criteria and questions for later design or evaluation

It must not define Purpose or stakeholder priority without evidence; claim that a QAW, vote, consensus process, ATAM, or architecture evaluation occurred; invent measurements or thresholds; select or assess architectures, tactics, technologies, or implementations; claim an architecture risk, sensitivity point, or tradeoff point; approve a quality baseline; persist an artifact; or write code.

## Workflow

1. Normalize Actor, Purpose, Context, Constraints, and Evidence without invention.
2. Register each material supplied quality concern in its original wording. Keep source and version visible. Map it to a named taxonomy only when current evidence supplies the model/version or the user explicitly requests a labeled candidate mapping. Do not add unsupplied characteristics merely to complete a quality inventory.
3. Trace each concern to an evidenced Actor and Purpose, business goal, or Goal when available. Missing trace remains a gap; it does not justify an invented stakeholder or priority.
4. For each requested scenario, keep these six SEI components distinct:
   - source of stimulus: entity that generates the stimulus
   - stimulus: condition or event affecting the system
   - environment: operating condition when it occurs
   - artifact stimulated: affected system or element
   - response: system behavior following the stimulus
   - response measure: rule for judging that response

   Actor or stakeholder is not automatically the source of stimulus. Purpose or Goal is not the response measure.
5. Preserve a supplied component exactly. Mark a material missing component unknown rather than filling it from a quality adjective, technology, generic example, or common industry practice. A vague concern may remain a raw concern without forcing six empty rows.
6. Assess whether the response measure is evaluable for the requested use. Check only dimensions that can materially change the judgment:
   - measured response or property
   - unit
   - threshold or comparison rule
   - workload, event, or environment
   - aggregation, percentile, or observation window
   - observation method or evidence artifact
   - applicable scope, version, and acceptance authority

   Do not require every dimension universally. When a material dimension is absent, record the gap and ask a neutral question. Do not offer a menu of metrics or sample thresholds unless the user explicitly requests alternatives; label any such alternative as an analyst proposal.
7. Preserve priority only from supplied evidence such as an authorized decision, stakeholder ranking, actual vote, risk ranking, program priority, or accepted record. Do not infer priority from prose order, urgency words, taxonomy category, or analyst concern.
8. Examine interactions only when requested or evidenced:
   - observed requirement conflict: current evidence shows that two requirements or outcomes cannot both hold in the stated scope
   - interaction hypothesis: evidence supplies a shared variable or mechanism, or the user asks for possible interaction; return it as a question
   - none evidenced: no interaction item is supported; this is not proof that none exists

   Do not rename these as architecture risks, sensitivity points, or tradeoff points.
9. Keep named products, architectures, technologies, and tactics outside scenario facts when they are only candidates for later selection. Preserve the comparison request and quality criteria, but do not infer candidate characteristics or recommend one.
10. Return the quality record, material gaps, and only the handoffs needed for the user's requested next decision. Do not create a handoff for a missing input unless that input can change the requested disposition or next decision.

## Handoffs

Use the smallest installed recipient and do not simulate missing capability:

- `purpose-goal-means`: missing Purpose or Goal trace blocks the requested quality decision
- `context-interpretation`: a material term, Actor, environment, boundary, or scope meaning must be settled
- `review-changeability`: code, diff, design, or refactor must be reviewed for scenario-specific modifiability
- `route-design-work`: architecture or tactic selection, implementation, artifact approval, or several design categories must be coordinated

Complete the quality framing first. For any handoff, state the recipient, why it is needed, what must return, and when this analysis can resume. Add evidence needs or exclusions only when they are material. Pass quality criteria and scenarios, never fabricated ATAM findings or candidate evaluations.

## Output Contract

Return a concise report containing:

1. disposition and reconstructed input frame
2. supplied quality concern, source/version status, and evidenced Purpose or Goal trace
3. requested quality scenarios with the six components that are known
4. response-measure gaps and neutral evidence questions
5. evidenced priority and interaction records when relevant
6. required handoffs and one next action or `none`

Use a compact table or prose according to the request. Omit empty optional sections. A vague one-line concern may need only its preserved wording, material unknowns, and one question. Do not emit Skill-maintenance, admission, release, reviewer, persistence, projection, hash, or evaluation records during ordinary use.

## Self-Review And Completion

The analysis is complete when every requested material quality concern is represented or explicitly unresolved; each scenario component, measure, priority, and interaction claim traces to evidence; material Purpose, context, authority, scope, version, and observation gaps are visible; and required handoffs can be executed without this Skill performing downstream design.

Before returning, verify that Actor and stimulus source are distinct, Purpose and response measure are distinct, no threshold or taxonomy mapping was invented, no priority or interaction was inferred from labels alone, candidate technology facts were not invented, and no QAW, ATAM, architecture finding, design selection, approval, persistence, or implementation was claimed.

Completion does not imply that a scenario is refined, a measure is acceptable, a priority is authorized, qualities interact, or design work is ready.

## References

- `references/method.md`: scenario, measure, priority, and interaction mechanics
- `references/source-ledger.md`: source provenance and authority limits
- `references/source-to-rule-map.md`: production-rule traceability
