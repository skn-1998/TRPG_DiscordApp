# Legacy Purpose Analysis Contract

Use this schema as a reporting contract, not as a demand to fill unsupported fields.

## Evidence Discipline

For each material statement, label the basis as one or more of:

- `supplied`: stated by the user or an authoritative supplied artifact;
- `observed`: directly visible in code, tests, logs, callers, or history;
- `inferred`: a conclusion drawn from supplied or observed evidence;
- `unknown`: not established by available evidence.

Code structure can reveal dependencies and repeated change, but it cannot by itself establish whose purpose a concept serves. Keep alternative interpretations when evidence supports more than one.

## Purpose Hypothesis

```text
Hypothesis ID:
Actor:
Desired outcome:
Domain meaning:
Observed responsibilities or members:
Supporting evidence:
Counterevidence:
Consequential unknowns:
Confidence basis: [not a numeric score]
```

Prefer an evidence description over a numeric confidence score. A class name, table name, or physical object is not an actor or purpose.

## Behavior Inventory

Classify only against a supplied authority:

```text
Behavior or public obligation:
Classification: [must-preserve / intentional-change / unknown]
Evidence and provenance:
Affected purpose hypotheses:
Conflict or gap:
```

`must-preserve` means the supplied authority requires preservation. It does not mean the current behavior is desirable. `intentional-change` belongs outside a behavior-preserving split unless separately routed.

## Member Classification

```text
Member, state, rule, or dependency:
Classification: [purpose-hypothesis-id / shared-candidate / infrastructure / unknown]
Evidence:
Reason it changes:
Open question:
```

Do not use a member count or similarity score as a purpose decision.

## Boundary Candidate

```text
Boundary ID:
Purpose hypothesis served:
Responsibilities included:
State owned or observed:
Public obligations preserved:
Dependencies required:
Excluded responsibilities:
Cross-boundary interactions:
Evidence:
Risks and unknowns:
```

A boundary is a hypothesis until its domain meaning and behavior obligations have adequate evidence.

## Shared-Logic Decision

Before proposing commonization, compare:

1. the actor and desired outcome;
2. semantic meaning, including units and lifecycle;
3. public or domain contract;
4. expected reason and cadence of change.

Classify as `shared`, `purpose-specific`, or `unknown`. Surface duplication as a possible cost, but do not make visual similarity override purpose.

## Sequencing Considerations

Report only the considerations needed by the requested recipient:

- a direct separation may be plausible when behavior obligations and dependencies are bounded;
- a parallel or incremental path may be plausible when callers can be redirected through an established seam;
- no path is recommended when the necessary behavior or dependency evidence is absent.

Do not expand these considerations into implementation tasks, required tests, rollout stages, ownership, approval, or rollback policy. Those belong to a requested downstream plan.

## Status Test

Use `analysis-supported` when another person or Skill can make the named next decision, or apply the supplied Purpose when no next decision is named, without treating an inference as fact. Otherwise use `analysis-incomplete` and name the smallest missing evidence or interpretation that blocks that use.
