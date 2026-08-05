---
name: data-destruction-analysis
description: Challenge one scoped state-changing use case or domain model with applicable invalid or contradictory values or operation sequences to reveal candidate integrity constraints. Use directly when the user asks how data could be corrupted, made inconsistent, or made harmful through a bounded mutation path. Do not use for a general DDD review, exhaustive model-completeness audit, formal invariant design, security penetration testing, distributed-failure architecture, implementation, or production-data probing.
---

# Data Destruction Analysis

Produce a bounded destruction-probe report. Prefer reasoned analysis or isolated supplied evidence; do not execute destructive operations.

## Input Contract

```text
Actor:
Purpose:
Context:
Constraints:
Evidence:
Subject and state-changing use case:
Valid baseline state:
Mutation path or entry point:
Requested recipient and decision:
```

- Preserve supplied wording, provenance, contradictions, and missing information. Mark absent fields `unknown`.
- Treat the baseline as authoritative only to the extent its source is supplied.
- Keep destructive ideas tied to the actor's purpose and plausible harm; do not generate Cartesian products of invalid values.
- Ask only when an unknown prevents bounding the state-changing use case, valid baseline, or requested artifact.

## Boundary

Analyze a small set of applicable invalid values, relationships, or operation sequences. Record the mutation path, reasoned or observed outcome, affected purpose, current prevention, exposed gap, and candidate integrity constraint.

Do not enumerate every writer, reader, API, batch, migration, or failure mode. Do not analyze security threats, time, concurrency, retries, atomicity, caches, distributed failures, or transaction design. Do not perform remediation, test implementation, migration, production-data search, or destructive execution. Candidate constraints are discoveries, not approved invariants.

## Workflow

Read `references/probe-contract.md`, then:

1. Bound the purpose, subject, state-changing use case, baseline, mutation path, recipient, and decision.
2. Identify what corruption, contradiction, or user harm is plausible from supplied evidence.
3. Select a proportionate set of probes. Consider each only when applicable: invalid values, invalid relationships, invalid transitions, duplication or cardinality, and invalid deletion.
4. For each probe, describe the mutation and path, expected or observed result, affected actor or outcome, current prevention, evidence, and uncertainty.
5. Classify each selected probe as `prevented`, `invalid-state-exposed`, or `unknown`. Do not treat a thought experiment as an observed result.
6. Derive candidate integrity constraints from exposed or plausible gaps and identify material bypass observations without formalizing ownership or implementation.
7. Report untested paths and hand off candidate constraints for invariant work when needed.

## Output Contract

Return:

- normalized input, scope, baseline, and evidence limits;
- selected probes and why each is applicable;
- probe records with outcome classification and evidence status;
- affected actor, purpose, and harm;
- candidate integrity constraints and material bypass observations;
- excluded categories, unknowns, and untested paths;
- narrow handoffs;
- status: `probe-report-supported` or `probe-report-incomplete`.

Use `references/probe-contract.md`. Do not require a fixed category catalog, full writer inventory, score, YAML, test matrix, layered defenses, or release gate.

## Completion

Return `probe-report-supported` when the scope and baseline are explicit, every selected probe is classified with evidence, material candidate constraints and bypasses are visible, and unknown or untested paths are honest enough for the named recipient's decision.

A bare test definition may support an `unknown` prevention finding but never proves prevention. When the requested decision is whether prevention is currently established, that evidence-bounded `unknown` can complete a supported report without executing the test or creating a verification handoff. Missing execution makes the report incomplete only when the named decision itself requires observed proof.

Return `probe-report-incomplete` when a missing baseline, mutation path, or evidence distinction prevents that use. Completion does not require every probe category, implemented defenses, executed tests, or proof that the model is complete.

## Handoffs

- Hand off candidate consistency rules to `invariant-modeling` only when current Skills metadata shows it is available; otherwise re-enter `domain-design` with the required capability marked unavailable.
- Consume supplied invariants when they help select a destructive challenge; do not re-model them here.
- Hand off implementation, verification execution, or remediation to the relevant code-design, refactoring, or test capability only when requested.
- Re-enter `domain-design` when destructive findings must be ordered with other domain methods.
- Re-enter `domain-design` with an `unsupported` remainder when security, time, concurrency, retry, atomicity, cache, distributed-failure, or transaction analysis is requested and no declared capability owns it.

Keep recipients opaque and pass only the probe findings and evidence they require.

## References

- `references/probe-contract.md`: probe selection, evidence, and outcome schema. Read for every run.
- `references/source-ledger.md`: source claims and adoption limits.
- `references/source-to-rule-map.md`: production-rule traceability.
