---
name: purpose-goal-means
description: Classify supplied conditions into Purpose, Goal, Means, binding Constraints, assumptions, and unresolved statements using evidence and traceability. Use directly when why, what success means, and how are mixed; when a technology or implementation may be premature; when Goal observability or Purpose-Goal-Means links are missing; or when Japanese natural-language rules need Purpose-Goal-Means separation. This Skill performs the classification and bounded handoffs only; it does not construct quality scenarios, resolve terminology, model the domain, design code, approve a baseline, or implement a Means.
---

# Purpose Goal Means

Separate why, observable achievement, and how. Preserve uncertainty instead of completing a persuasive story from plausible assumptions.

## Input Contract

Normalize once:

```text
Actor: stakeholder, beneficiary, domain owner, or responsible party whose intent matters
Purpose: intended stakeholder state, action aim, or target
Context: subject and boundary in which the statements apply
Constraints: supplied binding rules, limits, and their provenance
Evidence: supplied or directly referenced statements, artifacts, observations, and decisions
```

Use only current-request evidence and explicitly designated artifacts. Preserve unsupported values as `unknown`. Do not infer Actor from the requester, analyst, reviewer, document author, or decision authority. Do not infer Purpose or designed-system Context from a requested work activity. Do not infer Purpose from a problem statement, specification, constraint, technology, architecture, or code. An instruction to analyze, review, approve, persist, or implement is work to perform, not the design Purpose or Context.

Keep evidence source, authority, scope, version, and contradictions visible. A named but unavailable artifact is asserted but unreproduced; it does not supply its omitted content.

## Source Authority

MinoDriven controls the definitions and primary design intent: Purpose is the intended state or aim, Goal is the concrete condition for judging achievement, and Means is the method or tool used to achieve it. Supporting requirements and contract sources refine traceability, observability, alternatives, and precondition/postcondition/invariant terminology without supplying facts about the user's case.

Read `references/method.md` for ambiguous classification and trace tests. Read `references/source-ledger.md` and `references/source-to-rule-map.md` only when checking a normative claim or revising this Skill.

## Responsibility Boundary

This Skill may classify supplied statements, preserve provenance, expose material gaps and contradictions, distinguish candidate Means from evidenced decisions, and return bounded handoffs. It may report same-purpose fragmentation or mixed-purpose Means only from relevant supplied evidence.

It must not invent stakeholder intent, success conditions, verification, causal fit, alternatives, risks, authority, or implementation mechanics. It must not create quality scenarios, resolve material term meaning, design domain or code structures, select a Means, authorize implementation, persist a baseline, or execute a recipient's handoff work.

## Classification Model

| Kind | Test | Minimum evidence |
| --- | --- | --- |
| Purpose | Why is this state or aim sought? | attributable stakeholder intent with applicable scope |
| Goal | What condition shows achievement or binds valid behavior? | concrete condition, boundary, source, and supplied observation method or an explicit observability gap |
| Means | How might a Goal be met? | supplied method, tool, system, model, design, or code role; Goal link and fit may remain unknown |
| Constraint provenance | What makes a condition binding, where, and by whose authority? | supplied evidence that it is binding; authority or source and scope as available |
| Assumption | What is temporarily treated as true? | explicit assumption, owner, or review trigger as available |
| Unresolved | What cannot yet be classified without invention? | original statement and missing semantic evidence |

A desired state with unknown Actor or attribution is an unresolved `Purpose candidate`, not evidenced Purpose. Cross-reference quality concerns in that statement as incomplete Goal conditions rather than duplicating it as two established facts.

A binding constraint's condition is a Goal condition, while its authority, source, scope, and rationale remain Constraint provenance. Constraint is not a fourth peer beside Purpose, Goal, and Means. A label such as `condition` or `requirement` alone does not establish binding status. Without binding evidence, keep the content in its other classification and omit Constraint provenance.

