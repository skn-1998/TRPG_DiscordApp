---
name: invisible-driven-modeling
description: Discover evidence-backed, purpose-specific domain-concept candidates hidden by one visible physical noun or universal model. Use directly when a Product, User, Account, equipment, or similar visible object appears to combine different actors, purposes, problems, ownership, rights, responsibilities, agreements, events, or relationships. Do not use for generic domain modeling, Bounded Context decisions, invariant design, tactical type selection, code extraction, or implementation.
---

# Invisible Driven Modeling

Test one visible physical-noun or universal-model assumption and return purpose-specific hidden-concept candidates. Do not turn candidates into approved models or code.

## Input Contract

```text
Actor:
Purpose:
Context:
Constraints:
Evidence:
Visible noun or model surface:
Requested recipient and decision:
```

- Preserve supplied wording, provenance, alternatives, and missing information. Mark absent fields `unknown`.
- Treat code names, database tables, screens, and physical objects as evidence surfaces, not proof of a domain concept.
- A discovered phrase remains a candidate until domain evidence establishes its meaning.
- Ask only when an unknown prevents identifying the physical-noun assumption, scope, or requested artifact.

## Boundary

Analyze how the supplied visible noun is interpreted under evidenced actor-purpose cases. Surface hidden problems, ownership, rights, responsibilities, agreements, events, relationships, and other non-physical concepts only when relevant.

Do not create a class per actor, workflow step, state, or screen. Do not select a Bounded Context, Aggregate, Entity, Value Object, Policy, event-sourcing design, service, deployment unit, inheritance hierarchy, or migration plan. Do not rename or edit code.

## Workflow

Read `references/candidate-contract.md`, then:

1. Bound the visible noun, context, recipient, and decision. If the request is tactical classification only, return a boundary-only `unsupported` handoff to `domain-design` without a discovery status or a code-design substitute. For a mixed request, complete only the hidden-concept discovery and return the tactical remainder to `domain-design`.
2. Identify evidenced actor-purpose cases and the problem each purpose must solve.
3. For each case, describe the noun's purpose-specific interpretation and the information, behavior, and rules needed to address that problem.
4. Probe only applicable discovery signals: ownership, rights, responsibilities, agreements, abnormal cases, events, and relationships. Do not exhaust a checklist.
5. Form candidate hidden concepts. Tie every candidate to actor, purpose, problem, evidence, and consequential uncertainty.
6. Compare keeping interpretations together versus separating candidates using meaning, rules, lifecycle, and expected reasons for change. A purpose difference is evidence, not an automatic split.
7. Map only current elements material to the requested decision; leave unsupported elements unclassified.
8. Report downstream language, boundary, invariant, code-design, or refactoring needs without performing them.

## Output Contract

Return:

- normalized input and evidence limits;
- the physical-noun assumption tested;
- evidenced actor-purpose-problem cases;
- purpose-specific interpretations;
- hidden-concept candidates with evidence and alternatives;
- proportionate keep-together or separate considerations;
- material current-element observations, if supplied;
- unresolved questions and narrow handoffs;
- status: `discovery-supported` or `discovery-incomplete`.

For the tactical-only early exit, return normalized input, the unsupported requested capability, preserved evidence, and the `domain-design` handoff with status `unsupported`; do not imply that discovery ran.

Use `references/candidate-contract.md` for the candidate schema. Do not require a fixed candidate count, exhaustive symbol map, score, YAML record, or approval state.

## Completion

Return `discovery-supported` when the supplied evidence is represented, the physical-noun or universal-model assumption was tested, each reported candidate traces to an actor, purpose, problem, and evidence, alternatives and uncertainty are visible, and the named recipient or, when unknown, the requester can use the report without treating candidates as domain facts. This status may legitimately report `no-supported-candidate`.

Return `discovery-incomplete` when missing scope or evidence prevents that use. Completion does not approve a model, boundary, name, invariant, or implementation.

The tactical-only early exit is complete when the unsupported capability, preserved evidence, and `domain-design` handoff are explicit. It has status `unsupported`, not a discovery status.

## Handoffs

- Hand off term reconciliation to `ubiquitous-language`.
- Hand off model-applicability or context-boundary decisions to `bounded-context-discovery`.
- Hand off valid-state and consistency-rule work to `invariant-modeling`.
- Hand off target code design or behavior-preserving extraction to the relevant code-design or refactoring Skill.
- Re-enter `domain-design` when several domain methods must be ordered.

Keep recipients opaque; pass the candidates and evidence they require.

## References

- `references/candidate-contract.md`: evidence, candidate, and comparison rules. Read for every run.
- `references/source-ledger.md`: claims and adoption limits.
- `references/source-to-rule-map.md`: production-rule traceability.
