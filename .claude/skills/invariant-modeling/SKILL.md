---
name: invariant-modeling
description: Model or classify evidence-backed consistency rules for one bounded domain use case, model, entity, value, or aggregate. Use directly when a request asks what must remain true, which domain states are invalid, what conditions must hold before or after a specific domain operation, whether a supplied condition is domain consistency or another kind of check, or what model locus should protect an identified business consistency rule. Do not use for a generic domain-model review, full Design by Contract package, broad state-machine or completeness audit, destructive-probe campaign, implementation, or test creation.
---

# Invariant Modeling

Produce a bounded invariant model. Keep plausible rules provisional and do not implement enforcement.

## Input Contract

```text
Actor: who benefits from or uses the model
Purpose: stakeholder outcome or job to achieve
Context: business subject and scope
Constraints: binding business rules or limits
Evidence: supplied statements, examples, artifacts, observations, and decisions
Subject and use case:
Requested recipient and decision:
Candidate conditions, if any:
```

- Preserve supplied wording, provenance, conflicts, assumptions, and unknowns. Mark absent fields `unknown`.
- Do not infer Actor from the requester. Review, approval, implementation, and routing are workflow actions, not domain Purpose or Evidence.
- Treat a business constraint as domain fact only when its authority is supplied. A plausible rule inferred from code remains a candidate.
- Distinguish a stable domain condition from a transient intermediate state, input-format check, environmental assumption, precondition, or postcondition.
- Ask only when an unknown prevents bounding the subject or requested artifact.

## Boundary

State candidate invariants, validity intervals, falsifying states or sequences, business impact, required facts, protection-locus candidates, enforcement obligations, and observable verification oracles.

Do not prove model completeness, enumerate every writer or reader, choose a Bounded Context, create a giant Aggregate, turn every primitive into a Value Object, design a full transaction architecture, write assertions or tests, edit code, or claim formal proof.

## Workflow

Read `references/invariant-contract.md`, then:

1. Bound the purpose, context, subject, use case, and valid observation points.
2. Gather candidate conditions from supplied rules, examples, failures, tests, or destructive findings. Preserve source authority.
3. Decompose compound statements by subject, operation, and observation point. Classify each resulting assertion as invariant, precondition, postcondition, input validation, non-domain environment condition, cross-boundary condition, or unresolved. Preserve links among assertions derived from one underlying rule.
4. For a classification-only request, return the assertion, role, subject or operation, evidence status, and relationship to linked assertions; do not expand protection loci, enforcement obligations, or oracles unless required by the named decision.
5. For each material invariant candidate, express the condition over stable externally observable states and state its validity interval.
6. Provide at least one concrete falsifying state or sequence. Describe the affected actor or outcome from supplied Purpose, Constraints, and Evidence; keep impact `unknown` rather than inventing it. If no falsifier can be stated, keep the condition unresolved.
7. When the requested decision needs it, identify required facts and candidate protection loci from the state they observe and mutations they can control. Do not force unique ownership.
8. When material to the decision, record construction and public-mutation obligations and an observable oracle. Surface cross-boundary consistency uncertainty without designing the mechanism or a test suite.

## Output Contract

Return:

- normalized input, bounded subject, and evidence limits;
- classified, linked assertions; for a non-invariant condition, preserve its statement, subject or target operation, and evidence status without expanding a full contract;
- invariant records with evidence, validity interval, falsifier, and business impact;
- required facts and protection-locus candidates with rationale;
- analysis-level enforcement obligations and observable oracles;
- contradictions, unknowns, and narrow handoffs;
- invariant outcome: `evidence-supported-invariant-present`, `candidate-invariants-only`, `no-invariant-identified`, or `contradictory-or-unresolved`;
- report status: `analysis-complete` or `analysis-incomplete`, with its decision-use limit.

Use `references/invariant-contract.md`. Omit nonmaterial fields; do not add IDs, scores, coverage percentages, YAML, approval states, or a mandatory test matrix.

## Completion

Return `analysis-complete` when the subject and requested decision are bounded; each material source statement is decomposed where needed; every reported assertion preserves its role, evidence, and links; every modeled invariant has a validity interval and falsifier; and the invariant outcome accurately distinguishes supported invariants, candidates only, no identified invariant, or contradiction. Classification-only reports need not add protection or observation implications.

Return `analysis-incomplete` when missing authority, meaning, state facts, or observation boundaries prevent the named decision. State the smallest blocking uncertainty. A complete report may remain diagnostic-only; completion does not support a provisional invariant, prove completeness, or show that enforcement passes.

## Handoffs

- Re-enter `domain-design` when missing purpose, context meaning, model applicability, a full-contract request, or an unavailable domain capability needs routing.
- Consume integrity candidates from `data-destruction-analysis` when current Skills metadata shows it is available; return formalized invariants there only when a destructive recheck is requested. Otherwise re-enter `domain-design` with the required capability marked unavailable.
- Hand off implementation-oriented encapsulation or interface design through `code-design` when child selection or availability must be decided.
- Hand off bounded behavior-preserving implementation to `ai-assisted-refactoring` when requested.
- Re-enter `domain-design` when multiple domain methods require ordering.

For each material handoff, return recipient capability and current state, input artifact and evidence, expected output, completion condition, exclusions, and return condition. Keep recipients opaque and pass only the invariant artifact and evidence they require.

## References

- `references/invariant-contract.md`: condition classification and invariant schema. Read for every run.
- `references/source-ledger.md`: sources and adoption limits.
- `references/source-to-rule-map.md`: production-rule traceability.