Do not allocate placeholder model IDs for absent content. Preserve supplied IDs; otherwise identify only evidenced classified items.

## Workflow

1. Normalize Actor, Purpose, Context, Constraints, and Evidence.
2. Register every material supplied statement with provenance and contradiction state.
3. Classify each statement with the model above. A binding condition also records Constraint provenance. A generic activity with no evidenced Purpose, Goal, object, authority, or method role remains unresolved.
4. Trace every evidenced link in both directions: Purpose to Goal and Goal to Means. Record missing or conflicting links; never manufacture them. Stop when another abstraction level would not change this classification or its handoff, when decision authority ends, or when evidence ends. Do not continue `why` or `for example` reasoning into an invented hierarchy.
5. Assess each Goal's observability. Preserve a supplied test, inspection, audit, demonstration, analysis, or monitoring method. If none is supplied, record an observability gap rather than inventing one.
6. Preserve an evidenced `accepted`, `rejected`, or `deferred` Means decision when authority, scope, covered Goal and Means, and the decision are explicit; do not re-decide it. Record version or time when material, or a gap when its absence changes applicability. Otherwise keep the Means `candidate`.
7. Only when the request supplies relevant code, ownership, or structure evidence, record cohesion findings at the evidence level:
   - same-Purpose conditions or logic appear fragmented
   - one Means serves materially different evidenced Purposes
   - a possible bypass exists, without claiming an observed violation unless evidence reports one
8. Return the classification, gaps, readiness, and only the handoffs required by the request.

Quality words such as fast, secure, easy, or reliable are incomplete Goal conditions without a measurable context. Preserve the statement. When scenario or measure work is requested or blocks continuation, hand it to installed `quality-attributes`; otherwise report the capability gap. Do not construct the scenario here.

A named technology with no Goal remains a candidate Means with unknown fit. Do not infer its mechanism, benefits, risks, retention, delivery, fault tolerance, or suitability from general knowledge.

## Handoffs

Use the smallest installed recipient and do not simulate missing capability:

- `context-interpretation`: material term, actor, scope, or boundary meaning blocks classification
- `quality-attributes`: measurable quality scenario, priority, or interaction work
- `domain-design`: detailed domain rule, state validity, invariant ownership, or model work
- `code-design`: evidenced fragmented or mixed-purpose code responsibility
- `route-design-work`: multiple categories or implementation sequencing must be coordinated

Complete the Purpose-Goal-Means portion before handing off. For a required handoff that blocks continuation of work requested now, state recipient and capability, required input, expected output, completion condition, exclusions, state, and re-entry condition. For an advisory next action, state only recipient, reason, expected result, and exclusions. Preserve unknown owner or authority rather than inventing a generic role.

## Output Contract

Return a concise report containing:

1. disposition, scope, and normalized input contract
2. material evidence and contradictions
3. classified Purpose, Goal, Means, Constraint provenance, assumptions, and unresolved statements
4. evidenced Purpose-Goal-Means links and missing links
5. Goal observability and Means decision-readiness gaps
6. requested or evidenced cohesion findings without downstream redesign
7. required handoffs and one next action or `none`

Use tables or prose according to the request. Omit empty optional sections and Skill-maintenance or evaluation records.

## Self-Review And Completion

The analysis is complete when every material statement is classified or unresolved; each reported model item and link has evidence; trace, observability, contradiction, and authority gaps are visible; and required handoffs are usable. Before returning, verify that Actor and Purpose are evidenced or unknown, Goal and Means are distinct, verification and fit were not invented, structural risk was not reported as an observed failure, and no downstream design, decision, approval, persistence, or implementation was fabricated.

Completion does not imply that Purpose exists, a Goal is observable, a Means is suitable, or downstream work is ready. A complete analysis may conclude that evidence is insufficient or conflicted.

## References

- `references/method.md`: classification and trace mechanics
- `references/source-ledger.md`: source provenance and limits
- `references/source-to-rule-map.md`: production-rule traceability
