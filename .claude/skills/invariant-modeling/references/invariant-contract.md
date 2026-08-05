# Invariant Modeling Contract

Use this contract for one bounded subject. Empty fields do not create domain facts.

## Assertion Classification

- `invariant`: holds at every stated stable observation point during its stated validity interval;
- `precondition`: must hold before a specific operation is called;
- `postcondition`: must hold after a specific operation completes successfully;
- `input-validation`: checks representation, transport, or parsing rather than domain consistency;
- `environment-condition`: a non-domain operational assumption, such as resource availability or runtime configuration, that the model cannot establish;
- `cross-boundary-condition`: depends on a domain fact owned outside the bounded subject;
- `unresolved`: available evidence does not support classification.

Classify assertions, not whole source sentences. Split a compound statement by subject, operation, or observation point when its parts have different roles. One underlying rule may yield linked assertions, such as an input check, construction precondition, and stored-state invariant; do not discard one role to force a single label.

Do not classify an external domain fact as an environment condition. Preserve it as a cross-boundary candidate and classify its consistency timing as immediate, eventual, or unresolved from supplied authority.

An operation may temporarily violate an invariant internally if no violating state becomes externally observable and the invariant is restored at the required observation point. Do not use that precision to excuse partial persistence without evidence.

## Invariant Record

```text
Invariant statement:
Subject and context:
Actor and purpose protected:
Validity interval and observation points:
Supporting authority and evidence:
Falsifying state or sequence:
Business or user impact:
Facts required to evaluate it:
Protection-locus candidate and rationale:
Construction or mutation obligations:
Observable oracle:
Status: [evidence-supported / provisional / unresolved / contradicted]
```

The status describes evidence, not approval. A falsifier shows that the statement is meaningful; it does not prove that the invariant is complete or correct.

## Protection-Locus Reasoning

Prefer a locus that can observe the facts and prevent or reject the relevant state transitions. Record alternatives when facts or mutations span boundaries. Do not force all related data into one object or Aggregate merely to obtain a single owner.

For cross-boundary conditions, distinguish:

- immediate consistency required by supplied authority;
- an eventual outcome or reconciliation expectation;
- unresolved timing semantics.

Do not choose transactions, locks, messages, retries, or compensation in this Skill.

## Enforcement Obligations

Describe only what downstream design must preserve, such as:

- invalid construction must not expose an invalid subject;
- public state-changing operations must preserve or re-establish the invariant at the stated observation point;
- bypass paths remain a material unknown when evidence shows they exist.

These are analysis implications, not code or rollout tasks.

## Observable Oracle

State what evidence would distinguish preservation from violation. An oracle may be a domain observation, example, assertion condition, or existing test expectation. Do not require creation of a new test when the requested artifact is only the invariant model.

## Report And Outcome Test

Use `analysis-complete` when the requested classification or invariant model is evidence-aware and usable within its stated limit. Summarize the invariant outcome as `evidence-supported-invariant-present`, `candidate-invariants-only`, `no-invariant-identified`, or `contradictory-or-unresolved`. Use `analysis-incomplete` when a missing authority, meaning, fact, or timing boundary prevents the named decision.
