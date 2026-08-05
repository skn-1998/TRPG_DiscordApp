# Destruction Probe Contract

Use this schema for selected, purpose-relevant probes only.

## Evidence Labels

- `supplied`: stated by the request or an identified authority;
- `observed`: directly shown by an execution result tied to the relevant revision and environment, or by a relevant log or data artifact;
- `reasoned`: expected from the supplied model or code without execution;
- `unknown`: not established.

Never label a reasoned outcome as observed.
A bare test definition records an expectation, not current behavior. Label it `supplied` when provided as an authority or `reasoned` when used to infer likely behavior; only a relevant execution result can support `observed`.

## Probe Selection

Choose the smallest set that can expose a material integrity gap in the bounded use case. Applicable probes may include:

- invalid scalar or missing value;
- contradictory relationship or cross-owner reference;
- duplicate or forbidden cardinality;
- invalid state transition or operation order;
- invalid deletion or removal.

These are prompts, not a coverage taxonomy. Do not add security, time, concurrency, retries, atomicity, cache, distributed-failure, or transaction categories. When one is requested, record it as excluded and hand it to `domain-design` or an evidenced owning capability. Supplied failure evidence may inform an in-scope operation-sequence probe, but it does not import the excluded analysis category.

## Probe Record

```text
Probe:
Why applicable to the purpose:
Valid baseline:
Mutation or operation sequence:
Mutation path or entry point:
Expected or observed outcome:
Evidence label and provenance:
Affected actor, purpose, and harm:
Current prevention or rejection evidence:
Finding: [prevented / invalid-state-exposed / unknown]
Candidate integrity constraint:
Material bypass or untested path:
```

A `prevented` finding applies only to the evidenced path. An `invalid-state-exposed` finding reports an observed or strongly reasoned gap and does not by itself establish the correct invariant or remediation.

## Safety And Execution Boundary

This Skill designs and analyzes probes. It does not execute them. If execution is separately requested, pass the probe and safety constraints to an appropriate test or implementation capability. Never infer permission to mutate production, shared, or valuable data.

## Candidate Constraint

Phrase a candidate constraint in domain terms and retain its evidence source, affected purpose, counterexample, and unknown authority. Do not assign a class, Aggregate, database constraint, transaction, retry policy, or monitoring layer here.

## Status Test

Use `probe-report-supported` when selected probes are bounded and honestly classified for the named decision. An `unknown` finding from a bare test definition can support a complete report when the decision asks whether prevention is established; do not require execution unless observed proof is itself the requested decision. Use `probe-report-incomplete` when the baseline, mutation path, or evidence status is too unclear for the named use. Unselected categories and untested paths do not automatically make a proportionate report incomplete.
